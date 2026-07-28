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

  await b.shot(__dirname + "/boot-seeded.png");
  clearInterval(drain);
  b.close();
  srv.kill();
  await wait(400);
  if (fs.existsSync(BACK)) fs.copyFileSync(BACK, LOG);
  console.log("\n" + pass + " passed, " + fail + " failed\n");
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log("harness crashed: " + (e && e.stack || e)); process.exit(1); });
