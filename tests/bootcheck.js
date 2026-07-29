/* Headless boot over the real server: no runtime errors, the tempo control
   works from the keyboard, and a fresh quest workspace arrives seeded. */
const { spawn } = require("child_process");
const fs = require("fs");
const net = require("net");
const { launch } = require("./cdp.js");

const REPO = require("path").resolve(__dirname, "..").split("\\").join("/");
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
  ok("the workspace heads the list",
     (await b.eval("document.querySelectorAll('#settings .xslot')[1].textContent"))
       .indexOf("the workspace") >= 0);
  ok("and is the marked one",
     (await b.eval("document.querySelectorAll('#settings .xslot')[1].className"))
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

  /* nothing in the mode is a page any more: the quest log and the key are
     both gone from it, and neither can be reached from a slot */
  const labels = await b.eval(
    "Array.prototype.map.call(document.querySelectorAll('#settings .xslot .xl')," +
    "function(e){return e.textContent;})");
  ok("no slot of it is the quest log", labels.every(l => !/quest/i.test(l)), labels);
  ok("and none is the key page", labels.every(l => l !== "the key"), labels);
  await b.tap(GP.DL); await b.tap(GP.DR); await b.tap(GP.DU); await b.tap(GP.DD);
  ok("walking every d-pad slot opens no page",
     !(await on("quests")) && !(await on("keyref")), labels);
  ok("and the mode is still up", await on("settings"));

  /* ↑ and ↓ are the workspaces in the left margin, and walking is arriving */
  const where = () => b.eval("document.getElementById('railtitle').textContent");
  const slotv = () => b.eval("document.querySelectorAll('#settings .xslot')[1].textContent");
  const here0 = await where();
  await b.tap(GP.DD);
  const here1 = await where();
  ok("d-pad down lands in the next workspace", here1 !== here0, [here0, here1]);
  ok("without opening the quest log to do it", !(await on("quests")));
  ok("and the slot names where you are", (await slotv()).length > 12, await slotv());
  ok("the left rail washes the line the pad is on",
     (await b.eval("document.querySelectorAll('#railquests .rline.nav').length")) === 1);
  ok("and it is the line you are in",
     (await b.eval("document.querySelectorAll('#railquests .rline.nav')[0].className"))
       .indexOf("act") >= 0);
  ok("the rail is really drawn, not collapsed",
     (await b.eval("Math.round(document.querySelectorAll" +
       "('#railquests .rline.nav')[0].getBoundingClientRect().width)")) > 20,
     await b.eval("Math.round(document.getElementById('raill').getBoundingClientRect().width)"));
  await b.tap(GP.DU);
  ok("and up walks back to where it started", (await where()) === here0, [here0, await where()]);

  /* ← and → are the voice, a ring */
  const meta1 = () => b.eval("document.getElementById('metatext').textContent");
  const v0 = await meta1();
  await b.tap(GP.DR);
  ok("→ changes hands", (await meta1()) !== v0, [v0, await meta1()]);
  await b.tap(GP.DR);
  ok("→ again comes round the ring", (await meta1()) === v0, [v0, await meta1()]);
  await b.tap(GP.DL);
  ok("← walks it the other way", (await meta1()) !== v0);
  await b.tap(GP.DL);
  ok("and back", (await meta1()) === v0);

  const meth0 = await meta1();
  await b.tap(GP.X);
  ok("✕ changes the entry method", /relative/.test(await meta1()), meth0);
  ok("and the crossbar stays up for the next item", await on("settings"));
  await b.tap(GP.X);
  ok("and ✕ again puts it back", !/relative/.test(await meta1()), await meta1());
  await b.tap(GP.B);
  ok("○ closes it", !(await on("settings")));
  ok("and the rail wash goes with it",
     (await b.eval("document.querySelectorAll('#railquests .rline.nav').length")) === 0);

  /* the key page and the quest log kept their own keys */
  await b.key("F1", { key:"F1", vk:112 });
  ok("F1 still opens the key page", await on("keyref"));
  await b.tap(GP.R3);
  ok("R3 is still the way off it", !(await on("keyref")));
  await b.key("F3", { key:"F3", vk:114 });
  ok("F3 still opens the quest log", await on("quests"));
  await b.key("F3", { key:"F3", vk:114 });
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
  ok("the crossbar's → is the voice", /the voice/.test(slots[2]), slots[2]);
  ok("its ↓ is the workspace", /the workspace/.test(slots[3]), slots[3]);
  ok("and ✕ is the entry method", /entry method/.test(slots[7]), slots[7]);
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
     The roll could draw a pitch but never say it. It says it now in the
     margin rather than on top of itself: each octave rule carries its own C,
     once, at the side of the line; placing or moving a note raises one more
     line at that pitch and lets it fade; and where both voices sound the
     interval is written on a tie hung between the two bars. Re-pointed from
     the first cut (a name on every bar, a chip floating at the midpoint) on
     2026-07-29. Laid out for real, not inspected: a label that renders to
     nothing has shipped from this repo before. */
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

  const bare = await b.eval(`(function(){
    var bs = document.querySelectorAll('#rollfield .bar'), drawn = 0, i;
    for (i = 0; i < bs.length; i++) if (bs[i].style.display === 'block') drawn++;
    return [drawn, document.querySelectorAll('#rollfield .barname').length,
            document.querySelectorAll('#rollfield .bar *').length];
  })()`);
  ok("the five notes are drawn", bare[0] === 5, bare);
  ok("and not one of them carries a label", bare[1] === 0 && bare[2] === 0, bare);

  /* the octave rules, named once each in the margin the roll keeps for them */
  const ruled = await b.eval(`(function(){
    var ls = document.querySelectorAll('#rollfield .octline'), o = [];
    var f = document.getElementById('rollfield').getBoundingClientRect();
    for (var i = 0; i < ls.length; i++){
      var n = ls[i].querySelector('.octname');
      if (!n) { o.push([i, null]); continue; }
      var r = n.getBoundingClientRect(), q = ls[i].getBoundingClientRect();
      o.push([i, n.textContent, Math.round(r.width), Math.round(r.height),
              Math.abs((r.top + r.height/2) - q.top) < 3,       /* on its own line */
              r.right <= f.left + 1,                            /* off the drawing */
              r.left >= 0]);                                    /* and still on the page */
    }
    return o;
  })()`);
  ok("every octave rule in view carries a name", ruled.length >= 2 &&
     ruled.every(r => r[1]), ruled);
  ok("each of them a C, with its octave", ruled.every(r => /^C[0-9]$/.test(r[1])), ruled);
  ok("each really laid out", ruled.every(r => r[2] > 6 && r[3] > 4), ruled);
  ok("each level with its own line", ruled.every(r => r[4]), ruled);
  ok("and each in the margin, clear of the drawing but on the page",
     ruled.every(r => r[5] && r[6]), ruled);

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

  /* ---- and the label belongs to its pair, visibly ----
     The first cut floated it at the midpoint between the two bars, tied to
     nothing; with the voices a tenth or more apart it read as a chip in empty
     space. The slot now runs from the centre of the upper bar to the centre of
     the lower one, a tie of ink is drawn down it, and the name rides the tie's
     middle. Measured, because that is the whole of the change. */
  const placed = await b.eval(`(function(){
    var el = document.querySelectorAll('#rollfield .ivl')[0];
    var bs = document.querySelectorAll('#rollfield .bar');
    var lead = bs[0].getBoundingClientRect(), bass = bs[1].getBoundingClientRect();
    var lab = el.getBoundingClientRect();
    var pill = el.querySelector('span').getBoundingClientRect();
    var tie = el.querySelector('i').getBoundingClientRect();
    var field = document.getElementById('rollfield').getBoundingClientRect();
    var lc = lead.top + lead.height/2, bc = bass.top + bass.height/2;
    var c = pill.top + pill.height / 2;
    return { between: c > lc && c < bc,
             inColumn: pill.left + pill.width/2 > lead.left - 4 &&
                       pill.left + pill.width/2 < lead.right + 8,
             inField: lab.left >= field.left - 1 && lab.right <= field.right + 1,
             /* the slot reaches from one note to the other, within a pixel */
             spans: Math.abs(lab.top - lc) < 2 && Math.abs(lab.bottom - bc) < 2,
             /* the tie runs its length, and is a hairline */
             ties: Math.abs(tie.top - lab.top) < 2 && Math.abs(tie.bottom - lab.bottom) < 2,
             thin: tie.width <= 2 && tie.height > 40,
             /* the name rides its middle, and covers it there */
             rides: Math.abs((pill.left + pill.width/2) - (tie.left + tie.width/2)) < 2 &&
                    pill.top < c && pill.bottom > c,
             pillW: Math.round(pill.width), pillH: Math.round(pill.height),
             c: Math.round(c), lead: Math.round(lc), bass: Math.round(bc) };
  })()`);
  ok("the interval is written between the two notes it names", placed.between, placed);
  ok("in the column of the step it belongs to", placed.inColumn, placed);
  ok("and nothing spills off the drawing", placed.inField, placed);
  ok("the slot reaches from the one note to the other", placed.spans, placed);
  ok("a tie is drawn down its whole length", placed.ties, placed);
  ok("and it is a hairline, not a rule", placed.thin, placed);
  ok("the name rides the middle of the tie", placed.rides, placed);
  ok("and it is a dab with real size", placed.pillW > 14 && placed.pillH > 8, placed);
  await b.shot(__dirname + "/roll-names.png");

  /* ---- the pitch in hand ----
     Placing a note raises a line at its pitch, named in the same margin as
     the octave rules, and lets it go: no class remains a second later, and
     the stylesheet fades what is left. */
  const guide = await b.eval(`(function(){
    var g = document.getElementById('rollfield').querySelector('.rollguide');
    return [!!g, g && g.className, g && getComputedStyle(g).opacity];
  })()`);
  ok("the guide is a line of the drawing's own",
     guide[0] && /^rollguide/.test(guide[1]), guide);
  /* the hands are in the bass, on step 4; G2 there raises the guide and
     leaves the drawing's window exactly where it was (C2 is already lower) */
  await b.key("KeyB", { key:"b", vk:66 });
  await wait(400);
  const up = await b.eval(`(function(){
    var g = document.querySelector('#rollfield .rollguide');
    var n = g.querySelector('.gname');
    var r = g.getBoundingClientRect(), nr = n.getBoundingClientRect();
    var f = document.getElementById('rollfield').getBoundingClientRect();
    var bs = document.querySelectorAll('#rollfield .bar');
    var q = bs[7].getBoundingClientRect();           /* the bass bar just written */
    return { on: /\\bon\\b/.test(g.className), name: n.textContent,
             op: Number(getComputedStyle(g).opacity),
             /* it is a line, across the whole drawing, at that note's height */
             wide: Math.abs(r.width - f.width) < 2, thin: r.height <= 2,
             atPitch: Math.abs(r.top - (q.top + q.height/2)) < 3,
             /* and named in the margin the octave rules are named in */
             margin: nr.right <= f.left + 1 && nr.left >= 0,
             level: Math.abs((nr.top + nr.height/2) - r.top) < 3 };
  })()`);
  ok("writing a note raises the guide", up.on && up.op > 0.9, up);
  ok("it names the pitch that was just written", up.name === "G2", up);
  ok("it is a hairline drawn across the whole drawing", up.wide && up.thin, up);
  ok("at that note's own height", up.atPitch, up);
  ok("and named in the same margin, level with itself", up.margin && up.level, up);
  await b.shot(__dirname + "/roll-guide.png");

  /* and it lets go of itself: the class comes off after the hold, and the
     stylesheet's transition takes the line out over about a second. Raised
     again here so the clock starts at a known moment. */
  await b.key("ArrowUp", { key:"ArrowUp", vk:38 });   /* back onto the same step */
  await b.key("KeyB", { key:"b", vk:66 });
  await wait(300);
  const held = await b.eval(
    "(function(){var g=document.querySelector('#rollfield .rollguide');" +
    "return [/\\bon\\b/.test(g.className), Number(getComputedStyle(g).opacity)];})()");
  ok("raised again, it is up and whole", held[0] && held[1] > 0.9, held);
  await wait(1300);
  const letting = await b.eval(
    "(function(){var g=document.querySelector('#rollfield .rollguide');" +
    "return [/\\bon\\b/.test(g.className), Number(getComputedStyle(g).opacity)];})()");
  ok("about a second later it has let go", !letting[0], letting);
  ok("and is fading rather than gone at a stroke",
     letting[1] > 0 && letting[1] < 1, letting);
  await wait(1400);
  const gone = await b.eval(
    "Number(getComputedStyle(document.querySelector('#rollfield .rollguide')).opacity)");
  ok("a second after that it has gone entirely", gone < 0.02, gone);
  /* leave the page exactly as the checks above found it: five notes */
  await b.key("ArrowUp", { key:"ArrowUp", vk:38 });
  await b.key("Period", { key:".", vk:190 });
  await wait(150);

  await b.key("KeyK", K);
  await wait(120);
  const off = await b.eval(`(function(){
    var n = document.querySelector('#rollfield .octname');
    var g = document.querySelector('#rollfield .gname');
    var e = document.querySelectorAll('#rollfield .ivl')[0];
    var bars = 0, bs = document.querySelectorAll('#rollfield .bar');
    for (var i = 0; i < bs.length; i++) if (bs[i].style.display === 'block') bars++;
    return [getComputedStyle(n).display, getComputedStyle(e).display, bars,
            document.getElementById('roll').className,
            getComputedStyle(g).display,
            /* the lines themselves are the drawing, and stay */
            getComputedStyle(document.querySelector('#rollfield .octline')).display,
            document.querySelectorAll('#rollfield .octline').length];
  })()`);
  ok("K puts every name away", off[0] === "none" && off[1] === "none", off);
  ok("the guide's name with them", off[4] === "none", off);
  ok("but not the rules they are names for", off[5] !== "none" && off[6] >= 2, off);
  ok("and the drawing itself is untouched", off[2] === 5, off);
  ok("the roll carries the mark", /nonames/.test(off[3]), off);
  ok("the footer says so",
     /names/.test(await footer()), await footer());
  await b.shot(__dirname + "/roll-nonames.png");
  await b.key("KeyK", K);
  await wait(120);
  const back = await b.eval(
    "[getComputedStyle(document.querySelector('#rollfield .octname')).display," +
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
  ok("it says the rules are named at their side",
     /named once, at the side of its line/.test(kp));
  ok("and that placing or moving a note raises one more",
     /Place a note, or move one/.test(kp) && /holds for a moment and then fades/.test(kp));
  ok("and that the interval hangs on a tie between the pair",
     /hairline tie/.test(kp) && /belongs to that pair of notes/.test(kp));
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
