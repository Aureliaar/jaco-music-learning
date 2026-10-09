/* Folio's whole test suite: nine journeys through the real app.

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
const SYNC_DEBOUNCE = 2000;                    /* what js/quests.js waits before a PUT */
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

  /* Nothing in the suite may reach the machine's real rack or real Hub: the
     rack may be running beside it, and the Hub would restart the player's own
     browser. The rack's status port is pointed at nothing, and the Hub is a
     stand-in that records what it was asked. */
  const hubCalls = [];
  const hub = http.createServer((req, res) => {
    let raw = "";
    req.on("data", chunk => { raw += chunk; });
    req.on("end", () => {
      try { hubCalls.push(Object.assign({ url:req.url }, JSON.parse(raw || "{}"))); }
      catch (_){ hubCalls.push({ url:req.url, raw }); }
      res.writeHead(200, { "content-type":"application/json" });
      res.end(JSON.stringify({ ok:true, state:"navigated" }));
    });
  });
  const hubPort = await freePort(4250);
  await new Promise(resolve => hub.listen(hubPort, "127.0.0.1", resolve));
  const HUB_ENV = { FOLIO_HUB:"http://127.0.0.1:" + hubPort, FOLIO_RACK_PORT:String(await freePort(4260)) };

  const port = await freePort(4210);
  const base = "http://127.0.0.1:" + port;
  const server = spawn(process.execPath, [path.join(ROOT, "server.mjs")], {
    cwd: ROOT, stdio: ["ignore", "pipe", "pipe"],
    env: Object.assign({}, process.env, HUB_ENV, { PORT:String(port), FOLIO_LOG:LOG,
      FOLIO_RULINGS:RULES, FOLIO_KITS:KITS, FOLIO_RENDERER:"none" })
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
    expect(view.title === "Folio" && view.length === 16 && view.rows >= view.length && view.scripts === 13,
      "the page did not boot the complete instrument", view);
    expect(view.width > 500 && view.height > 300, "the working folio collapsed", view);
    expect(/112.*C major/.test(view.meta), "the seeded tempo and key are not visible", view.meta);
    expect(errors.length === 0, "the browser raised during boot", errors);
  });

  await journey("2. the keyboard writes lead, bass, chords, and a hold", async () => {
    /* Both halves of the renderer contract, before the composing proper.
       Journey 1's ordinary boot already played Folio's own tone with no
       renderer at all; this half opens the same instrument with the launch
       promise `?renderer=reaper` in front of an absent rack, and proves that
       the promise is kept honestly rather than quietly traded for a different
       instrument. No renderer service listens during the suite, so the page
       is looking at a genuinely missing rack. */
    /* On this machine the local server makes the promise itself, so a link
       that leaves out `?renderer=reaper` (a `?quest=` link, say) still
       cannot bring the own tone back. A second server, started the way
       folio.cmd starts it, must write the promise into the page it serves,
       and the page must keep it with nothing in the address. Nothing is
       played here: the real rack may well be running beside the suite. */
    const machineLog = path.join(TMP, "machine-log.json");
    writeJSON(machineLog, SEED);
    const machinePort = await freePort(port + 1);
    const machineBase = "http://127.0.0.1:" + machinePort;
    const machine = spawn(process.execPath, [path.join(ROOT, "server.mjs")], {
      cwd: ROOT, stdio: "ignore",
      env: Object.assign({}, process.env, HUB_ENV, { PORT:String(machinePort), FOLIO_LOG:machineLog,
        FOLIO_RULINGS:RULES, FOLIO_KITS:KITS, FOLIO_RENDERER:"" })
    });
    try {
      await ready(machineBase + "/");
      const served = await (await fetch(machineBase + "/")).text();
      const plain = await (await fetch(base + "/")).text();
      expect(/name="folio-renderer" content="reaper"/.test(served),
        "this machine's server did not promise the rack in the page it serves");
      expect(!/folio-renderer/.test(plain), "FOLIO_RENDERER=none still promised the rack");
      await browser.goto(machineBase + "/?quest=zoltraak");
      await wait(600);
      expect((await browser.eval("MIDI_REQUIRED")) === true,
        "a page served on this machine without ?renderer=reaper did not keep the rack promise");
    } finally { machine.kill(); }

    await browser.goto(base + "/?renderer=reaper");
    await wait(1400);
    const promised = await browser.eval(`(function(){
      var panel=document.getElementById('rackfault');
      window.__fellThrough=0;
      window.samplePlay=function(){window.__fellThrough++;return true;};
      playNote("C4",0,0.1,0);
      play();
      audition("C4",1);
      return {required:MIDI_REQUIRED, fault:midiFault, state:midiState,
              shown:!!panel && !panel.hidden,
              name:document.getElementById('rackfaultname').textContent,
              text:document.getElementById('rackfaulttext').textContent,
              playing:playing, fellThrough:window.__fellThrough};
    })()`);
    expect(promised.required && promised.fault === "service-absent" && promised.shown,
      "required-REAPER Folio did not show its missing rack", promised);
    expect(/did not answer/.test(promised.name) && /safe/.test(promised.text),
      "the renderer error does not name the boundary or reassure about the music", promised);
    expect(!promised.playing && promised.fellThrough === 0,
      "required-REAPER Folio played without its promised renderer", promised);
    await browser.shot(path.join(__dirname, "e2e-rack.png"));
    /* Editing and autosave stay available underneath the panel. */
    await browser.key("Home", { key:"Home", vk:36 });
    await browser.key("KeyZ", { key:"z", vk:90 });
    const edited = await browser.eval(`(function(){
      var wrote=doc.steps[0];
      doc.steps[0]=null; doc.hold[0]=1; renderAll();
      return {wrote:wrote};
    })()`);
    expect(edited.wrote === "C4", "the renderer error stopped the player writing", edited);
    /* A rack that answers clears the panel without reloading the music, and
       a rack that goes during playback takes the transport with it. The page
       learns both through its ordinary one-second poll of the real status
       endpoint, so this is the recovery path the player actually gets. */
    await browser.eval(`(function(){
      window.__rack="ready"; window.__midiSent=[];
      var real=window.fetch.bind(window);
      window.fetch=function(url,options){
        if(String(url).indexOf("/api/renderer")>=0)
          return Promise.resolve({ok:true,json:function(){
            return Promise.resolve({ready:window.__rack==="ready",state:window.__rack,detail:""});}});
        return real(url,options);
      };
      midiOut={name:"Folio to REAPER",state:"connected",connection:"open",
        clear:function(){},
        send:function(bytes,when){window.__midiSent.push({bytes:[].slice.call(bytes),when:when||0});}};
      midiPermission="granted";
      return true;
    })()`);
    const cleared = await eventually(async () => {
      const seen = await browser.eval(`({fault:midiFault,
        hidden:document.getElementById('rackfault').hidden,
        length:docLen(), first:doc.steps[0]})`);
      return (!seen.fault && seen.hidden) ? seen : null;
    }, 6000, "a healthy rack did not clear the renderer error");
    expect(cleared.length === 16 && cleared.first === null,
      "clearing the renderer error reloaded the music", cleared);
    const during = await browser.eval(`(function(){
      window.__midiSent=[]; play();
      return {playing:playing, fault:midiFault};
    })()`);
    expect(during.playing && !during.fault,
      "a ready rack did not let the transport start", during);
    await browser.eval(`(function(){window.__rack="renderer-lost";return true;})()`);
    const lost = await eventually(async () => {
      const seen = await browser.eval(`(function(){
        var panic=window.__midiSent.filter(function(e){return (e.bytes[0]&240)===176&&
          (e.bytes[1]===120||e.bytes[1]===123);});
        return {fault:midiFault, playing:playing, panic:panic.length,
          shown:!document.getElementById('rackfault').hidden,
          text:document.getElementById('rackfaulttext').textContent};
      })()`);
      return seen.fault === "renderer-lost" ? seen : null;
    }, 6000, "a renderer lost mid-playback was never noticed");
    expect(!lost.playing && lost.shown && lost.panic >= 6,
      "a renderer lost mid-playback did not stop the transport and silence the rack", lost);
    /* The rack answers, but this browser has no port by that name: a browser
       left open across a MIDI service restart. After the grace the page asks
       its own server, once, to have the Hub deal with it, naming this page;
       a Hub that opened the page in the Hub window leaves this one saying
       where the music went, and nothing reaches the own tone meanwhile. */
    hubCalls.length = 0;
    await browser.eval(`(function(){window.__rack="ready"; midiOut=null; midiRecovery=null;
      MIDI_RECOVER_GRACE=200; window.__fellThrough=0;
      window.samplePlay=function(){window.__fellThrough++;return true;};
      return true;})()`);
    const moved = await eventually(async () => {
      const seen = await browser.eval(`({fault:midiFault,
        name:document.getElementById('rackfaultname').textContent,
        token:document.documentElement.getAttribute('data-recover')})`);
      return seen.fault === "moved" ? seen : null;
    }, 8000, "a browser that lost the rack's port was never sent to Folio's own window");
    expect(hubCalls.length === 1 && hubCalls[0].url === "/api/browser/recover" &&
      hubCalls[0].name === "daw" && hubCalls[0].path === "/?renderer=reaper" &&
      hubCalls[0].token === moved.token && /Hub window/.test(moved.name),
      "the page did not ask the Hub, once, to reopen this page where the rack plays",
      { hubCalls, moved });
    expect((await browser.eval(`(function(){playNote("C4",0,0.1,0);play();
      return window.__fellThrough===0 && !playing;})()`)),
      "a browser that cannot see the rack played something else instead");
    await browser.goto(base + "/");
    await wait(700);

    /* A local virtual port, without depending on machine MIDI hardware.  The
       ordinary boot above already exercised the absent-port fallback; this
       half of the same composing journey proves that all three written lanes
       reach their default channels, that renderer selection moves a voice to
       its reserved channel seat, and that stop clears the rack. */
    await browser.eval(`(function(){
      window.__midiSent=[]; window.__midiClears=0;
      midiHealthSet=function(){};
      midiRackReady=true;
      window.__midiOut={name:"Folio to REAPER",state:"connected",connection:"open",
        open:function(){return Promise.resolve(this);},
        clear:function(){window.__midiClears++;},
        send:function(bytes,when){window.__midiSent.push({bytes:[].slice.call(bytes),when:when||0});}};
      Object.defineProperty(navigator,"requestMIDIAccess",{configurable:true,value:function(){
        return Promise.resolve({outputs:new Map([["folio",window.__midiOut]]),onstatechange:null});
      }});
      return true;
    })()`);
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
    const routed = await browser.eval(`new Promise(function(resolve){
      play();
      setTimeout(function(){
        stop();
        var ons=window.__midiSent.filter(function(e){return (e.bytes[0]&240)===144;});
        var panic=window.__midiSent.filter(function(e){return (e.bytes[0]&240)===176&&
          (e.bytes[1]===120||e.bytes[1]===123);});
        resolve({channels:ons.map(function(e){return e.bytes[0]&15;}),
          velocities:ons.map(function(e){return e.bytes[2];}),panic:panic.length,
          clears:window.__midiClears,connected:midiConnected()});
      },250);
    })`);
    expect(routed.connected && [0,1,2].every(ch => routed.channels.includes(ch)),
      "the three Folio lanes did not reach the REAPER channels", routed);
    expect([82,88,68].every(v => routed.velocities.includes(v)),
      "the level-matched MIDI velocities changed", routed);
    const selected = await browser.eval(`(function(){
      var before=window.__midiSent.length;
      var changed=midiSelectInstrument(1,3);
      var invalid=midiSelectInstrument(1,5);
      midiNote("D4",ctx.currentTime+0.01,0.1,1);
      return {changed:changed,invalid:invalid,slot:MIDI_SLOTS[1],
        sent:window.__midiSent.slice(before).map(function(e){return e.bytes;})};
    })()`);
    expect(selected.changed && !selected.invalid && selected.slot === 3 &&
      selected.sent.some(b => (b[0]&240)===144 && (b[0]&15)===10),
      "Folio did not send the bass renderer selection", selected);
    expect(routed.clears > 0 && routed.panic >= 6,
      "stop did not clear queued notes and silence all rack channels", routed);
    const clocked = await browser.eval(`new Promise(function(resolve){
      window.__midiSent=[];
      var oldLoop=doc.loop, oldChord=doc.chords[3], oldHold=doc.chordhold[3];
      doc.loop=4; doc.chords[3]=JSON.parse(JSON.stringify(doc.chords[0])); doc.chordhold[3]=1;
      play();
      /* A hidden Chrome tab starves this timer. The audio-clock pulse must
         carry scheduling across the loop without its help. */
      if(timer){clearInterval(timer);timer=null;}
      setTimeout(function(){
        stop();
        var sent=window.__midiSent.slice(), ons=sent.filter(function(e){
          return (e.bytes[0]&240)===144 && (e.bytes[0]&15)===2;
        });
        var gaps=[];
        sent.forEach(function(off){
          if((off.bytes[0]&240)!==128 || (off.bytes[0]&15)!==2) return;
          var next=sent.find(function(on){return (on.bytes[0]&240)===144 &&
            (on.bytes[0]&15)===2 && on.bytes[1]===off.bytes[1] && on.when>=off.when;});
          if(next) gaps.push(next.when-off.when);
        });
        doc.loop=oldLoop; doc.chords[3]=oldChord; doc.chordhold[3]=oldHold;
        resolve({ons:ons.length,gaps:gaps,clock:!!audioClockNode});
      },750);
    })`);
    expect(clocked.clock && clocked.ons >= 9,
      "the audio clock did not carry MIDI through a starved page timer", clocked);
    expect(clocked.gaps.length && clocked.gaps.every(g => g >= 20),
      "a MIDI note-off still crowds the following loop attack", clocked);
    await browser.eval(`(function(){
      midiPanic(); midiRackReady=false; midiOut=null; midiAccess=null; midiAsked=true;
      try{localStorage.removeItem(MIDI_PERMISSION);}catch(e){}
    })()`);
  });

  await journey("3. the gamepad remains a complete primary surface", async () => {
    const GP = { X:0, B:1, SQ:2, TR:3, L1:4, R1:5, L2:6, R2:7, SEL:8, START:9, DU:12, DD:13 };
    await browser.padInstall(); await browser.pad([]);
    await browser.tap(GP.START);
    /* start is a list of places, not an action bar: it opens a screen, the
       strip names all five, and the page underneath is still drawn — dimmed
       to a watermark rather than taken away, so the ear keeps its subject. */
    const screens = await browser.eval(`(function(){
      var chips=document.querySelectorAll('#sstrip .schip'),
          rows=document.querySelectorAll('#sv-voices .vrow');
      return {open:screenOpen(), id:screenId(), chips:chips.length, rows:rows.length,
        veiled:document.body.classList.contains('veiled'),
        drawn:document.getElementById('roll').classList.contains('on') ||
              document.getElementById('column').style.display==='flex',
        sized:[].every.call(rows,function(e){var r=e.getBoundingClientRect();
              return r.width>200&&r.height>16;})};})()`);
    expect(screens.open && screens.chips === 5 && screens.rows === 3 && screens.sized,
      "start did not open a laid-out screen", screens);
    expect(screens.veiled && screens.drawn,
      "the page stopped being drawn behind the screen", screens);
    /* L1 and R1 turn the strip and turning enters nothing */
    await browser.tap(GP.R1);
    const turned = await browser.eval("({id:screenId(), open:screenOpen()})");
    expect(turned.open && turned.id !== screens.id, "the bumpers did not turn the strip", turned);
    /* the board is no longer a page: a quest IS a workspace, so the log went
       to the two margins the page already has and the drawing stands through
       it. Both margins must be laid out, and neither may be over the sheet —
       the whole point of the screen is that the folio stays readable. */
    await browser.eval('openScreens("quests")');
    const board = await browser.eval(`(function(){
      var b=document.getElementById('quests').getBoundingClientRect(),
          d=document.getElementById('qdetail').getBoundingClientRect(),
          f=document.getElementById('field').getBoundingClientRect();
      return {id:screenId(), veiled:document.body.classList.contains('veiled'),
        drawn:document.getElementById('roll').classList.contains('on') ||
              document.getElementById('column').style.display==='flex',
        sized:b.width>150&&b.height>100&&d.width>120&&d.height>40,
        clear:b.right<=f.left+1&&d.left>=f.right-1};})()`);
    expect(board.id === "quests" && board.drawn && board.veiled,
      "the quest board stopped the drawing instead of standing beside it", board);
    expect(board.sized && board.clear,
      "the board and its reading are not laid out clear of the sheet", board);
    await browser.tap(GP.START);
    expect(!(await browser.eval("screenOpen()")), "start did not put the screens down");
    await browser.key("Home", { key:"Home", vk:36 });
    await browser.tap(GP.DU);                  // bare vertical moves only the root
    const bareRoot = await browser.eval(`({chord:doc.chords[0], next:doc.chords[1], cursor:cursor,
      length:writtenLen(doc, CHORD_LANE, 0)})`);
    expect(bareRoot.chord.deg === 1 && bareRoot.chord.shape === "triad" &&
           bareRoot.chord.voicing === undefined && bareRoot.chord.inversion === 0 &&
           bareRoot.chord.octave === 0 && bareRoot.length === 1 &&
           !bareRoot.next && bareRoot.cursor === 0,
      "bare d-pad up changed more than the chord's root", bareRoot);
    await browser.tap(GP.DD);                  // put the seed back
    await browser.tap(GP.L2, GP.DU);          // d-pad changes this chord's root
    const rooted = await browser.eval(`({chord:doc.chords[0], next:doc.chords[1], cursor:cursor})`);
    expect(rooted.chord.deg === 1 && rooted.chord.shape === "triad" && !rooted.next && rooted.cursor === 0,
      "L2 plus d-pad up did not edit the same chord's root", rooted);
    await browser.tap(GP.L2, GP.DD);          // put the seed back
    await browser.tap(GP.R2, GP.DU);          // d-pad changes this chord's type
    const shaped = await browser.eval(`({chord:doc.chords[0], next:doc.chords[1], cursor:cursor})`);
    expect(shaped.chord.deg === 0 && shaped.chord.shape === "seventh" && !shaped.next && shaped.cursor === 0,
      "R2 plus d-pad up did not edit the same chord's type", shaped);
    await browser.tap(GP.R2, GP.DD);          // put the seed back
    await browser.tap(GP.L2, GP.TR);          // right-hand symbol still writes/overwrites
    const written = await browser.eval(`({chord:doc.chords[0], cursor:cursor})`);
    expect(written.chord.shape === "seventh" && written.cursor > 0,
      "L2 plus the right-hand up symbol did not write a chord", written);
    await browser.key("Home", { key:"Home", vk:36 });
    await browser.key("KeyZ", { key:"z", vk:90 });       // restore the seed
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

  await journey("5b. a chord mirror delivered in a drill fans one written chord out to every site", async () => {
    /* the L5 mirrored boards bind the chord lane: a cell of eight pointed at
       from four places. One chord written at the first site must be the
       chord at all four, drawn at the mirror weight, and survive the trip
       through the log. */
    const nulls = () => new Array(32).fill(null), ones = () => new Array(32).fill(1);
    const disk = readJSON(LOG);
    disk.drills.push({ id:"mirror-drill", name:"the mirror drill", summary:"- chords 1–8 return every eight steps",
      teaches:"the vamp.", lesson:5,
      pattern:{ version:1, title:"the mirror drill", tempo:96, loop:32, key:"C major", len:32,
        steps:nulls(), bass:nulls(), hold:ones(), basshold:ones(), lock:nulls(), basslock:nulls(),
        tones:[null,null], mirrors:[{ voice:2, cell:8, sites:[0,8,16,24] }],
        mute:[false,false,false], solo:[false,false,false], chords:nulls(), chordhold:ones() } });
    writeJSON(LOG, disk);
    await eventually(async () => browser.eval(`DRILLS.some(function(d){return d.id==='mirror-drill';})`),
      13000, "the open tab did not adopt the mirrored drill");
    await browser.eval(`(function(){ switchWorkspace('mirror-drill'); voice = CHORD_LANE; cursor = 0; renderAll(); return true; })()`);
    const seeded = await browser.eval(`({mirrors:JSON.stringify(doc.mirrors), len:doc.len, chords:doc.chords.filter(Boolean).length})`);
    expect(seeded.mirrors === JSON.stringify([{ voice:2, cell:8, sites:[0,8,16,24] }]) && seeded.len === 32 && seeded.chords === 0,
      "the chord mirror was not read off the delivered seed", seeded);
    await browser.key("Home", { key:"Home", vk:36 });
    await browser.key("KeyZ", { key:"z", vk:90 });
    const fanned = await browser.eval(`({at:[0,8,16,24].map(function(i){return doc.chords[i] && doc.chords[i].deg;}),
      elsewhere:doc.chords.filter(Boolean).length, cursor:cursor,
      drawn:[].some.call(document.querySelectorAll('#column .row .note.chord'), function(e){return e.classList.contains('mirror');})})`);
    expect(fanned.at.every(d => d === 0) && fanned.elsewhere === 4 && fanned.cursor > 0,
      "one chord at the first site did not become the chord at all four", fanned);
    expect(fanned.drawn, "the bound chord was not drawn at the mirror weight", fanned);
    await eventually(() => {
      const slot = readJSON(LOG).quests["mirror-drill"], ws = slot && slot.pattern;
      return ws && ws.chords && [0,8,16,24].every(i => ws.chords[i] && ws.chords[i].deg === 0);
    }, 5000, "the mirrored chords never reached the log");
    await browser.eval(`(function(){ switchWorkspace(null); return true; })()`);
    expect(errors.length === 0, "the browser raised during the chord mirror journey", errors);
  });

  await journey("5c. the echo's own actions answer the pad and the margin says where they stand", async () => {
    /* an echo page carries acts nothing else does, and every one of them is
       under a trigger: the call played, the answer judged, the pace slowed, a
       window cut out of the page, and the hint that says where the call's
       notes fall. They are the drill's whole usable surface — losing any of
       them leaves a long transcription unanswerable — and not one of them may
       be reachable, or even mentioned, on a page that is not an echo's. */
    const GP = { L1:4, R1:5, L2:6, R2:7, SEL:8, L3:10, R3:11 };
    const nulls = () => new Array(32).fill(null), ones = () => new Array(32).fill(1);
    /* let the last journey's autosave land before touching the file: a PUT
       that crosses this write hands the tab a fresh ETag and every poll
       after it is a 304 over a file it has never read */
    await wait(SYNC_DEBOUNCE + 1200);
    const disk = readJSON(LOG);
    disk.drills.push({ id:"echo-drill", name:"the echo drill", summary:"- write back what you hear",
      teaches:"holding a line.", lesson:4,
      pattern:{ version:1, title:"the echo drill", tempo:96, loop:32, key:"C major", len:32,
        steps:nulls(), bass:nulls(), hold:ones(), basshold:ones(), lock:nulls(), basslock:nulls(),
        tones:[null,null], mute:[false,false,false], solo:[false,false,false],
        chords:nulls(), chordhold:ones(),
        echo:{ stage:"rhythm", voice:0, at:0,
               call:[{ step:0, note:"C4", len:2 }, { step:4, note:"E4", len:1 },
                     { step:8, note:"G4", len:4 }] } } });
    writeJSON(LOG, disk);
    /* and a fresh page onto it, so the drill is read at boot and the pad is
       answered by an instrument in its ordinary state rather than by whatever
       an earlier journey left standing */
    await browser.goto(base + "/");
    await wait(900);
    expect(await browser.eval(`DRILLS.some(function(d){return d.id==='echo-drill';})`),
      "the seeded echo drill was not read at boot");
    await browser.eval("(function(){ closeScreens(); switchWorkspace(null); return true; })()");
    await browser.padInstall(); await browser.pad([]);
    const free = await browser.eval(`({echo:!!echoNow(), rail:railecho.childNodes.length})`);
    expect(!free.echo && free.rail === 0, "a page that is not an echo's grew the echo's margin block", free);

    await browser.eval("(function(){ switchWorkspace('echo-drill'); return true; })()");
    const arrived = await browser.eval(`({echo:!!echoNow(), tempo:doc.tempo, dur:stepDur(),
      pace:echoPace, window:echoWindow(), hint:echoHint,
      rail:railecho.textContent, picks:[].map.call(railecho.querySelectorAll('.epick span.on'),
        function(e){return e.textContent;})})`);
    expect(arrived.echo && arrived.rail.indexOf("the echo") === 0 &&
           arrived.rail.indexOf("L2 + select") >= 0 && arrived.rail.indexOf("R2 + select") >= 0 &&
           arrived.rail.indexOf("the whole page") >= 0,
      "the margin did not say what the echo's seats do", arrived);
    expect(arrived.pace === 1 && !arrived.window && !arrived.hint &&
           arrived.picks.join(",") === "whole,hidden" && arrived.dur === 60 / 96 / 4,
      "the echo page did not open at the whole pace with no window", arrived);

    /* the pace: L2 over the bumpers, and it is the scheduling that changes,
       never the page's own tempo */
    await browser.tap(GP.L2, GP.L1);
    const half = await browser.eval(`({pace:echoPace, dur:stepDur(), tempo:doc.tempo,
      said:footer.textContent, pick:railecho.querySelector('.epick span.on').textContent})`);
    expect(half.pace === 2 && half.dur === 2 * (60 / 96 / 4) && half.tempo === 96 &&
           half.pick === "half" && half.said.indexOf("half pace") === 0,
      "L2 and the left bumper did not halve the step", half);
    await browser.tap(GP.L2, GP.L1);
    await browser.tap(GP.L2, GP.L1);            /* the ring has ends, not a way round */
    const quarter = await browser.eval(`({pace:echoPace, dur:stepDur()})`);
    expect(quarter.pace === 4 && quarter.dur === 4 * (60 / 96 / 4),
      "the pace did not stop at a quarter", quarter);
    await browser.tap(GP.L2, GP.R1);
    expect((await browser.eval("echoPace")) === 2, "L2 and the right bumper did not go back up a rung");

    /* the window: both edges under the left stick, at the cursor */
    await browser.eval("(function(){ jump(4); return true; })()");
    await browser.tap(GP.L2, GP.L3);
    await browser.eval("(function(){ jump(11); return true; })()");
    await browser.tap(GP.R2, GP.L3);
    const win = await browser.eval(`({window:echoWindow(), from:echoPlayFrom(), to:echoPlayTo(),
      rail:railecho.querySelector('.estate').textContent, said:footer.textContent,
      wash:document.querySelector('.rollwin').style.display})`);
    expect(win.window && win.window.from === 4 && win.window.to === 11 &&
           win.from === 4 && win.to === 11 && win.wash === "block" &&
           win.rail === "bars 2 to 3 \u00b7 steps 5 to 12" &&
           win.said.indexOf("the loop ends at 12") === 0,
      "the two stick presses did not cut a window out of the page", win);
    await browser.eval("(function(){ jump(2); return true; })()");
    await browser.tap(GP.R2, GP.L3);            /* an end before the start is that window backwards */
    expect(JSON.stringify(await browser.eval("echoWindow()")) === '{"from":2,"to":4}',
      "an end set before the start did not swap the two edges");

    /* the hint: where the call's notes fall, and nothing about what they are */
    await browser.tap(GP.L2, GP.R3);
    const shown = await browser.eval(`(function(){
      var b=[].filter.call(document.querySelectorAll('.hintbar'),function(e){return e.style.display==='block';});
      return {hint:echoHint, drawn:b.length, onscreen:echoCall(echoNow()).filter(function(ev){
        return rollSlot(echoNow().at+ev.step)>=0; }).length,
        pick:railecho.querySelectorAll('.epick span.on')[1].textContent,
        said:footer.textContent, tall:b.length?Math.round(b[0].getBoundingClientRect().height):0,
        pitched:b.some(function(e){return e.textContent.length>0;})};})()`);
    expect(shown.hint && shown.drawn === shown.onscreen && shown.drawn > 0 &&
           shown.tall > 2 && !shown.pitched && shown.pick === "shown" &&
           shown.said.indexOf("the notes, shown") === 0,
      "the hint did not bracket the call's notes without naming them", shown);
    await browser.tap(GP.L2, GP.R3);
    expect((await browser.eval(
      "[].filter.call(document.querySelectorAll('.hintbar'),function(e){return e.style.display==='block';}).length")) === 0,
      "the hint would not go away again");

    /* the call and the verdict, on select under a trigger; and select bare is
       still the transport it is everywhere */
    await browser.tap(GP.R2, GP.SEL);
    const judged = await browser.eval(`({said:footer.textContent, playing:playing})`);
    expect(!judged.playing && judged.said.indexOf("nothing answered yet") === 0,
      "R2 and select did not ask for the judgement", judged);
    await browser.tap(GP.L2, GP.SEL);
    const called = await browser.eval(`({said:footer.textContent, playing:playing})`);
    expect(!called.playing && /the call|enable sound/.test(called.said),
      "L2 and select did not play the call", called);
    await browser.tap(GP.SEL);
    expect(await browser.eval("playing"), "bare select stopped being the transport");
    await browser.tap(GP.SEL);

    /* and the bare seats are what they always were */
    const loopWas = await browser.eval("doc.loop");
    await browser.tap(GP.L3);
    expect((await browser.eval("doc.loop")) !== loopWas, "bare L3 stopped being the loop length");
    const vizWas = await browser.eval("viz");
    await browser.tap(GP.R3);
    expect((await browser.eval("viz")) !== vizWas, "bare R3 stopped turning the page over");
    await browser.tap(GP.R3);

    /* leaving the page puts all three back, and takes the block with them */
    await browser.eval("(function(){ switchWorkspace(null); return true; })()");
    const left = await browser.eval(`({pace:echoPace, window:echoWindow(), hint:echoHint,
      rail:railecho.childNodes.length, wash:document.querySelector('.rollwin').style.display,
      drawn:[].filter.call(document.querySelectorAll('.hintbar'),function(e){return e.style.display==='block';}).length})`);
    expect(left.pace === 1 && !left.window && !left.hint && left.rail === 0 &&
           left.wash === "none" && left.drawn === 0,
      "the pace, the window or the hint outlived the page they belong to", left);

    /* and back, with a window and the hint up, which is what the screenshot at
       the end of the run has to show */
    await browser.eval("(function(){ switchWorkspace('echo-drill'); jump(4); return true; })()");
    await browser.tap(GP.L2, GP.L3);
    await browser.eval("(function(){ jump(15); return true; })()");
    await browser.tap(GP.R2, GP.L3);
    await browser.tap(GP.L2, GP.R3);
    await browser.eval("(function(){ jump(0); return true; })()");
    expect(errors.length === 0, "the browser raised during the echo's own actions", errors);
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

  await wait(1200);                    // let the calm scenery transition settle
  await browser.shot(SCREENSHOT);
  clearInterval(drain);
  browser.close();
  server.kill();
  hub.close();
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
