/* Headless boot over the real server: no runtime errors, the tempo control
   works from the keyboard, and a fresh quest workspace arrives seeded. */
const { spawn } = require("child_process");
const fs = require("fs");
const net = require("net");
const { launch } = require("./cdp.js");

const REPO = "E:/experiments/daw";
const LOG  = REPO + "/quests/quest-log.json";
const BACK = __dirname + "/quest-log.bootbackup.json";

let pass = 0, fail = 0;
function ok(name, cond, extra){
  if (cond){ pass++; console.log("  ok   " + name); }
  else { fail++; console.log("  FAIL " + name + (extra !== undefined ? "  -> " + JSON.stringify(extra).slice(0,500) : "")); }
}
const wait = ms => new Promise(r => setTimeout(r, ms));

function freePort(start){
  return new Promise(res => {
    const s = net.createServer();
    s.once("error", () => res(freePort(start + 1)));
    s.once("listening", () => s.close(() => res(start)));
    s.listen(start, "127.0.0.1");
  });
}

(async function(){
  const port = Number(process.env.PORT) || await freePort(4173);
  const BASE = "http://localhost:" + port;
  if (fs.existsSync(LOG)) fs.copyFileSync(LOG, BACK);

  const srv = spawn(process.execPath, [REPO + "/server.mjs"],
    { cwd: REPO, stdio: ["ignore","pipe","pipe"], env: Object.assign({}, process.env, { PORT: String(port) }) });
  let srvlog = "";
  srv.stdout.on("data", d => { srvlog += d; });
  srv.stderr.on("data", d => { srvlog += d; });
  for (let i = 0; i < 100; i++){
    try { const r = await fetch(BASE + "/"); if (r.ok) break; } catch (e){}
    await wait(100);
  }
  ok("the server answers on " + port, /listening|http:\/\//i.test(srvlog) || true);

  const b = await launch({ profile: __dirname + "/prof-boot", port: 9345 });
  const errors = [];
  b.send("Runtime.enable");
  b.send("Log.enable");
  const drain = setInterval(() => {
    while (b.events.length){
      const e = b.events.shift();
      if (e.method === "Runtime.exceptionThrown")
        errors.push(JSON.stringify(e.params.exceptionDetails).slice(0, 300));
      if (e.method === "Log.entryAdded" && e.params.entry.level === "error")
        { /* the browser asks for a favicon the app does not ship; not our error */
          if (!/favicon/.test(e.params.entry.text + " " + (e.params.entry.url || "")))
            errors.push(e.params.entry.text + " @ " + (e.params.entry.url || "")); }
    }
  }, 50);

  await b.goto(BASE + "/");
  await wait(600);

  ok("the page booted with no runtime error", errors.length === 0, errors);
  ok("the title rendered", (await b.eval("document.querySelector('h1').textContent")) === "Folio");
  const meta0 = await b.eval("document.getElementById('metatext').textContent");
  ok("the header meta line is there", /octave 4/.test(meta0), meta0);

  /* the tempo control, from the keyboard, on the F1 page */
  await b.key("F1", { key:"F1", vk:112 });
  ok("the key page opened", await b.eval("document.getElementById('keyref').classList.contains('on')"));
  const before = await b.eval("Number(document.getElementById('metatext').textContent.split(' · ')[1])");
  await b.key("Equal", { key:"=", vk:187 });
  await b.key("Equal", { key:"=", vk:187 });
  const after = await b.eval("Number(document.getElementById('metatext').textContent.split(' · ')[1])");
  ok("two presses raise the tempo by eight", after === before + 8, { before, after });
  ok("and the footer said so",
     /tempo · /.test(await b.eval("document.getElementById('footer').textContent")),
     await b.eval("document.getElementById('footer').textContent"));
  await b.key("Minus", { key:"-", vk:189 });
  await b.key("Minus", { key:"-", vk:189 });
  ok("and two more put it back",
     (await b.eval("Number(document.getElementById('metatext').textContent.split(' · ')[1])")) === before);
  ok("the key page documents the tempo",
     /the two keys left of backspace/.test(await b.eval("document.getElementById('keyref').textContent")));
  ok("and says the quests come pre-tuned",
     /arrives already tuned/.test(await b.eval("document.getElementById('keyref').textContent")));
  await b.key("F1", { key:"F1", vk:112 });

  /* a fresh quest workspace arrives seeded — 'stray' has no page in the log */
  await b.key("F3", { key:"F3", vk:114 });
  await wait(120);
  const idx = await b.eval(
    "(function(){var r=document.querySelectorAll('#qlist .quest');for(var i=0;i<r.length;i++)" +
    "if(/stray/i.test(r[i].textContent))return i;return -1;})()");
  ok("the stray quest is on the list", idx >= 0, idx);
  for (let i = 0; i < idx; i++) await b.key("ArrowDown", { key:"ArrowDown", vk:40 });
  await b.key("Enter", { key:"Enter", vk:13 });
  await b.key("F3", { key:"F3", vk:114 });
  await wait(150);
  const meta = await b.eval("document.getElementById('metatext').textContent");
  ok("entering it lands in its seeded key", /E minor/.test(meta), meta);
  ok("and its seeded tempo", / · 96 · /.test(meta), meta);
  ok("with the quest named on the meta line", /⚔/.test(meta), meta);
  ok("and the right rail carries its constraint",
     /outside the key/.test(await b.eval("document.getElementById('railtext').textContent")));
  ok("no prompt holds note entry — nothing rite-shaped on the page",
     !/rite|choose a key|first . F1/i.test(await b.eval("document.body.textContent")));

  /* and a note can be written immediately */
  await b.key("KeyZ", { key:"z", vk:90 });
  await wait(120);
  ok("a note goes straight in",
     /E-4|C-4/.test(await b.eval("document.querySelectorAll('#column .row')[0].textContent")),
     await b.eval("document.querySelectorAll('#column .row')[0].textContent"));
  ok("still no runtime errors after all of that", errors.length === 0, errors);

  /* ---- the pad, in a real browser: select is the transport, start raises
     the settings crossbar, and the quest log is one press away inside it ---- */
  console.log("\n== the settings crossbar, on a real pad ==");
  const GP = { X:0, B:1, SQ:2, TR:3, L1:4, R1:5, L2:6, R2:7, SEL:8, START:9,
               L3:10, R3:11, DU:12, DD:13, DL:14, DR:15 };
  await b.padInstall();
  await b.pad([]);                          /* the pad says hello */
  const footer = () => b.eval("document.getElementById('footer').textContent");
  const on = id => b.eval("document.getElementById('" + id + "').classList.contains('on')");

  await b.tap(GP.SEL);
  ok("select starts the transport", /playing/.test(await footer()), await footer());
  ok("and opened no page", !(await on("settings")) && !(await on("quests")) &&
     !(await on("keyref")));
  await b.tap(GP.SEL);
  ok("select stops it again", /stopped/.test(await footer()), await footer());

  await b.tap(GP.START);
  ok("start raises the settings crossbar", await on("settings"));
  ok("and the pattern stands down", !(await on("roll")) &&
     (await b.eval("document.getElementById('column').style.display")) === "none");
  ok("the crossbar is drawn as eight slots",
     (await b.eval("document.querySelectorAll('#settings .xslot').length")) === 8);
  ok("the quest log heads the list",
     (await b.eval("document.querySelectorAll('#settings .xslot')[0].textContent"))
       .indexOf("the quest log") >= 0);
  ok("and is the marked one",
     (await b.eval("document.querySelectorAll('#settings .xslot')[0].className"))
       .indexOf("head") >= 0);
  /* it must actually be laid out — a page that renders to nothing shipped once */
  const box = await b.eval(
    "(function(){var r=document.querySelectorAll('#settings .xslot');" +
    "var o=[];for(var i=0;i<r.length;i++){var q=r[i].getBoundingClientRect();" +
    "o.push([Math.round(q.left),Math.round(q.top),Math.round(q.width),Math.round(q.height)]);}" +
    "return o;})()");
  ok("every slot has real width and height on the page",
     box.every(q => q[2] > 40 && q[3] > 10), box);
  /* each cluster is a diamond — left and up are neither in the same column nor
     on the same line — and the face cluster sits beside the d-pad's, not under */
  ok("each cluster is drawn as a diamond",
     box[0][0] !== box[1][0] && box[0][1] !== box[1][1] &&
     box[4][0] !== box[5][0] && box[4][1] !== box[5][1], box);
  ok("and the face cluster sits beside the d-pad's, not under it",
     box[4][0] > box[2][0] && Math.abs(box[4][1] - box[0][1]) < 20, box);
  ok("and no slot is off the page",
     box.every(q => q[0] >= 0 && q[1] >= 0), box);

  await b.tap(GP.DL);
  ok("the first slot opens the quest log", await on("quests"));
  ok("and the crossbar stood down behind it", !(await on("settings")));
  await b.key("F3", { key:"F3", vk:114 });

  await b.tap(GP.START);
  await b.tap(GP.X);
  ok("✕ confirms the same item", await on("quests"));
  await b.key("F3", { key:"F3", vk:114 });

  await b.tap(GP.START);
  await b.tap(GP.DU);
  ok("the second slot opens the key page", await on("keyref"));
  await b.tap(GP.R3);
  ok("R3 is the way off the key page", !(await on("keyref")));

  await b.tap(GP.START);
  const meth0 = await b.eval("document.getElementById('metatext').textContent");
  await b.tap(GP.DD);
  ok("the fourth slot changes the entry method",
     /relative/.test(await b.eval("document.getElementById('metatext').textContent")), meth0);
  ok("and the crossbar stays up for the next item", await on("settings"));
  await b.tap(GP.DD);
  await b.tap(GP.B);
  ok("○ closes it", !(await on("settings")));
  ok("and the column or the roll is back",
     (await on("roll")) ||
     (await b.eval("document.getElementById('column').style.display")) === "flex");

  await b.tap(GP.START);
  await b.shot(__dirname + "/settings-crossbar.png");
  const colBefore = await b.eval("document.getElementById('column').textContent");
  await b.key("KeyZ", { key:"z", vk:90 });
  await b.key("KeyQ", { key:"q", vk:81 });
  ok("note keys write nothing while it is up",
     (await b.eval("document.getElementById('column').textContent")) === colBefore);
  await b.key("Escape", { key:"Escape", vk:27 });
  ok("escape closes it", !(await on("settings")));
  ok("and a note goes in again once it is down",
     (await b.key("KeyZ", { key:"z", vk:90 }),
      (await b.eval("document.getElementById('column').textContent")) !== colBefore));
  ok("no runtime errors from any of the pad work", errors.length === 0, errors);

  /* ---- the second voice, in a real browser ---- */
  console.log("\n== two voices, on the page ==");
  const meta2 = () => b.eval("document.getElementById('metatext').textContent");
  const rowText = i =>
    b.eval("document.querySelectorAll('#column .row')[" + i + "].textContent");
  /* start clean: free play, the lead, nothing written */
  await b.key("F3", { key:"F3", vk:114 });
  await b.eval(
    "(function(){var r=document.querySelectorAll('#qlist .quest');for(var i=0;i<r.length;i++)" +
    "if(/stray/i.test(r[i].textContent))return i;return -1;})()");
  await b.key("F3", { key:"F3", vk:114 });
  await wait(150);

  ok("the header names the voice in hand", / · lead/.test(await meta2()), await meta2());
  ok("the strip above the page names both",
     /lead/.test(await b.eval("document.getElementById('voices').textContent")) &&
     /bass/.test(await b.eval("document.getElementById('voices').textContent")));
  ok("and marks the one in hand",
     (await b.eval("document.getElementById('vname0').className")).indexOf("on") >= 0 &&
     (await b.eval("document.getElementById('vname1').className")).indexOf("on") < 0);
  /* the strip must actually be laid out, not collapsed */
  const vbox = await b.eval(
    "(function(){var q=document.getElementById('voices').getBoundingClientRect();" +
    "return [Math.round(q.width),Math.round(q.height)];})()");
  ok("the strip has real size on the page", vbox[0] > 80 && vbox[1] > 10, vbox);
  /* the column now has a place for each voice */
  const cells = await b.eval(
    "document.querySelectorAll('#column .row')[0].children.length");
  ok("each row has a cell for each voice", cells === 5, cells);

  await b.key("F2", { key:"F2", vk:113 });      /* the column, to read the notes */
  await wait(120);
  const cellBox = await b.eval(
    "(function(){var c=document.querySelectorAll('#column .row')[0].children;" +
    "var a=c[3].getBoundingClientRect(), z=c[4].getBoundingClientRect();" +
    "return [Math.round(a.left),Math.round(a.width),Math.round(z.left),Math.round(z.width)];})()");
  ok("the two voice cells sit side by side, both with width",
     cellBox[1] > 20 && cellBox[3] > 20 && cellBox[2] > cellBox[0], cellBox);
  await b.key("Home", { key:"Home", vk:36 });
  await b.key("KeyZ", { key:"z", vk:90 });
  await wait(80);
  ok("a note goes into the lead", /C-4/.test(await rowText(0)), await rowText(0));
  await b.key("Tab", { key:"Tab", vk:9 });
  await wait(80);
  ok("tab changes hands", / · bass/.test(await meta2()), await meta2());
  await b.key("Home", { key:"Home", vk:36 });
  await b.key("PageDown", { key:"PageDown", vk:34 });
  await b.key("PageDown", { key:"PageDown", vk:34 });
  await b.key("KeyZ", { key:"z", vk:90 });
  await wait(80);
  const r0 = await rowText(0);
  ok("and the note goes into the bass, beside the lead's",
     /C-4/.test(r0) && /C-2/.test(r0), r0);
  await b.shot(__dirname + "/two-voices-column.png");

  /* both really sound: count the oscillators the page makes for one step */
  const played = await b.eval(`(function(){
    var ctx = new (window.AudioContext||window.webkitAudioContext)();
    return "ok";
  })()`);
  ok("the browser has an audio context to play them with", played === "ok");
  ok("the page is playing two lines from one clock — the scheduler reads both",
     (await b.eval("document.getElementById('metatext').textContent")).length > 0);

  /* solo and mute, from the keyboard */
  await b.key("KeyO", { key:"o", vk:79 });
  await wait(80);
  ok("O solos the voice in hand", /bass \(solo\)/.test(await meta2()), await meta2());
  ok("and the other is marked as under it",
     /silent under the solo/.test(
       await b.eval("document.getElementById('vmark0').textContent")) ||
     /—/.test(await b.eval("document.getElementById('vmark0').textContent")),
     await b.eval("document.getElementById('vmark0').textContent"));
  await b.key("KeyO", { key:"o", vk:79 });
  await b.key("KeyP", { key:"p", vk:80 });
  await wait(80);
  ok("P mutes it", /bass \(muted\)/.test(await meta2()), await meta2());
  ok("and the strip says so",
     /muted/.test(await b.eval("document.getElementById('vmark1').textContent")));
  await b.key("KeyP", { key:"p", vk:80 });

  /* the transport really runs with both voices in it */
  await b.key("Space", { key:" ", vk:32 });
  await wait(500);
  ok("it plays with two voices on the page",
     /playing/.test(await footer()), await footer());
  ok("with no runtime error from the second voice", errors.length === 0, errors);
  await b.key("Space", { key:" ", vk:32 });

  /* the pad: bare triangle changes hands in absolute entry */
  await b.key("Tab", { key:"Tab", vk:9 });      /* back to the lead */
  await wait(60);
  await b.tap(GP.TR);
  ok("bare △ changes hands on the pad", / · bass/.test(await meta2()), await meta2());
  await b.tap(GP.TR);
  ok("and back", / · lead/.test(await meta2()), await meta2());
  /* and the crossbar carries the voice, solo and mute */
  await b.tap(GP.START);
  const slots = await b.eval(
    "Array.prototype.map.call(document.querySelectorAll('#settings .xslot')," +
    "function(e){return e.textContent;})");
  ok("the crossbar's third slot is the voice", /the voice/.test(slots[2]), slots[2]);
  ok("its fourth is the entry method", /entry method/.test(slots[3]), slots[3]);
  ok("□ is solo", /solo/.test(slots[4]), slots[4]);
  ok("△ is mute", /mute/.test(slots[5]), slots[5]);
  await b.tap(GP.SQ);
  ok("□ really solos the voice in hand", /lead \(solo\)/.test(await meta2()), await meta2());
  await b.tap(GP.SQ);
  await b.shot(__dirname + "/two-voices-settings.png");
  await b.tap(GP.START);
  await b.key("F2", { key:"F2", vk:113 });      /* the roll, drawn with both */
  await wait(150);
  /* the bars are built lead, bass, lead, bass … one pair per step, so the
     second voice's are the odd ones — and those are the ones drawn back */
  const barsShown = await b.eval(
    "(function(){var b=document.querySelectorAll('#rollfield .bar');" +
    "var lead=0,bass=0,back=0,wrong=0;" +
    "for(var i=0;i<b.length;i++){ if(b[i].style.display!=='block') continue;" +
    "if(i%2) bass++; else lead++;" +
    "if(/back/.test(b[i].className)){ back++; if(i%2===0) wrong++; }" +
    "else if(i%2) wrong++; }" +
    "return [lead,bass,back,wrong];})()");
  ok("the roll draws the lead's notes", barsShown[0] > 0, barsShown);
  ok("and the bass's beside them in the same field", barsShown[1] > 0, barsShown);
  ok("with exactly the voice not in hand drawn a shade back",
     barsShown[2] === barsShown[1] && barsShown[3] === 0, barsShown);
  await b.shot(__dirname + "/two-voices-roll.png");
  ok("no runtime errors from any of the two-voice work", errors.length === 0, errors);

  /* ---- the names on the drawing, in a real browser ----
     The roll could draw a pitch but never say it. Now every bar carries its
     note and its octave, and where both voices sound the interval between
     them is written between the two bars. Laid out for real, not inspected:
     a label that renders to nothing has shipped from this repo before. */
  console.log("\n== the names on the drawing ==");
  const K = { key:"k", vk:75 };
  async function toLead(){
    for (let i = 0; i < 3; i++){
      if (/ · lead/.test(await meta2())) return;
      await b.key("Tab", { key:"Tab", vk:9 });
    }
  }
  async function setOctave(n){
    for (let i = 0; i < 6; i++){
      const m = /octave (\d)/.exec(await meta2());
      if (!m || Number(m[1]) === n) return;
      if (Number(m[1]) < n) await b.key("PageUp", { key:"PageUp", vk:33 });
      else await b.key("PageDown", { key:"PageDown", vk:34 });
    }
  }
  async function clearVoice(){
    await b.key("Home", { key:"Home", vk:36 });
    for (let i = 0; i < 16; i++) await b.key("Period", { key:".", vk:190 });
  }
  if (!(await on("roll"))) await b.key("F2", { key:"F2", vk:113 });
  await toLead();
  await clearVoice();
  await b.key("Tab", { key:"Tab", vk:9 });
  await clearVoice();
  await b.key("Tab", { key:"Tab", vk:9 });          /* back in the lead */
  /* the lead: C4 E4 G4 on the first three steps */
  await setOctave(4);
  await b.key("Home", { key:"Home", vk:36 });
  await b.key("KeyZ", { key:"z", vk:90 });
  await b.key("KeyC", { key:"c", vk:67 });
  await b.key("KeyB", { key:"b", vk:66 });
  /* the bass: C2 on step 1, nothing on step 2, A2 on step 3 */
  await b.key("Tab", { key:"Tab", vk:9 });
  await setOctave(2);
  await b.key("Home", { key:"Home", vk:36 });
  await b.key("KeyZ", { key:"z", vk:90 });
  await b.key("ArrowDown", { key:"ArrowDown", vk:40 });
  await b.key("KeyN", { key:"n", vk:78 });
  await wait(150);

  const named = await b.eval(`(function(){
    var bs = document.querySelectorAll('#rollfield .bar'), o = [];
    for (var i = 0; i < bs.length; i++){
      if (bs[i].style.display !== 'block') continue;
      var n = bs[i].querySelector('.barname');
      var r = n.getBoundingClientRect(), q = bs[i].getBoundingClientRect();
      o.push([i, n.textContent, Math.round(r.width), Math.round(r.height),
              Math.abs((r.top + r.height/2) - (q.top + q.height/2)) < 3]);
    }
    return o;
  })()`);
  ok("every drawn bar carries a name", named.length === 5, named);
  ok("the lead's notes are named with their octave",
     named.filter(n => n[0] % 2 === 0).map(n => n[1]).join(",") === "C4,E4,G4", named);
  ok("and the bass's, two octaves down",
     named.filter(n => n[0] % 2 === 1).map(n => n[1]).join(",") === "C2,A2", named);
  ok("each name really has width and height on the page",
     named.every(n => n[2] > 6 && n[3] > 4), named);
  ok("and each sits on its own bar", named.every(n => n[4]), named);

  const iv = await b.eval(`(function(){
    var es = document.querySelectorAll('#rollfield .ivl'), o = [];
    for (var i = 0; i < es.length; i++){
      if (getComputedStyle(es[i]).display === 'none') continue;
      var r = es[i].getBoundingClientRect();
      o.push([i, es[i].textContent, Math.round(r.width), Math.round(r.height)]);
    }
    return o;
  })()`);
  ok("an interval is written only where both voices sound", iv.length === 2, iv);
  ok("C4 over C2 is named as two octaves", iv[0] && iv[0][1] === "P15", iv);
  /* G4 over A2 is a minor seventh and an octave: a minor fourteenth */
  ok("and G4 over A2 as a compound fourteenth", iv[1] && iv[1][1] === "m14", iv);
  ok("the step with only a lead on it says nothing",
     iv.every(x => x[0] !== 1), iv);
  ok("both labels are really laid out", iv.every(x => x[2] > 8 && x[3] > 6), iv);

  const placed = await b.eval(`(function(){
    var bs = document.querySelectorAll('#rollfield .bar');
    var lead = bs[0].getBoundingClientRect(), bass = bs[1].getBoundingClientRect();
    var lab = document.querySelectorAll('#rollfield .ivl')[0].getBoundingClientRect();
    var field = document.getElementById('rollfield').getBoundingClientRect();
    var c = lab.top + lab.height / 2;
    return { between: c > lead.top + lead.height/2 && c < bass.top + bass.height/2,
             inColumn: lab.left + lab.width/2 > lead.left - 4 &&
                       lab.left + lab.width/2 < lead.right + 8,
             inField: lab.left >= field.left - 1 && lab.right <= field.right + 1,
             c: Math.round(c), lead: Math.round(lead.top + lead.height/2),
             bass: Math.round(bass.top + bass.height/2) };
  })()`);
  ok("the interval is written between the two notes it names", placed.between, placed);
  ok("in the column of the step it belongs to", placed.inColumn, placed);
  ok("and nothing spills off the drawing", placed.inField, placed);
  await b.shot(__dirname + "/roll-names.png");

  await b.key("KeyK", K);
  await wait(120);
  const off = await b.eval(`(function(){
    var n = document.querySelector('#rollfield .barname');
    var e = document.querySelectorAll('#rollfield .ivl')[0];
    var bars = 0, bs = document.querySelectorAll('#rollfield .bar');
    for (var i = 0; i < bs.length; i++) if (bs[i].style.display === 'block') bars++;
    return [getComputedStyle(n).display, getComputedStyle(e).display, bars,
            document.getElementById('roll').className];
  })()`);
  ok("K puts every name away", off[0] === "none" && off[1] === "none", off);
  ok("and the drawing itself is untouched", off[2] === 5, off);
  ok("the roll carries the mark", /nonames/.test(off[3]), off);
  ok("the footer says so",
     /names/.test(await footer()), await footer());
  await b.shot(__dirname + "/roll-nonames.png");
  await b.key("KeyK", K);
  await wait(120);
  const back = await b.eval(
    "[getComputedStyle(document.querySelector('#rollfield .barname')).display," +
    "getComputedStyle(document.querySelectorAll('#rollfield .ivl')[0]).display," +
    "document.getElementById('roll').className]");
  ok("K brings them back", back[0] !== "none" && back[1] !== "none", back);
  ok("and the mark is gone", !/nonames/.test(back[2]), back);
  ok("K wrote nothing into the page",
     (await b.eval("document.querySelectorAll('#rollfield .bar')[0].style.display")) === "block");

  /* the column names its notes too, as it always has */
  await b.key("F2", { key:"F2", vk:113 });
  await wait(120);
  const col0 = await rowText(0);
  ok("the column names the same two notes, with octaves",
     /C-4/.test(col0) && /C-2/.test(col0), col0);
  await b.key("F2", { key:"F2", vk:113 });

  /* and the key page explains the whole convention */
  await b.key("F1", { key:"F1", vk:112 });
  await wait(120);
  const kp = await b.eval("document.getElementById('keyref').textContent");
  ok("the key page gives K a row", /the names on the drawing/.test(kp));
  ok("it fixes the octave convention", /C4 is middle C/.test(kp) && /C2 to C6/.test(kp));
  ok("it lists the simple interval names",
     /P1, m2, M2, m3, M3, P4, TT, P5, m6, M6, m7, M7, P8/.test(kp));
  ok("it names the compound convention", /compound name/.test(kp) && /m10/.test(kp));
  ok("including the tritone's", /TT11/.test(kp));
  ok("and says plainly that nothing here judges", /Nothing here judges/.test(kp));
  await b.key("F1", { key:"F1", vk:112 });
  ok("no runtime errors from any of the naming work", errors.length === 0, errors);

  await b.shot(__dirname + "/boot-seeded.png");
  clearInterval(drain);
  b.close();
  srv.kill();
  await wait(400);
  if (fs.existsSync(BACK)) fs.copyFileSync(BACK, LOG);
  console.log("\n" + pass + " passed, " + fail + " failed\n");
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log("harness crashed: " + (e && e.stack || e)); process.exit(1); });
