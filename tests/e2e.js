/* Folio's whole test suite: seven journeys through the real app.

   This deliberately tests the seams a self-use instrument cannot afford to
   lose: it boots, both sets of hands can write, work survives a reload,
   assistant-delivered material cannot be clobbered, samples make the trip,
   and the published copy is playable but read-only.

   Every mutable path is redirected into a temporary directory. In
   particular, this file never reads or writes quests/quest-log.json or
   quests/rulings.json. */
const { spawn, execFileSync } = require("child_process");
const fs = require("fs");
const http = require("http");
const net = require("net");
const os = require("os");
const path = require("path");
const { launch } = require("./cdp.js");

const ROOT = path.resolve(__dirname, "..");
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "folio-e2e-"));
const LOG = path.join(TMP, "quest-log.json");
const RULES = path.join(TMP, "rulings.json");
const KITS = path.join(TMP, "kits");
const SCREENSHOT = path.join(__dirname, "e2e.png");
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const silence = n => new Array(n || 16).fill(null);

const SEED = {
  folio: "quest-log", version: 2, active: null,
  free: { version: 1, title: "e2e folio", tempo: 112, loop: 16, key: "C major",
          steps: silence(), bass: silence(), chords: silence() },
  quests: {},
  drills: [{ id: "first-drill", name: "the first drill", summary: "listen once",
             teaches: "sameness", pattern: null }]
};

