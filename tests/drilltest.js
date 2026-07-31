/* Real-browser check of live drill delivery: start the server, open the page,
   THEN write a second drill into quests/quest-log.json on disk, wait past the
   poll interval, and assert it arrives in an open tab — without a reload, and
   without disturbing the work already there. */
const { spawn } = require("child_process");
const fs = require("fs");
const net = require("net");
const { launch } = require("./cdp.js");

const REPO = require("path").resolve(__dirname, "..").split("\\").join("/");
const LOG  = REPO + "/quests/quest-log.json";
const BACK = __dirname + "/quest-log.drillbackup.json";

let pass = 0, fail = 0;
function ok(name, cond, extra){
  if (cond){ pass++; console.log("  ok   " + name); }
  else { fail++; console.log("  FAIL " + name + (extra !== undefined ? "  -> " + JSON.stringify(extra).slice(0,500) : "")); }
}
function eq(name, a, b){ ok(name, JSON.stringify(a) === JSON.stringify(b), { got:a, want:b }); }
const wait = ms => new Promise(r => setTimeout(r, ms));
function freePort(start){
  return new Promise(res => {
    const s = net.createServer();
    s.once("error", () => res(freePort(start + 1)));
    s.once("listening", () => s.close(() => res(start)));
    s.listen(start, "127.0.0.1");
  });
}
const readLog = () => JSON.parse(fs.readFileSync(LOG, "utf8"));

const ITCH = { id:"drill-itch", name:"the itch drill",
  summary:"loop the scale, swap the final note; rank each ender by how badly it wants to move",
  teaches:"tendency tones — which notes are chairs and which are standing on one leg",
  pattern:{ version:1, title:"the itch drill", tempo:104, loop:8, key:"F major",
            steps:["F4","G4","A4","A#4","C5","D5","E5","F5",
                   null,null,null,null,null,null,null,null] } };
const SEAM = { id:"drill-seam", name:"the seam drill",
  summary:"end on the fifth and hear the loop pull round",
  teaches:"what a seam does to a cadence",
  pattern:{ version:1, title:"the seam drill", tempo:92, loop:16, key:"D minor",
            steps:["D4","F4","A4","D5",null,null,null,null,
                   "C5","A4","F4","A4",null,null,null,null] } };

