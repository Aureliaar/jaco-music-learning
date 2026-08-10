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
               ".png":"image/png", ".css":"text/css; charset=utf-8",
               ".js":"text/javascript; charset=utf-8" };
const seen = [];

(async function(){
  console.log("\n== the deploy artifact ==");
  execFileSync(process.execPath, [REPO + "/scripts/build.mjs"], { stdio: "ignore" });
  const listed = [];
  (function walk(d, p){ for (const e of fs.readdirSync(d, { withFileTypes:true }))
    e.isDirectory() ? walk(path.join(d, e.name), p + e.name + "/") : listed.push(p + e.name); })(DIST, "");
  listed.sort();
  /* the auditor page joined the deploy after this harness was written, and
     the per-workspace stills after that: the instrument, the blind lineup
     page, the seed, and the pictures — and nothing else */
  const stills = listed.filter(n => n.indexOf("quest-backgrounds/") === 0);
  const samples = listed.filter(n => n.indexOf("kits/") === 0);
  const rest = listed.filter(n => n.indexOf("quest-backgrounds/") !== 0 &&
                                  n.indexOf("kits/") !== 0);
  ok("dist holds the pages, the app, the seed and nothing else",
     JSON.stringify(rest) === JSON.stringify(
       ["auditor.html","folio-forest.png","folio-paper.png","folio-sea.png",
        "folio.css","index.html",
        "js/audio.js","js/boot.js","js/echo.js","js/edit.js","js/entry.js","js/quests.js",
        "js/quiz.js","js/state.js","js/tones.js","js/views.js",
        "quests/quest-log.json","quests/rulings.json"]), rest);
  /* the kits travel whole — a dumb host has no /api/kits to list them, so the
     page asks each one for its manifest.md by name and the label has to be
     there beside the samples it names */
  const kitDirs = fs.readdirSync(REPO + "/kits", { withFileTypes:true })
                    .filter(e => e.isDirectory()).map(e => e.name).sort();
  ok("every kit on the shelf travels", kitDirs.length > 0 &&
     kitDirs.every(k => samples.includes("kits/" + k + "/manifest.md")), samples);
  ok("with its samples beside its label",
     kitDirs.every(k => samples.some(n => n.indexOf("kits/" + k + "/") === 0 &&
                                          n.endsWith(".wav"))), samples);
  ok("and nothing else out of kits/ — the bake script stays home",
     samples.every(n => n.endsWith(".wav") || n.endsWith("/manifest.md")), samples);
  /* the split is only safe if every script the page names actually travels */
  const named = (fs.readFileSync(DIST + "/index.html", "utf8")
                   .match(/<script src="([^"]+)"/g) || [])
                  .map(t => t.slice(13, -1));
  ok("and every script index.html names is one of them",
     named.length === 10 && named.every(n => listed.includes(n)), named);
  ok("with the stylesheet it names beside them",
     /<link[^>]+href="folio\.css"/.test(fs.readFileSync(DIST + "/index.html", "utf8")));
  ok("and the workspaces' own stills travel with them",
     stills.length === fs.readdirSync(REPO + "/quest-backgrounds").filter(n => n.endsWith(".png")).length &&
     stills.length > 0, stills.length);
  ok("each still is named after a workspace and nothing else",
     stills.every(n => /^quest-backgrounds\/[A-Za-z0-9._-]+\.png$/.test(n)), stills.slice(0, 3));
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
        /* the 404s on /api are the whole point — the log's, and the shelf of
           kits the scriptorium asks a dumb host for and does not get; a
           favicon is not our business either */
        if (!/favicon|api\/quest-log|api\/kits/.test(t)) errors.push(t);
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

  /* and the fallback is not decoration: with no API to list the shelf, the
     page must still have the kits its rails name, off plain files */
  await b.eval("doc.tones = [null, 'sub']; voiceSamples(1);");
  let bank = 0;
  for (let i = 0; i < 40; i++){
    bank = await b.eval("(kitBank.sub||[]).length");
    if (bank > 0) break;
    await wait(200);
  }
  ok("a dumb host still gives the page the kit its page names", bank > 0, bank);
  ok("asked for by name, off the disk — there is no shelf to list",
     seen.some(t => t === "GET /kits/sub/manifest.md"), seen.filter(t => /kits/.test(t)));
  ok("and the samples the label named came with it",
     seen.some(t => t.indexOf("GET /kits/sub/") === 0 && /[.]wav$/.test(t)));

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
              /* the sheet moved off <main> and onto the working field alone:
                 the title and the footer stand in the scene now */
              mainFade:getComputedStyle(document.querySelector('.field'),'::before').backgroundImage,
              onMain:getComputedStyle(document.querySelector('main'),'::before').backgroundImage};
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
  ok("and <main> as a whole is no longer the sheet",
     railPanels.every(r => r.onMain.indexOf("folio-paper.png") < 0), railPanels);

  /* the title and the footer took the margins' treatment: off the sheet, in
     the scene, pale ink over the same borderless breath */
  const ends = await b.eval(`(function(){
    var out = {};
    /* the footer is marginalia and wears the scene's scrim on the box it
       sits in rather than on itself: .foot is what carries it */
    ['header','.foot'].forEach(function(sel){
      var el = document.querySelector(sel), s = getComputedStyle(el),
          p = getComputedStyle(el, '::before'),
          f = document.querySelector('.field').getBoundingClientRect(),
          r = el.getBoundingClientRect();
      out[sel] = { background:s.backgroundColor, image:s.backgroundImage,
                   border:s.borderTopWidth, shadow:s.boxShadow,
                   scrim:p.backgroundImage,
                   /* clear of the working field, which is what the sheet covers */
                   clear: sel === 'header' ? r.bottom <= f.top : r.top >= f.bottom,
                   ink:getComputedStyle(el.querySelector('h1,#footer') || el).color };
    });
    out.divider = getComputedStyle(document.querySelector('.divider')).display;
    out.wash = getComputedStyle(document.querySelector('.field')).getPropertyValue('--wash').trim();
    return out;
  })()`);
  ok("the title and the footer stand in the scene, on no sheet and no panel",
     ['header','.foot'].every(k => ends[k].background === "rgba(0, 0, 0, 0)" &&
       ends[k].image === "none" && ends[k].shadow === "none" &&
       ends[k].border === "0px" && ends[k].clear), ends);
  ok("each breathes the same borderless darkening the margins do",
     ['header','.foot'].every(k => /^radial-gradient/.test(ends[k].scrim) &&
       ends[k].scrim.indexOf("closest-side") >= 0 &&
       /rgba\(13, 18, 16, 0\)/.test(ends[k].scrim)), ends);
  ok("the rules that fenced them off are the torn edges now",
     ends.divider === "none", ends.divider);
  ok("the wash steps down with the darker sheet",
     ends.wash.toUpperCase() === "#D9C9A8", ends.wash);
  /* the ground is baked into the sheet, not written in CSS: read it back out
     of the image the deploy actually carries (scripts/bake-paper.mjs) */
  const ground = await b.eval(`(async function(){
    const img = new Image(); img.src = "/folio-paper.png"; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const g = c.getContext('2d', { willReadFrequently:true }); g.drawImage(img, 0, 0);
    const d = g.getImageData(Math.round(img.width*0.3), Math.round(img.height*0.3),
                             Math.round(img.width*0.4), Math.round(img.height*0.4)).data;
    let s = [0,0,0], a = 0;
    for (let i = 0; i < d.length; i += 4){ s[0]+=d[i]; s[1]+=d[i+1]; s[2]+=d[i+2]; a+=d[i+3]; }
    const n = d.length / 4;
    return { rgb:s.map(v => Math.round(v/n)), alpha:Math.round(a/n), w:img.width, h:img.height };
  })()`);
  ok("the sheet is whole inside and its ground a dab under the plain page's",
     ground.alpha === 255 && ground.w === 1280 && ground.h === 1280 &&
     ground.rgb.every((v, i) => Math.abs(v - [227,215,192][i]) <= 3), ground);
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

  const sharedDisk = JSON.parse(fs.readFileSync(DIST + "/quests/quest-log.json", "utf8"));
  const inPage = await b.eval("JSON.parse(localStorage.getItem('folio.quests.v2'))");
  ok("the committed quests are what the page holds",
     JSON.stringify(Object.keys(inPage.quests || {}).sort()) ===
     JSON.stringify(Object.keys(sharedDisk.quests || {}).sort()),
     [Object.keys(inPage.quests||{}), Object.keys(sharedDisk.quests||{})]);
  /* The completions live in a file of their own now, and the build publishes
     the ones QUESTS.md records. Whatever that list is on the day, the page
     must show exactly what the published rulings say — off a dumb host with
     no /api, which is the whole point of the plain-file fallback. What is
     deliberately *not* asserted is any particular count or melody:
     quests/quest-log.json is the player's live workspace, and a harness that
     reads its contents goes red every time they write something. */
  const ruleSnap = JSON.parse(fs.readFileSync(DIST + "/quests/rulings.json", "utf8"));
  ok("the log the shared copy carries speaks of no verdict at all",
     JSON.stringify(sharedDisk).indexOf('"done"') < 0);
  const doneInSnap = Object.keys(ruleSnap.complete || {})
                       .filter(id => ruleSnap.complete[id]).sort();
  const doneInPage = (await b.eval("JSON.stringify(Object.keys(rulings).filter(function(k){return rulings[k];}).sort())"));
  ok("the completions the rulings publish are the completions the page shows",
     doneInPage === JSON.stringify(doneInSnap), [doneInPage, doneInSnap]);
  ok("and it asked a plain host for them by name",
     seen.some(s => s === "GET /quests/rulings.json"), seen);
  const firstQuest = Object.keys(sharedDisk.quests || {})[0];
  if (firstQuest){
    const a = JSON.stringify((sharedDisk.quests[firstQuest].pattern || {}).steps);
    const c = JSON.stringify((inPage.quests[firstQuest].pattern || {}).steps);
    ok("and the melody in it came through note for note (" + firstQuest + ")", a === c, [a, c]);
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
  await b.eval(`(function(){
    var stale=JSON.parse(localStorage.getItem('folio.quests.v2'));
    stale.free.title='visitor-only stale copy';
    localStorage.setItem('folio.quests.v2',JSON.stringify(stale));
  })()`);
  await b.goto(BASE + "/");
  await wait(1200);
  const after = await b.eval("localStorage.getItem('folio.quests.v2')");
  ok("the published showcase replaces his stale local copy",
     JSON.parse(after).free.title === sharedDisk.free.title,
     [JSON.parse(after).free.title, sharedDisk.free.title]);
  ok("and the seed was fetched again",
     seen.filter(s => s === "GET /quests/quest-log.json").length === 2, seen);
  ok("his scenery is still the sea",
     (await b.eval("document.body.getAttribute('data-scenery')")) === "sea");

  clearInterval(drain);
  b.close();
  srv.close();
  await wait(300);
  console.log("\n" + pass + " passed, " + fail + " failed\n");
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log("harness crashed: " + (e && e.stack || e)); process.exit(1); });
