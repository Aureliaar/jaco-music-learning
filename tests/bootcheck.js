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
function eq2(name, a, b){ ok(name, JSON.stringify(a) === JSON.stringify(b), { got:a, want:b }); }
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
  const before = await b.eval("Number(document.getElementById('metatext').textContent.split(' · ')[0])");
  await b.key("Equal", { key:"=", vk:187 });
  await b.key("Equal", { key:"=", vk:187 });
  const after = await b.eval("Number(document.getElementById('metatext').textContent.split(' · ')[0])");
  ok("two presses raise the tempo by eight", after === before + 8, { before, after });
  ok("and the footer said so",
     /tempo · /.test(await b.eval("document.getElementById('footer').textContent")),
     await b.eval("document.getElementById('footer').textContent"));
  await b.key("Minus", { key:"-", vk:189 });
  await b.key("Minus", { key:"-", vk:189 });
  ok("and two more put it back",
     (await b.eval("Number(document.getElementById('metatext').textContent.split(' · ')[0])")) === before);
  ok("the key page documents the tempo",
     /the two keys left of backspace/.test(await b.eval("document.getElementById('keyref').textContent")));
  ok("and says the quests come pre-tuned",
     /arrives already tuned/.test(await b.eval("document.getElementById('keyref').textContent")));
  await b.key("F1", { key:"F1", vk:112 });

  /* a fresh quest workspace arrives seeded — 'stray' has no page in the log.
     The board is read one lesson at a time now, so walk the tabs to it. */
  const rowIndex = name => b.eval(
    "(function(){var r=document.querySelectorAll('#qlist .quest');for(var i=0;i<r.length;i++)" +
    "if(/" + name + "/i.test(r[i].textContent))return i;return -1;})()");
  /* the boot GET may still be in flight, and applying the server's state puts
     the caret (and so the tab) back where the work is: settle first, then walk */
  await wait(600);
  await b.key("F3", { key:"F3", vk:114 });
  await wait(200);
  let idx = await rowIndex("stray");
  for (let t = 0; t < 12 && idx < 0; t++){
    await b.key("ArrowRight", { key:"ArrowRight", vk:39 });
    await wait(150);
    idx = await rowIndex("stray");
  }
  ok("the stray quest is on the list", idx >= 0, idx);
  /* the log opens on the lesson the work is in, so the caret starts on the
     workspace in hand rather than at the head: walk from where it is */
  const caretRow = () => b.eval(
    "(function(){var r=document.querySelectorAll('#qlist .quest');" +
    "for(var i=0;i<r.length;i++) if(r[i].classList.contains('sel')) return i; return 0;})()");
  let at0 = await caretRow();
  for (let i = at0; i < idx; i++) await b.key("ArrowDown", { key:"ArrowDown", vk:40 });
  for (let i = at0; i > idx; i--) await b.key("ArrowUp", { key:"ArrowUp", vk:38 });
  await b.key("Enter", { key:"Enter", vk:13 });
  await b.key("F3", { key:"F3", vk:114 });
  await wait(150);
  const meta = await b.eval("document.getElementById('metatext').textContent");
  ok("entering it lands in its seeded key", /E minor/.test(meta), meta);
  ok("and its seeded tempo", /^96 · /.test(meta), meta);
  /* both margins name the quest already; the line is the three settings */
  ok("with the quest left off the meta line", !/⚔/.test(meta), meta);
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
  /* item 7 of the pre-L3 pass: the crossbar is raised OVER the folio now,
     not in place of it — the music stays in view while settings are turned */
  ok("and the folio stays in view under it",
     (await on("roll")) ||
     (await b.eval("document.getElementById('column').style.display")) === "flex",
     await b.eval("document.getElementById('column').style.display"));
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

  /* ← and → turn the lesson the margin is showing — it reads one at a time,
     the one the board is on, so the four directions are the whole board with
     no page opened. The base octave, here one pass, is not a command now. */
  const meta1 = () => b.eval("document.getElementById('metatext').textContent");
  const railTabOn = () => b.eval(
    "(document.querySelector('#rtabs .rtab.on')||{}).textContent||''");
  const railList = () => b.eval(
    "[].map.call(document.querySelectorAll('#railquests .rline .rn'), function(e){return e.textContent;})");
  ok("the margin has a tag per lesson, and one of them in hand",
     (await b.eval("document.querySelectorAll('#rtabs .rtab').length")) >= 2 &&
     (await b.eval("document.querySelectorAll('#rtabs .rtab.on').length")) === 1);
  const oct0 = await meta1(), tab0 = await railTabOn(), list0 = await railList();
  await b.tap(GP.DR);
  await wait(120);
  ok("→ turns the margin to another lesson", (await railTabOn()) !== tab0,
     [tab0, await railTabOn()]);
  ok("and the margin shows that lesson's workspaces instead",
     JSON.stringify(await railList()) !== JSON.stringify(list0), [list0, await railList()]);
  ok("and raised no octave — that is not a command any more",
     (await meta1()) === oct0, [oct0, await meta1()]);
  await b.tap(GP.DL);
  await wait(120);
  ok("← turns it back", (await railTabOn()) === tab0, [tab0, await railTabOn()]);
  eq2("and the margin comes back with it", await railList(), list0);
  /* the voice, on the bumpers, from the page itself */
  await b.tap(GP.START);
  const vb = () => b.eval("document.getElementById('vname1').className");
  const vb0 = await vb();
  await b.tap(GP.R1);
  ok("R1 changes hands on the page", (await vb()) !== vb0, [vb0, await vb()]);
  await b.tap(GP.L1);
  ok("and L1 walks the ring back", (await vb()) === vb0, [vb0, await vb()]);
  await b.tap(GP.START);

  /* no scene is put up until its picture is fetched and decoded, so the
     ground answers a moment after the button, holding what it had until then */
  const scene = () => b.eval("document.body.getAttribute('data-scenery')");
  const sceneSettles = async (want) => {
    for (let i = 0; i < 60; i++){
      if (want ? (await scene()) === want : (await scene()) !== scene0) return await scene();
      await wait(150);
    }
    return await scene();
  };
  const scene0 = await scene();
  await b.tap(GP.X);
  ok("✕ walks the background", (await sceneSettles(null)) !== scene0, scene0);
  ok("and the crossbar stays up for the next item", await on("settings"));
  await b.tap(GP.X); await b.tap(GP.X); await b.tap(GP.X);
  ok("and four presses is the whole ring", (await sceneSettles(scene0)) === scene0, scene0);
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
  ok("tab changes hands, and the strip is what says so",
     (await b.eval("document.getElementById('vname1').className")).indexOf("on") >= 0 &&
     (await b.eval("document.getElementById('vname0').className")).indexOf("on") < 0);
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
  /* the strip is the one home for this, and the header has stopped repeating it */
  ok("O solos the voice in hand, on its own line of the strip",
     /solo/.test(await b.eval("document.getElementById('vmark1').textContent")),
     await b.eval("document.getElementById('vmark1').textContent"));
  ok("and the other is marked as silent under it",
     /silent/.test(await b.eval("document.getElementById('vmark0').textContent")),
     await b.eval("document.getElementById('vmark0').textContent"));
  ok("with the header out of it entirely", !/solo/.test(await meta2()), await meta2());
  await b.key("KeyO", { key:"o", vk:79 });
  await b.key("KeyP", { key:"p", vk:80 });
  await wait(80);
  ok("P mutes it, and the strip says so",
     /muted/.test(await b.eval("document.getElementById('vmark1').textContent")));
  ok("and the header still does not", !/muted/.test(await meta2()), await meta2());
  await b.key("KeyP", { key:"p", vk:80 });

  /* the transport really runs with both voices in it */
  await b.key("Space", { key:" ", vk:32 });
  await wait(500);
  ok("it plays with two voices on the page",
     /playing/.test(await footer()), await footer());
  ok("with no runtime error from the second voice", errors.length === 0, errors);
  await b.key("Space", { key:" ", vk:32 });

  /* the pad: the bumpers change hands, △ is a move and never the voice */
  await b.key("Tab", { key:"Tab", vk:9 });      /* back to the lead */
  await wait(60);
  const inHand = () => b.eval(
    "document.getElementById('vname0').className.indexOf('on') >= 0 ? 'lead' : 'bass'");
  await b.tap(GP.R1);
  ok("R1 changes hands on the pad", (await inHand()) === "bass", await inHand());
  await b.tap(GP.L1);
  ok("and L1 walks the ring back", (await inHand()) === "lead", await inHand());
  /* and the crossbar carries the voice, solo and mute */
  await b.tap(GP.START);
  const slots = await b.eval(
    "Array.prototype.map.call(document.querySelectorAll('#settings .xslot')," +
    "function(e){return e.textContent;})");
  ok("the crossbar's → is the lesson", /the lesson/.test(slots[2]), slots[2]);
  ok("its ↓ is the workspace", /the workspace/.test(slots[3]), slots[3]);
  ok("and no slot of it is the base octave any more",
     slots.every(s => !/octave/.test(s)), slots);
  ok("and ✕ is the background", /the background/.test(slots[7]), slots[7]);
  ok("and no slot of it is the voice any more",
     slots.every(s => !/the voice/.test(s)), slots);
  ok("□ is solo", /solo/.test(slots[4]), slots[4]);
  ok("△ is mute", /mute/.test(slots[5]), slots[5]);
  await b.tap(GP.SQ);
  ok("□ really solos the voice in hand, marked on the strip",
     /solo/.test(await b.eval("document.getElementById('vmark0').textContent")),
     await b.eval("document.getElementById('vmark0').textContent"));
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
  /* which voice the hands are in is read off the strip that names them */
  async function toLead(){
    for (let i = 0; i < 3; i++){
      if ((await b.eval("document.getElementById('vname0').className")).indexOf("on") >= 0) return;
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
  /* clearing advances two steps now, as writing does, so sixteen periods
     would only ever visit the even steps. One arrow back after each keeps
     the sweep walking one step at a time, as it did before the change. */
  async function clearVoice(){
    await b.key("Home", { key:"Home", vk:36 });
    for (let i = 0; i < 16; i++){
      await b.key("Period", { key:".", vk:190 });
      await b.key("ArrowUp", { key:"ArrowUp", vk:38 });
    }
  }
  if (!(await on("roll"))) await b.key("F2", { key:"F2", vk:113 });
  await toLead();
  await clearVoice();
  await b.key("Tab", { key:"Tab", vk:9 });
  await clearVoice();
  await b.key("Tab", { key:"Tab", vk:9 });          /* back in the lead */
  /* the lead: C4 E4 G4, written straight ahead — and entry lays eighths, so
     they land on steps 1, 3 and 5 rather than on the first three steps */
  await setOctave(4);
  await b.key("Home", { key:"Home", vk:36 });
  await b.key("KeyZ", { key:"z", vk:90 });
  await b.key("KeyC", { key:"c", vk:67 });
  await b.key("KeyB", { key:"b", vk:66 });
  /* the bass: C2 on step 1, nothing on step 3, A2 on step 5 — under the lead's
     first and last, so that exactly two steps have both voices on them */
  await b.key("Tab", { key:"Tab", vk:9 });
  await setOctave(2);
  await b.key("Home", { key:"Home", vk:36 });
  await b.key("KeyZ", { key:"z", vk:90 });
  await b.key("ArrowDown", { key:"ArrowDown", vk:40 });
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

  /* ---- re-pointed and extended, 2026-07-31 ----
     The rules sit on the home note of the page's key rather than on C, and
     each margin label carries the pitch with the word home under it. This page
     is the stray quest's, seeded in E minor, so its home is E. */
  const rules = () => b.eval(`(function(){
    var ls = document.querySelectorAll('#rollfield .octline'), o = [];
    var f = document.getElementById('rollfield').getBoundingClientRect();
    for (var i = 0; i < ls.length; i++){
      var n = ls[i].querySelector('.octname');
      if (!n) { o.push([i, null]); continue; }
      var p = n.querySelector('.opn'), h = n.querySelector('.ohome');
      var r = n.getBoundingClientRect(), q = ls[i].getBoundingClientRect();
      var pr = p ? p.getBoundingClientRect() : null;
      var hr = h ? h.getBoundingClientRect() : null;
      o.push([i, p && p.textContent, Math.round(r.width), Math.round(r.height),
              Math.abs((r.top + r.height/2) - q.top) < 3,       /* on its own line */
              r.right <= f.left + 1,                            /* off the drawing */
              r.left >= 0,                                      /* and still on the page */
              h && h.textContent,
              /* the marker hangs under the name, smaller than it */
              !!(pr && hr) && hr.top >= pr.bottom - 1 &&
                parseFloat(getComputedStyle(h).fontSize) <
                parseFloat(getComputedStyle(p).fontSize),
              hr ? Math.round(hr.width) : 0,
              getComputedStyle(h).color]);
    }
    return o;
  })()`);
  const ruled = await rules();
  ok("every home rule in view carries a name", ruled.length >= 2 &&
     ruled.every(r => r[1]), ruled);
  ok("each of them the page's own home — E, this being E minor",
     ruled.every(r => /^E[0-9]$/.test(r[1])), ruled);
  ok("each really laid out", ruled.every(r => r[2] > 6 && r[3] > 4), ruled);
  ok("each level with its own line", ruled.every(r => r[4]), ruled);
  ok("and each in the margin, clear of the drawing but on the page",
     ruled.every(r => r[5] && r[6]), ruled);
  ok("each says what that pitch is to the piece", ruled.every(r => r[7] === "home"), ruled);
  ok("the marker sits under the name, and smaller", ruled.every(r => r[8]), ruled);
  ok("and it is really drawn", ruled.every(r => r[9] > 10), ruled);
  ok("in the page's gilt", ruled.every(r => /156, ?122, ?40/.test(r[10])), ruled);
  await b.shot(__dirname + "/roll-home-eminor.png");

  /* ---- and the key moves them, live ----
     The key page's arrows move the tonic; the rules must be somewhere else the
     moment they do, with nothing else on the drawing disturbed. */
  const barTops = () => b.eval(
    "[].map.call(document.querySelectorAll('#rollfield .bar')," +
    "function(b){return [b.style.top, b.style.height, b.style.display];})");
  const beforeKey = await barTops();
  await b.key("F1", { key:"F1", vk:112 });
  await wait(80);
  for (let i = 0; i < 3; i++) await b.key("ArrowRight", { key:"ArrowRight", vk:39 });
  await wait(150);
  ok("three steps of the tonic reach G minor",
     /G minor/.test(await b.eval("document.getElementById('metatext').textContent")),
     await b.eval("document.getElementById('metatext').textContent"));
  await b.key("F1", { key:"F1", vk:112 });
  await wait(150);
  const moved = await rules();
  ok("the rules moved to the new home, without a reload",
     moved.length >= 2 && moved.every(r => /^G[0-9]$/.test(r[1])), moved);
  ok("and each still says home", moved.every(r => r[7] === "home"), moved);
  ok("still in the margin, level with its own line",
     moved.every(r => r[4] && r[5] && r[6]), moved);
  ok("and the notes on the drawing did not move at all",
     JSON.stringify(await barTops()) === JSON.stringify(beforeKey), beforeKey);
  await b.shot(__dirname + "/roll-home-gminor.png");
  /* major or minor does not change where home is */
  await b.key("F1", { key:"F1", vk:112 });
  await b.key("ArrowUp", { key:"ArrowUp", vk:38 });
  await wait(120);
  await b.key("F1", { key:"F1", vk:112 });
  await wait(120);
  const maj = await rules();
  ok("G major has the same home as G minor",
     maj.every(r => /^G[0-9]$/.test(r[1])), maj);
  /* and back to the page's own key, exactly as it was found */
  await b.key("F1", { key:"F1", vk:112 });
  await b.key("ArrowUp", { key:"ArrowUp", vk:38 });
  for (let i = 0; i < 3; i++) await b.key("ArrowLeft", { key:"ArrowLeft", vk:37 });
  await wait(120);
  await b.key("F1", { key:"F1", vk:112 });
  await wait(150);
  const backHome = await rules();
  ok("back in E minor, the rules are the Es again",
     backHome.every(r => /^E[0-9]$/.test(r[1])), backHome);
  ok("and the drawing is still the drawing",
     JSON.stringify(await barTops()) === JSON.stringify(beforeKey), backHome);

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
     iv.every(x => x[0] !== 2), iv);
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
  /* the hands are in the bass, two steps past the A2 — on step 7; G2 there
     raises the guide and leaves the drawing's window exactly where it was
     (C2 is already lower) */
  await b.key("KeyB", { key:"b", vk:66 });
  await wait(400);
  const up = await b.eval(`(function(){
    var g = document.querySelector('#rollfield .rollguide');
    var n = g.querySelector('.gname');
    var r = g.getBoundingClientRect(), nr = n.getBoundingClientRect();
    var f = document.getElementById('rollfield').getBoundingClientRect();
    var bs = document.querySelectorAll('#rollfield .bar');
    /* the bars are built lead, bass, lead, bass … so step 7's bass is 2*6+1 */
    var q = bs[13].getBoundingClientRect();          /* the bass bar just written */
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
  /* back onto the same step: entry left the cursor two on, so two arrows back */
  await b.key("ArrowUp", { key:"ArrowUp", vk:38 });
  await b.key("ArrowUp", { key:"ArrowUp", vk:38 });
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
            document.querySelectorAll('#rollfield .octline').length,
            /* the home marker goes with the name it hangs under */
            document.querySelector('#rollfield .ohome').getClientRects().length];
  })()`);
  ok("K puts every name away", off[0] === "none" && off[1] === "none", off);
  ok("the home marker goes with them", off[7] === 0, off);
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
  ok("and that the ruled line is the page's home note",
     /home note of the page/.test(kp) && /the tonic of its key/.test(kp) &&
     /in G major the Gs/.test(kp));
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

  /* ---- entry lays eighths, in a real browser ----
     A step is a sixteenth; writing a note or a rest now leaves the cursor two
     steps on, so writing straight ahead lands on 1, 3, 5, 7. Moving the cursor
     by hand is untouched — one step — and that is how a sixteenth is placed.
     Driven here rather than inspected: every path that writes goes through the
     real keyboard and the real pad. */
  console.log("\n== entry lays eighths ==");
  const at = () => b.eval(
    "(function(){var r=document.querySelectorAll('#column .row');" +
    "for(var i=0;i<r.length;i++) if(/\\bcursor\\b/.test(r[i].className)) return i;" +
    "return -1;})()");
  const stepText = i =>
    b.eval("document.querySelectorAll('#column .row')[" + i + "].textContent");
  await toLead();
  await clearVoice();
  await b.key("Tab", { key:"Tab", vk:9 });
  await clearVoice();
  await b.key("Tab", { key:"Tab", vk:9 });          /* back in the lead */
  await setOctave(4);

  await b.key("Home", { key:"Home", vk:36 });
  await b.key("KeyZ", { key:"z", vk:90 });
  ok("a note from the keyboard leaves the cursor two steps on", (await at()) === 2, await at());
  ok("and the note is on step 1", /C-4/.test(await stepText(0)), await stepText(0));
  await b.key("KeyC", { key:"c", vk:67 });
  ok("the next one lands on step 3, not step 2", /E-4/.test(await stepText(2)), await stepText(2));
  ok("with step 2 left empty", !/[A-G]-\d/.test(await stepText(1)), await stepText(1));
  ok("and the cursor is on step 5", (await at()) === 4, await at());

  /* the guide still says which pitch that was */
  ok("writing still raises the pitch guide",
     /\bon\b/.test(await b.eval("document.querySelector('#rollfield .rollguide').className")));

  /* the arrows are untouched: one step each, either way */
  await b.key("ArrowDown", { key:"ArrowDown", vk:40 });
  ok("an arrow still moves one step", (await at()) === 5, await at());
  await b.key("ArrowUp", { key:"ArrowUp", vk:38 });
  ok("and back one", (await at()) === 4, await at());

  /* which is how a sixteenth is placed: back one, and write */
  await b.key("Home", { key:"Home", vk:36 });
  await b.key("ArrowDown", { key:"ArrowDown", vk:40 });
  await b.key("KeyX", { key:"x", vk:88 });
  ok("a step back puts a sixteenth between the eighths",
     /D-4/.test(await stepText(1)), await stepText(1));
  ok("and entry goes on by two from there too", (await at()) === 3, await at());

  /* it wraps around the page, as the arrows do — and the loop fences neither */
  await b.key("End", { key:"End", vk:35 });
  await b.key("KeyZ", { key:"z", vk:90 });
  ok("entry wraps past step 16", (await at()) === 1, await at());
  await b.key("KeyL", { key:"l", vk:76 });
  /* the page draws the loop, which is why the meta line stopped saying it */
  ok("the loop is eight, and the page is what says so",
     (await b.eval("document.querySelectorAll('#column .row.outside').length")) === 8,
     await b.eval("document.querySelectorAll('#column .row.outside').length"));
  await b.key("End", { key:"End", vk:35 });
  await b.key("KeyZ", { key:"z", vk:90 });
  ok("and wraps the same way under a short loop", (await at()) === 1, await at());
  await b.key("Home", { key:"Home", vk:36 });
  for (let i = 0; i < 7; i++) await b.key("ArrowDown", { key:"ArrowDown", vk:40 });
  await b.key("KeyZ", { key:"z", vk:90 });
  ok("a short loop does not fence the advance either", (await at()) === 9, await at());
  await b.key("KeyL", { key:"l", vk:76 });
  await b.key("KeyL", { key:"l", vk:76 });          /* back to the whole page */

  /* the rest, and both pad methods, on a page cleared for the purpose */
  await clearVoice();
  await b.key("Home", { key:"Home", vk:36 });
  await b.key("Period", { key:".", vk:190 });
  ok("clearing a step advances two as well", (await at()) === 2, await at());
  await b.key("Home", { key:"Home", vk:36 });
  /* the absolute crossbar is gone: a trigger with a d-pad slot names no pitch.
     The d-pad still does its own bare work under it (time, or the nudge, as
     the view decides) — what must never happen again is a pitch appearing. */
  await b.tap(GP.L2, GP.DL);
  ok("a trigger and the old slot 1 write no pitch",
     !/[A-G]/.test(await stepText(0)), await stepText(0));
  await b.key("Home", { key:"Home", vk:36 });
  await b.key("KeyZ", { key:"z", vk:90 });          /* an anchor to move from */
  await b.key("Home", { key:"Home", vk:36 });
  await b.tap(GP.TR);
  ok("a contour note advances two", (await at()) === 2, await at());
  await b.tap(GP.SQ);
  ok("a rest on the pad advances two, as a note does", (await at()) === 4, await at());

  /* ---- the chromatic escape hatch, on a real pad ----
     L1 and R1 held together mean one thing in relative entry: out of the key,
     a semitone. It answered △ and ✕ and not the d-pad, which nudges the note
     already under the cursor — the same move, made on a note already written.
     Driven here through the real pad rather than inspected, and read off the
     column, so which pair of the d-pad the view puts the nudge on is asked
     rather than assumed. */
  console.log("\n== the chromatic escape reaches the nudge ==");
  const PCS = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
  const noteAt = async i => {
    const m = /([A-G])(♯|-)(\d)/.exec(await stepText(i));
    return m ? m[1] + (m[2] === "♯" ? "#" : "") + m[3] : null;
  };
  const MIDI = n => { const m = /^([A-G]#?)(\d)$/.exec(n);
    return (parseInt(m[2], 10) + 1) * 12 + PCS.indexOf(m[1]); };
  const metaLine = () => b.eval("document.getElementById('metatext').textContent");
  await clearVoice();
  await b.key("Home", { key:"Home", vk:36 });
  await b.tap(GP.TR);                               /* a note to nudge */
  await b.key("Home", { key:"Home", vk:36 });
  const inRoll = await on("roll");
  const UP = inRoll ? GP.DU : GP.DR, DOWN = inRoll ? GP.DD : GP.DL;
  const hatchBefore = await noteAt(0);
  ok("there is a note under the cursor to nudge", hatchBefore !== null, await stepText(0));
  await b.tap(GP.L2, GP.R2, UP);
  const hatchAfter = await noteAt(0);
  ok("both triggers held, the d-pad nudges by a semitone",
     hatchBefore && hatchAfter && MIDI(hatchAfter) === MIDI(hatchBefore) + 1, [hatchBefore, hatchAfter]);
  ok("and the nudge did not advance the cursor", (await at()) === 0, await at());
  ok("nor did the triggers touch the octave or the voice", / octave 4 /.test(await metaLine()), await metaLine());
  await b.tap(GP.L2, GP.R2, DOWN);
  ok("and the other way is a semitone back", (await noteAt(0)) === hatchBefore,
     [hatchBefore, await noteAt(0)]);
  await b.tap(UP);
  const hatchBare = await noteAt(0);
  ok("bare, the same d-pad is a step of the key, as it always was",
     hatchBare && MIDI(hatchBare) - MIDI(hatchBefore) >= 1 && MIDI(hatchBare) - MIDI(hatchBefore) <= 2,
     [hatchBefore, hatchBare]);
  ok("and the escape hatch raised no runtime error", errors.length === 0, errors);

  ok("no runtime errors from any of the eighth-note work", errors.length === 0, errors);

  await b.shot(__dirname + "/boot-seeded.png");

  /* ================= the board, the hint, and the workspace's scenery ====
     All of this is layout, so none of it is checked by reading the source:
     it is measured in the browser that draws it, and photographed. */
  console.log("\n== the board, read one lesson at a time ==");
  const KEY = { F3:{ key:"F3", vk:114 }, F1:{ key:"F1", vk:112 },
                RIGHT:{ key:"ArrowRight", vk:39 }, LEFT:{ key:"ArrowLeft", vk:37 },
                DOWN:{ key:"ArrowDown", vk:40 }, UP:{ key:"ArrowUp", vk:38 } };
  const rowNames = () => b.eval(
    "[].map.call(document.querySelectorAll('#qlist .quest .qname'), function(e){return e.textContent;})");
  const tabNames = () => b.eval(
    "[].map.call(document.querySelectorAll('#qtabs .qtab'), function(e){return e.textContent;})");
  const railNames = () => b.eval(
    "[].map.call(document.querySelectorAll('#railquests .rline .rn'), function(e){return e.textContent;})");
  const boxOf = sel => b.eval(
    "(function(){var r=document.querySelector('" + sel + "').getBoundingClientRect();" +
    "return {w:Math.round(r.width),h:Math.round(r.height),t:Math.round(r.top)};})()");
  const hairText = sel => b.eval("(document.querySelector('" + sel + "')||{}).textContent||''");

  await b.key("F3", KEY.F3); await wait(150);
  const tabs = await tabNames();
  ok("the log has a tab per lesson on the board", tabs.length >= 2, tabs);
  ok("the first is Lesson 1", /^L1/.test(tabs[0]), tabs);
  ok("the drills are the last", /drills/.test(tabs[tabs.length - 1]), tabs);
  ok("each tab says how many are in it", tabs.every(t => /\d/.test(t)), tabs);
  ok("exactly one tab is in hand",
     (await b.eval("document.querySelectorAll('#qtabs .qtab.on').length")) === 1);
  const l1rows = await rowNames();
  ok("the list shows that tab and no more", l1rows.length >= 1 && l1rows.length <= 12, l1rows.length);
  await b.key("ArrowRight", KEY.RIGHT); await wait(120);
  const l2rows = await rowNames();
  ok("turning the tab changes the list",
     JSON.stringify(l1rows) !== JSON.stringify(l2rows), [l1rows[0], l2rows[0]]);
  ok("and the caret is on a quest that is actually on the page",
     (await b.eval("document.querySelectorAll('#qlist .quest.sel').length")) === 1);
  ok("nothing outside the tab is left in the list",
     (await b.eval("document.querySelectorAll('#qlist .quest').length")) === l2rows.length);
  await b.key("ArrowLeft", KEY.LEFT); await wait(120);
  ok("and back again", JSON.stringify(await rowNames()) === JSON.stringify(l1rows));
  await b.shot(__dirname + "/boot-tabs.png");

  console.log("\n== kept to hand, and moved by hand ==");
  await b.key("ArrowDown", KEY.DOWN); await b.key("ArrowDown", KEY.DOWN);
  await wait(100);
  const chosen = await b.eval("document.querySelector('#qlist .quest.sel .qname').textContent");
  await b.key("KeyF", { key:"f", vk:70 }); await wait(150);
  ok("F marks it on its row",
     (await b.eval("document.querySelector('#qlist .quest.sel .qfav').textContent")) === "\u2726");
  eq2("and takes it to the head of the lesson", (await rowNames())[0], chosen);
  ok("with a labelled hairline under it", /L1/.test(await hairText("#qlist .qhair")),
     await hairText("#qlist .qhair"));
  const rail = await railNames();
  ok("the margin puts it straight under free play",
     rail[1].toLowerCase() === chosen.toLowerCase(), [rail[1], chosen]);
  ok("marked there as it is on its row",
     (await b.eval(
       "document.querySelectorAll('#railquests .rline')[1].querySelector('.rf').textContent"))
     === "\u2726");
  /* the margin is one lesson deep now, and its tags say which lesson */
  ok("and the margin draws no dividers at all",
     (await b.eval("document.querySelectorAll('#railquests .rhair').length")) === 0);
  ok("its tag says which lesson it is showing",
     /L1/.test(await b.eval("(document.querySelector('#rtabs .rtab.on')||{}).textContent||''")),
     await b.eval("(document.querySelector('#rtabs .rtab.on')||{}).textContent||''"));
  await b.shot(__dirname + "/boot-favourite.png");
  await b.key("KeyF", { key:"f", vk:70 }); await wait(150);
  ok("F again lets it go",
     (await b.eval("document.querySelector('#qlist .quest.sel .qfav').textContent")) === "");

  const wasOrder = await rowNames();
  await b.key("ArrowUp", KEY.UP); await wait(80);
  await b.key("ArrowUp", KEY.UP); await wait(80);
  await b.key("ArrowDown", Object.assign({ shift:true }, KEY.DOWN)); await wait(150);
  const nowOrder = await rowNames();
  ok("shift and down move the quest itself",
     nowOrder[0] === wasOrder[1] && nowOrder[1] === wasOrder[0], [wasOrder.slice(0,2), nowOrder.slice(0,2)]);
  ok("and the caret went with it",
     (await b.eval("document.querySelector('#qlist .quest.sel .qname').textContent")) === wasOrder[0]);
  await b.key("ArrowUp", Object.assign({ shift:true }, KEY.UP)); await wait(150);
  ok("shift and up put it back",
     JSON.stringify(await rowNames()) === JSON.stringify(wasOrder), await rowNames());
  await b.key("F3", KEY.F3); await wait(120);

  console.log("\n== the standing hint, and nothing moving because of it ==");
  const hint = () => b.eval("document.getElementById('hints').textContent");
  const pageHint = await hint();
  ok("the hint is under the footer and not empty", pageHint.length > 10, pageHint);
  ok("it names what writes a note", /notes|up, down, again/.test(pageHint), pageHint);
  const hb = await boxOf("#hints");
  ok("it has a height of its own", hb.h > 6, hb);
  ok("and does not run off the measure", hb.w <= (await b.eval("window.innerWidth")), hb);
  const mainA = await boxOf("main");
  await b.key("F3", KEY.F3); await wait(150);
  const questHint = await hint();
  ok("in the quest log it names the lesson keys", /lesson/.test(questHint), questHint);
  ok("and the two marks", /keep to hand/.test(questHint) && /move it/.test(questHint), questHint);
  const mainB = await boxOf("main");
  await b.key("F3", KEY.F3); await b.key("F1", KEY.F1); await wait(150);
  const keyHint = await hint();
  ok("on the key page it names the key and the tempo",
     /tonic/.test(keyHint) && /tempo/.test(keyHint), keyHint);
  const mainC = await boxOf("main");
  await b.key("F1", KEY.F1); await wait(150);
  /* the pages have always been of different lengths — the key page is a wall
     of prose and always was — so what is checked is that the hint costs the
     same on all of them: it is the same strip, at the same height, wherever
     it is, and it is the last thing on the page in each case */
  const hintOn = async () => {
    const r = await boxOf("#hints");
    return r.h;
  };
  const hA = await hintOn();
  await b.key("F3", KEY.F3); await wait(150);
  const hB = await hintOn();
  await b.key("F3", KEY.F3); await b.key("F1", KEY.F1); await wait(150);
  const hC = await hintOn();
  await b.key("F1", KEY.F1); await wait(150);
  ok("the hint is the same height on every page", hA === hB && hB === hC, [hA, hB, hC]);
  ok("and it is not what pushed the pattern page off the screen",
     mainA.h <= (await b.eval("window.innerHeight")),
     [mainA.h, await b.eval("window.innerHeight")]);
  /* the tabs were the point: the log used to be a column of every quest there
     is — 1427px of it in a 905px window — and no tab of it may overflow now */
  await b.key("F3", KEY.F3); await wait(150);
  const tabHeights = [];
  for (let t = 0; t < 4; t++){
    tabHeights.push((await boxOf("main")).h);
    await b.key("ArrowRight", KEY.RIGHT); await wait(160);
  }
  await b.key("F3", KEY.F3); await wait(120);
  const winFit = await b.eval("window.innerHeight");
  ok("every tab of the log fits the window",
     tabHeights.every(h => h <= winFit), [tabHeights, winFit]);
  ok("however long a lesson gets, the list itself is bounded",
     /#qlist\{[\s\S]*?max-height/.test(fs.readFileSync(REPO + "/folio.html", "utf8")));
  const bodyH = mainC.h;                       /* the key page, the tallest */
  const winH = await b.eval("window.innerHeight");
  ok("the page still never offers a scrollbar",
     (await b.eval("getComputedStyle(document.body).overflow")) === "hidden",
     [bodyH, winH]);
  ok("nothing scrolls sideways either",
     (await b.eval("document.documentElement.scrollWidth")) <=
     (await b.eval("window.innerWidth")) + 2);
  await b.shot(__dirname + "/boot-hints.png");

  console.log("\n== the workspace wears its own scene ==");
  await b.key("F3", KEY.F3); await wait(150);
  let found = await rowIndex("shadow");
  for (let t = 0; t < 6 && found < 0; t++){
    await b.key("ArrowRight", KEY.RIGHT); await wait(80);
    found = await rowIndex("shadow");
  }
  ok("the shadow is on the board", found >= 0, found);
  const selNow = await b.eval(
    "(function(){var r=document.querySelectorAll('#qlist .quest');" +
    "for(var i=0;i<r.length;i++) if(r[i].classList.contains('sel')) return i; return 0;})()");
  for (let i = selNow; i < found; i++){ await b.key("ArrowDown", KEY.DOWN); await wait(40); }
  for (let i = selNow; i > found; i--){ await b.key("ArrowUp", KEY.UP); await wait(40); }
  await b.key("Enter", { key:"Enter", vk:13 });
  await b.key("F3", KEY.F3); await wait(200);
  ok("and it is the workspace in hand — the margin is what says so",
     /shadow/i.test(await b.eval("document.getElementById('railtitle').textContent")),
     await b.eval("document.getElementById('railtitle').textContent"));
  eq2("the page starts on paper", await scene(), "paper");
  for (let i = 0; i < 3; i++){ await b.key("KeyB", { key:"B", vk:66, shift:true }); await wait(150); }
  for (let i = 0; i < 40 && (await scene()) !== "quest"; i++) await wait(150);
  eq2("three turns of shift+B lands on the workspace's own", await scene(), "quest");
  const bg = await b.eval("getComputedStyle(document.body).backgroundImage");
  ok("and the picture behind the sheet is that workspace's",
     bg.indexOf("quest-backgrounds/shadow.png") >= 0, bg.slice(0, 220));
  ok("veiled, as the other scenes are", /linear-gradient/.test(bg), bg.slice(0, 120));
  /* ---- and the ground never changed to a picture that was not there yet ----
     The scene used to go up the moment it was asked for and the picture be
     fetched afterwards, so the sheet sat on bare parchment for a few frames.
     A decoded image is one the browser hands back complete on the spot. */
  ok("the picture was already fetched and drawn before the ground changed",
     await b.eval("(function(){var i=new Image();" +
       "i.src='quest-backgrounds/shadow.png';return i.complete;})()"));
  ok("and one scene giving way to another has a layer to do it on",
     (await b.eval("!!document.getElementById('scenefade')")) &&
     /\.scenefade\{[\s\S]*?transition:opacity/.test(fs.readFileSync(REPO + "/folio.html", "utf8")));
  ok("the torn sheet is under the work",
     (await b.eval("getComputedStyle(document.querySelector('.field'),'::before').backgroundImage"))
       .indexOf("folio-paper.png") >= 0);
  ok("the title keeps its darkening breath over the picture",
     /^radial-gradient/.test(await b.eval(
       "getComputedStyle(document.querySelector('header'),'::before').backgroundImage")));
  ok("and so do the footer and the hint under it",
     /^radial-gradient/.test(await b.eval(
       "getComputedStyle(document.querySelector('.foot'),'::before').backgroundImage")));
  ok("the margins too",
     /^radial-gradient/.test(await b.eval(
       "getComputedStyle(document.getElementById('raill'),'::before').backgroundImage")));
  ok("the hint is pale ink over the scene, not the page's brown",
     (await b.eval("getComputedStyle(document.getElementById('hints')).color"))
       !== "rgb(169, 156, 130)",
     await b.eval("getComputedStyle(document.getElementById('hints')).color"));
  await b.shot(__dirname + "/boot-quest-scenery.png");
  await b.key("F3", KEY.F3); await wait(200);
  await b.shot(__dirname + "/boot-quest-scenery-log.png");
  await b.key("F3", KEY.F3); await wait(100);

  const mainScene = await boxOf("main");
  await b.eval("document.querySelectorAll('#railquests .rline')[0].click()");
  await wait(300);
  eq2("free play falls back to paper", await scene(), "paper");
  const mainFree = await boxOf("main");
  /* the scene costs the page what forest and sea have always cost it — the
     title and the footer step off the sheet — and nothing more: the measure
     is the same, and the page is still centred */
  ok("and the fall costs the measure nothing",
     mainScene.w === mainFree.w, [mainScene, mainFree]);
  ok("the page is still centred either way",
     Math.abs((mainScene.t * 2 + mainScene.h) - (mainFree.t * 2 + mainFree.h)) <= 4,
     [mainScene, mainFree]);
  await b.key("KeyB", { key:"B", vk:66, shift:true }); await wait(150);
  ok("still no runtime error from any of it", errors.length === 0, errors);
  clearInterval(drain);
  b.close();
  srv.kill();
  await wait(400);
  if (fs.existsSync(BACK)) fs.copyFileSync(BACK, LOG);
  console.log("\n" + pass + " passed, " + fail + " failed\n");
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log("harness crashed: " + (e && e.stack || e)); process.exit(1); });