(async function(){
  const port = Number(process.env.PORT) || await freePort(4200);
  const BASE = "http://localhost:" + port;
  if (fs.existsSync(LOG)) fs.copyFileSync(LOG, BACK);

  /* a log the user has been working in, with one drill already delivered */
  const seeded = {
    folio:"quest-log", version:2, active:null,
    free:{ version:1, title:"untitled folio", tempo:112, loop:16, key:"C major",
           steps:["G3",null,null,null,null,null,null,null,
                  null,null,null,null,null,null,null,null] },
    quests:{ whitespace:{ done:false, pattern:{ version:1, title:"mine", tempo:88,
      loop:16, key:"A minor", steps:["A3","C4",null,"E4",null,null,null,null,
                                     null,null,null,null,null,null,null,null] } } },
    drills:[ ITCH ]
  };
  fs.writeFileSync(LOG, JSON.stringify(seeded, null, 2) + "\n");

  const srv = spawn(process.execPath, [REPO + "/server.mjs"],
    { cwd: REPO, stdio:["ignore","pipe","pipe"],
      env: Object.assign({}, process.env, { PORT: String(port) }) });
  let srvlog = "";
  srv.stdout.on("data", d => { srvlog += d; });
  srv.stderr.on("data", d => { srvlog += d; });
  for (let i = 0; i < 100; i++){
    try { const r = await fetch(BASE + "/"); if (r.ok) break; } catch (e){}
    await wait(100);
  }

  /* the ETag, straight from the server */
  const g1 = await fetch(BASE + "/api/quest-log");
  const tag = g1.headers.get("etag");
  ok("the log comes with an ETag", !!tag, tag);
  const g2 = await fetch(BASE + "/api/quest-log", { headers: { "if-none-match": tag } });
  ok("and an unchanged file is a 304", g2.status === 304, g2.status);
  ok("which carries the same tag", g2.headers.get("etag") === tag);

  const b = await launch({ profile: __dirname + "/prof-drill", port: 9347 });
  const errors = [];
  b.send("Runtime.enable"); b.send("Log.enable");
  const drain = setInterval(() => {
    while (b.events.length){
      const e = b.events.shift();
      if (e.method === "Runtime.exceptionThrown")
        errors.push(JSON.stringify(e.params.exceptionDetails).slice(0,300));
      if (e.method === "Log.entryAdded" && e.params.entry.level === "error" &&
          !/favicon/.test(e.params.entry.text + " " + (e.params.entry.url || "")))
        errors.push(e.params.entry.text);
    }
  }, 50);

  await b.goto(BASE + "/");
  await wait(800);
  ok("the page booted with no runtime error", errors.length === 0, errors);

  const railText = () => b.eval("document.getElementById('railquests').textContent");
  const listText = () => b.eval("document.getElementById('qlist').textContent");

  const tabText = () => b.eval("document.getElementById('qtabs').textContent");
  const RIGHT = { key:"ArrowRight", vk:39 };
  await b.key("F3", { key:"F3", vk:114 });
  await wait(200);
  /* the board is read one lesson at a time now: the eight are the first tab
     and the delivered drill is the last one */
  ok("the log opens on the lesson", /L1/.test(await tabText()), await tabText());
  ok("with a tab for the drills beside it", /drills/.test(await tabText()), await tabText());
  ok("the eight built-ins are the lesson's tab",
     (await b.eval("document.querySelectorAll('#qlist .quest').length")) === 8);
  ok("and no divider is drawn inside a tab",
     (await b.eval("document.querySelectorAll('#qlist .qhair').length")) === 0);
  await b.key("ArrowRight", RIGHT);
  await wait(120);
  ok("the delivered drill is in the drills tab", /the itch drill/.test(await listText()));
  ok("alone", (await b.eval("document.querySelectorAll('#qlist .quest').length")) === 1);
  /* the margin reads the same tab the board does, so turning to the drills
     turned the margin to them as well — it is one lesson deep now, with no
     labelled dividers left to draw. The tab is left on the drills, which is
     where a delivered drill lands and so where it has to be seen arriving. */
  ok("and in the left rail, which turned with the board",
     /the itch drill/.test(await railText()));
  ok("the margin draws no dividers at all now",
     (await b.eval("document.querySelectorAll('#railquests .rhair').length")) === 0);
  ok("its own tag says which tab it is showing",
     /drills/.test(await b.eval(
       "(document.querySelector('#rtabs .rtab.on')||{}).textContent||''")),
     await b.eval("(document.querySelector('#rtabs .rtab.on')||{}).textContent||''"));
  await b.key("F3", { key:"F3", vk:114 });
  await wait(200);                        /* the log is a page: let it close */

  /* the user does some work, which is autosaved through a PUT */
  await b.key("ArrowDown", { key:"ArrowDown", vk:40 });
  await wait(60);
  await b.key("KeyX", { key:"x", vk:88 });     /* D4 into free play, step 2 */
  await wait(2600);
  const afterWork = readLog();
  ok("the work reached the file", afterWork.free.steps[1] === "D4", afterWork.free.steps.slice(0,3));
  ok("and the PUT round-tripped the drill",
     Array.isArray(afterWork.drills) && afterWork.drills.length === 1 &&
     afterWork.drills[0].id === "drill-itch", afterWork.drills);
  ok("with its pattern unchanged",
     JSON.stringify(afterWork.drills[0].pattern.steps) === JSON.stringify(ITCH.pattern.steps));

  /* --- the delivery: a second drill, written into the file underneath a
     tab that is open and has never been reloaded --- */
  const now = readLog();
  now.drills.push(SEAM);
  fs.writeFileSync(LOG, JSON.stringify(now, null, 2) + "\n");
  console.log("  ..   the seam drill written to disk; waiting out the poll");
  let seen = false;
  for (let i = 0; i < 30 && !seen; i++){
    await wait(1000);
    seen = /the seam drill/.test(await railText());
  }
  if (!seen) console.log("SERVER LOG: " + srvlog.replace(/\n/g, " | ") +
    "  FILE NOW: " + JSON.stringify((readLog().drills || []).map(d => d.id)));
  ok("it appears in the rail with no reload", seen);
  ok("announced quietly in the footer",
     /a drill arrived: the seam drill/.test(
       await b.eval("document.getElementById('footer').textContent")),
     await b.eval("document.getElementById('footer').textContent"));
  ok("and still no dividers in the margin",
     (await b.eval("document.querySelectorAll('#railquests .rhair').length")) === 0);
  ok("the work already on the page is untouched",
     /D-4/.test(await b.eval("document.querySelectorAll('#column .row')[1].textContent")),
     await b.eval("document.querySelectorAll('#column .row')[1].textContent"));

  /* enter it: the seed is what the page arrives holding */
  await b.key("F3", { key:"F3", vk:114 });
  await wait(200);                             /* already on the drills tab */
  ok("and in the drills tab beside the first", /the seam drill/.test(await listText()));
  const idx = await b.eval(
    "(function(){var r=document.querySelectorAll('#qlist .quest');for(var i=0;i<r.length;i++)" +
    "if(/the seam drill/.test(r[i].textContent))return i;return -1;})()");
  ok("it is selectable", idx === 1, idx);
  for (let i = 0; i < idx; i++) await b.key("ArrowDown", { key:"ArrowDown", vk:40 });
  ok("the detail shows its constraint",
     /end on the fifth/.test(await b.eval("document.getElementById('qdtext').textContent")));
  await b.key("Enter", { key:"Enter", vk:13 });
  await b.key("F3", { key:"F3", vk:114 });
  await wait(300);
  const meta = await b.eval("document.getElementById('metatext').textContent");
  ok("entering it lands in its seeded key", /D minor/.test(meta), meta);
  ok("at its tempo, which the meta line now leads with", /^92 · /.test(meta), meta);
  const col = await b.eval("document.getElementById('column').textContent");
  ok("with its pattern on the page", /D-4/.test(col) && /F-4/.test(col) && /A-4/.test(col), col);
  ok("the right rail carries its summary",
     /end on the fifth/.test(await b.eval("document.getElementById('railtext').textContent")));

  /* and the work in the other workspaces survived all of it */
  await wait(2600);
  const final = readLog();
  eq("both drills are in the file", (final.drills || []).map(d => d.id).join(),
     "drill-itch,drill-seam");
  ok("free play kept its notes",
     final.free.steps[0] === "G3" && final.free.steps[1] === "D4", final.free.steps.slice(0,3));
  ok("the quest workspace kept its melody",
     final.quests.whitespace.pattern.steps[0] === "A3", final.quests.whitespace.pattern.steps.slice(0,4));
  /* the log seeded above is single-track throughout — written before the
     second voice existed. Round-tripped through the running app it must come
     back with every note where it was, and a silent bass added beneath it. */
  ok("a single-track workspace round-trips unchanged",
     JSON.stringify(final.quests.whitespace.pattern.steps) ===
     JSON.stringify(seeded.quests.whitespace.pattern.steps),
     final.quests.whitespace.pattern.steps);
  ok("and gains a silent second voice, not a broken one",
     Array.isArray(final.quests.whitespace.pattern.bass) &&
     final.quests.whitespace.pattern.bass.length === 16 &&
     final.quests.whitespace.pattern.bass.every(v => v === null),
     final.quests.whitespace.pattern.bass);
  ok("free play, written before it too, is silent underneath",
     Array.isArray(final.free.bass) && final.free.bass.every(v => v === null),
     final.free.bass);
  ok("the drill's seed pattern is untouched on disk",
     JSON.stringify(final.drills.find(d => d.id === "drill-itch").pattern.steps) ===
     JSON.stringify(ITCH.pattern.steps));
  ok("the drill's own workspace is saved",
     final.quests["drill-seam"] && final.quests["drill-seam"].pattern.steps[0] === "D4",
     final.quests["drill-seam"]);
  ok("no runtime errors through the whole of it", errors.length === 0, errors);

  /* the stale-tab guard on the server: a PUT with no drills at all */
  const stale = JSON.parse(JSON.stringify(final));
  delete stale.drills;
  stale.free.steps[15] = "C5";
  const pr = await fetch(BASE + "/api/quest-log",
    { method:"PUT", headers:{ "content-type":"application/json" }, body: JSON.stringify(stale) });
  ok("a stale PUT is accepted", pr.status === 204, pr.status);
  ok("and answers with an ETag", !!pr.headers.get("etag"));
  const kept = readLog();
  eq("but the server kept both drills anyway",
     (kept.drills || []).map(d => d.id).join(), "drill-itch,drill-seam");
  ok("while writing what the tab did send", kept.free.steps[15] === "C5");

  await b.shot(__dirname + "/drill-arrived.png");
  clearInterval(drain);
  b.close(); srv.kill();
  await wait(400);
  if (fs.existsSync(BACK)) fs.copyFileSync(BACK, LOG);
  console.log("\n" + pass + " passed, " + fail + " failed\n");
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log("harness crashed: " + (e && e.stack || e)); process.exit(1); });
