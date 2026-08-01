/* tests/rig.js — the bench the fake-DOM harnesses stand on.

   reltest.js and leaptest.js each carried their own copy of this: the same
   fake document, the same fake Web Audio, the same fake pad, the same loader
   and very nearly the same hook. Two copies of a fake DOM is two places for
   the fake DOM to drift from the real one, which is the one thing a fake DOM
   must never do. It lives here once now, and tier1.js stands on it as well.

   What it gives a harness:

     const R = require("./rig.js").boot();
     R.T            the app's internals, by name (window.__t)
     R.probe(expr)  anything else, evaluated inside the app's scope
     R.ids          the fake elements the app looked up by id
     R.store        what localStorage holds
     R.sounded      every oscillator the app started
     R.clock.t      the audio clock, ours to advance
     R.key(code)    a keystroke, by physical position
     R.frame/hold/press/stick/holdLong   the pad, a frame at a time
     R.ok/R.eq      the checks, and R.done() the tail

   The app is loaded from whatever folio.html actually asks for: the split
   js/*.js in the order the page lists them, or — for a folio that has not
   been split — the inline script. The harness can therefore never disagree
   with the page about what the app is made of. */
const fs = require("fs");
const REPO = require("path").resolve(__dirname, "..").split("\\").join("/");

const html = fs.readFileSync(REPO + "/folio.html", "utf8");

/* the files the page loads, in the order it loads them */
function scriptFiles(){
  const out = [];
  const re = /<script[^>]*\ssrc="([^"]+)"/g;
  let m;
  while ((m = re.exec(html))) out.push(m[1]);
  return out;
}
/* the app's whole source, as one body to be run in one scope — which is the
   scope the IIFE used to make, and the scope the hook reads through */
function appSource(){
  const files = scriptFiles();
  if (files.length)
    return files.map(f => fs.readFileSync(REPO + "/" + f, "utf8")).join("\n;\n");
  const src = html.slice(html.indexOf("<script>") + 8, html.lastIndexOf("</script>"));
  return src.replace(/^\s*\(function\(\)\s*\{/, "").replace(/\}\)\(\);\s*$/, "");
}
/* the page without its script and its stylesheet: the markup alone, so that
   a scan of "everything the app is" counts each thing exactly once whether
   the folio is split or not */
function appMarkup(){
  let out = html;
  out = out.replace(/<style>[\s\S]*?<\/style>/, "<style></style>");
  out = out.replace(/<script>[\s\S]*?<\/script>/, "<script></script>");
  return out;
}
/* the stylesheet, wherever it lives — a split folio keeps it in folio.css */
function appStyle(){
  const m = /<link[^>]*\shref="([^"]+\.css)"/.exec(html);
  if (m) return fs.readFileSync(REPO + "/" + m[1], "utf8");
  return html.slice(html.indexOf("<style>") + 7, html.indexOf("</style>"));
}

/* ---------- the fake document ---------- */
function mkEl(tag){
  const set = new Set();
  const attrs = {};
  const el = {
    tagName: tag, children: [], style: {}, textContent: "", value: "", files: null,
    get className(){ return [...set].join(" "); },
    set className(v){ set.clear(); String(v).split(/\s+/).filter(Boolean).forEach(c => set.add(c)); },
    classList: {
      add: c => set.add(c), remove: c => set.delete(c), contains: c => set.has(c),
      toggle: (c, f) => { const on = f === undefined ? !set.has(c) : !!f; on ? set.add(c) : set.delete(c); return on; }
    },
    get firstChild(){ return el.children[0] || null; },
    appendChild(c){ el.children.push(c); return c; },
    insertBefore(c, ref){ const i = ref ? el.children.indexOf(ref) : -1;
      if (i >= 0) el.children.splice(i, 0, c); else el.children.push(c); return c; },
    removeChild(c){ const i = el.children.indexOf(c); if (i >= 0) el.children.splice(i, 1); },
    addEventListener(){}, click(){},
    setAttribute(k, v){ attrs[k] = String(v); },
    getAttribute(k){ return (k in attrs) ? attrs[k] : null; },
    removeAttribute(k){ delete attrs[k]; },
    /* enough of a selector engine for the app: it only ever asks an element
       for descendants, and the fake tree is flat, so children suffice */
    querySelectorAll(){ return []; }
  };
  return el;
}