let passed = 0, failed = 0;
async function journey(name, body){
  try {
    await body();
    passed++;
    console.log("  PASS " + name);
  } catch (error){
    failed++;
    console.log("  FAIL " + name + "\n       " + (error && error.stack || error));
  }
}
function expect(value, message, detail){
  if (!value) throw new Error(message + (detail === undefined ? "" : "\n       " + JSON.stringify(detail)));
}
function readJSON(file){ return JSON.parse(fs.readFileSync(file, "utf8")); }
function writeJSON(file, value){ fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n", "utf8"); }
function freePort(start){
  return new Promise(resolve => {
    const server = net.createServer();
    server.once("error", () => resolve(freePort(start + 1)));
    server.once("listening", () => server.close(() => resolve(start)));
    server.listen(start, "127.0.0.1");
  });
}
async function ready(url){
  for (let i = 0; i < 100; i++){
    try { if ((await fetch(url)).ok) return; } catch (_){}
    await wait(100);
  }
  throw new Error("server did not answer at " + url);
}
async function eventually(check, timeout, message){
  const end = Date.now() + timeout;
  let last;
  while (Date.now() < end){
    last = await check();
    if (last) return last;
    await wait(250);
  }
  throw new Error(message + (last === undefined ? "" : ": " + JSON.stringify(last)));
}
function validWave(){
  const out = Buffer.alloc(48);
  out.write("RIFF", 0); out.writeUInt32LE(40, 4); out.write("WAVEfmt ", 8);
  out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(1, 22);
  out.writeUInt32LE(8000, 24); out.writeUInt32LE(16000, 28);
  out.writeUInt16LE(2, 32); out.writeUInt16LE(16, 34);
  out.write("data", 36); out.writeUInt32LE(4, 40);
  out.writeInt16LE(-1000, 44); out.writeInt16LE(1000, 46);
  return out;
}
function copyForBuild(dest){
  fs.mkdirSync(path.join(dest, "scripts"), { recursive: true });
  fs.mkdirSync(path.join(dest, "quests"), { recursive: true });
  for (const name of ["folio.html", "folio.css", "auditor.html",
                      "folio-forest.png", "folio-sea.png", "folio-paper.png"])
    if (fs.existsSync(path.join(ROOT, name))) fs.copyFileSync(path.join(ROOT, name), path.join(dest, name));
  for (const name of ["js", "kits", "quest-backgrounds"])
    if (fs.existsSync(path.join(ROOT, name))) fs.cpSync(path.join(ROOT, name), path.join(dest, name), { recursive: true });
  fs.copyFileSync(path.join(ROOT, "scripts", "build.mjs"), path.join(dest, "scripts", "build.mjs"));
  writeJSON(path.join(dest, "quests", "quest-log.json"), SEED);
  writeJSON(path.join(dest, "quests", "rulings.json"), { folio:"rulings", version:1, complete:{} });
}
function staticServer(root, seen){
  return http.createServer((req, res) => {
    seen.push(req.method + " " + req.url);
    if (req.method !== "GET" && req.method !== "HEAD"){
      res.writeHead(405).end(); return;
    }
    let name;
    try { name = decodeURIComponent(req.url.split("?")[0]); } catch (_) { res.writeHead(400).end(); return; }
    if (name === "/") name = "/index.html";
    const file = path.resolve(root, "." + name);
    if (!file.startsWith(path.resolve(root) + path.sep)){ res.writeHead(403).end(); return; }
    let body;
    try { body = fs.readFileSync(file); } catch (_) { res.writeHead(404).end(); return; }
    const ext = path.extname(file);
    const types = { ".html":"text/html", ".js":"text/javascript", ".css":"text/css",
                    ".json":"application/json", ".png":"image/png", ".wav":"audio/wav", ".md":"text/plain" };
    res.writeHead(200, { "content-type": types[ext] || "application/octet-stream" });
    res.end(req.method === "HEAD" ? undefined : body);
  });
}

(async function(){
  fs.mkdirSync(KITS, { recursive: true });
  writeJSON(LOG, SEED);
  writeJSON(RULES, { folio:"rulings", version:1, complete:{} });

  const port = await freePort(4210);
  const base = "http://127.0.0.1:" + port;
  const server = spawn(process.execPath, [path.join(ROOT, "server.mjs")], {
    cwd: ROOT, stdio: ["ignore", "pipe", "pipe"],
    env: Object.assign({}, process.env, { PORT:String(port), FOLIO_LOG:LOG,
      FOLIO_RULINGS:RULES, FOLIO_KITS:KITS })
  });
  let serverLog = "";
  server.stdout.on("data", d => { serverLog += d; });
  server.stderr.on("data", d => { serverLog += d; });
  await ready(base + "/");

  const chromePort = await freePort(9410);
  const browser = await launch({ profile:path.join(TMP, "profile"), port:chromePort });
  const errors = [];
  const drain = setInterval(() => {
    while (browser.events.length){
      const event = browser.events.shift();
      if (event.method === "Runtime.exceptionThrown")
        errors.push(JSON.stringify(event.params.exceptionDetails).slice(0, 500));
      if (event.method === "Log.entryAdded" && event.params.entry.level === "error"){
        const line = event.params.entry.text + " " + (event.params.entry.url || "");
        if (!/favicon|api\/rulings/.test(line)) errors.push(line);
      }
    }
  }, 40);

  await journey("1. the folio boots and draws a usable instrument", async () => {
    await browser.goto(base + "/");
    await wait(500);
    const view = await browser.eval(`(function(){
      var rows=document.querySelectorAll('#column .row'), field=document.getElementById('field').getBoundingClientRect();
      return {title:document.title, rows:rows.length, length:docLen(), scripts:document.scripts.length,
              width:Math.round(field.width), height:Math.round(field.height),
              meta:document.getElementById('metatext').textContent};
    })()`);
    expect(view.title === "Folio" && view.length === 16 && view.rows >= view.length && view.scripts === 11,
      "the page did not boot the complete instrument", view);
    expect(view.width > 500 && view.height > 300, "the working folio collapsed", view);
    expect(/112.*C major/.test(view.meta), "the seeded tempo and key are not visible", view.meta);
    expect(errors.length === 0, "the browser raised during boot", errors);
  });

  await journey("2. the keyboard writes lead, bass, chords, and a hold", async () => {
    await browser.key("Home", { key:"Home", vk:36 });
    await browser.key("KeyZ", { key:"z", vk:90 });
    await browser.key("Home", { key:"Home", vk:36 });
    await browser.key("Equal", { key:"=", vk:187 });
    await browser.key("Tab", { key:"Tab", vk:9 });
    await browser.key("Home", { key:"Home", vk:36 });
    await browser.key("KeyX", { key:"x", vk:88 });
    await browser.key("Tab", { key:"Tab", vk:9 });
    await browser.key("Home", { key:"Home", vk:36 });
    await browser.key("KeyZ", { key:"z", vk:90 });
    const state = await browser.eval(`({steps:doc.steps.slice(0,2), hold:doc.hold.slice(0,2),
      bass:doc.bass.slice(0,2), chord:doc.chords[0], cursor:cursor, voice:voice,
      rows:document.querySelectorAll('#column .row').length})`);
    expect(state.steps[0] === "C4" && state.hold[0] === 2, "lead note or its written length was lost", state);
    expect(state.bass[0] === "D4", "the second voice did not receive its note", state);
    expect(state.chord && state.chord.deg === 0, "the chord lane did not receive its degree", state);
    expect(state.cursor === 2 && state.voice === 2 && state.rows >= 16, "entry did not leave the expected page state", state);
  });

  await journey("3. the gamepad remains a complete primary surface", async () => {
    const GP = { X:0, B:1, SQ:2, TR:3, L1:4, R1:5, SEL:8, START:9 };
    await browser.padInstall(); await browser.pad([]);
    await browser.tap(GP.START);
    const crossbar = await browser.eval(`(function(){var s=document.querySelectorAll('#settings .xslot');
      return {on:document.getElementById('settings').classList.contains('on'), count:s.length,
        sized:[].every.call(s,function(e){var r=e.getBoundingClientRect();return r.width>40&&r.height>10;})};})()`);
    expect(crossbar.on && crossbar.count === 8 && crossbar.sized, "start did not raise a laid-out crossbar", crossbar);
    await browser.tap(GP.START);
    await browser.tap(GP.R1);                 // chords -> lead
    await browser.key("End", { key:"End", vk:35 });
    const before = await browser.eval("JSON.stringify(doc.steps)");
    await browser.tap(GP.TR);                 // contour up
    const after = await browser.eval(`({steps:JSON.stringify(doc.steps), voice:voice, cursor:cursor})`);
    expect(after.voice === 0 && after.steps !== before, "R1 and triangle did not reach the lead", after);
    await browser.tap(GP.SEL);
    expect(await browser.eval("playing"), "select did not start transport");
    await browser.tap(GP.SEL);
    expect(!(await browser.eval("playing")), "select did not stop transport");
    expect(errors.length === 0, "the browser raised during pad use", errors);
  });

  await journey("4. autosave survives a server round trip and reload", async () => {
    await eventually(() => {
      const saved = readJSON(LOG).free;
      return saved.steps[0] === "C4" && saved.bass[0] === "D4" && saved.chords && saved.chords[0];
    }, 5000, "the composed page never reached the isolated log");
    await browser.goto(base + "/");
    await wait(700);
    const restored = await browser.eval(`({lead:doc.steps[0], hold:doc.hold[0], bass:doc.bass[0],
      chord:doc.chords[0], title:doc.title})`);
    expect(restored.lead === "C4" && restored.hold === 2 && restored.bass === "D4" &&
           restored.chord && restored.chord.deg === 0, "the saved page did not return intact", restored);
    expect(restored.title === "e2e folio", "the workspace identity changed on reload", restored);
  });

  await journey("5. live drills and rulings arrive without a stale tab undoing them", async () => {
    const disk = readJSON(LOG);
    disk.drills.push({ id:"arriving-drill", name:"the arriving drill",
      summary:"hear the seam", teaches:"return", pattern:null });
    writeJSON(LOG, disk);
    const ruling = await fetch(base + "/api/rulings", { method:"PUT",
      headers:{ "content-type":"application/json" },
      body:JSON.stringify({ folio:"rulings", version:1, complete:{ ladder:true } }) });
    expect(ruling.status === 204, "the ruling endpoint refused a verdict", ruling.status);
    await eventually(async () => browser.eval(`({drill:DRILLS.some(function(d){return d.id==='arriving-drill';}),
      ruled:!!rulings.ladder})`).then(v => v.drill && v.ruled), 13000,
      "the open tab did not adopt the delivered drill and ruling");
    const stale = readJSON(LOG);
    delete stale.drills;
    stale.free.title = "saved by a stale tab";
    const response = await fetch(base + "/api/quest-log", { method:"PUT",
      headers:{ "content-type":"application/json" }, body:JSON.stringify(stale) });
    expect(response.status === 204, "the stale write itself was refused", response.status);
    const kept = readJSON(LOG);
    expect(kept.drills.some(d => d.id === "arriving-drill"), "the stale write erased a delivered drill", kept.drills);
    expect(readJSON(RULES).complete.ladder === true, "saving music erased an independent ruling");
  });

  await journey("6. a sample can enter, appear on the shelf, and play back byte-for-byte", async () => {
    const wave = validWave();
    const put = await fetch(base + "/api/kits/e2e/tone.wav", { method:"PUT", body:wave });
    expect(put.status === 204, "the shelf refused a valid wave", put.status);
    const manifest = "tone.wav | root C4 | rate 8000 | bytes 48 | source e2e\n";
    const putManifest = await fetch(base + "/api/kits/e2e/manifest.md", { method:"PUT", body:manifest });
    expect(putManifest.status === 204, "the shelf refused its manifest", putManifest.status);
    const shelf = await (await fetch(base + "/api/kits")).json();
    expect(shelf.kits.some(k => k.name === "e2e" && k.files.some(f => f.name === "tone.wav")),
      "the new sample is absent from the shelf", shelf);
    const returned = Buffer.from(await (await fetch(base + "/api/kits/e2e/tone.wav")).arrayBuffer());
    expect(returned.equals(wave), "the wave changed on its trip through the server");
    expect((await fetch(base + "/api/kits/../escape.wav", { method:"PUT", body:wave })).status >= 400,
      "the kit endpoint accepted a path outside its shelf");
  });

  await browser.shot(SCREENSHOT);
  clearInterval(drain);
  browser.close();
  server.kill();
  await wait(300);

  await journey("7. the built copy is playable, seeded, and read-only", async () => {
    const buildRoot = path.join(TMP, "build-root");
    copyForBuild(buildRoot);
    execFileSync(process.execPath, [path.join(buildRoot, "scripts", "build.mjs")],
      { cwd:buildRoot, stdio:"ignore" });
    const seen = [];
    const host = staticServer(path.join(buildRoot, "dist"), seen);
    const staticPort = await freePort(4230);
    await new Promise(resolve => host.listen(staticPort, "127.0.0.1", resolve));
    const staticBrowser = await launch({ profile:path.join(TMP, "static-profile"),
      port:await freePort(9430) });
    const staticBase = "http://127.0.0.1:" + staticPort;
    await staticBrowser.goto(staticBase + "/");
    await wait(700);
    expect((await staticBrowser.eval("doc.title")) === "e2e folio", "the built copy did not load its seed");
    await staticBrowser.key("F3", { key:"F3", vk:114 });
    expect(/read-only copy/.test(await staticBrowser.eval("document.getElementById('footer').textContent")),
      "the built copy did not identify itself as read-only");
    await staticBrowser.key("F3", { key:"F3", vk:114 });
    await staticBrowser.key("Home", { key:"Home", vk:36 });
    await staticBrowser.key("KeyX", { key:"x", vk:88 });
    expect((await staticBrowser.eval("doc.steps[0]")) === "D4", "the read-only copy is not locally playable");
    await wait(2300);
    expect(!seen.some(line => line.startsWith("PUT ")), "the read-only copy tried to write to its host", seen);
    staticBrowser.close(); host.close();
  });

  console.log("\n" + passed + " passed, " + failed + " failed\n");
  if (serverLog && failed) console.log("server log:\n" + serverLog);
  try { fs.rmSync(TMP, { recursive:true, force:true }); } catch (_){}
  process.exit(failed ? 1 : 0);
})().catch(error => {
  console.log("harness crashed: " + (error && error.stack || error));
  try { fs.rmSync(TMP, { recursive:true, force:true }); } catch (_){}
  process.exit(1);
});
