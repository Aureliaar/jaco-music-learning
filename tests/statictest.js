/* The shared copy, end to end: dist/ served by a dumb static host with no
   /api at all, in real headless Chrome. Proves the seed arrives, the footer
   says read-only, and nothing is ever written back. */
const { spawn, execFileSync } = require("child_process");
const http = require("http");
const fs = require("fs");
const net = require("net");
const path = require("path");
const { launch } = require("./cdp.js");

const REPO = require("path").resolve(__dirname, "..").split("\\").join("/");
const DIST = REPO + "/dist";

let pass = 0, fail = 0;
function ok(name, cond, extra){
  if (cond){ pass++; console.log("  ok   " + name); }
  else { fail++; console.log("  FAIL " + name + (extra !== undefined ? "  -> " + JSON.stringify(extra).slice(0,400) : "")); }
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

const MIME = { ".html":"text/html; charset=utf-8", ".json":"application/json; charset=utf-8",
               ".png":"image/png" };
const seen = [];

(async function(){
  console.log("\n== the deploy artifact ==");
  execFileSync(process.execPath, [REPO + "/scripts/build.mjs"], { stdio: "ignore" });
  const listed = [];
  (function walk(d, p){ for (const e of fs.readdirSync(d, { withFileTypes:true }))
    e.isDirectory() ? walk(path.join(d, e.name), p + e.name + "/") : listed.push(p + e.name); })(DIST, "");
  listed.sort();
  /* the auditor page joined the deploy after this harness was written: the
     instrument, the blind lineup page, and the seed — and nothing else */
  ok("dist holds the pages and the seed and nothing else",
     JSON.stringify(listed) === JSON.stringify(
       ["auditor.html","folio-forest.png","folio-paper.png","folio-sea.png","index.html","quests/quest-log.json"]), listed);
  for (const secret of ["BUDGET.md","CURRICULUM.md","QUESTS.md","SPEC-LESSON-0.md","server.mjs"])
    ok("the deploy leaves " + secret + " at home", !listed.includes(secret));

  const port = await freePort(4180);
  const BASE = "http://127.0.0.1:" + port;
  /* a host that knows nothing but files: no /api, plain-text 404s */
  const srv = http.createServer((req, res) => {
    seen.push(req.method + " " + req.url);
    let p = req.url.split("?")[0];
    if (p === "/") p = "/index.html";
    const file = path.join(DIST, p);
    if (req.method !== "GET" || !file.startsWith(path.resolve(DIST)) || !fs.existsSync(file)){
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("Not Found"); return;
    }
    res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream" });
    res.end(fs.readFileSync(file));
  });
  await new Promise(r => srv.listen(port, "127.0.0.1", r));

  console.log("\n== a brother opens the link ==");
  const prof = __dirname + "/prof-static";
  fs.rmSync(prof, { recursive:true, force:true });
  const b = await launch({ profile: prof, port: 9351 });
  const errors = [];
  b.send("Runtime.enable"); b.send("Log.enable");
  const drain = setInterval(() => {
    while (b.events.length){
      const e = b.events.shift();
      if (e.method === "Runtime.exceptionThrown")
        errors.push(JSON.stringify(e.params.exceptionDetails).slice(0,300));
      if (e.method === "Log.entryAdded" && e.params.entry.level === "error"){
        const t = e.params.entry.text + " " + (e.params.entry.url || "");
        /* the 404 on /api is the whole point; a favicon is not our business */
        if (!/favicon|api\/quest-log/.test(t)) errors.push(t);
      }
    }
  }, 50);

  await b.goto(BASE + "/");
  await wait(900);
  ok("the page booted with no runtime error", errors.length === 0, errors);
  ok("it is the folio", (await b.eval("document.querySelector('h1').textContent")) === "Folio");
  ok("it asked for /api once", seen.filter(s => /api\/quest-log/.test(s)).length === 1, seen);
  ok("and then for the committed log",
     seen.some(s => s === "GET /quests/quest-log.json"), seen);

  console.log("\n== quiet scenery ==");
  ok("paper is the calm default",
     (await b.eval("document.body.getAttribute('data-scenery')")) === "paper");
  await b.key("KeyB", { key:"B", vk:66, shift:true });
  await wait(250);
  ok("shift+B reaches the forest",
     (await b.eval("document.body.getAttribute('data-scenery')")) === "forest");
  ok("the forest image is requested only when chosen",
     seen.some(s => s === "GET /folio-forest.png"), seen);
  ok("and the torn sheet arrives with it",
     seen.some(s => s === "GET /folio-paper.png"), seen);
  ok("the scenery preference is kept apart from the folio",
     (await b.eval("localStorage.getItem('folio.scenery.v1')")) === "forest");
  const railPanels = await b.eval(`(function(){
    return Array.from(document.querySelectorAll('.rail')).map(function(el){
      var r=el.getBoundingClientRect(),s=getComputedStyle(el),p=getComputedStyle(el,'::before');
      return {top:r.top,bottom:r.bottom,viewport:innerHeight,left:r.left,right:r.right,
              height:r.height,client:el.clientHeight,scroll:el.scrollHeight,
              background:s.backgroundColor,image:s.backgroundImage,shadow:s.boxShadow,overflow:s.overflow,
              fade:p.backgroundImage,
              mainFade:getComputedStyle(document.querySelector('main'),'::before').backgroundImage};
    });
  })()`);
  ok("the edge copy sits bounded in the scene, on no panel of its own",
     railPanels.every(r => r.top > 0 && r.bottom < r.viewport && r.image === "none"), railPanels);
  ok("the rails breathe a borderless darkening scrim, and the folio is the torn sheet",
     railPanels.every(r => r.background === "rgba(0, 0, 0, 0)" && r.shadow === "none" &&
       /^radial-gradient/.test(r.fade) && r.fade.indexOf("closest-side") >= 0 &&
       r.mainFade.indexOf("folio-paper.png") >= 0), railPanels);
  ok("neither rail fade clips its copy",
     railPanels.every(r => r.overflow === "visible"), railPanels);
  const sceneryStyle = await b.eval(`(function(){
    var el=document.getElementById('scenery'),s=getComputedStyle(el);
    return {border:s.borderTopWidth,box:s.backgroundImage,
            scrim:getComputedStyle(el,'::before').backgroundImage,
            selected:getComputedStyle(el.querySelector('[aria-pressed=true]')).backgroundColor};
  })()`);
  ok("the scenery control has no hard panel edge either",
     sceneryStyle.border === "0px" && sceneryStyle.box === "none" &&
     /^radial-gradient/.test(sceneryStyle.scrim) &&
     sceneryStyle.scrim.indexOf("closest-side") >= 0 &&
     sceneryStyle.selected === "rgba(0, 0, 0, 0)", sceneryStyle);
  await b.eval("document.querySelector('button[data-scene=sea]').click()");
  await wait(250);
  ok("the pointer control reaches the sea",
     (await b.eval("document.body.getAttribute('data-scenery')")) === "sea");
  ok("and says which choice is pressed",
     (await b.eval("document.querySelector('button[data-scene=sea]').getAttribute('aria-pressed')")) === "true");

  const disk = JSON.parse(fs.readFileSync(REPO + "/quests/quest-log.json", "utf8"));
  const inPage = await b.eval("JSON.parse(localStorage.getItem('folio.quests.v2'))");
  ok("the committed quests are what the page holds",
     JSON.stringify(Object.keys(inPage.quests || {}).sort()) ===
     JSON.stringify(Object.keys(disk.quests || {}).sort()),
     [Object.keys(inPage.quests||{}), Object.keys(disk.quests||{})]);
  const firstQuest = Object.keys(disk.quests || {})[0];
  if (firstQuest){
    const a = JSON.stringify((disk.quests[firstQuest].pattern || disk.quests[firstQuest].motif || {}).steps);
    const c = JSON.stringify((inPage.quests[firstQuest].pattern || {}).steps);
    ok("and his melody came through note for note (" + firstQuest + ")", a === c, [a, c]);
  }

  await b.key("F3", { key:"F3", vk:114 });
  await wait(150);
  const footer = await b.eval("document.getElementById('footer').textContent");
  ok("the footer calls it a read-only copy", / · read-only copy$/.test(footer), footer);
  ok("it does not claim to be synced", !/synced|sync failed/.test(footer), footer);
  await b.key("F3", { key:"F3", vk:114 });

  console.log("\n== and he can play with it himself ==");
  const before = seen.length;
  await b.key("KeyZ", { key:"z", vk:90 });
  await b.key("KeyX", { key:"x", vk:88 });
  await wait(2600);                       /* longer than the 2s push debounce */
  ok("his notes land", /[A-G]/.test(await b.eval("document.querySelectorAll('#column .row')[0].textContent")));
  ok("they are kept in his own browser",
     (await b.eval("localStorage.getItem('folio.quests.v2')")).length > 0);
  /* the browser's own favicon poke is not the app talking */
  const said = seen.slice(before).filter(s => !/favicon/.test(s));
  ok("and nothing at all was sent back", said.length === 0, said);
  ok("no PUT ever reached the host", !seen.some(s => /^PUT/.test(s)), seen);
  ok("still no runtime errors", errors.length === 0, errors);

  console.log("\n== he comes back tomorrow ==");
  const own = await b.eval("localStorage.getItem('folio.quests.v2')");
  await b.goto(BASE + "/");
  await wait(1200);
  const after = await b.eval("localStorage.getItem('folio.quests.v2')");
  ok("his own work is what he finds, not the seed again",
     JSON.parse(after).free.steps[0] === JSON.parse(own).free.steps[0],
     [JSON.parse(after).free.steps.slice(0,2), JSON.parse(own).free.steps.slice(0,2)]);
  ok("and the seed was not fetched a second time",
     seen.filter(s => s === "GET /quests/quest-log.json").length === 1, seen);
  ok("his scenery is still the sea",
     (await b.eval("document.body.getAttribute('data-scenery')")) === "sea");

  clearInterval(drain);
  b.close();
  srv.close();
  await wait(300);
  console.log("\n" + pass + " passed, " + fail + " failed\n");
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log("harness crashed: " + (e && e.stack || e)); process.exit(1); });