const ELEMENT_IDS =
  ["column","footer","metatext","picker","quests","qlist","qtabs","hints",
   "roll","rollfield","rollbase",
   "qfree","qfreesigil","qdname","qdtext","qdteach","qdstate","qpreview",
   "railquests","rtabs","railtitle","railtext","railteach","railstate",
   "settings","xbarpad","xbarface","voices","vname0","vname1","vmark0","vmark1",
   "scenery","scenefade"];

/* ---------- the fake pad ---------- */
const GP = { X:0, B:1, SQ:2, TR:3, L1:4, R1:5, L2:6, R2:7, SEL:8, START:9,
             L3:10, R3:11, DU:12, DD:13, DL:14, DR:15 };

/* ---------- what the app is handed, and what it hands back ---------- */
function boot(opts){
  opts = opts || {};
  const ids = {};
  ELEMENT_IDS.forEach(i => { ids[i] = mkEl("div"); });
  let keyHandler = null, upHandler = null;
  const document = {
    getElementById: i => (i in ids ? ids[i] : null),
    createElement: mkEl,
    body: mkEl("body"),
    addEventListener(t, f){ if (t === "keydown") keyHandler = f; if (t === "keyup") upHandler = f; }
  };
  const winHandlers = {};
  const clock = { pad: 1000, t: 0 };
  /* The app reads the bare global `performance`, so that is the clock to
     take over — but only its `now`. Replacing the whole object wholesale
     breaks node's own fetch, which reaches through the same global for
     resource timing, and a harness that cannot make an http request is no
     use to the suite that drives the real server. */
  /* the app reads a bare `performance`; it is handed one of its own below,
     as a parameter of the scope it runs in, so node's own clock — which its
     fetch reaches through for resource timing — is left entirely alone */
  const performance = { now: () => clock.pad };
  const window = {
    addEventListener(t, f){ (winHandlers[t] = winHandlers[t] || []).push(f); },
    performance: { now: () => clock.pad },
    getComputedStyle: null
  };
  if (opts.location) window.location = opts.location;
  const store = {};
  const localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; }
  };

  /* ---------- fake web audio ---------- */
  const sounded = [];
  const gains = [];
  function param(){
    const p = { calls: [], value: 1,
      setValueAtTime(v, t){ p.calls.push(["set", v, t]); },
      linearRampToValueAtTime(v, t){ p.calls.push(["ramp", v, t]); },
      cancelScheduledValues(){ p.calls.push(["cancel"]); } };
    return p;
  }
  class FakeCtx {
    constructor(){ this.state = "running"; }
    get currentTime(){ return clock.t; }
    resume(){}
    createGain(){ const g = { gain: param(), connect(){}, disconnect(){} };
      gains.push(g); return g; }
    createBiquadFilter(){ return { type:"", frequency:param(), Q:param(), connect(){}, disconnect(){} }; }
    createOscillator(){
      const o = { type:"", frequency:{ setValueAtTime:(f, at) => { o._f = f; o._at = at; } },
        connect(){}, disconnect(){},
        start(){ o._rec = { freq:o._f, at:o._at, gain:(gains[gains.length - 1] || {}).gain };
                 sounded.push(o._rec); },
        /* the app stops an oscillator a hair after its release ends, so the
           length it was actually asked to ring for is readable from here */
        stop(t){ if (o._rec) o._rec.off = t; }, onended:null };
      return o;
    }
    get destination(){ return {}; }
  }
  const state = { gamepads: [null] };
  const navigator = { getGamepads: () => state.gamepads };
  const URL = { createObjectURL: () => "blob:x", revokeObjectURL(){} };
  const blobs = [];
  function Blob(parts){ blobs.push(Array.isArray(parts) ? String(parts[0]) : ""); }

  /* ---------- the hook: the app's insides, by name ----------
     Some names come and go while another session works on the file, so every
     one of them is read through a guarded eval: a missing name is undefined
     rather than a ReferenceError that takes the whole harness down. */
  const hook = `
  var _g = function(n){ try { return eval(n); } catch(e){ return undefined; } };
  window.__t = { get doc(){return doc;}, get cursor(){return cursor;}, set cursor(v){cursor=v;},
    get baseOctave(){return baseOctave;}, set baseOctave(v){baseOctave=v;},
    get voice(){ return _g("voice"); }, setVoice: _g("setVoice"),
    nextVoice: _g("nextVoice"), prevVoice: _g("prevVoice"), cycleVoice: _g("cycleVoice"),
    toggleSolo: _g("toggleSolo"), toggleMute: _g("toggleMute"),
    audible: _g("audible"), vsteps: _g("vsteps"), flag: _g("flag"),
    voiceState: _g("voiceState"), renderVoices: _g("renderVoices"),
    VOICES: _g("VOICES"), VOICE_NAMES: _g("VOICE_NAMES"), TONE: _g("TONE"),
    bars2: _g("bars2"), qdabs2: _g("qdabs2"),
    enterNote: _g("enterNote"), clearStep: _g("clearStep"), moveCursor: _g("moveCursor"),
    validate: _g("validate"), importText: _g("importText"),
    save: _g("save"), load: _g("load"), scheduler: _g("scheduler"),
    setDoc: function(d){ doc = d; renderAll(); },
    setPlaying: function(v){ playing = v; },
    schedFrom: function(s){ schedStep = s; nextStepTime = 0; queue.length = 0; },
    audioInit: function(){ audio(); },
    rows: _g("rows"), pollPads: _g("pollPads"), bars: _g("bars"),
    intervalName: _g("intervalName"), pitchName: _g("pitchName"),
    get ivls(){ return _g("ivls"); }, get ivlTies(){ return _g("ivlTies"); },
    get octlines(){ return _g("octlines"); },
    get rollGuide(){ return _g("rollGuide"); }, get guideName(){ return _g("guideName"); },
    get guideMidi(){ return _g("guideMidi"); },
    showGuide: _g("showGuide"), GUIDE_HOLD: _g("GUIDE_HOLD"),
    get showNames(){ return _g("showNames"); },
    setNames: _g("setNames"), toggleNames: _g("toggleNames"),
    NAMES_KEY: _g("NAMES_KEY"), rollEl: _g("roll"),
    get viz(){return viz;}, toggleViz: _g("toggleViz"), VIZ_KEY: _g("VIZ_KEY"),
    relStep: _g("relStep"), relRepeat: _g("relRepeat"), nudge: _g("nudge"),
    anchorMidi: _g("anchorMidi"), tonicMidi: _g("tonicMidi"),
    moveDegrees: _g("moveDegrees"), degreeOfMidi: _g("degreeOfMidi"),
    midiOfDegree: _g("midiOfDegree"),
    nameOfMidi: _g("nameOfMidi"), midiOf: _g("midiOf"), clampMidi: _g("clampMidi"),
    keyOf: _g("keyOf"), parseKey: _g("parseKey"), normalizeKey: _g("normalizeKey"),
    shiftTonic: _g("shiftTonic"), toggleKeyMode: _g("toggleKeyMode"),
    shiftTempo: _g("shiftTempo"), stepDur: _g("stepDur"),
    TEMPO_MIN: _g("TEMPO_MIN"), TEMPO_MAX: _g("TEMPO_MAX"),
    TEMPO_STEP: _g("TEMPO_STEP"), TEMPO_FINE: _g("TEMPO_FINE"),
    SEEDS: _g("SEEDS"), seededDoc: _g("seededDoc"), workspaceDoc: _g("workspaceDoc"),
    setKey: function(k){ doc.key = k; renderMeta(); },
    MIDI_LO: _g("MIDI_LO"), MIDI_HI: _g("MIDI_HI"), SCALES: _g("SCALES"),
    QUESTS: _g("QUESTS"), QUEST_KEY: _g("QUEST_KEY"), QUEST_KEY_V1: _g("QUEST_KEY_V1"),
    qrows: _g("qrows"),
    get qsel(){return qsel;}, set qsel(v){qsel=v;},
    get qActive(){return qActive;}, set qActive(v){qActive=v;},
    get qState(){return qState;},
    get wsFree(){return wsFree;}, get wsDoc(){return wsDoc;},
    toggleQuests: _g("toggleQuests"),
    toggleSettings: _g("toggleSettings"), closeSettings: _g("closeSettings"),
    runSetting: _g("runSetting"), renderSettings: _g("renderSettings"),
    railStep: _g("railStep"), railOrder: _g("railOrder"),
    workspaceName: _g("workspaceName"),
    get SETTINGS(){ return _g("SETTINGS"); },
    get xslots(){ return _g("xslots"); },
    renderQuests: _g("renderQuests"),
    saveQuests: _g("saveQuests"), loadQuests: _g("loadQuests"),
    isQuestLog: _g("isQuestLog"), exportQuests: _g("exportQuests"),
    applyState: _g("applyState"), loadState: _g("loadState"), stateToJSON: _g("stateToJSON"),
    switchWorkspace: _g("switchWorkspace"), chooseWorkspace: _g("chooseWorkspace"),
    questPage: _g("questPage"), questHasContent: _g("questHasContent"),
    questGlyph: _g("questGlyph"),
    qdabs: _g("qdabs"), rrows: _g("rrows"), renderRails: _g("renderRails"),
    syncNote: _g("syncNote"), httpOrigin: _g("httpOrigin"),
    applyServerState: _g("applyServerState"),
    get syncOn(){return syncOn;}, set syncOn(v){syncOn=v;},
    get syncState(){return syncState;}, set syncState(v){syncState=v;},
    get syncTimer(){return syncTimer;},
    setSyncDebounce: function(ms){ SYNC_DEBOUNCE = ms; },
    syncBoot: _g("syncBoot"), syncFlush: _g("syncFlush"), syncPush: _g("syncPush"),
    bootState: _g("bootState"),
    get staticMode(){return staticMode;}, set staticMode(v){staticMode=v;},
    SEED_URL: _g("SEED_URL"), SYNC_URL: _g("SYNC_URL"),
    seedBoot: _g("seedBoot"), jsonish: _g("jsonish"),
    get DRILLS(){ return _g("DRILLS"); },
    get ALL(){ return _g("ALL"); },
    allQuests: _g("allQuests"), selQuest: _g("selQuest"),
    questById: _g("questById"), questSlot: _g("questSlot"),
    drillById: _g("drillById"), normDrill: _g("normDrill"),
    mergeDrills: _g("mergeDrills"), pollTick: _g("pollTick"), pollStart: _g("pollStart"),
    buildQuestRows: _g("buildQuestRows"), rebuildList: _g("rebuildList"),
    get qrowsNow(){ return _g("qrows"); },
    get rrowsNow(){ return _g("rrows"); },
    get qlistEl(){ return _g("qlist"); },
    get railEl(){ return _g("railquests"); },
    get logETag(){ return _g("logETag"); }, setETag: function(v){ logETag = v; },
    get putInFlight(){ return _g("putInFlight"); },
    set putInFlight(v){ putInFlight = v; },
    get pollTimer(){ return _g("pollTimer"); },
    setPollMs: function(ms){ POLL_MS = ms; },
    stopPoll: function(){ if (pollTimer) clearInterval(pollTimer); pollTimer = null; },
    get POLL_MS(){ return _g("POLL_MS"); },
    resetDrills: function(){ DRILLS = []; rebuildList(); },
    resetQuests: function(){ qState = {}; qActive = null; qsel = 0;
      wsDoc = {}; wsFree = null; doc = workspaceDoc(null);
      renderAll(); renderQuests(); renderMeta(); },
    exportJSON: function(){ return JSON.stringify(docOut(doc)); },
    docJSON: function(){ return JSON.stringify(doc); },
    setScenery: _g("setScenery"), cycleScenery: _g("cycleScenery"),
    SCENERY_KEY: _g("SCENERY_KEY"), SCENERIES: _g("SCENERIES"),
    tabList: _g("tabList"), tabLabel: _g("tabLabel"), setTab: _g("setTab"),
    moveTab: _g("moveTab"), currentTab: _g("currentTab"),
    view: _g("view"), viewOf: _g("viewOf"), questGroup: _g("questGroup"),
    toggleFavourite: _g("toggleFavourite"), moveInOrder: _g("moveInOrder"),
    favOf: _g("favOf"), orderOf: _g("orderOf"), TAB_KEY: _g("TAB_KEY"),
    LESSON_OF: _g("LESSON_OF"), newestLesson: _g("newestLesson"),
    railSequence: _g("railSequence"),
    get activeTab(){ return _g("activeTab"); },
    get qtabsEl(){ return _g("qtabs"); },
    get hintsEl(){ return _g("hintsEl"); },
    hintsNow: _g("hintsNow"), renderHints: _g("renderHints"),
    applyScenery: _g("applyScenery"), sceneNow: _g("sceneNow"),
    questBgUrl: _g("questBgUrl"), QUEST_BG_DIR: _g("QUEST_BG_DIR"),
    get scenePref(){ return _g("scenePref"); },
    get bgKnown(){ return _g("bgKnown"); },
    /* ---- Lesson 3: the held note ---- */
    spanOf: _g("spanOf"), spanSteps: _g("spanSteps"), sounding: _g("sounding"),
    ringEnds: _g("ringEnds"), roomAt: _g("roomAt"), writtenLen: _g("writtenLen"),
    vhold: _g("vhold"), docHold: _g("docHold"), docOut: _g("docOut"),
    headAt: _g("headAt"), setLen: _g("setLen"), stretch: _g("stretch"),
    readHolds: _g("readHolds"), allPlain: _g("allPlain"),
    VOICE_HOLD: _g("VOICE_HOLD"), TAIL: _g("TAIL"),
    growStart: _g("growStart"), growTick: _g("growTick"), growStop: _g("growStop"),
    get grow(){ return _g("grow"); },
    GROW_DELAY: _g("GROW_DELAY"), growStep: _g("growStep"),
    get seamBars(){ return _g("seamBars"); },
    STEPS: _g("STEPS"), STORE_KEY: _g("STORE_KEY"), LEGACY_KEY: _g("LEGACY_KEY"),
    defaultDoc: _g("defaultDoc"), NOTE_KEYS: _g("NOTE_KEYS") };
  window.__probe = function(n){ try { return eval(n); } catch(e){ return "__undefined__"; } };
`;

  const fn = new Function("document", "window", "localStorage", "requestAnimationFrame",
    "navigator", "URL", "Blob", "AudioContext", "setTimeout", "setInterval",
    "clearInterval", "clearTimeout", "performance",
    appSource() + hook);
  window.AudioContext = FakeCtx;
  fn(document, window, localStorage, () => 0, navigator, URL, Blob, FakeCtx,
     setTimeout, setInterval, clearInterval, clearTimeout, performance);

  const T = window.__t;

  /* ---------- the checks ---------- */
  const tally = { pass: 0, fail: 0 };
  function ok(name, cond, extra){
    if (cond){ tally.pass++; console.log("  ok   " + name); }
    else { tally.fail++; console.log("  FAIL " + name +
      (extra !== undefined ? "  -> " + JSON.stringify(extra).slice(0, 500) : "")); }
  }
  function eq(name, a, b){ ok(name, JSON.stringify(a) === JSON.stringify(b), { got:a, want:b }); }
  function done(){
    console.log("\n" + tally.pass + " passed, " + tally.fail + " failed\n");
    process.exit(tally.fail ? 1 : 0);
  }

  /* ---------- driving it ---------- */
  function key(code, o){
    keyHandler(Object.assign({ code, preventDefault(){}, repeat:false,
      ctrlKey:false, metaKey:false, altKey:false }, o || {}));
  }
  function keyUp(code){ if (upHandler) upHandler({ code }); }
  function padState(down, axes){
    const buttons = [];
    for (let i = 0; i < 17; i++)
      buttons.push({ pressed: down.indexOf(i) >= 0, value: down.indexOf(i) >= 0 ? 1 : 0 });
    return { connected:true, mapping:"standard", buttons, axes: axes || [0,0,0,0], index:0 };
  }
  function frame(down, axes){
    clock.pad += 16; state.gamepads = [padState(down || [], axes)]; T.pollPads();
  }
  function frames(n, down){ for (let i = 0; i < n; i++) frame(down); }
  function hold(...b){ frame(b); frame([]); }
  function holdLong(...b){ frame(b); clock.pad += 600; frame(b); frame([]); }
  function stick(axes){ frame([], axes); frame([]); }
  function noPad(){ state.gamepads = [null]; }

  function blank(){ return new Array(16).fill(null); }
  function steps(o){ const s = blank(); for (const k in o) s[k | 0] = o[k]; return s; }

  frame([]);                        /* the pad says hello once */

  return { T, probe: window.__probe, ids, store, blobs, sounded, gains, clock,
           document, window, winHandlers, state, FakeCtx,
           ok, eq, tally, done, key, keyUp, frame, frames, hold, press: hold,
           holdLong, stick, noPad, padState, blank, steps, GP,
           html, appSource, appStyle, appMarkup, REPO };
}

module.exports = { boot, mkEl, GP, REPO, html, appSource, appStyle, appMarkup, scriptFiles };
