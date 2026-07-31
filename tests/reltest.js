/* Headless regression harness for folio.html.
   Covers the pre-existing suite (note entry, clear/cursor, the roll, the
   quest log, transport, save format, the crossbar) brought up to the current
   bindings, plus relative (contour) entry: scale-step motion, leaps, the
   chromatic escape, anchors, the snap rule, nudge, clamping, the key field
   and the entry-method toggle. */
const fs = require("fs");
const REPO = require("path").resolve(__dirname, "..").split("\\").join("/");
const path = REPO + "/folio.html";
const html = fs.readFileSync(path, "utf8");
const src = html.slice(html.indexOf("<script>") + 8, html.lastIndexOf("</script>"));

/* ---------- fake dom ---------- */
function mkEl(tag){
  const set = new Set();
  const attrs = {};
  const el = {
    tagName: tag, children: [], style: {}, textContent: "", value: "", files: null,
    get className(){ return [...set].join(" "); },
    set className(v){ set.clear(); String(v).split(/\s+/).filter(Boolean).forEach(c=>set.add(c)); },
    classList: {
      add:c=>set.add(c), remove:c=>set.delete(c), contains:c=>set.has(c),
      toggle:(c,f)=>{ const on = f===undefined ? !set.has(c) : !!f; on?set.add(c):set.delete(c); return on; }
    },
    get firstChild(){ return el.children[0] || null; },
    appendChild(c){ el.children.push(c); return c; },
    insertBefore(c, ref){ const i = ref ? el.children.indexOf(ref) : -1;
      if (i >= 0) el.children.splice(i, 0, c); else el.children.push(c); return c; },
    removeChild(c){ const i=el.children.indexOf(c); if(i>=0) el.children.splice(i,1); },
    addEventListener(){}, click(){},
    setAttribute(k, v){ attrs[k] = String(v); },
    getAttribute(k){ return (k in attrs) ? attrs[k] : null; },
    /* enough of a selector engine for the app: it only ever asks an element
       for descendants, and the fake tree is flat, so children suffice */
    querySelectorAll(){ return []; }
  };
  return el;
}
const ids = {};
["column","footer","metatext","keyref","picker","quests","qlist","qtabs","hints",
 "roll","rollfield","rollbase",
 "qfree","qfreesigil","qdname","qdtext","qdteach","qdstate","qpreview",
 "railquests","railtitle","railtext","railteach","railstate",
 "settings","xbarpad","xbarface","voices","vname0","vname1","vmark0","vmark1",
 "scenery"].forEach(i=>ids[i]=mkEl("div"));
let keyHandler = null;
const document = {
  getElementById: i => (i in ids ? ids[i] : null),
  createElement: mkEl,
  body: mkEl("body"),
  addEventListener(t,f){ if(t==="keydown") keyHandler = f; }
};
const winHandlers = {};
let padNow = 1000;                      /* the pad clock, ours to advance */
/* the app reads the bare global `performance`, so that is what we replace */
globalThis.performance = { now: () => padNow };
const window = {
  addEventListener(t,f){ (winHandlers[t]=winHandlers[t]||[]).push(f); },
  performance: { now: () => padNow }
};
const store = {};
const localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k,v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; }
};
const requestAnimationFrame = () => 0;

/* ---------- fake web audio ---------- */
const sounded = [];
let nowT = 0;
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
  get currentTime(){ return nowT; }
  resume(){}
  createGain(){ const g = { gain: param(), connect(){}, disconnect(){} };
    gains.push(g); return g; }
  createBiquadFilter(){ return { type:"", frequency:param(), Q:param(), connect(){}, disconnect(){} }; }
  createOscillator(){
    const o = { type:"", frequency:{ setValueAtTime:(f,at)=>{ o._f=f; o._at=at; } },
      connect(){}, disconnect(){},
      start(){ o._rec = { freq:o._f, at:o._at,
                          gain: (gains[gains.length-1] || {}).gain };
               sounded.push(o._rec); },
      /* the app stops an oscillator a hair after its release ends, so the
         length it was actually asked to ring for is readable from here */
      stop(t){ if (o._rec) o._rec.off = t; }, onended:null };
    return o;
  }
  get destination(){ return {}; }
}
let gamepads = [null];
const navigator = { getGamepads: () => gamepads };
const URL = { createObjectURL:()=>"blob:x", revokeObjectURL(){} };
const blobs = [];
function Blob(parts){ blobs.push(Array.isArray(parts) ? String(parts[0]) : ""); }

/* ---------- expose internals ---------- */
const hook = `
  /* some features come and go while another session works on the file; read
     them by name so a missing one is undefined rather than a ReferenceError */
  var _g = function(n){ try { return eval(n); } catch(e){ return undefined; } };
  window.__t = { get doc(){return doc;}, get cursor(){return cursor;}, set cursor(v){cursor=v;},
    get baseOctave(){return baseOctave;}, set baseOctave(v){baseOctave=v;},
    get voice(){ return _g("voice"); }, setVoice: _g("setVoice"),
    nextVoice: _g("nextVoice"), toggleSolo: _g("toggleSolo"), toggleMute: _g("toggleMute"),
    audible: _g("audible"), vsteps: _g("vsteps"), flag: _g("flag"),
    voiceState: _g("voiceState"), renderVoices: _g("renderVoices"),
    VOICES: _g("VOICES"), VOICE_NAMES: _g("VOICE_NAMES"), TONE: _g("TONE"),
    bars2: _g("bars2"), qdabs2: _g("qdabs2"),
    enterNote: enterNote, clearStep: clearStep, moveCursor: moveCursor,
    validate: validate, importText: importText, save: save, load: load, scheduler: scheduler,
    setDoc: function(d){ doc = d; renderAll(); },
    setPlaying: function(v){ playing = v; },
    schedFrom: function(s){ schedStep = s; nextStepTime = 0; queue.length = 0; },
    audioInit: function(){ audio(); },
    rows: rows, pollPads: pollPads, bars: bars,
    intervalName: _g("intervalName"), pitchName: _g("pitchName"),
    get ivls(){ return _g("ivls"); }, get ivlTies(){ return _g("ivlTies"); },
    get octlines(){ return _g("octlines"); },
    get rollGuide(){ return _g("rollGuide"); }, get guideName(){ return _g("guideName"); },
    get guideMidi(){ return _g("guideMidi"); },
    showGuide: _g("showGuide"), GUIDE_HOLD: _g("GUIDE_HOLD"),
    get showNames(){ return _g("showNames"); },
    setNames: _g("setNames"), toggleNames: _g("toggleNames"),
    NAMES_KEY: _g("NAMES_KEY"), rollEl: roll,
    get viz(){return viz;}, toggleViz: toggleViz, VIZ_KEY: VIZ_KEY,
    get relative(){return relative;}, setRelative: setRelative, toggleRelative: toggleRelative,
    ENTRY_KEY: ENTRY_KEY,
    relStep: relStep, relRepeat: relRepeat, nudge: nudge,
    anchorMidi: anchorMidi, tonicMidi: tonicMidi,
    moveDegrees: moveDegrees, degreeOfMidi: degreeOfMidi, midiOfDegree: midiOfDegree,
    nameOfMidi: nameOfMidi, midiOf: midiOf, clampMidi: clampMidi,
    keyOf: keyOf, parseKey: parseKey, normalizeKey: normalizeKey,
    shiftTonic: shiftTonic, toggleKeyMode: toggleKeyMode,
    shiftTempo: shiftTempo, stepDur: stepDur,
    TEMPO_MIN: TEMPO_MIN, TEMPO_MAX: TEMPO_MAX,
    TEMPO_STEP: TEMPO_STEP, TEMPO_FINE: TEMPO_FINE,
    SEEDS: SEEDS, seededDoc: seededDoc, workspaceDoc: workspaceDoc,
    setKey: function(k){ doc.key = k; renderMeta(); },
    MIDI_LO: MIDI_LO, MIDI_HI: MIDI_HI, SCALES: SCALES,
    QUESTS: QUESTS, QUEST_KEY: QUEST_KEY, QUEST_KEY_V1: QUEST_KEY_V1, qrows: qrows,
    get qsel(){return qsel;}, set qsel(v){qsel=v;},
    get qActive(){return qActive;}, set qActive(v){qActive=v;},
    get qState(){return qState;},
    get wsFree(){return wsFree;}, get wsDoc(){return wsDoc;},
    toggleQuests: toggleQuests, toggleKeyref: toggleKeyref,
    toggleSettings: _g("toggleSettings"), closeSettings: _g("closeSettings"),
    runSetting: _g("runSetting"), renderSettings: _g("renderSettings"),
    railStep: _g("railStep"), railOrder: _g("railOrder"),
    workspaceName: _g("workspaceName"), cycleVoice: _g("cycleVoice"),
    get SETTINGS(){ return _g("SETTINGS"); },
    get xslots(){ return _g("xslots"); },
    loadQuests: loadQuests, saveQuests: saveQuests, renderQuests: renderQuests,
    questsToJSON: stateToJSON, isQuestLog: isQuestLog, exportQuests: exportQuests,
    applyState: applyState, loadState: loadState, stateToJSON: stateToJSON,
    switchWorkspace: switchWorkspace, chooseWorkspace: chooseWorkspace,
    questPage: questPage, questHasContent: questHasContent, questGlyph: questGlyph,
    qdabs: qdabs, rrows: rrows, renderRails: renderRails,
    syncNote: syncNote, httpOrigin: httpOrigin, applyServerState: applyServerState,
    get syncOn(){return syncOn;}, set syncOn(v){syncOn=v;},
    get syncState(){return syncState;}, set syncState(v){syncState=v;},
    get syncTimer(){return syncTimer;},
    setSyncDebounce: function(ms){ SYNC_DEBOUNCE = ms; },
    syncBoot: syncBoot, syncFlush: syncFlush, syncPush: syncPush, bootState: bootState,
    get staticMode(){return staticMode;}, set staticMode(v){staticMode=v;},
    SEED_URL: _g("SEED_URL"), seedBoot: _g("seedBoot"), jsonish: _g("jsonish"),
    get DRILLS(){ return _g("DRILLS"); },
    get ALL(){ return _g("ALL"); },
    allQuests: _g("allQuests"), selQuest: _g("selQuest"),
    drillById: _g("drillById"), normDrill: _g("normDrill"),
    mergeDrills: _g("mergeDrills"), pollTick: _g("pollTick"), pollStart: _g("pollStart"),
    buildQuestRows: _g("buildQuestRows"), rebuildList: _g("rebuildList"),
    get qrowsNow(){ return _g("qrows"); },
    get rrowsNow(){ return _g("rrows"); },
    get qlistEl(){ return qlist; },
    get railEl(){ return railquests; },
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
    /* the tabs, the favourites and the order they impose */
    tabList: _g("tabList"), tabLabel: _g("tabLabel"), setTab: _g("setTab"),
    moveTab: _g("moveTab"), currentTab: _g("currentTab"),
    view: _g("view"), viewOf: _g("viewOf"), questGroup: _g("questGroup"),
    toggleFavourite: _g("toggleFavourite"), moveInOrder: _g("moveInOrder"),
    favOf: _g("favOf"), orderOf: _g("orderOf"), TAB_KEY: _g("TAB_KEY"),
    LESSON_OF: _g("LESSON_OF"), newestLesson: _g("newestLesson"),
    railSections: _g("railSections"), railSequence: _g("railSequence"),
    get activeTab(){ return _g("activeTab"); },
    get qtabsEl(){ return qtabs; },
    /* the standing hint under the footer */
    get hintsEl(){ return _g("hintsEl"); },
    hintsNow: _g("hintsNow"), renderHints: _g("renderHints"),
    /* the workspace's own scenery */
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
    STORE_KEY: STORE_KEY, LEGACY_KEY: LEGACY_KEY, NOTE_KEYS: NOTE_KEYS };
  window.__probe = function(n){ try { return eval(n); } catch(e){ return "__undefined__"; } };
`;
const patched = src.replace(/\}\)\(\);\s*$/, hook + "\n})();");
if (patched === src) throw new Error("could not inject hook");

const fn = new Function("document","window","localStorage","requestAnimationFrame",
  "navigator","URL","Blob","AudioContext","setTimeout","setInterval","clearInterval",
  patched);
window.AudioContext = FakeCtx;
fn(document, window, localStorage, requestAnimationFrame, navigator, URL, Blob, FakeCtx,
   setTimeout, setInterval, clearInterval);

const T = window.__t;

/* ---------- test rig ---------- */
let pass = 0, fail = 0;
function ok(name, cond, extra){
  if (cond){ pass++; console.log("  ok   " + name); }
  else { fail++; console.log("  FAIL " + name + (extra !== undefined ? "  -> " + JSON.stringify(extra) : "")); }
}
function eq(name, a, b){ ok(name, JSON.stringify(a) === JSON.stringify(b), {got:a, want:b}); }
function key(code, opts){ keyHandler(Object.assign({ code, preventDefault(){}, repeat:false,
  ctrlKey:false, metaKey:false, altKey:false }, opts||{})); }
function blank(){ return new Array(16).fill(null); }
/* The written column was the default view when this suite was first written;
   the roll is the default now. Everything below the roll's own section reads
   the column and its d-pad bindings (↑↓ time, ←→ nudge), so the baseline is
   set explicitly here rather than assumed. */
function useColumn(){ if (T.viz !== "column") T.toggleViz(); }
function useRoll(){ if (T.viz !== "roll") T.toggleViz(); }
function reset(){
  T.setDoc({ version:1, title:"untitled folio", tempo:112, loop:16, key:"C major",
             steps: blank(), bass: blank(), mute:[false,false], solo:[false,false] });
  T.setVoice(0);                        /* the lead is the baseline hand */
  T.cursor = 0;
  T.baseOctave = 4;
  T.setRelative(false);
  useColumn();
  sounded.length = 0;
}
function steps(o){ const s = blank(); for (const k in o) s[k|0] = o[k]; return s; }
function page(o, extra){
  T.setDoc(Object.assign({ version:1, title:"t", tempo:112, loop:16, key:"C major",
                           steps: steps(o), bass: blank(),
                           mute:[false,false], solo:[false,false] }, extra||{}));
}
/* a page with something in the second voice as well */
function duet(lead, bass, extra){ page(lead, Object.assign({ bass: steps(bass) }, extra||{})); }
/* ---- re-pointed, 2026-07-31 ----
   The roll's horizontal rules sit on the *home* note of the page's key rather
   than always on C, and each margin label now carries two words: the pitch,
   and what that pitch is to the piece. So the name is the label's first child
   instead of the label itself. */
function ruleNames(){ return T.octlines.map(l => l.firstChild.children[0].textContent); }
function ruleHomes(){ return T.octlines.map(l => l.firstChild.children[1].textContent); }

/* ---------- pad helpers ---------- */
function pad(down, axes){
  const buttons = [];
  for (let i = 0; i < 17; i++) buttons.push({ pressed: down.indexOf(i) >= 0, value: down.indexOf(i) >= 0 ? 1 : 0 });
  return { connected:true, mapping:"standard", buttons, axes: axes || [0,0,0,0], index:0 };
}
function frame(down, axes){ padNow += 16; gamepads = [pad(down, axes)]; T.pollPads(); }
function hold(...b){ frame(b); frame([]); }
const press = hold;
function stick(axes){ frame([], axes); frame([]); }
function holdLong(...b){ frame(b); padNow += 600; frame(b); frame([]); }
const GP = { X:0, B:1, SQ:2, TR:3, L1:4, R1:5, L2:6, R2:7, SEL:8, START:9,
             L3:10, R3:11, DU:12, DD:13, DL:14, DR:15 };
gamepads = [pad([])]; T.pollPads();

/* ================= 1. the page, the column, plain entry ================= */
console.log("\n== plain (absolute) note entry ==");
reset();
key("KeyZ");
eq("writes C4 at step 1", T.doc.steps[0], "C4");
/* the default is the eighth: entry leaves the cursor two steps on, so a run
   of notes lands on 1, 3, 5, 7 … and a sixteenth costs one deliberate step
   back with an arrow. Re-pointed from the old one-step advance. */
eq("advances by two — the eighth", T.cursor, 2);
key("KeyM"); eq("writes B4 two steps on", T.doc.steps[2], "B4");
eq("and nothing was written between them", T.doc.steps[1], null);
key("KeyQ"); eq("Q row is an octave up", T.doc.steps[4], "C5");
eq("three notes lay themselves on 1, 3, 5", T.cursor, 6);
/* the sixteenth, placed the deliberate way: back one, write there */
T.cursor = 2; key("ArrowUp"); key("KeyX");
eq("a step back puts a sixteenth between the eighths", T.doc.steps[1], "D4");
eq("and entry goes on by two from there as well", T.cursor, 3);
T.cursor = 6;
key("Enter"); eq("enter is inert", T.cursor, 6);
key("Tab");   eq("tab is inert", T.cursor, 6);
key("Tab");   /* back in the lead */
T.cursor = 15; key("KeyZ");
eq("entry wraps past 16", T.cursor, 1);
T.cursor = 14; key("KeyZ");
eq("and lands on step 1 from step 15", T.cursor, 0);
/* the loop length fences neither the cursor nor the advance, as it never has */
reset(); T.doc.loop = 8; T.cursor = 7; key("KeyZ");
eq("a short loop does not fence the advance", T.cursor, 9);
T.cursor = 15; key("KeyZ");
eq("and it still wraps around the whole page", T.cursor, 1);
reset();
eq("NOTE_KEYS unchanged", T.NOTE_KEYS, {KeyZ:0,KeyS:1,KeyX:2,KeyD:3,KeyC:4,KeyV:5,KeyG:6,KeyB:7,KeyH:8,
  KeyN:9,KeyJ:10,KeyM:11,Comma:12,KeyQ:12,Digit2:13,KeyW:14,Digit3:15,KeyE:16,KeyR:17,Digit5:18,
  KeyT:19,Digit6:20,KeyY:21,Digit7:22,KeyU:23,KeyI:24});

console.log("\n== clear, cursor, octave, loop ==");
reset();
page({0:"C4", 1:"C4", 2:"C4", 3:"C4", 4:"C4"});
T.cursor = 0;
key("Period"); eq("period clears", T.doc.steps[0], null);
eq("clear advances by two, as a note does", T.cursor, 2);
key("Delete"); eq("delete clears", T.doc.steps[2], null);
key("Backspace"); ok("backspace clears", T.doc.steps[4] === null);
eq("and the steps between are left alone", [T.doc.steps[1], T.doc.steps[3]], ["C4","C4"]);
reset();
key("ArrowDown"); eq("down moves one", T.cursor, 1);
key("ArrowUp"); key("ArrowUp"); eq("up wraps one at a time", T.cursor, 15);
key("ArrowRight"); eq("right moves forward", T.cursor, 0);
key("ArrowLeft"); eq("left moves back", T.cursor, 15);
key("Home"); eq("home -> step 1", T.cursor, 0);
key("End");  eq("end -> step 16", T.cursor, 15);
key("PageDown"); eq("page down lowers the octave", T.baseOctave, 3);
key("PageUp");   eq("page up raises it", T.baseOctave, 4);
key("KeyL"); eq("L cycles the loop length", T.doc.loop, 8);
key("KeyL"); eq("and again", T.doc.loop, 4);
key("KeyL"); eq("and back to the whole page", T.doc.loop, 16);
key("Space"); ok("space transports", /playing|stopped/.test(ids.footer.textContent), ids.footer.textContent);
key("Space");

console.log("\n== rendering ==");
reset();
page({0:"C4", 2:"F#3"});
eq("note glyph", T.rows[0].note.textContent, "C-4");
eq("note class", T.rows[0].note.className, "note");
eq("the second voice sits beside it", T.rows[0].note2.className, "note empty dim");
eq("empty glyph", T.rows[1].note.textContent, "\u00b7");
eq("empty class", T.rows[1].note.className, "note empty");
eq("sharp glyph", T.rows[2].note.textContent, "F\u266f3");

console.log("\n== the roll ==");
reset();
ok("the roll is in the markup", /id="roll"/.test(html) && /id="rollfield"/.test(html));
/* the shipped default: the page arrives drawn, not written */
ok("the roll is the view a fresh browser gets", /var viz = "roll";/.test(src),
   (/var viz = "[a-z]+";/.exec(src) || [])[0]);
eq("reset puts the suite back in the column", T.viz, "column");
key("F2"); eq("F2 shows the roll", T.viz, "roll");
ok("the roll section is on", ids.roll.classList.contains("on"));
eq("the column stands down", ids.column.style.display, "none");
key("F2"); eq("F2 shows the column again", T.viz, "column");
ok("the roll is off", !ids.roll.classList.contains("on"));
press(GP.R3); eq("R3 shows the roll", T.viz, "roll");
press(GP.R3); eq("R3 shows the column", T.viz, "column");
eq("the choice is a preference, not the document", store[T.VIZ_KEY], "column");
page({0:"C4", 5:"G4"});
ok("a bar is drawn for a sounding step", T.bars[0].style.display, "block");
eq("and none for a rest", T.bars[1].style.display, "none");
ok("bars are coloured by pitch class", /hsl\(/.test(T.bars[0].style.backgroundColor),
   T.bars[0].style.backgroundColor);

/* ================= 2. the key of the piece ================= */
console.log("\n== the key: defaults, parsing, normalising ==");
reset();
eq("the default key is C major", T.doc.key, "C major");
eq("keyOf reads it", T.keyOf(), { pc:0, mode:"major" });
eq("a lowercase key normalises", T.normalizeKey("e minor"), "E minor");
eq("a sharp tonic normalises", T.normalizeKey("f# MINOR"), "F# minor");
eq("a hyphen separator is accepted", T.normalizeKey("A-minor"), "A minor");
eq("the unicode sharp is accepted", T.normalizeKey("C\u266f major"), "C# major");
eq("junk falls back to C major", T.normalizeKey("H lydian"), "C major");
eq("a missing key falls back to C major", T.normalizeKey(undefined), "C major");
eq("a non-string falls back to C major", T.normalizeKey(7), "C major");
eq("major scale", T.SCALES.major, [0,2,4,5,7,9,11]);
eq("natural minor scale", T.SCALES.minor, [0,2,3,5,7,8,10]);

console.log("\n== the key is shown in the header ==");
reset();
eq("the meta line names the key", ids.metatext.textContent,
   "untitled folio \u00b7 112 \u00b7 octave 4 \u00b7 C major \u00b7 lead");
T.setKey("E minor");
eq("and follows it", ids.metatext.textContent,
   "untitled folio \u00b7 112 \u00b7 octave 4 \u00b7 E minor \u00b7 lead");
reset();
key("KeyL");
eq("loop still reads after the key", ids.metatext.textContent,
   "untitled folio \u00b7 112 \u00b7 octave 4 \u00b7 C major \u00b7 loop 8 \u00b7 lead");
reset();

console.log("\n== setting the key on the key page ==");
reset();
key("F1"); ok("F1 opens the key page", ids.keyref.classList.contains("on"));
key("ArrowRight"); eq("right moves the tonic up a semitone", T.doc.key, "C# major");
key("ArrowLeft"); key("ArrowLeft"); eq("left moves it down", T.doc.key, "B major");
eq("the tonic wraps", T.keyOf().pc, 11);
key("ArrowUp"); eq("up makes it minor", T.doc.key, "B minor");
key("ArrowDown"); eq("down makes it major again", T.doc.key, "B major");
ok("the footer says so", /the key · B major/.test(ids.footer.textContent), ids.footer.textContent);
key("KeyZ"); eq("note keys are still inert on the key page", T.doc.steps.filter(Boolean).length, 0);
ok("the key is autosaved", JSON.parse(store["folio.v1"]).key === "B major",
   JSON.parse(store["folio.v1"]).key);
key("Escape"); ok("escape closes the page", !ids.keyref.classList.contains("on"));
/* the pad reaches the same setting on the key page itself. Start no longer
   leads there: the key has no slot in the settings crossbar at all, and F1
   (with R3 to leave) is the whole of the way in and out. */
reset();
press(GP.START); ok("start raises the settings crossbar", ids.settings.classList.contains("on"));
ok("no slot of it is the key page any more",
   T.SETTINGS.every(s => !/^the key$/.test(s.label)), T.SETTINGS.map(s => s.label));
ok("and nothing it does opens one", !ids.keyref.classList.contains("on"));
press(GP.START);
ok("start put it down again", !ids.settings.classList.contains("on"));
key("F1"); ok("F1 is the way to the key page", ids.keyref.classList.contains("on"));
press(GP.DR); eq("d-pad right moves the tonic up", T.doc.key, "C# major");
press(GP.DL); press(GP.DL); eq("d-pad left moves it down", T.doc.key, "B major");
press(GP.TR); eq("triangle makes it minor", T.doc.key, "B minor");
press(GP.X);  eq("cross makes it major", T.doc.key, "B major");
eq("the pattern cursor never moved", T.cursor, 0);
press(GP.R3);
ok("R3 is the way out of the key page", !ids.keyref.classList.contains("on"));
ok("and it did not flip the view on the way", T.viz, "column");

console.log("\n== the key travels in the save file ==");
reset();
T.setKey("E minor");
const withKey = JSON.parse(T.exportJSON());
eq("export carries the key", withKey.key, "E minor");
eq("and is still version 1", withKey.version, 1);
eq("the pattern file has exactly the version-1 fields",
   Object.keys(withKey).sort(), ["bass","key","loop","mute","solo","steps","tempo","title","version"]);
const keyless = { version:1, title:"keyless", tempo:112, loop:16, steps: steps({0:"C4"}) };
eq("a file with no key validates", T.validate(keyless).key, "C major");
eq("a file with a key keeps it", T.validate(Object.assign({}, keyless, {key:"g minor"})).key, "G minor");
eq("a file with a junk key falls back", T.validate(Object.assign({}, keyless, {key:{}})).key, "C major");
const v0 = { version:0, title:"old folio", tempo:96, steps: steps({0:"C4", 2:"F#3"}) };
ok("v0 still validates", !!T.validate(v0));
eq("v0 is upgraded to version 1", T.validate(v0).version, 1);
eq("and lands in C major", T.validate(v0).key, "C major");
T.importText(JSON.stringify(Object.assign({}, keyless, {key:"F# minor"})), "keyed.folio.json");
eq("import round-trips the key", T.doc.key, "F# minor");
eq("and the header follows", ids.metatext.textContent.indexOf("F# minor") > 0, true);
T.importText(JSON.stringify(keyless), "keyless.folio.json");
eq("a keyless import is C major", T.doc.key, "C major");
/* autosave round-trip */
reset(); T.setKey("A minor"); T.save();
delete store["folio.v0"];
T.setKey("C major");
ok("autosave reloads the key", T.load() === true);
eq("as written", T.doc.key, "A minor");

/* ================= 3. relative entry ================= */
console.log("\n== the entry method toggles ==");
reset();
ok("absolute at rest", !T.relative);
eq("and the header says nothing about it", ids.metatext.textContent.indexOf("relative"), -1);
key("F4"); ok("F4 turns relative entry on", T.relative);
ok("the header says so quietly", / \u00b7 relative$/.test(ids.metatext.textContent),
   ids.metatext.textContent);
ok("the footer explains the mapping", /△ up, ✕ down/.test(ids.footer.textContent),
   ids.footer.textContent);
eq("the choice is a preference", store[T.ENTRY_KEY], "relative");
key("F4"); ok("F4 turns it off", !T.relative);
eq("stored as absolute", store[T.ENTRY_KEY], "absolute");
eq("and the header is quiet again", ids.metatext.textContent.indexOf("relative"), -1);
/* the pad: select is the transport now, and the method is a crossbar item */
reset();
press(GP.SEL);
ok("select transports", /playing|stopped/.test(ids.footer.textContent), ids.footer.textContent);
ok("select opens no page", !ids.keyref.classList.contains("on") &&
   !ids.quests.classList.contains("on") && !ids.settings.classList.contains("on"));
ok("and does not change the method", !T.relative);
press(GP.SEL);
holdLong(GP.SEL);
ok("holding select is the transport too, and nothing else", !T.relative);
ok("still no page opened", !ids.keyref.classList.contains("on") &&
   !ids.settings.classList.contains("on"));
holdLong(GP.SEL);
/* the entry method has moved to ✕: the d-pad's four slots are the workspace
   and the voice now, and ✕ was freed by the quest log leaving the mode */
press(GP.START); press(GP.X);
ok("the crossbar's ✕ turns relative entry on", T.relative);
ok("and the crossbar stays up for the next item", ids.settings.classList.contains("on"));
press(GP.X);
ok("the same slot turns it off again", !T.relative);
ok("and it opens no page on the way",
   !ids.quests.classList.contains("on") && !ids.keyref.classList.contains("on"));
press(GP.B);
ok("○ closes the crossbar", !ids.settings.classList.contains("on"));
ok("F4 is still the keyboard's way to the same setting",
   (function(){ key("F4"); const on = T.relative; key("F4"); return on && !T.relative; })());

console.log("\n== relative moves from an anchor ==");
function rel(setup, buttons, opts){
  reset();
  page(setup.steps, setup.doc);
  T.cursor = setup.cursor === undefined ? 0 : setup.cursor;
  if (setup.octave) T.baseOctave = setup.octave;
  T.setRelative(true);
  /* where it was written, not where the cursor ended up: the advance is two
     steps now and this helper is about the pitch, not the walk */
  const at = T.cursor;
  hold(...buttons);
  return T.doc.steps[at];
}
const A = { steps:{15:"C4"}, cursor:0 };            /* the anchor is C4, behind step 1 */
eq("△ writes one scale step up", rel(A, [GP.TR]), "D4");
eq("✕ writes one scale step down", rel(A, [GP.X]), "B3");
eq("○ repeats the anchor", rel(A, [GP.B]), "C4");
eq("L1 + △ leaps a third", rel(A, [GP.L1, GP.TR]), "E4");
eq("L1 + ✕ leaps a third down", rel(A, [GP.L1, GP.X]), "A3");
eq("R1 + △ leaps a fifth", rel(A, [GP.R1, GP.TR]), "G4");
eq("R1 + ✕ leaps a fifth down", rel(A, [GP.R1, GP.X]), "F3");
eq("L1 + R1 + △ is a semitone up", rel(A, [GP.L1, GP.R1, GP.TR]), "C#4");
eq("L1 + R1 + ✕ is a semitone down", rel(A, [GP.L1, GP.R1, GP.X]), "B3");
/* the steps of the key, not of the keyboard: C major from B3 */
eq("a step up from B3 is C4", rel({steps:{15:"B3"}, cursor:0}, [GP.TR]), "C4");
eq("a step down from C4 is B3", rel({steps:{15:"C4"}, cursor:0}, [GP.X]), "B3");
eq("a step up from E4 is F4", rel({steps:{15:"E4"}, cursor:0}, [GP.TR]), "F4");
/* and they follow the key */
const Em = { steps:{15:"E4"}, cursor:0, doc:{ key:"E minor" } };
eq("in E minor a step up from E4 is F#4", rel(Em, [GP.TR]), "F#4");
eq("in E minor a third up from E4 is G4", rel(Em, [GP.L1, GP.TR]), "G4");
eq("in E minor a fifth up from E4 is B4", rel(Em, [GP.R1, GP.TR]), "B4");
eq("in E minor a step down from E4 is D4", rel(Em, [GP.X]), "D4");

console.log("\n== rest, advance and audition ==");
reset(); page({0:"C4", 1:"E4"}); T.cursor = 1; T.setRelative(true);
sounded.length = 0;
hold(GP.SQ);
eq("□ writes a rest", T.doc.steps[1], null);
eq("and advances by two, as everything that writes does", T.cursor, 3);
eq("a rest sounds nothing", sounded.length, 0);
reset(); page({15:"C4"}); T.setRelative(true);
sounded.length = 0;
hold(GP.TR);
eq("a relative note advances by two", T.cursor, 2);
eq("and is auditioned", sounded.length, 1);
ok("at the pitch it wrote", Math.abs(sounded[0].freq - 293.6647679174076) < 1e-6, sounded);
ok("the footer names the note and the step", /D-4 at step 1/.test(ids.footer.textContent),
   ids.footer.textContent);

console.log("\n== the anchor ==");
reset(); T.setRelative(true);
hold(GP.TR);
eq("an empty page starts on the tonic", T.doc.steps[0], "C4");
reset(); T.setRelative(true); T.setKey("E minor");
hold(GP.TR); eq("in E minor, on E", T.doc.steps[0], "E4");
reset(); T.setRelative(true); T.baseOctave = 2;
hold(GP.TR); eq("in the base octave", T.doc.steps[0], "C2");
reset(); T.setRelative(true);
hold(GP.B); eq("○ on an empty page is the tonic too", T.doc.steps[0], "C4");
reset(); T.setRelative(true);
hold(GP.X); eq("✕ on an empty page is the tonic too", T.doc.steps[0], "C4");
/* rests do not break the chain */
reset(); page({0:"G4"}); T.cursor = 4; T.setRelative(true);
hold(GP.TR);
eq("the scan steps over rests", T.doc.steps[4], "A4");
/* the nearest note behind wins */
reset(); page({0:"G4", 2:"C4"}); T.cursor = 5; T.setRelative(true);
hold(GP.TR);
eq("the nearest note behind is the anchor", T.doc.steps[5], "D4");
/* it wraps */
reset(); page({15:"A4"}); T.cursor = 0; T.setRelative(true);
hold(GP.TR);
eq("the scan wraps around the page", T.doc.steps[0], "B4");
/* around the loop, when the cursor is inside it */
reset(); page({3:"D4", 15:"A4"}, { loop:4 }); T.cursor = 0; T.setRelative(true);
hold(GP.TR);
eq("inside a short loop it wraps at the loop", T.doc.steps[0], "E4");
/* outside the loop it wraps around the whole page */
reset(); page({15:"A4"}, { loop:4 }); T.cursor = 8; T.setRelative(true);
hold(GP.TR);
eq("outside the loop it wraps around the whole page", T.doc.steps[8], "B4");
/* the note under the cursor is the last resort */
reset(); page({4:"C4"}); T.cursor = 4; T.setRelative(true);
hold(GP.TR);
eq("a lone note under the cursor still anchors", T.doc.steps[4], "D4");

console.log("\n== out of the key: the snap rule ==");
/* C major, F#4: up goes to the nearest scale tone above, and that is the step */
reset(); page({15:"F#4"}); T.setRelative(true);
hold(GP.TR); eq("a step up from F#4 is G4", T.doc.steps[0], "G4");
reset(); page({15:"F#4"}); T.setRelative(true);
hold(GP.X);  eq("a step down from F#4 is F4", T.doc.steps[0], "F4");
reset(); page({15:"F#4"}); T.setRelative(true);
hold(GP.L1, GP.TR); eq("a third up from F#4 is A4", T.doc.steps[0], "A4");
reset(); page({15:"F#4"}); T.setRelative(true);
hold(GP.L1, GP.X);  eq("a third down from F#4 is E4", T.doc.steps[0], "E4");
reset(); page({15:"F#4"}); T.setRelative(true);
hold(GP.B);  eq("○ repeats an out-of-key note exactly", T.doc.steps[0], "F#4");
reset(); page({15:"F#4"}); T.setRelative(true);
hold(GP.L1, GP.R1, GP.TR); eq("the chromatic move ignores the key", T.doc.steps[0], "G4");
reset(); page({15:"C#4"}); T.setRelative(true);
hold(GP.X);  eq("a step down from C#4 is C4", T.doc.steps[0], "C4");
reset(); page({15:"A#4"}); T.setRelative(true);
hold(GP.TR); eq("a step up from A#4 is B4", T.doc.steps[0], "B4");
/* the escape hatch and back: a chromatic note then a diatonic step */
reset(); T.setRelative(true);
hold(GP.TR);                       /* C4, the tonic */
hold(GP.L1, GP.R1, GP.TR);         /* C#4 */
hold(GP.TR);                       /* snaps up to D4 */
/* on 1, 3 and 5 now: three writes, each two steps on */
eq("a chromatic detour rejoins the key",
   [T.doc.steps[0], T.doc.steps[2], T.doc.steps[4]], ["C4","C#4","D4"]);

console.log("\n== nudge: change the note, stay put ==");
reset(); page({0:"C4", 1:"E4"}); T.cursor = 1; T.setRelative(true);
hold(GP.DR);
eq("d-pad right nudges the note up a step", T.doc.steps[1], "F4");
eq("and does not advance", T.cursor, 1);
hold(GP.DL); hold(GP.DL);
eq("d-pad left nudges it down", T.doc.steps[1], "D4");
eq("still no advance", T.cursor, 1);
sounded.length = 0; hold(GP.DR);
eq("a nudge auditions", sounded.length, 1);
reset(); page({0:"C4"}); T.cursor = 1; T.setRelative(true);
hold(GP.DR);
eq("nudging an empty step writes nothing", T.doc.steps[1], null);
ok("and says so", /nothing to nudge/.test(ids.footer.textContent), ids.footer.textContent);
eq("and does not move", T.cursor, 1);
/* out-of-key nudge follows the same snap rule */
reset(); page({0:"F#4"}); T.cursor = 0; T.setRelative(true);
hold(GP.DR); eq("nudging F#4 up gives G4", T.doc.steps[0], "G4");
/* nudge is relative-only: in absolute entry the d-pad still walks */
reset(); page({0:"C4"}); T.cursor = 0;
hold(GP.DR);
eq("in absolute entry d-pad right still moves the cursor", T.cursor, 1);
eq("and leaves the note alone", T.doc.steps[0], "C4");

/* ---- the escape hatch reaches the nudge as well ----
   Both bumpers together mean one thing in relative entry — out of the key, a
   semitone — and it used to be heard only by △ and ✕. The nudge is the same
   logical move made on a note already written, so it answers the same hand,
   whichever pair of the d-pad the view has put it on. */
console.log("\n== the chromatic escape, on the d-pad ==");
reset(); page({0:"C4"}); T.cursor = 0; T.setRelative(true);
hold(GP.L1, GP.R1, GP.DR);
eq("both bumpers make the nudge chromatic", T.doc.steps[0], "C#4");
eq("and it still does not advance", T.cursor, 0);
eq("the bumpers were spent: the octave did not move", T.baseOctave, 4);
hold(GP.L1, GP.R1, GP.DL);
eq("and back down a semitone the same way", T.doc.steps[0], "C4");
reset(); page({0:"G4"}); T.cursor = 0; T.setRelative(true);
hold(GP.L1, GP.R1, GP.DR);
eq("a semitone above G4 is G#4, not the key's A4", T.doc.steps[0], "G#4");
/* one bumper alone is not the hatch — the nudge stays a step of the key */
reset(); page({0:"C4"}); T.cursor = 0; T.setRelative(true);
hold(GP.L1, GP.DR);
eq("L1 alone leaves the nudge in the key", T.doc.steps[0], "D4");
reset(); page({0:"C4"}); T.cursor = 0; T.setRelative(true);
hold(GP.R1, GP.DR);
eq("and so does R1 alone", T.doc.steps[0], "D4");
reset(); page({0:"C4"}); T.cursor = 0; T.setRelative(true);
hold(GP.DR);
eq("and a bare d-pad is the step it always was", T.doc.steps[0], "D4");
/* the roll trades the pairs, so there the hatch is on ↑ and ↓ */
reset(); page({0:"C4"}); T.cursor = 0; T.setRelative(true); useRoll();
hold(GP.L1, GP.R1, GP.DU);
eq("in the roll the hatch is on d-pad up", T.doc.steps[0], "C#4");
hold(GP.L1, GP.R1, GP.DD);
eq("and on d-pad down", T.doc.steps[0], "C4");
hold(GP.DU);
eq("bare, the roll's up is still a step of the key", T.doc.steps[0], "D4");
/* the left stick is the same move behind the same pair */
reset(); page({0:"C4"}); T.cursor = 0; T.setRelative(true); useRoll();
frame([GP.L1, GP.R1], [0,-1,0,0]); frame([]);
eq("the left stick takes the hatch too", T.doc.steps[0], "C#4");
useColumn();
/* an out-of-key note nudged chromatically moves by semitone, never by snap */
reset(); page({0:"C#4"}); T.cursor = 0; T.setRelative(true);
hold(GP.L1, GP.R1, GP.DR);
eq("a chromatic nudge from C#4 is D4", T.doc.steps[0], "D4");
reset(); page({0:"C#4"}); T.cursor = 0; T.setRelative(true);
hold(GP.DR);
eq("while the bare nudge snaps into the key", T.doc.steps[0], "D4");
reset(); page({0:"D#4"}); T.cursor = 0; T.setRelative(true);
hold(GP.L1, GP.R1, GP.DR);
eq("a chromatic nudge from D#4 is E4", T.doc.steps[0], "E4");
reset(); page({0:"D#4"}); T.cursor = 0; T.setRelative(true);
hold(GP.L1, GP.R1, GP.DL);
eq("and down from D#4 is D4, not the key's D4 by snap", T.doc.steps[0], "D4");
/* the clamp and the empty step are unchanged by the hatch */
reset(); page({0:"C6"}); T.cursor = 0; T.setRelative(true);
hold(GP.L1, GP.R1, GP.DR);
eq("a chromatic nudge clamps at the ceiling too", T.doc.steps[0], "C6");
reset(); page({0:"C2"}); T.cursor = 0; T.setRelative(true);
hold(GP.L1, GP.R1, GP.DL);
eq("and at the floor", T.doc.steps[0], "C2");
reset(); T.cursor = 0; T.setRelative(true);
hold(GP.L1, GP.R1, GP.DR);
ok("the hatch on an empty step still says there is nothing to nudge",
   /nothing to nudge/.test(ids.footer.textContent), ids.footer.textContent);
eq("and the octave is still not spent on it", T.baseOctave, 4);
/* the hatch belongs to relative entry: in absolute the bumpers are the octave */
reset(); page({0:"C4"}); T.cursor = 0; useRoll();
hold(GP.L1, GP.R1, GP.DU);
eq("in absolute entry the nudge stays in the key", T.doc.steps[0], "D4");
eq("and the bumpers were the octave, down and up", T.baseOctave, 4);
useColumn();
/* it writes into the hand you are in, as every edit does */
reset(); page({0:"C4"}); T.setDoc(Object.assign({}, T.doc, { bass: (function(){
  const s = blank(); s[0] = "C3"; return s; })() }));
T.cursor = 0; T.setRelative(true); T.setVoice(1);
hold(GP.L1, GP.R1, GP.DR);
eq("a chromatic nudge lands in the bass when the bass is in hand", T.doc.bass[0], "C#3");
eq("and the lead is untouched", T.doc.steps[0], "C4");
T.setVoice(0);

console.log("\n== the range is clamped ==");
reset(); page({15:"C6"}); T.setRelative(true);
hold(GP.TR);
eq("a move above C6 stops at C6", T.doc.steps[0], "C6");
ok("and says so", /end of the range/.test(ids.footer.textContent), ids.footer.textContent);
reset(); page({15:"C2"}); T.setRelative(true);
hold(GP.X);
eq("a move below C2 stops at C2", T.doc.steps[0], "C2");
reset(); page({15:"B5"}); T.setRelative(true);
hold(GP.R1, GP.TR);
eq("a fifth past the ceiling clamps", T.doc.steps[0], "C6");
reset(); page({0:"C6"}); T.cursor = 0; T.setRelative(true);
hold(GP.DR); eq("nudge clamps too", T.doc.steps[0], "C6");
eq("the range is C2 to C6", [T.MIDI_LO, T.MIDI_HI], [36, 84]);
eq("nameOfMidi agrees at the floor", T.nameOfMidi(36), "C2");
eq("and at the ceiling", T.nameOfMidi(84), "C6");

console.log("\n== the crossbar, whole, in absolute entry ==");
const SLOTS = [14, 12, 15, 13, 2, 3, 1, 0];          /* ←↑→↓ then □△○✕ */
const NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
function expected(off){ const t = 4*12 + off; const o = Math.floor(t/12); return NAMES[t-o*12] + o; }
/* ---- re-pointed at Lesson 3 ----
   The crossbar is absolute entry's, whole and untouched: all twenty-four
   slots, exactly where they were. In contour entry the triggers are spent on
   the two edges of the note instead, because contour entry writes with the
   face buttons and does not need them; absolute entry is the method that has
   nothing else to write with. */
{
  let bad = 0;
  [[[GP.L2],0],[[GP.R2],8],[[GP.L2,GP.R2],16]].forEach(([trig, base])=>{
    for (let i = 0; i < 8; i++){
      reset(); T.setRelative(false);
      hold(...trig, SLOTS[i]);
      const want = expected(base + i);
      if (T.doc.steps[0] !== want){ bad++; console.log("      slot mismatch", trig, i, T.doc.steps[0], want); }
    }
  });
  ok("all 24 crossbar slots are absolute pitches", bad === 0, bad);
}
reset(); hold(GP.L2, GP.DL); eq("L2 slot 1 = C4", T.doc.steps[0], "C4");
eq("crossbar entry advances by two", T.cursor, 2);
hold(GP.L2, GP.DL);
eq("so the crossbar lays eighths too", T.doc.steps[2], "C4");
eq("and nothing between them", T.doc.steps[1], null);
reset(); hold(GP.R2, GP.X);  eq("R2 slot 8 = D#5", T.doc.steps[0], "D#5");
reset(); hold(GP.L2, GP.R2, GP.DL); eq("L2+R2 slot 1 = E5", T.doc.steps[0], "E5");
reset(); T.setRelative(true);
hold(GP.L2, GP.TR);
eq("in contour entry a trigger writes no pitch at all - it is a modifier",
   T.doc.steps[0], null);
reset(); T.setRelative(true);
hold(GP.L2, GP.B);
eq("nor on any other face button", T.doc.steps[0], null);
ok("the crossbar table is unchanged", /GP_SLOTS = \[14, 12, 15, 13, 2, 3, 1, 0\]/.test(html));

console.log("\n== the bumpers in each method ==");
reset();
press(GP.L1); eq("absolute: L1 lowers the octave", T.baseOctave, 3);
press(GP.R1); eq("absolute: R1 raises it", T.baseOctave, 4);
reset(); T.setRelative(true);
press(GP.L1); eq("relative: a bare tap of L1 still lowers the octave", T.baseOctave, 3);
press(GP.R1); eq("relative: a bare tap of R1 raises it", T.baseOctave, 4);
reset(); page({15:"C4"}); T.setRelative(true);
hold(GP.L1, GP.TR);
eq("a bumper used as a leap writes the leap", T.doc.steps[0], "E4");
eq("and does not shift the octave", T.baseOctave, 4);
reset(); page({15:"C4"}); T.setRelative(true);
hold(GP.L1, GP.R1, GP.TR);
eq("neither bumper shifts when both are the escape hatch", T.baseOctave, 4);
reset(); page({15:"C4"}); T.setRelative(true);
hold(GP.L1, GP.B);
eq("○ ignores the bumpers", T.doc.steps[0], "C4");
eq("so L1 is still the octave", T.baseOctave, 3);

console.log("\n== the bare face buttons in absolute entry are unchanged ==");
reset();
page({3:"C4"}); T.cursor = 3;
press(GP.SQ); eq("bare square clears the step", T.doc.steps[3], null);
eq("clear advanced by two", T.cursor, 5);
press(GP.B); eq("bare circle goes home", T.cursor, 0);
reset();
press(GP.X); press(GP.TR);
eq("bare cross and triangle write nothing", T.doc.steps.filter(Boolean).length, 0);
eq("and do not move the cursor", T.cursor, 0);

console.log("\n== the rest of the pad ==");
reset();
press(GP.L3); eq("L3 cycles the loop length", T.doc.loop, 8);
press(GP.DU); eq("d-pad up moves the cursor", T.cursor, 15);
press(GP.DD); eq("d-pad down moves the cursor", T.cursor, 0);
stick([0, 1]); eq("left stick down moves the cursor", T.cursor, 1);
stick([0, 0, 0, 1]); eq("the right stick strides by fours", T.cursor, 5);
reset(); T.setRelative(true);
press(GP.DU); eq("relative: d-pad up still moves the cursor", T.cursor, 15);
press(GP.DD); eq("relative: d-pad down still moves the cursor", T.cursor, 0);
stick([0, 0, 0, 1]); eq("relative: the right stick still strides", T.cursor, 4);
press(GP.L3); eq("relative: L3 is still the loop", T.doc.loop, 8);
press(GP.R3); eq("relative: R3 is still the roll", T.viz, "roll");
press(GP.R3);
reset();
press(GP.START); ok("start raises the settings crossbar", ids.settings.classList.contains("on"));
press(GP.START); ok("and start puts it down again", !ids.settings.classList.contains("on"));

console.log("\n== the settings crossbar ==");
reset();
press(GP.START);
ok("the pattern stands down while it is up", ids.column.style.display === "none" &&
   !ids.roll.classList.contains("on"), ids.column.style.display);
eq("its eight slots are labelled", T.xslots.length, 8);
eq("← is the voice", T.xslots[0].label.textContent, "the voice");
eq("which names the one in hand", T.xslots[0].value.textContent, "lead");
eq("↑ is the workspace", T.xslots[1].label.textContent, "the workspace");
eq("which names where you are", T.xslots[1].value.textContent, "free play");
ok("and the workspace is what the mode is headed by",
   /head/.test(T.xslots[1].el.className), T.xslots[1].el.className);
eq("→ is the voice as well", T.xslots[2].label.textContent, "the voice");
eq("↓ is the workspace as well", T.xslots[3].label.textContent, "the workspace");
ok("and marked the same", /head/.test(T.xslots[3].el.className), T.xslots[3].el.className);
eq("□ is solo", T.xslots[4].label.textContent, "solo");
eq("△ is mute", T.xslots[5].label.textContent, "mute");
eq("○ is close", T.xslots[6].label.textContent, "close");
eq("✕ is the entry method", T.xslots[7].label.textContent, "entry method");
eq("which shows where it stands", T.xslots[7].value.textContent, "absolute");
/* the two items that used to be here are gone from it entirely */
ok("no slot of it is the quest log",
   T.SETTINGS.every(s => !/quest/i.test(s.label)), T.SETTINGS.map(s => s.label));
ok("and none is the key page",
   T.SETTINGS.every(s => !/^the key$/.test(s.label)), T.SETTINGS.map(s => s.label));
ok("so none of them opens a page at all",
   (function(){
     for (let i = 0; i < 8; i++){
       if (i === 6) continue;                    /* ○ is the way out, not a page */
       T.runSetting(i);
       if (ids.quests.classList.contains("on") || ids.keyref.classList.contains("on")) return false;
     }
     return true;
   })());
press(GP.B);
reset();

console.log("\n== start walks the left margin, and walking is arriving ==");
closePages(); T.resetDrills(); T.resetQuests(); reset();
press(GP.START);
eq("free play is the line it starts on", T.qActive, null);
eq("and the slot says so", T.xslots[1].value.textContent, "free play");
ok("the rail washes that line for the pad", /nav/.test(T.rrows[0].el.className),
   T.rrows[0].el.className);
press(GP.DD);
eq("d-pad down lands in the first workspace", T.qActive, T.QUESTS[0].id);
ok("with no page opened to do it",
   !ids.quests.classList.contains("on") && !ids.keyref.classList.contains("on"));
ok("and the crossbar still up", ids.settings.classList.contains("on"));
eq("the slot names where you are now", T.xslots[1].value.textContent, T.QUESTS[0].short);
eq("the quest log's own selection followed", T.qsel, 0);
ok("the rail wash moved with it", /nav/.test(T.rrows[1].el.className) &&
   !/nav/.test(T.rrows[0].el.className), T.rrows.map(r => r.el.className));
eq("exactly one line is washed", T.rrows.filter(r => /nav/.test(r.el.className)).length, 1);
ok("and the washed line is the one you are in",
   /act/.test(T.rrows[1].el.className), T.rrows[1].el.className);
press(GP.DD);
eq("down again, the second", T.qActive, T.QUESTS[1].id);
press(GP.DU); press(GP.DU);
eq("up walks back through free play", T.qActive, null);
press(GP.DU);
eq("and wraps round to the last workspace", T.qActive, T.QUESTS[T.QUESTS.length - 1].id);
press(GP.DD);
eq("and round again to free play", T.qActive, null);
holdLong(GP.DD);
eq("holding walks the list", T.qActive, T.QUESTS[1].id);
/* the left stick agrees with the d-pad, as it does on every other list */
stick([0, 1]);
eq("the left stick walks it too", T.qActive, T.QUESTS[2].id);
press(GP.START);
ok("start puts the mode down", !ids.settings.classList.contains("on"));
eq("and the wash goes with it", T.rrows.filter(r => /nav/.test(r.el.className)).length, 0);
ok("but the workspace it left you in is where you are",
   T.qActive === T.QUESTS[2].id, T.qActive);
closePages(); T.resetQuests(); reset();

console.log("\n== the voice is a ring, walked by ← and → ==");
press(GP.START);
press(GP.DR);
eq("→ changes hands", T.voice, 1);
ok("and stays up", ids.settings.classList.contains("on"));
eq("the slot names the voice now in hand", T.xslots[0].value.textContent, "bass");
press(GP.DR);
eq("→ again comes round to the lead", T.voice, 0);
press(GP.DL);
eq("← walks the ring the other way", T.voice, 1);
press(GP.DL);
eq("and back", T.voice, 0);
eq("the ring is the order the voices are named in", T.VOICE_NAMES, ["lead","bass"]);
press(GP.DR);
press(GP.SQ);
ok("□ solos it", T.flag("solo", 1));
eq("and the slot says so", T.xslots[4].value.textContent, "on");
press(GP.SQ);
press(GP.TR);
ok("△ mutes it", T.flag("mute", 1));
press(GP.TR);
press(GP.DL);                            /* back to the lead */
eq("and ← brings the hands back", T.voice, 0);
/* the transport reaches through it, as it reaches through every page */
press(GP.SEL);
ok("select still transports from inside the crossbar",
   /playing|stopped/.test(ids.footer.textContent), ids.footer.textContent);
press(GP.SEL);
/* a trigger raises no pitches here: the slots are items */
hold(GP.L2, GP.SQ);
eq("a trigger writes no note while the crossbar is up", T.doc.steps.filter(Boolean).length, 0);
ok("and the crossbar is still up", ids.settings.classList.contains("on"));
key("Escape");
ok("escape closes it", !ids.settings.classList.contains("on"));
eq("and the column came back", ids.column.style.display, "flex");
press(GP.START); key("KeyZ");
eq("note keys are inert while it is up", T.doc.steps.filter(Boolean).length, 0);
key("F1");
ok("F1 reaches the key page from inside it", ids.keyref.classList.contains("on"));
ok("and the crossbar stood down", !ids.settings.classList.contains("on"));
key("F1");
press(GP.START); key("F3");
ok("F3 reaches the quest log from inside it", ids.quests.classList.contains("on"));
ok("and the crossbar stood down there too", !ids.settings.classList.contains("on"));
key("F3");
reset();

/* ================= the second voice (Lesson 2) ================= */
console.log("\n== two voices: the model ==");
reset();
eq("there are two of them", T.VOICES, 2);
eq("named lead and bass", T.VOICE_NAMES, ["lead","bass"]);
eq("the lead is the hand a page opens in", T.voice, 0);
eq("the lead is still the old `steps` field", T.doc.steps.length, 16);
eq("and the bass is beside it", T.doc.bass.length, 16);
eq("neither is muted", T.doc.mute, [false,false]);
eq("neither is soloed", T.doc.solo, [false,false]);
/* the two timbres are genuinely different, and the bass is the darker */
ok("the lead keeps the triangle it always had", T.TONE[0].type === "triangle", T.TONE[0]);
ok("the bass is a rounder wave", T.TONE[1].type !== T.TONE[0].type, T.TONE[1]);
ok("under a much lower cutoff", T.TONE[1].cut < T.TONE[0].cut / 2, [T.TONE[0].cut, T.TONE[1].cut]);
ok("with a slower attack and a longer release",
   T.TONE[1].attack > T.TONE[0].attack && T.TONE[1].release > T.TONE[0].release, T.TONE[1]);

console.log("\n== a page from before the second voice ==");
const legacy = { version:1, title:"before", tempo:104, loop:8, key:"E minor",
                 steps: steps({0:"E4", 4:"G4", 8:"B4"}) };
const lv = T.validate(legacy);
ok("it still validates", !!lv);
eq("its lead is untouched", lv.steps, legacy.steps);
eq("its tempo, loop and key are untouched", [lv.tempo, lv.loop, lv.key], [104, 8, "E minor"]);
eq("it gains a silent bass", lv.bass, blank());
eq("and neither flag set", [lv.mute, lv.solo], [[false,false],[false,false]]);
ok("a bass that cannot be read is silence, not a rejected file",
   JSON.stringify(T.validate(Object.assign({}, legacy, { bass:"nonsense" })).bass) ===
   JSON.stringify(blank()));
ok("and the lead survives that intact",
   JSON.stringify(T.validate(Object.assign({}, legacy, { bass:["zz"] })).steps) ===
   JSON.stringify(legacy.steps));
ok("a broken lead is still a rejected file",
   T.validate({ version:1, steps:new Array(16).fill("zz"), bass: blank() }) === null);
const withBass = Object.assign({}, legacy, { bass: steps({0:"E2", 8:"B2"}) });
eq("a page that has one keeps it", T.validate(withBass).bass[0], "E2");
eq("marks in the bass are dropped as they are in the lead",
   T.validate(Object.assign({}, legacy, { bass: steps({0:"x", 1:"C2"}) })).bass.slice(0,2),
   [null, "C2"]);
/* it opens, and it plays, exactly as it did */
reset();
T.importText(JSON.stringify(legacy), "before");
eq("opened, its lead is on the page", T.doc.steps.slice(0,1), ["E4"]);
eq("with nothing in the bass", T.doc.bass, blank());
T.audioInit(); T.setPlaying(true);
sounded.length = 0; nowT = 0; T.schedFrom(0);
T.scheduler();
eq("and one voice is what sounds", sounded.length, 1);
T.setPlaying(false);

console.log("\n== the hands change voice ==");
reset();
key("KeyZ");
eq("a note goes into the lead", T.doc.steps[0], "C4");
eq("and not into the bass", T.doc.bass[0], null);
key("Tab");
eq("tab changes hands", T.voice, 1);
eq("and leaves the cursor where it was", T.cursor, 2);
key("KeyZ");
eq("now the note goes into the bass", T.doc.bass[2], "C4");
eq("and the lead is untouched", T.doc.steps[2], null);
key("Tab");
eq("tab comes back", T.voice, 0);
eq("the two voices are round, not a stack", T.VOICES, 2);
/* clearing, the cursor, and nudge all follow the hand */
reset();
duet({0:"C4"}, {0:"C2"});
T.cursor = 0; key("Tab"); key("Period");
eq("clear takes the bass note", T.doc.bass[0], null);
eq("and leaves the lead's", T.doc.steps[0], "C4");
reset();
duet({0:"E4"}, {0:"E2"}); T.cursor = 0; key("Tab"); T.setRelative(true);
hold(GP.DR);
eq("nudge moves the bass note", T.doc.bass[0], "F2");
eq("and not the lead's", T.doc.steps[0], "E4");
/* the anchor relative entry counts from is the hand's own line */
reset();
duet({15:"C5"}, {15:"C3"}); T.setRelative(true); key("Tab");
hold(GP.TR);
eq("a step up is counted from the bass's own anchor", T.doc.bass[0], "D3");
/* the pages hold tab still, as they hold note entry */
reset();
key("F3"); key("Tab");
eq("tab is inert in the quest log", T.voice, 0);
key("F3");
key("F1"); key("Tab");
eq("and on the key page", T.voice, 0);
key("F1");
press(GP.START); key("Tab");
eq("and inside the settings crossbar", T.voice, 0);
key("Escape");
/* the pad: bare △ in absolute entry, a move in relative */
reset();
press(GP.TR);
eq("bare △ changes hands in absolute entry", T.voice, 1);
eq("and writes nothing", T.doc.bass.filter(Boolean).length, 0);
press(GP.TR);
eq("and back", T.voice, 0);
reset(); page({15:"C4"}); T.setRelative(true);
hold(GP.TR);
eq("in relative entry △ is still a move", T.doc.steps[0], "D4");
eq("and did not change hands", T.voice, 0);

console.log("\n== solo and mute ==");
reset();
duet({0:"C4"}, {0:"C2"});
ok("both voices are audible at rest", T.audible(0) && T.audible(1));
key("KeyP");
ok("P mutes the voice in hand", !T.audible(0));
ok("and leaves the other alone", T.audible(1));
ok("the strip says so", /muted/.test(ids.vmark0.textContent), ids.vmark0.textContent);
ok("and so does the header", /lead \(muted\)/.test(ids.metatext.textContent), ids.metatext.textContent);
key("KeyP");
ok("P again gives it back", T.audible(0));
key("Tab"); key("KeyO");
ok("O solos the voice in hand", T.audible(1));
ok("and takes the other away", !T.audible(0));
ok("the strip marks the solo", /solo/.test(ids.vmark1.textContent), ids.vmark1.textContent);
key("KeyO");
ok("O again brings both back", T.audible(0) && T.audible(1));
/* solo beats mute, as it does on every desk */
reset(); duet({0:"C4"}, {0:"C2"});
key("KeyP");                                  /* the lead muted */
key("Tab"); key("KeyO");                      /* the bass soloed */
ok("a soloed voice is heard even so", T.audible(1));
key("Tab"); key("KeyO");
ok("and a muted voice soloed is heard too", T.audible(0), [T.doc.mute, T.doc.solo]);
/* what the scheduler actually does with all that */
function heard(){
  T.audioInit(); T.setPlaying(true);
  sounded.length = 0; nowT = 0; T.schedFrom(0);
  T.scheduler();
  T.setPlaying(false);
  return sounded.map(s => Math.round(s.freq)).sort((a,b) => a - b);
}
reset(); duet({0:"C4"}, {0:"C2"});
eq("both voices sound together", heard(), [65, 262]);
key("KeyP");
eq("a muted lead leaves the bass alone", heard(), [65]);
key("KeyP"); key("Tab"); key("KeyP");
eq("a muted bass leaves the lead alone", heard(), [262]);
key("KeyP"); key("KeyO");
eq("a soloed bass is the only thing left", heard(), [65]);
key("KeyO");
eq("and letting go brings both back", heard(), [65, 262]);
/* the two lines are in step, from the one clock */
reset(); duet({0:"C4", 1:"E4"}, {0:"C2", 1:"C2"});
T.audioInit(); T.setPlaying(true);
sounded.length = 0; nowT = 0; T.schedFrom(0);
T.scheduler(); nowT = 0.14; T.scheduler();
ok("each step sounds both voices at the same instant",
   sounded.length >= 4 && sounded[0].at === sounded[1].at &&
   sounded[2].at === sounded[3].at, sounded);
ok("and the second step is a step later",
   sounded[2].at > sounded[0].at, sounded.map(s => s.at));
T.setPlaying(false);

console.log("\n== the two voices on the page ==");
reset();
duet({0:"C4"}, {0:"C2"});
eq("the lead is written in its own column", T.rows[0].note.textContent, "C-4");
eq("and the bass beside it", T.rows[0].note2.textContent, "C-2");
eq("the hand's voice is in ink", T.rows[0].note.className, "note");
eq("the other a shade back", T.rows[0].note2.className, "note dim");
key("Tab");
eq("changing hands changes which is which", T.rows[0].note.className, "note dim");
eq("and the other comes forward", T.rows[0].note2.className, "note");
ok("the strip marks the hand", ids.vname1.classList.contains("on"));
ok("and unmarks the other", !ids.vname0.classList.contains("on"));
key("Tab");
/* the roll draws both, in the one field */
reset();
duet({0:"C4"}, {0:"C2"});
eq("a bar is drawn for the lead", T.bars[0].style.display, "block");
eq("and one for the bass", T.bars2[0].style.display, "block");
ok("the bass's is the lower of the two",
   parseFloat(T.bars2[0].style.top) > parseFloat(T.bars[0].style.top),
   [T.bars[0].style.top, T.bars2[0].style.top]);
ok("the voice not in hand is drawn a shade back",
   /back/.test(T.bars2[0].className) && !/back/.test(T.bars[0].className),
   [T.bars[0].className, T.bars2[0].className]);
key("Tab");
ok("and that follows the hand",
   /back/.test(T.bars[0].className) && !/back/.test(T.bars2[0].className));
key("Tab");
/* a bass well below the lead must still be inside the drawing */
reset();
duet({0:"C5"}, {0:"C2"});
ok("the window opens wide enough to hold both",
   parseFloat(T.bars2[0].style.top) <= 100 && parseFloat(T.bars2[0].style.top) >= 0,
   T.bars2[0].style.top);
ok("and neither bar falls off it",
   parseFloat(T.bars[0].style.top) >= 0 && parseFloat(T.bars[0].style.top) <= 100);
/* the header names the hand */
reset();
ok("the header names the voice in hand", / · lead$/.test(ids.metatext.textContent),
   ids.metatext.textContent);
key("Tab");
ok("and follows it", / · bass$/.test(ids.metatext.textContent), ids.metatext.textContent);
key("Tab");

console.log("\n== the second voice is saved and read back ==");
reset();
duet({0:"C4", 4:"E4"}, {0:"C2", 8:"G2"});
key("Tab"); key("KeyP"); key("Tab");
const both = JSON.parse(T.exportJSON());
eq("the file carries the lead", both.steps[0], "C4");
eq("and the bass", both.bass[8], "G2");
eq("and the flags", both.mute, [false, true]);
eq("the file's fields are the version-1 six and the three new ones",
   Object.keys(both).sort(),
   ["bass","key","loop","mute","solo","steps","tempo","title","version"]);
eq("and it is still version 1", both.version, 1);
T.setDoc(T.validate(both));
eq("read back, the bass is where it was", T.doc.bass[8], "G2");
eq("and the mute with it", T.doc.mute[1], true);
/* the autosave, and the workspace it lives in */
qreset();
duet({0:"C4"}, {0:"C2"});
T.save();
eq("the autosave carries the bass", JSON.parse(store["folio.v1"]).bass[0], "C2");
const st = T.stateToJSON();
eq("and so does the whole state", st.free.bass[0], "C2");
qreset();
T.applyState({ folio:"quest-log", version:2, active:null,
  quests:{ summit:{ done:false, pattern:{ version:1, title:"t", tempo:112, loop:16,
    key:"C major", steps: steps({0:"C4"}) } } } });
ok("a quest workspace written before the second voice still loads",
   !!T.wsDoc.summit, T.wsDoc.summit);
eq("with a silent bass under it", T.wsDoc.summit.bass, blank());
ok("and the log still says it has something written", T.questHasContent("summit"));
qreset();
T.applyState({ folio:"quest-log", version:2, active:null,
  quests:{ summit:{ done:false, pattern:{ version:1, title:"t", tempo:112, loop:16,
    key:"C major", steps: blank(), bass: steps({0:"C2"}) } } } });
ok("a workspace with only a bass line counts as written in",
   T.questHasContent("summit"));

console.log("\n== the key page documents the second voice ==");
const twoPage = html.slice(html.indexOf('id="keyref"'), html.indexOf('id="settings"'));
ok("it names both voices", /a lead and a bass/.test(twoPage));
ok("tab is documented", /<dt>tab<\/dt>/.test(twoPage));
ok("so are solo and mute", /O solos/.test(twoPage) && /P mutes/.test(twoPage));
ok("it says the bass is the darker", /rounder and darker/.test(twoPage));
ok("it promises the old pages still open",
   /written before there were two voices/.test(twoPage));
ok("the crossbar lists the voice, solo and mute",
   /the voice/.test(twoPage) && /solo/.test(twoPage) && /mute/.test(twoPage));
ok("bare △ is documented as the other voice", /the other voice/.test(twoPage));
reset();

console.log("\n== the scheduler still only sounds real notes ==");
reset();
page({0:"C4", 1:"E4"});
T.audioInit(); T.setPlaying(true);
sounded.length = 0; nowT = 0; T.schedFrom(0);
T.scheduler(); nowT = 0.14; T.scheduler();
ok("C4 sounds at 261.63", sounded.length >= 1 && Math.abs(sounded[0].freq - 261.6255653005986) < 1e-6, sounded);
ok("E4 sounds at 329.63", sounded.length >= 2 && Math.abs(sounded[1].freq - 329.6275569128699) < 1e-6, sounded);
T.setPlaying(false);

console.log("\n== the save format, still ==");
reset();
const v1x = { version:1, title:"marked folio", tempo:112,
  steps:["C4","x",null,"x","E4",null,null,null,null,null,null,null,null,null,null,null] };
const gotV1x = T.validate(v1x);
ok("v1 with marks still accepted", !!gotV1x);
eq("marks become null", gotV1x.steps.slice(0,5), ["C4",null,null,null,"E4"]);
ok("junk rejected", T.validate({version:1,title:"x",tempo:112,steps:new Array(16).fill("zz")}) === null);
ok("wrong length rejected", T.validate({version:1,steps:[null]}) === null);
ok("non-object rejected", T.validate("nope") === null);
T.importText(JSON.stringify(v1x), "marked folio");
eq("import drops the marks", T.doc.steps.slice(0,5), ["C4",null,null,null,"E4"]);
ok("footer mentions the drop", /marks from an older file were dropped/.test(ids.footer.textContent),
   ids.footer.textContent);
reset();
const clean = { version:1, title:"clean", tempo:120, loop:8, key:"D minor",
  steps: steps({0:"C4", 2:"E4", 4:"G4"}) };
T.importText(JSON.stringify(clean), "clean");
eq("clean import round-trips", T.doc.steps, clean.steps);
eq("clean import keeps loop", T.doc.loop, 8);
eq("clean import keeps the key", T.doc.key, "D minor");
ok("no drop message on a clean file", !/dropped/.test(ids.footer.textContent), ids.footer.textContent);
eq("export round-trip identical", JSON.parse(T.exportJSON()).steps, clean.steps);
ok("autosave under folio.v1", typeof store["folio.v1"] === "string", Object.keys(store));

/* ================= 4. quests as workspaces ================= */
function closePages(){
  if (ids.quests.classList.contains("on")) T.toggleQuests();
  if (ids.keyref.classList.contains("on")) T.toggleKeyref();
}
function qreset(){
  closePages(); reset(); useColumn(); T.resetDrills(); T.resetQuests();
  delete store[T.QUEST_KEY]; delete store[T.QUEST_KEY_V1];
  T.syncOn = false; T.syncState = "idle";
}
const Q = T.QUESTS;

console.log("\n== quest data ==");
qreset();
eq("eight lesson-1 quests", Q.length, 8);
eq("ids are unique", new Set(Q.map(q=>q.id)).size, 8);
ok("every quest keeps the sword flavour", Q.every(q=>q.name.indexOf("⚔") === 0), Q.map(q=>q.name));
eq("eight rows rendered", T.qrows.length, 8);
ok("every quest carries its full constraint", Q.every(q=>typeof q.text === "string" && q.text.length > 70),
   Q.map(q=>q.text && q.text.length));
ok("and the line that says what it teaches",
   Q.every(q=>typeof q.teaches === "string" && q.teaches.length > 20), Q.map(q=>q.teaches));
/* the real descriptions, not a compression of them: a phrase from each
   quest in QUESTS.md must appear verbatim in the app */
const questsMd = fs.readFileSync(REPO + "/QUESTS.md", "utf8").replace(/\s+/g," ");
const PHRASES = {
  ladder:      ["Coverage disguised as melody", "using the whole tonal space"],
  whitespace:  ["not parked in one hole", "the pause as a placed note"],
  summit:      ["not on step 1", "a melody is a shape with one peak"],
  stones:      ["Exactly three distinct pitches", "what rhythm alone can carry"],
  ouroboros:   ["must feel like an interruption", "the cycle test, three lessons early"],
  callanswer:  ["end unresolved", "the sentence structure you already stumbled into"],
  stray:       ["approached and left so smoothly", "chromaticism as seasoning"],
  hand:        ["change exactly four steps", "about four decisions"]
};
for (const q of Q){
  const both = (q.text + " " + q.teaches).replace(/[’‘]/g, "'").replace(/\s+/g," ");
  const md = questsMd.replace(/[’‘]/g, "'");
  for (const p of PHRASES[q.id]){
    ok("“" + p + "” is in the app and in QUESTS.md",
       both.indexOf(p) >= 0 && md.indexOf(p) >= 0, both);
  }
}

console.log("\n== the quest page ==");
qreset();
ok("closed at rest", !ids.quests.classList.contains("on"));
key("F3"); ok("F3 opens it", ids.quests.classList.contains("on"));
eq("the column stands down", ids.column.style.display, "none");
ok("footer offers the way out", /F3 to close/.test(ids.footer.textContent), ids.footer.textContent);
key("F3"); ok("F3 closes it", !ids.quests.classList.contains("on"));
eq("the column comes back", ids.column.style.display, "flex");
key("F3"); key("Escape"); ok("escape closes it", !ids.quests.classList.contains("on"));
key("F3"); press(GP.R3); ok("R3 closes it too", !ids.quests.classList.contains("on"));
eq("and R3 did not flip the view instead", T.viz, "column");
qreset();
key("F1"); key("F3");
ok("opening the quest log closes the key", !ids.keyref.classList.contains("on"));
key("F1");
ok("opening the key closes the quest log", !ids.quests.classList.contains("on"));
key("F1");
eq("closing the last page restores the column", ids.column.style.display, "flex");

console.log("\n== selection, and nothing else reaching the pattern ==");
qreset(); key("F3");
eq("starts at the first quest", T.qsel, 0);
key("ArrowDown"); eq("down moves one", T.qsel, 1);
key("ArrowUp"); key("ArrowUp"); eq("up wraps to the last", T.qsel, 7);
key("ArrowDown"); eq("down wraps to the first", T.qsel, 0);
eq("the caret marks the selection", T.qrows[0].caret.textContent, "‸");
/* left and right are the lessons now, not a second way to walk the list:
   with only the eight built-ins there is one tab, so they are a no-op that
   leaves the caret exactly where it was */
key("ArrowRight"); eq("right is the lesson, not the selection", T.qsel, 0);
key("ArrowLeft");  eq("and so is left", T.qsel, 0);
eq("with one lesson on the board there is one tab", T.tabList().length, 1);
press(GP.DD); eq("d-pad down moves the selection", T.qsel, 1);
press(GP.DU); eq("d-pad up moves the selection", T.qsel, 0);
key("KeyZ"); key("KeyQ");
eq("note keys are swallowed", T.doc.steps.filter(Boolean).length, 0);
key("KeyB"); key("KeyL"); key("KeyV"); key("KeyM");
eq("the retired bind and load keys write nothing either", T.doc.steps.filter(Boolean).length, 0);
eq("and they leave the selection alone", T.qsel, 0);
frame([GP.L2, GP.DL]); frame([]);
eq("the crossbar writes nothing on the quest page", T.doc.steps.filter(Boolean).length, 0);
press(GP.SQ); press(GP.TR);
eq("square and triangle bind and load nothing — there is nothing to bind",
   T.doc.steps.filter(Boolean).length, 0);
eq("the pattern cursor never moved", T.cursor, 0);
closePages();

console.log("\n== choosing a quest switches workspace ==");
qreset(); key("F3");
eq("free play is where a fresh folio starts", T.qActive, null);
eq("and the free-play line is marked", ids.qfreesigil.textContent, "⚔");
key("ArrowDown"); key("ArrowDown"); key("Enter");
eq("enter switches to that quest's workspace", T.qActive, Q[2].id);
eq("the sigil marks it", T.qrows[2].sigil.textContent, "⚔");
eq("and the free-play line is not", ids.qfreesigil.textContent, "");
ok("the footer says where you are", /the summit/.test(ids.footer.textContent), ids.footer.textContent);
key("F3");
ok("the meta line shows it quietly", /⚔ the summit$/.test(ids.metatext.textContent), ids.metatext.textContent);
ok("in the ordinary meta shape",
   /^untitled folio · 112 · octave 4 · D major · lead · ⚔ the summit$/.test(ids.metatext.textContent),
   ids.metatext.textContent);
eq("stored as the id", JSON.parse(store[T.QUEST_KEY]).active, Q[2].id);
eq("and the storage key is version 2", JSON.parse(store[T.QUEST_KEY]).version, 2);
T.resetQuests(); T.loadQuests(); T.renderQuests();
eq("restored from storage", T.qActive, Q[2].id);
closePages();

console.log("\n== the round trip: two workspaces, both intact ==");
qreset();
key("KeyZ"); key("KeyX");                       /* free play: C4 on 1, D4 on 3 */
/* entry lays eighths, so a pair of notes is steps 1 and 3, not 1 and 2 */
const two = () => [T.doc.steps[0], T.doc.steps[2]];
eq("free play holds what was written", two(), ["C4","D4"]);
key("F3"); key("Enter"); key("F3");             /* into quest A */
eq("the quest's page starts empty", T.doc.steps.filter(Boolean).length, 0);
eq("and it is the active workspace", T.qActive, Q[0].id);
key("KeyV"); key("KeyG"); key("KeyL");          /* A: F4 F#4, loop 8 */
key("F1"); key("ArrowUp"); key("F1");           /* A: G major seeded -> G minor */
eq("A holds its own notes", two(), ["F4","F#4"]);
eq("its own loop", T.doc.loop, 8);
eq("and its own key", T.doc.key, "G minor");
key("F3"); key("ArrowDown"); key("Enter"); key("F3");   /* into quest B */
eq("B starts empty", T.doc.steps.filter(Boolean).length, 0);
eq("B is not carrying A's loop", T.doc.loop, 16);
eq("nor A's key — it has its own seed", T.doc.key, "A minor");
key("KeyB");                                    /* B: G4 */
key("F3"); key("ArrowUp"); key("Enter"); key("F3");     /* back to A */
eq("A survives the round trip", two(), ["F4","F#4"]);
eq("with its loop", T.doc.loop, 8);
eq("and its key", T.doc.key, "G minor");
key("F3"); key("Enter"); key("F3");             /* A again: back to free play */
eq("choosing the active quest again returns to free play", T.qActive, null);
eq("and free play is exactly as it was left", two(), ["C4","D4"]);
eq("with its own loop", T.doc.loop, 16);
key("F3"); key("ArrowDown"); key("Enter"); key("F3");   /* into B */
eq("the other quest is intact too", T.doc.steps[0], "G4");
eq("switching lands the cursor at the top", T.cursor, 0);
/* the pad reaches all of it */
key("F3"); press(GP.X);
eq("cross returns to free play from the quest you are in", T.qActive, null);
press(GP.X); eq("and cross again goes back into it", T.qActive, Q[1].id);
closePages();

console.log("\n== nothing is ever copied between workspaces ==");
qreset();
key("KeyZ");                                    /* free play: C4 */
key("F3"); key("Enter"); key("F3");             /* quest A, empty */
eq("entering a quest does not bring the page with it", T.doc.steps[0], null);
key("KeyX");                                    /* A: D4 */
key("F3"); key("Enter"); key("F3");             /* back to free play */
eq("and leaving does not take it away", T.doc.steps[0], "C4");
eq("A kept its own", T.questPage(Q[0].id).steps[0], "D4");
eq("free play is a workspace of its own", T.wsFree.steps[0], "C4");
eq("and the quest's page is stored under its id", T.wsDoc[Q[0].id].steps[0], "D4");

console.log("\n== done, and the glyphs ==");
qreset(); key("F3");
eq("an untouched quest shows nothing", T.qrows[0].stat.textContent, "");
key("KeyC"); ok("C marks complete", T.qState[Q[0].id].done);
eq("the gilt fleuron shows", T.qrows[0].stat.textContent, "❧");
key("KeyC"); ok("C again sets it aside", !T.qState[Q[0].id].done);
press(GP.B); ok("circle marks complete on the pad", T.qState[Q[0].id].done);
eq("done survives a reload", (function(){ T.resetQuests(); T.loadQuests(); T.renderQuests();
   return T.qState[Q[0].id].done; })(), true);
qreset(); key("F3"); key("Enter"); key("F3");
key("KeyZ");
key("F3");
eq("a quest you are in shows the sword", T.questGlyph(Q[0].id), "⚔");
key("Enter");                                    /* back to free play */
eq("and a quest with something written shows the dot", T.questGlyph(Q[0].id), "•");
eq("the row agrees", T.qrows[0].stat.textContent, "•");
key("KeyC");
eq("complete outranks both", T.questGlyph(Q[0].id), "❧");
closePages();

console.log("\n== the selected quest, read in full ==");
qreset(); key("F3");
eq("the detail names the quest", ids.qdname.textContent, "The Ladder");
ok("and prints no sword beside it — the sword means where you are",
   ids.qdname.textContent.indexOf("⚔") < 0, ids.qdname.textContent);
eq("the constraint is shown whole", ids.qdtext.textContent, Q[0].text);
eq("with the teaches line", ids.qdteach.textContent, "Teaches: " + Q[0].teaches);
ok("it is the real description", /Coverage disguised as melody/.test(ids.qdtext.textContent),
   ids.qdtext.textContent);
ok("an untouched quest says so", /nothing written yet/.test(ids.qdstate.textContent),
   ids.qdstate.textContent);
key("ArrowDown");
eq("the detail follows the selection", ids.qdname.textContent, "White Space");
eq("and so does the constraint", ids.qdtext.textContent, Q[1].text);
key("Enter");
ok("the detail says where you are", /you are working here/.test(ids.qdstate.textContent),
   ids.qdstate.textContent);
key("KeyC");
ok("and that it is complete", /❧ complete/.test(ids.qdstate.textContent), ids.qdstate.textContent);
closePages();

console.log("\n== the contour preview ==");
qreset();
eq("sixteen dabs, one per step", T.qdabs.length, 16);
key("F3"); key("Enter"); key("F3");             /* into quest A */
key("KeyZ"); key("Period"); key("KeyN");        /* C4 on 1, a rest on 3, A4 on 5 */
key("F3");
eq("a written step draws a dab", T.qdabs[0].style.display, "block");
eq("an empty step draws none", T.qdabs[1].style.display, "none");
eq("the cleared step draws none either", T.qdabs[2].style.display, "none");
eq("and the note after it is drawn", T.qdabs[4].style.display, "block");
ok("dabs are coloured by pitch class", /^hsl\(/.test(T.qdabs[0].style.backgroundColor),
   T.qdabs[0].style.backgroundColor);
ok("pitch is height", T.qdabs[0].style.top !== T.qdabs[4].style.top,
   [T.qdabs[0].style.top, T.qdabs[4].style.top]);
ok("time runs right", parseFloat(T.qdabs[4].style.left) > parseFloat(T.qdabs[0].style.left));
key("ArrowDown");
eq("an untouched workspace draws nothing", T.qdabs[0].style.display, "none");
key("ArrowUp");
eq("and coming back draws it again", T.qdabs[0].style.display, "block");
ok("the preview has no rules, beats or numbers of its own",
   !/qdline|qbeat|qoctline/.test(html));
ok("the preview element is in the markup", /id="qpreview"/.test(html));
closePages();

console.log("\n== the side rails ==");
ok("both rails are in the markup",
   /class="rail left"/.test(html) && /class="rail right"/.test(html));
eq("nine lines on the left: free play and eight quests", T.rrows.length, 9);
qreset();
eq("free play is marked when you are in it", T.rrows[0].glyph.textContent, "⚔");
ok("free play is the highlighted line", T.rrows[0].el.classList.contains("act"));
eq("the right rail names it", ids.railtitle.textContent, "Free play");
ok("and says what free play is", /No constraint/.test(ids.railtext.textContent),
   ids.railtext.textContent);
key("F3"); key("ArrowDown"); key("ArrowDown"); key("Enter"); key("F3");
eq("the left rail follows the active workspace", T.rrows[3].glyph.textContent, "⚔");
ok("and highlights it", T.rrows[3].el.classList.contains("act"));
eq("free play is no longer marked", T.rrows[0].glyph.textContent, "");
ok("free play is no longer highlighted", !T.rrows[0].el.classList.contains("act"));
eq("the right rail names the quest", ids.railtitle.textContent, "The Summit");
eq("and carries its constraint, in full", ids.railtext.textContent, Q[2].text);
eq("and what it teaches", ids.railteach.textContent, "Teaches: " + Q[2].teaches);
ok("and its done state", /not yet complete/.test(ids.railstate.textContent),
   ids.railstate.textContent);
key("KeyZ");                                     /* write in the quest workspace */
key("F3"); key("KeyC"); key("F3");
ok("done shows in the right rail", /❧ complete/.test(ids.railstate.textContent));
eq("and in the left one", T.rrows[3].glyph.textContent, "❧");
key("F3"); key("Enter"); key("F3");              /* back to free play */
eq("a quest left with something written keeps the dot", T.rrows[3].glyph.textContent, "❧");
key("F3"); key("KeyC"); key("F3");
eq("set aside, the dot is what is left", T.rrows[3].glyph.textContent, "•");
eq("the left rail names the quests by their short names", T.rrows[1].name.textContent, Q[0].short);
ok("and the list rows carry no sword of their own",
   T.qrows.every((r,i)=>true) && !/⚔/.test(ids.qlist.children[0].children[2].textContent),
   ids.qlist.children[0].children[2].textContent);
eq("and free play by name", T.rrows[0].name.textContent, "free play");
ok("the rails collapse whole on a narrow window",
   /@media \(max-width:80rem\)\{ \.rail\{display:none;\} \}/.test(html));
ok("the rails are pinned to the margins, not the column",
   /\.rail\{[\s\S]*?position:fixed/.test(html));
ok("they are read, not clicked", /pointer-events:none/.test(html));
ok("no rail borders heavier than a hairline",
   !/\.rail[^{]*\{[^}]*border:[^;]*[2-9]px/.test(html));

console.log("\n== migration from version 1 ==");
qreset();
const v1motif = { version:1, title:"bound", tempo:96, loop:8, key:"A minor",
                  steps: steps({0:"E4", 3:"A4"}) };
const v1log = { folio:"quest-log", version:1, active:Q[4].id, quests:{} };
v1log.quests[Q[4].id] = { done:true, motif:v1motif };
v1log.quests[Q[1].id] = { done:false, motif:{ version:1, title:"other", tempo:112,
                          loop:16, key:"C major", steps: steps({7:"B3"}) } };
store[T.QUEST_KEY_V1] = JSON.stringify(v1log);
delete store[T.QUEST_KEY];
store["folio.v1"] = JSON.stringify({ version:1, title:"the page", tempo:104, loop:16,
                                     key:"D major", steps: steps({0:"C4"}) });
delete store["folio.v0"];
T.resetQuests();
ok("boot reports something restored", T.bootState() === true);
T.renderQuests();
eq("the v1 objective becomes the active workspace", T.qActive, Q[4].id);
eq("the v1 done flag survives", T.qState[Q[4].id].done, true);
eq("the bound motif becomes that quest's page", T.doc.steps[0], "E4");
eq("all of it", T.doc.steps[3], "A4");
eq("with its tempo", T.doc.tempo, 96);
eq("its loop", T.doc.loop, 8);
eq("and its key", T.doc.key, "A minor");
eq("a second bound motif migrates too", T.questPage(Q[1].id).steps[7], "B3");
T.switchWorkspace(null);
eq("the old main autosave became the free-play page", T.doc.steps[0], "C4");
eq("with its title", T.doc.title, "the page");
eq("and its tempo", T.doc.tempo, 104);
ok("the state is written forward as version 2", JSON.parse(store[T.QUEST_KEY]).version === 2,
   store[T.QUEST_KEY]);
ok("the version-1 log is left where it was, unharmed",
   typeof store[T.QUEST_KEY_V1] === "string");
eq("nothing was lost: two quests carry pages", Object.keys(T.wsDoc).length, 2);
/* a version-1 log arriving as a file migrates the same way */
qreset();
T.importText(JSON.stringify(v1log), "quest-log.json");
eq("an imported v1 log restores the active workspace", T.qActive, Q[4].id);
eq("and its motif is that workspace's page", T.doc.steps[0], "E4");

console.log("\n== the whole state on disk ==");
qreset();
key("KeyZ");                                     /* free play: C4 */
key("F3"); key("Enter"); key("F3");              /* into quest A */
key("KeyE");                                     /* A: E5 */
key("F3");
blobs.length = 0;
key("KeyS", { ctrlKey:true });
eq("ctrl+S on the quest page writes one file", blobs.length, 1);
const onDisk = JSON.parse(blobs[0]);
eq("marked as a quest log", onDisk.folio, "quest-log");
eq("and it is version 2", onDisk.version, 2);
eq("the active workspace is legible on disk", onDisk.active, Q[0].id);
eq("the quest's own page travels with it", onDisk.quests[Q[0].id].pattern.steps[0], "E5");
eq("and the free-play page too", onDisk.free.steps[0], "C4");
eq("with the done flags", onDisk.quests[Q[0].id].done, false);
key("F3"); blobs.length = 0; key("KeyS", { ctrlKey:true });
eq("ctrl+S on the pattern still writes the pattern", JSON.parse(blobs[0]).steps.length, 16);
eq("and it writes the active workspace", JSON.parse(blobs[0]).steps[0], "E5");
eq("and it carries the key", JSON.parse(blobs[0]).key, "G major");
eq("the pattern file gains no quest fields",
   Object.keys(JSON.parse(blobs[0])).sort(), ["bass","key","loop","mute","solo","steps","tempo","title","version"]);
T.resetQuests(); delete store[T.QUEST_KEY];
T.importText(JSON.stringify(onDisk), "quest-log.json");
eq("a quest log file restores the active workspace", T.qActive, Q[0].id);
eq("and the page it holds", T.doc.steps[0], "E5");
T.switchWorkspace(null);
eq("and free play with it", T.doc.steps[0], "C4");
ok("a pattern file is still a pattern file",
   !T.isQuestLog({version:1,title:"t",tempo:112,steps:blank()}));
ok("quests/quest-log.json exists on disk",
   fs.existsSync(REPO + "/quests/quest-log.json"));
const repoLog = JSON.parse(fs.readFileSync(REPO + "/quests/quest-log.json","utf8"));
ok("and the app can read it", T.isQuestLog(repoLog));
T.resetQuests();
T.importText(JSON.stringify(repoLog), "quest-log.json");
ok("it applies cleanly", !/not a/.test(ids.footer.textContent), ids.footer.textContent);
closePages();

console.log("\n== the log on disk: the local server, and the fallback ==");
qreset();
/* the harness has no `location` at all — which is what a file: page amounts
   to here: no server, no sync, nothing said */
ok("no http origin in this environment", !T.httpOrigin());
T.syncBoot();
ok("so the sync layer stays off", T.syncOn === false);
eq("and the footer says nothing about syncing", T.syncNote(), "");
key("F3");
ok("the quest page is quiet from a file", !/sync/.test(ids.footer.textContent),
   ids.footer.textContent);
T.syncOn = true; T.syncState = "ok"; key("ArrowDown");
ok("served over http it says so quietly", / · synced$/.test(ids.footer.textContent),
   ids.footer.textContent);
T.syncState = "failed"; key("ArrowDown");
ok("a failed push degrades in words, not in function",
   / · sync failed — working locally$/.test(ids.footer.textContent), ids.footer.textContent);
key("F3");
ok("the pattern page never mentions the sync", !/sync/.test(ids.footer.textContent),
   ids.footer.textContent);
T.syncOn = false; T.syncState = "idle";
ok("pushing with the sync off is a no-op",
   (function(){ T.syncPush(); return T.syncTimer; })() === null);

/* the authority rule: what the server sends replaces what was loaded */
qreset();
page({0:"C4"});
T.save();
const fromServer = { folio:"quest-log", version:2, active:"summit",
  free: { version:1, title:"free", tempo:112, loop:16, key:"C major",
          steps: steps({0:"G4", 4:"A4"}) },
  quests: { summit: { done:true, pattern: { version:1, title:"summit", tempo:112,
            loop:16, key:"C major", steps: steps({2:"E5"}) } } } };
ok("a quest log from the server is applied", T.applyServerState(fromServer));
eq("the server's active workspace wins", T.qActive, "summit");
eq("and its page is what is on screen", T.doc.steps[2], "E5");
eq("its free play is kept too", T.wsFree.steps[0], "G4");
ok("and its done flags", T.qState.summit.done);
ok("the local cache is brought level with it",
   /"active": "summit"|"active":"summit"/.test(store[T.QUEST_KEY] || ""), store[T.QUEST_KEY]);
ok("anything that is not a quest log is refused", !T.applyServerState({ hello:"world" }));
ok("and refusing changes nothing", T.qActive === "summit");
ok("a bare pattern is not mistaken for one",
   !T.applyServerState({ version:1, title:"t", tempo:112, steps: blank() }));

ok("the source pushes to the server's one endpoint",
   /SYNC_URL = "api\/quest-log"/.test(html));
ok("with the whole storage schema", /JSON\.stringify\(stateToJSON\(\), null, 2\)/.test(html));
ok("pushes are debounced", /SYNC_DEBOUNCE = 2000/.test(html));
ok("the mode is decided by the protocol",
   /location\.protocol === "http:"/.test(html) && /location\.protocol === "https:"/.test(html));
ok("no File System Access remains", !/showSaveFilePicker|showOpenFilePicker/.test(html));
ok("no IndexedDB handle store remains", !/indexedDB/i.test(html));
/* K was the old bind-a-motif key. Binding is gone — every quest is a
   workspace — and the position was free, so K is now the names on the
   drawing and nothing else. */
ok("no binding of motifs remains",
   !/bindMotif|keepMotif|bindQuest|takeMotif/i.test(html));
ok("K is the names now, and only that",
   /case "KeyK":\s*\n\s*e\.preventDefault\(\); toggleNames\(\); return;/.test(html));
ok("and it appears nowhere else in the keymap",
   (html.match(/"KeyK"/g) || []).length === 1);
ok("ctrl+O still opens a log by hand", /code === "KeyO"/.test(html));
ok("a dropped file is still read", /addEventListener\("drop"/.test(html));
closePages();

/* the live parts — debounce, failure, retry — with a fetch of our own */
async function syncLive(){
  console.log("\n== the sync layer, driven ==");
  const calls = [];
  let mode = "ok";
  globalThis.fetch = function(url, opt){
    calls.push({ url, method: (opt && opt.method) || "GET", body: opt && opt.body });
    if (mode === "throw") return Promise.reject(new Error("connection refused"));
    return Promise.resolve({ ok: mode === "ok", status: mode === "ok" ? 204 : 500,
                             json: () => Promise.resolve(null) });
  };
  const settle = () => new Promise(r => setTimeout(r, 60));

  qreset();
  T.setSyncDebounce(10);
  T.syncOn = true; T.syncState = "idle";

  /* a burst of note entry is one write, not five */
  reset(); key("KeyZ"); key("KeyX"); key("KeyC"); key("KeyV"); key("KeyB");
  ok("a burst schedules a single push", calls.length === 0 && T.syncTimer !== null);
  await settle();
  eq("and it fires exactly once", calls.length, 1);
  eq("as a PUT to the endpoint", [calls[0].method, calls[0].url], ["PUT", "api/quest-log"]);
  const sent = JSON.parse(calls[0].body);
  eq("carrying the whole v2 state", [sent.folio, sent.version], ["quest-log", 2]);
  /* five notes entered as eighths: steps 1, 3, 5, 7, 9 */
  eq("with the notes just entered",
     [sent.free.steps[0], sent.free.steps[2], sent.free.steps[4], sent.free.steps[6]],
     ["C4","D4","E4","F4"]);
  eq("and the footer is content", T.syncState, "ok");

  /* the server goes away mid-session */
  mode = "throw";
  calls.length = 0;
  key("KeyG");
  await settle();
  eq("a dead server is one failed push", calls.length, 1);
  eq("recorded as a failure", T.syncState, "failed");
  ok("and the work is still in localStorage",
     JSON.parse(store[T.QUEST_KEY]).free.steps[10] === "F#4",
     JSON.parse(store[T.QUEST_KEY]).free.steps.slice(0,13));
  key("F3");
  ok("which the footer admits, quietly",
     / · sync failed — working locally$/.test(ids.footer.textContent), ids.footer.textContent);
  key("F3");

  /* and comes back: the next change retries, nothing is lost */
  mode = "ok";
  calls.length = 0;
  key("KeyH");
  await settle();
  eq("the next change retries", calls.length, 1);
  eq("and it recovers", T.syncState, "ok");
  eq("with both notes in the push",
     [JSON.parse(calls[0].body).free.steps[10],
      JSON.parse(calls[0].body).free.steps[12]], ["F#4","G#4"]);

  /* boot: the server is the authority when it has a log */
  qreset();
  T.setSyncDebounce(10);
  calls.length = 0;
  globalThis.fetch = function(url, opt){
    calls.push({ url, method: (opt && opt.method) || "GET" });
    return Promise.resolve({ ok:true, status:200, json: () => Promise.resolve(fromServer) });
  };
  /* an http origin, which is the whole of the decision */
  globalThis.location = { protocol: "http:" };
  T.syncBoot();
  ok("an http origin turns the sync on by itself", T.syncOn === true);
  await settle();
  eq("boot asks the server first", calls[calls.length-1].method, "GET");
  eq("and the server's state is what is loaded", T.qActive, "summit");
  ok("the footer says where it came from",
     /restored from the server/.test(ids.footer.textContent), ids.footer.textContent);

  /* a response of our own, with the headers the mode decision reads */
  function resp(o){
    return {
      ok: !!o.ok, status: o.status,
      headers: { get: k => (String(k).toLowerCase() === "content-type" ? (o.type || null) : null) },
      json: o.json || (() => Promise.reject(new Error("not json")))
    };
  }

  /* a 404 is not a failure: there is simply no log yet. server.mjs says so
     in JSON, which is exactly what separates it from a static host. */
  qreset();
  T.syncState = "idle"; T.staticMode = false;
  calls.length = 0;
  globalThis.fetch = (url) => { calls.push({ url });
    return Promise.resolve(resp({ ok:false, status:404,
      type:"application/json; charset=utf-8",
      json: () => Promise.resolve({ folio:"quest-log", absent:true }) })); };
  T.syncBoot(true);
  await settle();
  eq("no log on the server yet is fine", T.syncState, "ok");
  ok("and the page is untouched", T.qActive === null);
  ok("an empty server is still a server", T.syncOn === true && T.staticMode === false);
  eq("and no seed is read behind its back", calls.map(c => c.url), ["api/quest-log"]);

  /* ---- the static copy: a host with no /api at all ---- */
  console.log("\n== the shared copy on a static host ==");
  ok("the source names the seed", /SEED_URL = "quests\/quest-log\.json"/.test(html));
  ok("the seed is only ever read", !/SEED_URL[^]{0,400}method:\s*"PUT"/.test(html));
  ok("static mode turns the push off", /staticMode = true;[^]{0,120}syncOn = false/.test(html));
  eq("the seed url is the committed log", T.SEED_URL, "quests/quest-log.json");

  qreset();
  T.syncState = "idle"; T.staticMode = false; T.syncOn = false;
  calls.length = 0;
  globalThis.fetch = function(url){
    calls.push({ url });
    if (url === "api/quest-log")
      return Promise.resolve(resp({ ok:false, status:404, type:"text/html; charset=utf-8" }));
    return Promise.resolve(resp({ ok:true, status:200, type:"application/json",
                                  json: () => Promise.resolve(fromServer) }));
  };
  T.syncBoot(true);
  await settle();
  ok("a 404 that is not JSON means a static host", T.staticMode === true);
  ok("and nothing is ever pushed from there", T.syncOn === false);
  eq("it asks for the committed log", calls.map(c => c.url),
     ["api/quest-log", "quests/quest-log.json"]);
  eq("and the seed is what is on the page", T.qActive, "summit");
  ok("the footer says it is a copy",
     / · read-only copy$/.test((key("F3"), ids.footer.textContent)), ids.footer.textContent);
  key("F3");
  /* and from then on the visitor's own work stays theirs */
  calls.length = 0;
  T.setSyncDebounce(10);
  key("KeyZ");
  await settle();
  eq("a static copy never writes home", calls.length, 0);
  ok("but it does save locally", (store[T.QUEST_KEY] || "").length > 0);

  /* ---- a returning visitor: the published work is what they get ----
     These two checks used to assert the opposite — that a browser with
     something of its own was never seeded over — which was an older design
     the source has since deliberately replaced (see the comment above
     goStatic and the paragraph on the key page). The shared copy is a
     showcase: the point of it is that whoever opens it hears what was
     published rather than whatever their browser kept from last time. So the
     seed is read on every visit and replaces the local cache. A visitor may
     still play with the page for the rest of the session; a reload returns
     to the published work. syncBoot weighs no freshness and takes no
     argument. */
  qreset();
  T.staticMode = false; T.syncState = "idle";
  page({0:"D4"}); T.save();
  ok("the visitor has work of their own in the local cache",
     /"D4"/.test(store[T.QUEST_KEY] || ""), store[T.QUEST_KEY]);
  calls.length = 0;
  T.syncBoot();
  await settle();
  ok("a returning visitor still lands in static mode", T.staticMode === true);
  eq("and the seed is read again on this visit too", calls.map(c => c.url),
     ["api/quest-log", "quests/quest-log.json"]);
  eq("the published work replaces what their browser kept", T.qActive, "summit");
  eq("its page is what is on screen", T.doc.steps[2], "E5");
  eq("and the published free play came with it", T.wsFree.steps[0], "G4");
  ok("so their own edit is not on the page any more",
     T.doc.steps[0] !== "D4" && T.wsFree.steps[0] !== "D4",
     [T.doc.steps[0], T.wsFree.steps[0]]);
  ok("the copy still never writes home", T.syncOn === false);
  eq("and it booted cleanly — the sync is not in a failed state", T.syncState, "idle");

  /* a host that answers every path with the page itself */
  qreset();
  T.staticMode = false; T.syncState = "idle";
  globalThis.fetch = (url) => (url === "api/quest-log"
    ? Promise.resolve(resp({ ok:true, status:200, type:"text/html" }))
    : Promise.resolve(resp({ ok:true, status:200, type:"application/json",
                             json: () => Promise.resolve(fromServer) })));
  T.syncBoot(true);
  await settle();
  ok("a page where the log should be is a static host too", T.staticMode === true);
  eq("and the seed still comes through", T.qActive, "summit");

  /* no /api at all: the request does not even arrive */
  qreset();
  T.staticMode = false; T.syncState = "idle";
  page({0:"D4"}); T.save();
  globalThis.fetch = (url) => (url === "api/quest-log"
    ? Promise.reject(new Error("refused"))
    : Promise.reject(new Error("refused")));
  T.syncBoot(false);
  await settle();
  ok("an unreachable /api is a static copy, not a wipe", T.staticMode === true);
  eq("and the local page is still there", T.doc.steps[0], "D4");
  ok("with no failure shouted at the reader", T.syncState !== "failed");

  T.staticMode = false;
  T.setSyncDebounce(2000);
  delete globalThis.location;
  T.syncBoot();
  ok("and without an http origin it switches itself off again", T.syncOn === false);
  T.syncState = "idle";
  closePages();
}

/* ================= 4b. drills: quests delivered into the log ================= */
console.log("\n== drills: the schema and the list ==");
const ITCH = { id:"drill-itch", name:"the itch drill",
  summary:"loop the scale, swap the final note",
  teaches:"tendency tones",
  pattern:{ version:1, title:"the itch drill", tempo:104, loop:8, key:"F major",
            steps:["F4","G4","A4","A#4","C5","D5","E5","F5",
                   null,null,null,null,null,null,null,null] } };
const SECOND = { id:"drill-two", name:"the second drill", summary:"s2", teaches:"t2",
  pattern:{ version:1, title:"two", tempo:96, loop:16, key:"A minor",
            steps: steps({0:"A4"}) } };
function logWith(drills, extra){
  return Object.assign({ folio:"quest-log", version:2, active:null,
    free:{ version:1, title:"free", tempo:112, loop:16, key:"C major", steps: blank() },
    quests:{}, drills: drills }, extra||{});
}
function drillIndex(id){ return T.ALL.findIndex(q => q.id === id); }
function hairs(el, cls){ return el.children.filter(c => c.className === cls).length; }

qreset();
eq("with no drills the list is the eight", T.ALL.length, 8);
eq("and so are the rows", T.qrowsNow.length, 8);
eq("no divider is drawn for nothing", hairs(T.qlistEl, "qhair"), 0);
eq("nor in the margin", hairs(T.railEl, "rhair"), 0);

ok("a log with a drill applies", T.applyState(logWith([ITCH])));
eq("the drill joins the list", T.ALL.length, 9);
eq("after the eight built-ins", T.ALL[8].id, "drill-itch");
ok("and it is marked as a drill", T.ALL[8].drill === true);
eq("the rows follow it", T.qrowsNow.length, 9);
eq("named plainly on its row", T.qrowsNow[8].el.children[2].textContent, "the itch drill");
/* the divider that used to separate the drills from the quests inside one
   long list is a tab of its own now; the list itself is one lesson deep and
   draws no hairline until something is kept to hand */
eq("the drills take a tab of their own", T.tabList().map(T.tabLabel), ["L1","drills"]);
eq("and the list draws no divider inside a tab", hairs(T.qlistEl, "qhair"), 0);
eq("the left rail grows too", T.rrowsNow.length, 10);
eq("with the same divider, once", hairs(T.railEl, "rhair"), 1);
eq("labelled", T.railEl.children.find(c=>c.className==="rhair").children[0].textContent, "drills");
eq("and the drill's name in the margin", T.rrowsNow[9].name.textContent, "the itch drill");
eq("a second drill lands after the first", (T.applyState(logWith([ITCH, SECOND])), T.ALL.length), 10);
eq("still the two tabs", T.tabList().length, 2);
eq("and still one divider in the margin", hairs(T.railEl, "rhair"), 1);

console.log("\n== a drill is a workspace like any other ==");
qreset();
T.applyState(logWith([ITCH]));
const iItch = drillIndex("drill-itch");
eq("it is selectable", iItch, 8);
key("F3"); T.qsel = iItch; T.renderQuests();
eq("the page names it", ids.qdname.textContent, "the itch drill");
eq("with its constraint", ids.qdtext.textContent, "loop the scale, swap the final note");
eq("and what it teaches", ids.qdteach.textContent, "Teaches: tendency tones");
key("Enter"); key("F3");
eq("entering it makes it active", T.qActive, "drill-itch");
eq("and the page is the drill's pattern", T.doc.steps.slice(0,8),
   ["F4","G4","A4","A#4","C5","D5","E5","F5"]);
eq("with its key", T.doc.key, "F major");
eq("its tempo", T.doc.tempo, 104);
eq("and its loop", T.doc.loop, 8);
eq("and its title", T.doc.title, "the itch drill");
ok("the right rail carries its summary",
   /loop the scale/.test(ids.railtext.textContent), ids.railtext.textContent);
ok("and what it teaches", /tendency tones/.test(ids.railteach.textContent));
ok("the seed is a copy, not the definition itself",
   T.doc !== T.drillById("drill-itch").pattern);
T.cursor = 8; key("KeyZ");
eq("writing in it edits the workspace", T.doc.steps[8], "C4");
eq("the definition is untouched", T.drillById("drill-itch").pattern.steps[8], null);
key("F3"); key("Enter"); key("F3");
eq("leaving it returns to free play", T.qActive, null);
eq("and free play is its own page", T.doc.steps[0], null);
key("F3"); key("Enter"); key("F3");
eq("coming back finds the edit", T.doc.steps[8], "C4");
eq("and does not re-seed", T.doc.steps.filter(Boolean).length, 9);
key("F3"); T.qsel = iItch; key("KeyC");
ok("C marks a drill complete", T.qState["drill-itch"].done);
eq("and the row says so", T.qrowsNow[iItch].stat.textContent, "❧");
key("KeyC");
ok("and unmarks it", !T.qState["drill-itch"].done);
closePages();

console.log("\n== drills round-trip through the state ==");
qreset();
T.applyState(logWith([ITCH, SECOND]));
T.switchWorkspace("drill-itch");
T.doc.steps[9] = "G4"; T.save();
const out = T.stateToJSON();
eq("the state carries both definitions", out.drills.map(d=>d.id), ["drill-itch","drill-two"]);
eq("unchanged — name", out.drills[0].name, "the itch drill");
eq("unchanged — summary", out.drills[0].summary, ITCH.summary);
eq("unchanged — teaches", out.drills[0].teaches, ITCH.teaches);
eq("unchanged — pattern", out.drills[0].pattern.steps, ITCH.pattern.steps);
eq("and the drill's workspace is a quest like any other",
   out.quests["drill-itch"].pattern.steps[9], "G4");
ok("a PUT body would carry them", /"drill-itch"/.test(JSON.stringify(out)));
ok("re-reading the state loses nothing", T.applyState(out));
eq("both are still there", T.DRILLS.map(d=>d.id), ["drill-itch","drill-two"]);
eq("and the workspace with them", T.workspaceDoc("drill-itch").steps[9], "G4");
eq("a state with no drills writes no drills key",
   (T.resetDrills(), "drills" in T.stateToJSON()), false);

console.log("\n== a workspace whose definition is missing ==");
qreset();
const orphan = logWith([], { quests: { "drill-gone": { done:true,
  pattern:{ version:1, title:"x", tempo:112, loop:16, key:"C major", steps: steps({0:"E4"}) } } } });
ok("it applies without crashing", T.applyState(orphan));
eq("the workspace is kept", T.workspaceDoc("drill-gone").steps[0], "E4");
eq("its done flag too", T.qState["drill-gone"].done, true);
eq("it is listed by its id", T.ALL[8].id, "drill-gone");
eq("named by its id", T.ALL[8].short, "drill-gone");
eq("with no summary", T.ALL[8].text, "");
eq("and the ghost is not written back as a definition",
   "drills" in T.stateToJSON(), false);
T.switchWorkspace("drill-gone");
eq("it can still be entered", T.doc.steps[0], "E4");
closePages();

console.log("\n== a drill never shadows a built-in quest ==");
qreset();
ok("a definition with a quest's id is refused",
   T.normDrill({ id:"ladder", name:"nope" }) === null);
ok("nor one with no id", T.normDrill({ name:"nope" }) === null);
ok("nor a non-object", T.normDrill(null) === null && T.normDrill([]) === null);
const loose = T.normDrill({ id:" x ", pattern:{ nonsense:true } });
eq("an id is trimmed", loose.id, "x");
eq("a missing name falls back to the id", loose.name, "x");
eq("an unreadable pattern is simply no seed", loose.pattern, null);
eq("and its workspace is then an ordinary empty page",
   (T.resetDrills(), T.applyState(logWith([{ id:"drill-bare", name:"bare" }])),
    T.workspaceDoc("drill-bare").steps.filter(Boolean).length), 0);
eq("in C major", T.workspaceDoc("drill-bare").key, "C major");

/* the live delivery: the poll, the conditional GET, the narrow merge */
async function drillsLive(){
  console.log("\n== drills arrive without a reload ==");
  const settle = () => new Promise(r => setTimeout(r, 60));
  const calls = [];
  let served = logWith([ITCH]);
  let tag = '"aaa"';
  let status = 200;
  function resp(){
    if (status === 304)
      return { ok:false, status:304,
               headers:{ get: k => (String(k).toLowerCase()==="etag" ? tag : null) },
               json: () => Promise.reject(new Error("no body")) };
    return { ok:true, status:200,
             headers:{ get: k => (String(k).toLowerCase()==="etag" ? tag : null) },
             json: () => Promise.resolve(served) };
  }
  globalThis.fetch = function(url, opt){
    calls.push({ url, method:(opt&&opt.method)||"GET", body: opt&&opt.body,
                 inm: opt && opt.headers && opt.headers["if-none-match"] });
    if ((opt && opt.method) === "PUT")
      return Promise.resolve({ ok:true, status:204,
        headers:{ get: k => (String(k).toLowerCase()==="etag" ? '"put"' : null) } });
    return Promise.resolve(resp());
  };

  qreset();
  T.syncOn = true; T.syncState = "ok"; T.staticMode = false;
  T.setSyncDebounce(10);
  T.setETag(null);

  /* the tab has been sitting here with work in it */
  T.switchWorkspace("summit");
  T.doc.steps[0] = "D4"; T.save();
  T.switchWorkspace(null);
  T.doc.steps[3] = "B4"; T.save();
  await settle();
  calls.length = 0;
  T.setETag(null);

  /* and a drill is written into the file underneath it */
  T.pollTick();
  await settle();
  eq("the poll asks for the log", calls.map(c=>c.method), ["GET"]);
  eq("as a plain conditional read with no etag yet", calls[0].inm, undefined);
  eq("the drill is adopted", T.DRILLS.map(d=>d.id), ["drill-itch"]);
  eq("and appears in the list", T.ALL.length, 9);
  eq("with a row", T.qrowsNow.length, 9);
  eq("and a line in the margin", T.rrowsNow.length, 10);
  eq("the etag is remembered", T.logETag, '"aaa"');
  ok("the footer says so, quietly",
     / · a drill arrived: the itch drill/.test(ids.footer.textContent), ids.footer.textContent);
  eq("nothing else moved — active", T.qActive, null);
  eq("nothing else moved — free play", T.doc.steps[3], "B4");
  eq("nothing else moved — a quest's workspace", T.workspaceDoc("summit").steps[0], "D4");
  ok("and the arrival is not pushed back as a change", T.syncTimer === null);
  ok("but it is kept locally",
     /drill-itch/.test(store[T.QUEST_KEY] || ""), (store[T.QUEST_KEY]||"").slice(0,80));
  key("ArrowDown");                   /* anything said next clears the notice */
  ok("the notice does not stick",
     !/a drill arrived/.test(ids.footer.textContent), ids.footer.textContent);
  await settle();

  /* the same file again: adopted once, announced once */
  calls.length = 0;
  T.pollTick();
  await settle();
  eq("the second poll sends the etag", calls[0].inm, '"aaa"');
  eq("and the drill is not adopted twice", T.DRILLS.length, 1);
  ok("nor announced again", !/a drill arrived/.test(ids.footer.textContent));

  /* a 304 costs nothing and changes nothing */
  status = 304;
  calls.length = 0;
  const before304 = JSON.stringify(T.stateToJSON());
  T.pollTick();
  await settle();
  eq("a 304 is one request", calls.length, 1);
  eq("and nothing at all happens", JSON.stringify(T.stateToJSON()), before304);
  status = 200;

  /* a changed definition never reaches back into a workspace */
  T.switchWorkspace("drill-itch");
  eq("the drill's page is the seed", T.doc.steps[0], "F4");
  T.doc.steps[0] = "C4"; T.save();
  await settle();
  served = logWith([Object.assign({}, ITCH, { name:"renamed", summary:"different",
    pattern: Object.assign({}, ITCH.pattern, { steps: steps({0:"B4"}) }) })]);
  tag = '"bbb"';
  T.pollTick();
  await settle();
  eq("a known drill is never overwritten — name", T.drillById("drill-itch").name, "the itch drill");
  eq("— summary", T.drillById("drill-itch").summary, ITCH.summary);
  eq("— pattern", T.drillById("drill-itch").pattern.steps[0], "F4");
  eq("and the workspace is exactly as it was left", T.doc.steps[0], "C4");
  T.switchWorkspace(null);
  await settle();

  /* a second drill, delivered while the first is being worked in */
  served = logWith([ITCH, SECOND]);
  tag = '"ccc"';
  T.pollTick();
  await settle();
  eq("only the unseen one is adopted", T.DRILLS.map(d=>d.id), ["drill-itch","drill-two"]);
  ok("and it announces itself once",
     /a drill arrived: the second drill/.test(ids.footer.textContent), ids.footer.textContent);
  eq("the list grew by one", T.ALL.length, 10);
  T.switchWorkspace("drill-two");
  eq("its page is its own seed", T.doc.steps[0], "A4");
  eq("in its own key", T.doc.key, "A minor");
  T.switchWorkspace(null);
  await settle();

  /* the file never removes anything from the page */
  served = logWith([]);
  tag = '"ddd"';
  T.pollTick();
  await settle();
  eq("a log with the drills gone removes nothing", T.DRILLS.length, 2);
  served = { hello:"world" };
  tag = '"eee"';
  T.pollTick();
  await settle();
  eq("and something that is not a quest log is ignored", T.DRILLS.length, 2);
  ok("the active workspace is still free play", T.qActive === null);
  served = logWith([ITCH, SECOND]);

  /* a ghost is given its definition when one finally arrives */
  qreset();
  T.syncOn = true; T.staticMode = false; T.setETag(null);
  T.applyState(logWith([], { quests:{ "drill-itch": { done:false,
    pattern:{ version:1, title:"mine", tempo:112, loop:16, key:"C major",
              steps: steps({0:"G3"}) } } } }));
  eq("the orphan workspace is a ghost", T.DRILLS[0].ghost, true);
  served = logWith([ITCH]);
  T.pollTick();
  await settle();
  eq("the definition fills the ghost in", T.drillById("drill-itch").name, "the itch drill");
  ok("it is a definition now", !T.drillById("drill-itch").ghost);
  eq("and the work already in that workspace is untouched",
     T.workspaceDoc("drill-itch").steps[0], "G3");
  eq("the seed does not overwrite an existing page",
     T.workspaceDoc("drill-itch").steps[1], null);

  /* the poll stands aside while a write is pending or in flight */
  console.log("\n== the poll and the push never cross ==");
  qreset();
  T.syncOn = true; T.staticMode = false;
  T.setSyncDebounce(5000);
  calls.length = 0;
  key("KeyZ");                            /* a push is now pending */
  ok("a push is pending", T.syncTimer !== null);
  T.pollTick();
  await settle();
  eq("the poll does not run", calls.length, 0);
  T.setSyncDebounce(10);
  key("KeyC");                            /* re-armed at the short debounce */
  await settle();
  ok("the pending push has gone out", T.syncTimer === null);
  calls.length = 0;
  T.putInFlight = true;
  T.pollTick();
  await settle();
  eq("nor while one is on the wire", calls.length, 0);
  T.putInFlight = false;
  served = logWith([ITCH]);
  T.pollTick();
  await settle();
  eq("and it runs once both are clear", calls.length, 1);
  eq("adopting the drill it finds", T.DRILLS.map(d=>d.id), ["drill-itch"]);

  /* and the push carries the drills out with it */
  calls.length = 0;
  key("KeyX");
  await settle();
  const put = calls.filter(c => c.method === "PUT");
  eq("the change is pushed", put.length, 1);
  const body = JSON.parse(put[0].body);
  eq("carrying every drill it knows", body.drills.map(d=>d.id), ["drill-itch"]);
  eq("with the pattern intact", body.drills[0].pattern.steps.slice(0,3), ["F4","G4","A4"]);
  eq("and the server's tag is taken from the write", T.logETag, '"put"');

  /* static mode never polls at all */
  qreset();
  T.stopPoll();
  T.staticMode = true; T.syncOn = false;
  calls.length = 0;
  T.pollTick(); T.pollStart();
  await settle();
  eq("a read-only copy is never polled", calls.length, 0);
  ok("and no timer is started", T.pollTimer === null);
  T.staticMode = false;
  T.setSyncDebounce(2000);
  T.syncOn = false; T.syncState = "idle";
  closePages();
}

/* ================= 5. the documentation ================= */
console.log("\n== the key page documents it all ==");
const keyPage = html.slice(html.indexOf('id="keyref"'), html.indexOf('id="settings"'));
for (const s of ["F1","F2","F3","F4","R3","L3","quest log","the roll"])
  ok("the key page mentions " + s, keyPage.indexOf(s) >= 0);
ok("it names the entry-method toggle", /the entry method/.test(keyPage));
ok("it says select is the transport", /select \(create\)/.test(keyPage) &&
   /play or stop/.test(keyPage));
ok("it says start raises the settings crossbar",
   /start \(options\)/.test(keyPage) && /settings crossbar/.test(keyPage));
ok("it lists the crossbar's slots", /its eight slots/.test(keyPage));
ok("it says ↑↓ there are the workspaces in the left margin",
   /the workspace, walked in the left margin/.test(keyPage));
ok("and that walking is arriving",
   /you are already in the one it is on/.test(keyPage));
ok("it says ←→ there are the voice", /the voice, round the ring/.test(keyPage));
ok("it puts the entry method on ✕", /&#10005; the entry method/.test(keyPage));
ok("it says the quest log and the key have no slot",
   /what is not there/.test(keyPage) && /None of them has a slot/.test(keyPage));
ok("the crossbar no longer offers the quest log",
   !/&#8592; the quest log/.test(keyPage));
/* the two features met here: the reworked crossbar spends all eight slots on
   the workspace, the voice, solo, mute, close and the entry method, so the
   names have no slot to take and K is the keyboard's alone. The page says so
   in the one place that lists what the mode cannot reach. */
ok("the page counts the names among what has no slot",
   /the names on the drawing \(K\)/.test(keyPage), keyPage.match(/what is not there[\s\S]{0,240}/));
ok("and says why: all eight are spoken for",
   /all eight are spoken for/.test(keyPage));
ok("the crossbar it describes is the reworked one, with no names slot",
   T.SETTINGS.length === 8 && T.SETTINGS.every(s => !/name/i.test(s.label)),
   T.SETTINGS.map(s => s.label));
ok("K reaches the names without the pad at all",
   /case "KeyK":/.test(html) && !/runSetting[\s\S]{0,80}toggleNames/.test(src));
ok("it no longer promises select walks the pages", !/the pages in turn/.test(keyPage));
ok("nor that a held select changes the method", !/hold select/.test(keyPage));
ok("it names R3 as the way off the key page", /R3 closes it/.test(keyPage));
ok("escape is documented", /closes whichever page is up/.test(keyPage));
ok("it documents relative entry", /in relative entry/.test(keyPage));
ok("it names the leaps", /a third/.test(keyPage) && /a fifth/.test(keyPage));
ok("it names the chromatic escape", /a semitone, out of the key/.test(keyPage));
ok("it documents nudge", /nudge the note under the cursor/.test(keyPage));
ok("it documents setting the key of the piece", /the key of the piece/.test(keyPage));
ok("it explains the anchor", /the last note that sounds before the cursor/.test(keyPage));
ok("it explains the snap", /nearest note of the key in the direction/.test(keyPage));
for (const g of ["&#9651; (Y)", "&#10005; (A)", "&#9675; (B)", "&#9633; (X)",
                 "L1 (LB)", "R1 (RB)", "L2 (LT)", "R2 (RT)"])
  ok("both names given for " + g.replace(/&#\d+;/g,"").trim(), keyPage.indexOf(g) >= 0);

ok("the key page describes the workspace model",
   /Every quest is a workspace/.test(keyPage), keyPage.indexOf("workspace"));
ok("it says the page saves itself", /saves itself into the workspace/.test(keyPage));
ok("it says nothing is bound or loaded", /Nothing is bound, nothing is loaded/.test(keyPage));
ok("it describes the rails", /on the left every workspace/.test(keyPage));
ok("and their collapse", /narrow window drops both/.test(keyPage));
ok("the quest-page instructions are the new ones",
   /enter on the quest you are already in returns to free play/.test(keyPage));
ok("the sync is documented", /http:\/\/localhost:4173/.test(keyPage) &&
   /quests\/quest&#8209;log.json/.test(keyPage));
ok("and so is what happens when the server is not there",
   /keeps everything in the browser alone/.test(keyPage));
ok("no K binding survives on the key page", !/K links the log/.test(keyPage));
ok("no bind or load key survives on the key page",
   !/binds the pattern|loads that motif/.test(keyPage), keyPage.match(/bind\w*|load\w*/g));

console.log("\n== the spec records it ==");
const spec = fs.readFileSync(REPO + "/SPEC-LESSON-0.md", "utf8");
ok("the spec has a relative-entry section", /Relative entry \(contour mode\)/.test(spec));
for (const s of ["anchor", "snap", "\"key\"", "hold select", "F4", "nudge"])
  ok("the spec covers " + s, spec.indexOf(s) >= 0);
ok("the spec has the workspace section", /## Quests as workspaces/.test(spec));
for (const s of ["folio.quests.v2", "Migration (v1 → v2)", "free-play", "side rails",
                 "server.mjs", "folio.cmd", "GET /api/quest-log", "PUT /api/quest-log",
                 "http://localhost:4173", "--lan",
                 "contour preview", "80 rem", "\"pattern\""])
  ok("the spec covers " + s, spec.indexOf(s) >= 0, s);
ok("the spec records why bind/load died", /bind and load are therefore\s+\*\*dead\*\*/.test(spec));
ok("the spec gives the v2 document schema", /"folio": "quest-log",[\s\S]{0,40}"version": 2/.test(spec));
ok("the spec no longer claims a quest holds one motif",
   !/Each quest holds one/.test(spec));

console.log("\n== nothing new blinks, stripes or shouts ==");
ok("no animation anywhere", /animation:none !important/.test(html));
ok("no new @keyframes", !/@keyframes/.test(html));
ok("no repeating background", !/repeating-linear-gradient|background-repeat:repeat/.test(html));
ok("no pure white or black", !/#fff\b|#ffffff|#000\b|#000000/i.test(html));

ok("the spec no longer sells the File System Access API",
   !/showSaveFilePicker/.test(spec) && /It is gone/.test(spec));
ok("the spec records the authority rule", /the server is the authority/.test(spec));

/* ================= 5. the tempo, and the seeded workspaces ================= */
console.log("\n== the tempo, set on the key page (keyboard) ==");
qreset();
eq("112 is still where a fresh page starts", T.doc.tempo, 112);
eq("the range is 60 to 180", [T.TEMPO_MIN, T.TEMPO_MAX], [60, 180]);
eq("the coarse step is four, the fine step one", [T.TEMPO_STEP, T.TEMPO_FINE], [4, 1]);
ok("the tempo does nothing off the key page",
   (function(){ key("Equal"); key("Minus"); return T.doc.tempo; })() === 112, T.doc.tempo);
key("F1");
key("Equal"); eq("the key right of the minus key raises it by four", T.doc.tempo, 116);
key("Minus"); eq("and its neighbour lowers it by four", T.doc.tempo, 112);
key("Equal", { shiftKey:true }); eq("with shift, by one", T.doc.tempo, 113);
key("Minus", { shiftKey:true }); eq("and down by one", T.doc.tempo, 112);
key("NumpadAdd"); eq("the numpad agrees", T.doc.tempo, 116);
key("NumpadSubtract"); eq("both ways", T.doc.tempo, 112);
ok("the footer says the new tempo", /tempo · 112/.test(ids.footer.textContent), ids.footer.textContent);
ok("the header meta carries it", / · 112 · /.test(ids.metatext.textContent), ids.metatext.textContent);
for (let i = 0; i < 40; i++) key("Equal");
eq("it clamps at 180", T.doc.tempo, 180);
ok("and says so", /the end of the range/.test(ids.footer.textContent), ids.footer.textContent);
key("Equal", { shiftKey:true }); eq("the fine step clamps too", T.doc.tempo, 180);
for (let i = 0; i < 40; i++) key("Minus");
eq("and at 60 the other way", T.doc.tempo, 60);
key("Minus", { shiftKey:true }); eq("finely too", T.doc.tempo, 60);
key("Equal", { shiftKey:true }); eq("one off the floor", T.doc.tempo, 61);
ok("the tempo is autosaved like everything else",
   JSON.parse(store["folio.v1"]).tempo === 61, store["folio.v1"]);
/* the key bindings that were already there are untouched */
key("ArrowLeft");  eq("the arrows are still the key", T.doc.key, "B major");
key("ArrowRight"); eq("both ways", T.doc.key, "C major");
key("ArrowUp");    eq("and the mode", T.doc.key, "C minor");
key("ArrowDown");  eq("back again", T.doc.key, "C major");
eq("moving the key left the tempo alone", T.doc.tempo, 61);
key("F1");

console.log("\n== the tempo, on the pad, without a keyboard ==");
qreset();
key("F1");
frame([GP.DU]); frame([]);
eq("d-pad up raises the tempo by four", T.doc.tempo, 116);
frame([GP.DD]); frame([]);
eq("d-pad down lowers it", T.doc.tempo, 112);
frame([GP.L1, GP.DU]); frame([]);
eq("a bumper makes the step fine", T.doc.tempo, 113);
frame([GP.R1, GP.DD]); frame([]);
eq("either bumper", T.doc.tempo, 112);
frame([GP.DL]); frame([]);
eq("the d-pad sideways is still the tonic", T.doc.key, "B major");
frame([GP.DR]); frame([]);
eq("and back", T.doc.key, "C major");
press(GP.TR); eq("triangle is still the mode", T.doc.key, "C minor");
press(GP.X);  eq("and cross", T.doc.key, "C major");
eq("none of that moved the tempo", T.doc.tempo, 112);
/* the hold repeat works here as it does everywhere */
frame([GP.DU]); padNow += 400; frame([GP.DU]); frame([]);
ok("a held direction repeats", T.doc.tempo > 116, T.doc.tempo);
key("F1");

console.log("\n== the tempo belongs to the workspace ==");
qreset();
key("F1"); key("Equal"); key("Equal"); key("F1");     /* free play: 120 */
eq("free play took the change", T.doc.tempo, 120);
key("F3"); key("Enter"); key("F3");                   /* into quest A (ladder) */
eq("the quest arrived at its own tempo", T.doc.tempo, 120);
key("F1"); for (let i = 0; i < 5; i++) key("Equal"); key("F1");
eq("and takes its own change", T.doc.tempo, 140);
key("F3"); key("ArrowDown"); key("Enter"); key("F3"); /* into quest B (whitespace) */
eq("quest B is not carrying quest A's tempo", T.doc.tempo, 88);
key("F3"); key("ArrowUp"); key("Enter"); key("F3");   /* back into A */
eq("A kept its 140", T.doc.tempo, 140);
key("F3"); key("Enter"); key("F3");                   /* back to free play */
eq("and free play is untouched by any of it", T.doc.tempo, 120);
T.save();
const tlog = JSON.parse(store[T.QUEST_KEY]);
eq("free play's tempo is on disk", tlog.free.tempo, 120);
eq("and each quest's own beside it", tlog.quests[Q[0].id].pattern.tempo, 140);
eq("separately", tlog.quests[Q[1].id].pattern.tempo, 88);
T.resetQuests(); T.loadQuests();
eq("and they come back apart", T.workspaceDoc(Q[0].id).tempo, 140);
eq("all of them", T.workspaceDoc(Q[1].id).tempo, 88);
eq("free play too", T.workspaceDoc(null).tempo, 120);
closePages();

console.log("\n== a tempo change lands on the next scheduling window ==");
qreset();
page({});                                       /* every step sounds, so every window shows */
for (let i = 0; i < 16; i++) T.doc.steps[i] = "C4";
T.audioInit(); T.setPlaying(true);
sounded.length = 0; nowT = 0; T.schedFrom(0);
const d112 = 60 / 112 / 4;
ok("the step duration follows the tempo", Math.abs(T.stepDur() - d112) < 1e-12, T.stepDur());
T.scheduler();
eq("the first window schedules one step", sounded.length, 1);
ok("at the top of the clock", Math.abs(sounded[0].at - 0) < 1e-12, sounded[0]);
T.doc.tempo = 60;                              /* the dial moves while it runs */
const d60 = 60 / 60 / 4;
ok("the duration follows immediately", Math.abs(T.stepDur() - d60) < 1e-12, T.stepDur());
nowT = d112; T.scheduler();
eq("the next window still schedules exactly one step", sounded.length, 2);
ok("the step already committed keeps its time — nothing is rescheduled",
   Math.abs(sounded[0].at - 0) < 1e-12, sounded[0]);
ok("and the one that was already queued lands where it was promised",
   Math.abs(sounded[1].at - d112) < 1e-12, sounded[1]);
nowT = d112 + d60; T.scheduler();
eq("and the window after that", sounded.length, 3);
ok("the gap after the change is the new step duration",
   Math.abs((sounded[2].at - sounded[1].at) - d60) < 1e-12,
   sounded[2].at - sounded[1].at);
T.doc.tempo = 180;
const d180 = 60 / 180 / 4;
nowT = d112 + 2 * d60; T.scheduler();      /* this step was promised at the old rate */
ok("a step already promised keeps the old spacing",
   Math.abs((sounded[3].at - sounded[2].at) - d60) < 1e-12,
   sounded[3].at - sounded[2].at);
nowT = d112 + 2 * d60 + d180; T.scheduler();
ok("and the one after it follows the dial back up",
   Math.abs((sounded[4].at - sounded[3].at) - d180) < 1e-12,
   sounded[4].at - sounded[3].at);
ok("nothing was ever scheduled in the past",
   sounded.every((s, i) => i === 0 || s.at >= sounded[i-1].at), sounded.map(s=>s.at));
T.setPlaying(false);
/* the note itself is shaped by the same duration, so no click at any tempo */
sounded.length = 0;
qreset(); T.doc.tempo = 60; T.audioInit();
ok("a slow tempo still ends its note before the next step",
   T.stepDur() > 0.04 + 0.006);

console.log("\n== every quest arrives already tuned ==");
qreset();
const SEED_TABLE = {
  ladder:     ["G major", 120],
  whitespace: ["A minor", 88],
  summit:     ["D major", 112],
  stones:     ["A minor", 100],
  ouroboros:  ["D minor", 100],
  callanswer: ["F major", 104],
  stray:      ["E minor", 96],
  hand:       ["C major", 128]
};
eq("every quest has a seed and no quest is missing one",
   Object.keys(T.SEEDS).sort(), Q.map(q=>q.id).sort());
eq("the seeds are the table", Object.keys(SEED_TABLE).sort(), Q.map(q=>q.id).sort());
for (let i = 0; i < Q.length; i++){
  const id = Q[i].id, want = SEED_TABLE[id];
  eq(id + " is seeded " + want[0] + ", " + want[1],
     [T.SEEDS[id].key, T.SEEDS[id].tempo], want);
}
/* and the seed is what a fresh workspace actually arrives holding */
for (let i = 0; i < Q.length; i++){
  qreset(); key("F3");
  for (let j = 0; j < i; j++) key("ArrowDown");
  key("Enter"); key("F3");
  const want = SEED_TABLE[Q[i].id];
  eq("entering " + Q[i].id + " lands in " + want[0], T.doc.key, want[0]);
  eq("… at " + want[1], T.doc.tempo, want[1]);
  ok("… and the header says so",
     ids.metatext.textContent.indexOf(" · " + want[1] + " · ") > 0 &&
     ids.metatext.textContent.indexOf(want[0]) > 0, ids.metatext.textContent);
  eq("… with an empty page and nothing else changed", T.doc.steps.filter(Boolean).length, 0);
  eq("… and the loop untouched", T.doc.loop, 16);
  eq("… and the title untouched", T.doc.title, "untitled folio");
}
qreset();
eq("free play is never seeded — C major", T.doc.key, "C major");
eq("… at 112", T.doc.tempo, 112);
key("F3"); key("Enter"); key("F3");
key("F3"); key("Enter"); key("F3");
eq("and coming back out of a seeded quest leaves it that way", T.doc.key, "C major");
eq("with its tempo", T.doc.tempo, 112);
ok("the pattern file gains no seed field",
   Object.keys(JSON.parse(T.exportJSON())).sort().join() ===
   ["bass","key","loop","mute","solo","steps","tempo","title","version"].join());

console.log("\n== the seed is a starting value, not a rule ==");
qreset(); key("F3"); key("Enter"); key("F3");        /* ladder: G major 120 */
eq("seeded", [T.doc.key, T.doc.tempo], ["G major", 120]);
key("F1"); key("ArrowRight"); key("Minus"); key("Minus"); key("F1");
eq("the key page overrides the seeded key", T.doc.key, "G# major");
eq("and the seeded tempo", T.doc.tempo, 112);
key("F3"); key("ArrowDown"); key("Enter"); key("F3");
key("F3"); key("ArrowUp"); key("Enter"); key("F3");
eq("the override survives leaving and coming back", T.doc.key, "G# major");
eq("with the tempo", T.doc.tempo, 112);
T.save(); T.resetQuests(); T.loadQuests();
eq("and a reload — the seed does not come back", T.workspaceDoc(Q[0].id).key, "G# major");
eq("nor the tempo", T.workspaceDoc(Q[0].id).tempo, 112);
closePages();

console.log("\n== an existing page is never re-seeded ==");
qreset();
/* a log written before the seeds existed: its quests keep exactly what they had */
const oldLog = { folio:"quest-log", version:2, active:null,
  free: { version:1, title:"free", tempo:112, loop:16, key:"C major", steps: steps({0:"C4"}) },
  quests: {} };
oldLog.quests[Q[0].id] = { done:false, pattern: { version:1, title:"old", tempo:112,
  loop:16, key:"C major", steps: steps({0:"A3"}) } };
ok("it applies", T.applyState(oldLog));
eq("the old page is left exactly as it was — key", T.workspaceDoc(Q[0].id).key, "C major");
eq("— and tempo", T.workspaceDoc(Q[0].id).tempo, 112);
eq("— and notes", T.workspaceDoc(Q[0].id).steps[0], "A3");
T.switchWorkspace(Q[0].id);
eq("entering it does not re-seed it", T.doc.key, "C major");
eq("nor retune it", T.doc.tempo, 112);
/* a quest that log never mentioned is still seeded when it is first entered */
T.switchWorkspace(Q[6].id);
eq("but a quest with no page yet is seeded as usual", T.doc.key, "E minor");
eq("at its own tempo", T.doc.tempo, 96);
closePages();

console.log("\n== the seeded key is the key relative entry counts in ==");
qreset();
T.setRelative(true);
key("F3"); for (let i = 0; i < 6; i++) key("ArrowDown"); key("Enter"); key("F3");  /* stray: E minor */
eq("in the stray's workspace", T.qActive, Q[6].id);
eq("seeded E minor", T.doc.key, "E minor");
press(GP.TR);
eq("an empty page begins on the seeded tonic", T.doc.steps[0], "E4");
press(GP.TR);
eq("and a step up is a step of E minor", T.doc.steps[2], "F#4");
press(GP.X);
eq("and back down", T.doc.steps[4], "E4");
press(GP.X);
eq("the sixth below the tonic is D, natural minor", T.doc.steps[6], "D4");
eq("the anchor helper agrees", T.tonicMidi(), 64);
T.setRelative(false);
closePages();

console.log("\n== the seeded tempo is the tempo that plays ==");
qreset();
key("F3"); key("ArrowDown"); key("Enter"); key("F3");   /* whitespace: 88 */
eq("whitespace plays at 88", T.doc.tempo, 88);
ok("and the scheduler agrees", Math.abs(T.stepDur() - 60/88/4) < 1e-12, T.stepDur());
T.doc.steps[0] = "C4"; T.doc.steps[1] = "D4";   /* written into the seeded page itself */
T.audioInit(); T.setPlaying(true);
sounded.length = 0; nowT = 0; T.schedFrom(0);
T.scheduler(); nowT = 60/88/4; T.scheduler();
ok("the two steps are one 88-bpm step apart",
   sounded.length >= 2 && Math.abs((sounded[1].at - sounded[0].at) - 60/88/4) < 1e-12,
   sounded.map(s=>s.at));
T.setPlaying(false);
closePages();

/* ================= 6. the names: pitches, and the interval between ======== */
console.log("\n== the note name, with its octave ==");
qreset();
eq("middle C is C4", T.nameOfMidi(60), "C4");
eq("and C4 is MIDI 60", T.midiOf("C4"), 60);
eq("the bottom of the range is C2", T.nameOfMidi(T.MIDI_LO), "C2");
eq("and C2 is MIDI 36", T.midiOf("C2"), 36);
eq("the top of the range is C6", T.nameOfMidi(T.MIDI_HI), "C6");
eq("and C6 is MIDI 84", T.midiOf("C6"), 84);
eq("a semitone under middle C is B3", T.nameOfMidi(59), "B3");
eq("and one over it is C#4", T.nameOfMidi(61), "C#4");
eq("A440 is A4", T.nameOfMidi(69), "A4");
eq("the label drops the column's alignment dash", T.pitchName("C4"), "C4");
eq("and writes a real sharp sign", T.pitchName("F#3"), "F♯3");
eq("at the bottom of the range", T.pitchName("C2"), "C2");
eq("at the top of it", T.pitchName("C6"), "C6");
eq("and says nothing about a rest", T.pitchName(null), "");

console.log("\n== the interval names ==");
const IVL = ["P1","m2","M2","m3","M3","P4","TT","P5","m6","M6","m7","M7","P8"];
for (let n = 0; n <= 12; n++) eq(n + " semitones is " + IVL[n], T.intervalName(n), IVL[n]);
eq("the tritone is TT and not a number", T.intervalName(6), "TT");
eq("13 semitones compounds to m9", T.intervalName(13), "m9");
eq("14 to M9", T.intervalName(14), "M9");
eq("15 to m10", T.intervalName(15), "m10");
eq("16 to M10", T.intervalName(16), "M10");
eq("17 to P11", T.intervalName(17), "P11");
eq("18 — a tritone and an octave — to TT11", T.intervalName(18), "TT11");
eq("19 to P12", T.intervalName(19), "P12");
eq("21 to M13", T.intervalName(21), "M13");
eq("23 to M14", T.intervalName(23), "M14");
eq("two octaves to P15", T.intervalName(24), "P15");
eq("27 to m17", T.intervalName(27), "m17");
eq("30 to TT18", T.intervalName(30), "TT18");
eq("three octaves to P22", T.intervalName(36), "P22");
eq("the whole range, C2 to C6, is P29", T.intervalName(T.MIDI_HI - T.MIDI_LO), "P29");
eq("direction is not named — a crossed pair reads the same",
   T.intervalName(-7), T.intervalName(7));
eq("nor at the octave", T.intervalName(-12), "P8");

/* ---- re-pointed, 2026-07-29 ----
   The first cut of this wrote a note on every bar in the roll. Sixteen labels
   over a shape one is trying to *see* is not a drawing, so the names moved off
   the bars: the octave rules carry a pitch each, once, in the margin at the
   side of the line, and a note being placed or moved raises a line of its own
   there for a moment. The coverage below follows them; nothing was dropped. */
console.log("\n== the names, on the drawing ==");
qreset(); useRoll();
duet({0:"C4", 2:"F#3", 5:"C4"}, {0:"C3", 1:"G2", 5:"E3"});
ok("no bar carries a name of its own any more", !/barname/.test(html));
ok("and none is built with one", T.bars[0].children.length === 0 &&
   T.bars2[0].children.length === 0);
ok("the drawing is still drawn: a rest's bar is not there at all",
   T.bars[1].style.display === "none");
ok("every home rule in view is named, once",
   T.octlines.length > 0 &&
   T.octlines.every(l => l.children.length === 1 && /^C\d$/.test(l.firstChild.children[0].textContent)),
   ruleNames());
eq("this page, in C major from G2 to C4, rules C3 and C4", ruleNames(), ["C3", "C4"]);
eq("and each name sits in the margin, beside its own line",
   T.octlines.map(l => l.firstChild.className), ["octname", "octname"]);
duet({0:"C6"}, {0:"C2"});
eq("the whole range, in C major, rules every C in it",
   ruleNames(), ["C2","C3","C4","C5","C6"]);
duet({0:"C4", 2:"F#3", 5:"C4"}, {0:"C3", 1:"G2", 5:"E3"});
eq("there is one interval slot per step", T.ivls.length, 16);
eq("both voices sounding: the interval is written",
   T.ivls[0].firstChild.textContent, "P8");
ok("and the slot is shown", T.ivls[0].classList.contains("on"));
eq("the same step, in the same column", T.ivls[0].style.left, "0%");
eq("as wide as the step", T.ivls[0].style.width, "6.25%");
eq("a minor sixth, named", T.ivls[5].firstChild.textContent, "m6");
ok("only the lead sounds: nothing is named", !T.ivls[2].classList.contains("on"));
ok("only the bass sounds: nothing is named", !T.ivls[1].classList.contains("on"));
ok("neither sounds: nothing is named", !T.ivls[3].classList.contains("on"));
duet({0:"C4"}, {0:"F#3"});
eq("a tritone is named like anything else", T.ivls[0].firstChild.textContent, "TT");
duet({0:"C6"}, {0:"C2"});
eq("and the widest pair on the page compounds", T.ivls[0].firstChild.textContent, "P29");
duet({0:"C4"}, {0:"C4"});
eq("two voices on the same pitch is a unison", T.ivls[0].firstChild.textContent, "P1");
duet({0:"E3"}, {0:"C4"});
eq("the bass above the lead names the same distance",
   T.ivls[0].firstChild.textContent, "m6");
duet({15:"C4"}, {15:"C3"}, { loop:8 });
ok("past the loop, the interval is drawn back with the bars",
   T.ivls[15].classList.contains("outside") && T.bars[15].classList.contains("outside"));
duet({0:"C4"}, {0:"C3"});
ok("inside it, it is not", !T.ivls[0].classList.contains("outside"));

/* ---- re-pointed, 2026-07-29 ----
   The label used to float at the vertical midpoint between the two bars,
   attached to nothing; with the voices far apart it read as a chip in empty
   space. The slot is now the pair itself — drawn from the centre of the upper
   bar down to the centre of the lower one, with a tie of ink down its middle
   and the name riding that tie. Same text, same column, same two modifiers. */
console.log("\n== the interval belongs to the pair it names ==");
duet({0:"C4"}, {0:"C3"});
eq("the slot hangs from the centre of the upper bar", T.ivls[0].style.top, "26%");
eq("and is as tall as the distance it names", T.ivls[0].style.height, "48%");
eq("there is one tie per step", T.ivlTies.length, 16);
eq("the pair's tie is drawn down it", T.ivlTies[0].style.display, "block");
eq("and the name still rides it as the slot's first child",
   T.ivls[0].firstChild.textContent, "P8");
duet({0:"C4"}, {0:"C4"});
eq("a unison has no distance to tie across", T.ivlTies[0].style.display, "none");
eq("and the slot no height", T.ivls[0].style.height, "0%");
ok("but the pair is named all the same",
   T.ivls[0].firstChild.textContent === "P1" && T.ivls[0].classList.contains("on"));
duet({0:"E3"}, {0:"C4"});
eq("crossed, the slot still hangs from whichever note is on top",
   T.ivls[0].style.top, "34%");
eq("and is still as tall as the distance", T.ivls[0].style.height, "32%");
duet({0:"C4", 4:"G4"}, {0:"C3", 4:"C3"});
ok("a step with no pair has no tie shown", !T.ivls[1].classList.contains("on"));

console.log("\n== the names describe, and nothing more ==");
ok("no interval is ranked anywhere in the app",
   !/consonan|dissonan|harsh|clash|tense interval|good interval|bad interval/i.test(html));
/* the only modifier the label ever takes is the one the bars take: past the
   loop. Nothing sorts intervals into kinds. */
eq("the label takes only the two modifiers the bars take: shown, and past the loop",
   [...new Set(html.match(/\.ivl\.[a-z]+/g) || [])].sort(), [".ivl.on", ".ivl.outside"]);
const rollIvlSrc = (/function rollIntervals[\s\S]*?\n  \}/.exec(src) || ["" ])[0];
ok("the function that writes them exists", /el\.firstChild\.textContent = intervalName/.test(rollIvlSrc));
ok("and nothing else is ever added to the label at runtime",
   !/classList\.(add|toggle|remove)\((?!"on"|"outside")/.test(rollIvlSrc), rollIvlSrc.slice(0, 200));
const css = html.replace(/\s+/g,"");
ok("the label is drawn in the page's own ink", /\.ivl\{[^}]*color:var\(--ink\)/.test(css));
ok("and rides a dab of the page's own wash",
   /\.ivlspan\{[^}]*background-color:var\(--wash\)/.test(css));
ok("with the ruling colour for a rim, and no harder edge than that",
   /\.ivlspan\{[^}]*box-shadow:0001pxrgba\(201,188,160/.test(css));
ok("and it is a dab, not a box", /\.ivlspan\{[^}]*border-radius:999px/.test(css));
/* the tie is sixteen short vertical strokes at worst; a solid rule at every
   step would be the one pattern this page may not draw, so it is a gradient
   that has faded to nothing before it reaches either bar */
ok("the tie fades to nothing at both ends rather than ruling a line",
   /\.ivli\{[^}]*linear-gradient\(tobottom,rgba\(59,47,30,0\)0%/.test(css) &&
   /rgba\(59,47,30,0\)100%\)/.test(css));
ok("and it is a hairline, an ink wash of a quarter at its darkest",
   /\.ivli\{[^}]*width:1px/.test(css) && !/\.ivli\{[^}]*rgba\(59,47,30,0\.[4-9]/.test(css));
ok("the names in the margin are in the page's faded ink",
   /\.octname,\.gname\{[^}]*color:var\(--faded\)/.test(css));
ok("and each is off the drawing, past its left edge",
   /\.octname,\.gname\{[^}]*right:100%/.test(css));
ok("still no pure white or black anywhere", !/#fff\b|#ffffff|#000\b|#000000/i.test(html));
ok("and still nothing that blinks", !/@keyframes/.test(html));

/* ---- new, 2026-07-31: the rules sit on home ----
   The drawing always ruled C, whatever the page was in, so a piece in G major
   was read against a line that meant nothing to it. The rules now sit on the
   tonic of the page's key, at every octave in view, and each carries the word
   home under its name: the reference one can see is the note the music comes
   home to, and distance from the line is distance from home. Nothing else
   about the drawing moves — the window, the bars, the beats, the ties and the
   guide are all exactly what they were. */
console.log("\n== the home rules sit on the key's own note ==");
qreset(); useRoll();
duet({0:"C4"}, {0:"C3"});
eq("in C major the rules are the Cs, as they always were", ruleNames(), ["C3","C4"]);
duet({0:"C4"}, {0:"C3"}, { key:"G major" });
eq("the same page in G major rules the Gs instead", ruleNames(), ["G2","G3"]);
ok("and not one C is ruled", ruleNames().every(n => /^G/.test(n)), ruleNames());
duet({0:"C4"}, {0:"C3"}, { key:"A minor" });
eq("A minor comes home to A, not to its relative major's C",
   ruleNames(), ["A2","A3"]);
duet({0:"C4"}, {0:"C3"}, { key:"F# major" });
eq("a sharp tonic is ruled and named as one", ruleNames(), ["F♯2","F♯3","F♯4"]);
duet({0:"C6"}, {0:"C2"}, { key:"E minor" });
eq("the whole range rules one line per octave, on the tonic",
   ruleNames(), ["E2","E3","E4","E5"]);
/* one per octave and no more: the ruling stays as sparse as it ever was */
duet({0:"C6"}, {0:"C2"});
const wideC = ruleNames().length;
duet({0:"C6"}, {0:"C2"}, { key:"B major" });
ok("no key rules more lines than C major did", ruleNames().length <= wideC,
   [wideC, ruleNames()]);

console.log("\n== each rule says its pitch, and what that pitch is ==");
duet({0:"G4"}, {0:"G3"}, { key:"G major" });
eq("every rule carries a name and a marker, in that order",
   T.octlines.map(l => l.firstChild.children.map(c => c.className)),
   T.octlines.map(() => ["opn", "ohome"]));
eq("the marker says home, once per line", ruleHomes(),
   T.octlines.map(() => "home"));
eq("and the name is still the pitch the tool would write",
   ruleNames(), ["G3","G4"]);
eq("both words are inside the one label K takes away",
   T.octlines.map(l => l.firstChild.className), ["octname", "octname"]);
const homeRule = T.octlines[T.octlines.length - 1];
const halfStep = parseFloat(homeRule.style.top) - parseFloat(T.bars[0].style.top);
ok("the rule runs through the middle of a note that lands on it",
   Math.abs(halfStep * 2 - parseFloat(T.bars[0].style.height)) < 1e-9,
   [homeRule.style.top, T.bars[0].style.top, T.bars[0].style.height]);
ok("the marker is the page's own gilt, not a new colour",
   /\.octname\.ohome\{[^}]*color:var\(--gilt\)/.test(css));
ok("and it is smaller than the name it hangs under, and quieter",
   /\.octname\.ohome\{[^}]*font-size:0\.9em/.test(css) &&
   /\.octname\.ohome\{[^}]*opacity:0\.72/.test(css));
ok("the rules themselves are no louder than they ever were — a hairline at 0.55",
   /\.octline\{[^}]*height:1px/.test(css) &&
   /\.octline\{[^}]*background:rgba\(201,188,160,0\.55\)/.test(css));
ok("and the guide's name is still a name alone, with no marker on it",
   T.guideName.children.length === 0);

console.log("\n== the key moves the rules, there and then ==");
qreset(); useRoll();
duet({0:"C4"}, {0:"C3"});
const barsBefore = T.bars.map(b => [b.style.top, b.style.height, b.style.display]);
eq("C major, before anything is touched", ruleNames(), ["C3","C4"]);
T.shiftTonic(2);
eq("the key moved to D major", T.doc.key, "D major");
eq("and the rules moved with it, without a redraw of anything else",
   ruleNames(), ["D3","D4"]);
eq("the bars did not move a hair",
   T.bars.map(b => [b.style.top, b.style.height, b.style.display]), barsBefore);
eq("and nothing was written into the page", [T.doc.steps[0], T.doc.bass[0]], ["C4","C3"]);
T.toggleKeyMode();
eq("major to minor keeps the same home", T.doc.key, "D minor");
eq("so the rules stay where they are", ruleNames(), ["D3","D4"]);
T.shiftTonic(-2);
eq("and back to C", ruleNames(), ["C3","C4"]);
/* the marker travels with them */
eq("the marker is still under every name", ruleHomes(), ["home","home"]);
/* a workspace arrives in its own key, and is drawn against its own home */
closePages(); T.resetQuests(); reset(); useRoll();
T.switchWorkspace("ladder");
eq("the ladder's page arrives in its seeded key", T.doc.key, "G major");
ok("and its empty page is ruled on G", ruleNames().every(n => /^G/.test(n)), ruleNames());
T.switchWorkspace("whitespace");
eq("white space is seeded in A minor", T.doc.key, "A minor");
ok("so its page is ruled on A", ruleNames().every(n => /^A/.test(n)), ruleNames());
T.switchWorkspace(null);
ok("free play is C major and ruled on C",
   T.doc.key === "C major" && ruleNames().every(n => /^C/.test(n)), ruleNames());
closePages(); T.resetQuests(); qreset();

/* ---- new, 2026-07-29: the pitch in hand ----
   The bars no longer say what they are, so the moment of placing or moving a
   note does: a line is drawn across the roll at that pitch, parallel to the
   octave rules and named in the same margin, and then let go of. */
console.log("\n== the pitch in hand raises a line of its own ==");
qreset(); useRoll();
ok("the guide is a line of the drawing's own, built down",
   /rollGuide\.className = "rollguide";/.test(src) &&
   T.rollGuide.classList.contains("rollguide"));
eq("its name is drawn in the same margin", T.guideName.className, "gname");
T.rollGuide.classList.remove("on");        /* whatever the sections above left up */
ok("and nothing but writing raises it", !T.rollGuide.classList.contains("on"));
T.cursor = 0; T.baseOctave = 4;
key("KeyZ");
ok("placing a note raises it", T.rollGuide.classList.contains("on"));
eq("at that note's own pitch", T.guideMidi, 60);
eq("named as the octave rules are named", T.guideName.textContent, "C4");
key("KeyD");
eq("the next note takes it with it, sharp and all", T.guideName.textContent, "D♯4");
eq("and the line follows the pitch", T.guideMidi, 63);
T.cursor = 0;
T.nudge(1);
eq("nudging the note under the cursor moves it too", T.guideName.textContent, "D4");
ok("and it is still up", T.rollGuide.classList.contains("on"));
eq("nothing of it is written into the page", T.doc.steps[0], "D4");
duet({0:"C4"}, {0:"C3"});
T.showGuide(60);
eq("the line is laid where this drawing puts that pitch — the bar's own centre",
   T.rollGuide.style.top, "26%");
T.showGuide(48);
eq("and moves with the pitch it is given", T.rollGuide.style.top, "74%");
/* it lets go of itself: the hold, then the fade the stylesheet does. A
   transition, never an animation — nothing on this page may blink. */
ok("the hold is about a second", T.GUIDE_HOLD >= 800 && T.GUIDE_HOLD <= 2000, T.GUIDE_HOLD);
ok("and it takes the line down by itself",
   /guideTimer = setTimeout\(function\(\)\{[\s\S]{0,120}rollGuide\.classList\.remove\("on"\)/.test(src));
ok("the arrival is gentle and the fade slow",
   /\.rollguide\{[^}]*transition:opacity1\.1s/.test(css) &&
   /\.rollguide\.on\{[^}]*transition:opacity0\.22s/.test(css));
ok("the guide is a hairline of ink, not a wall",
   /\.rollguide\{[^}]*height:1px/.test(css) &&
   /\.rollguide\{[^}]*background:rgba\(59,47,30,0\.3/.test(css));
ok("and it answers no key of its own — it is raised by writing, and nothing else",
   !/showGuide/.test(src.slice(src.indexOf("document.addEventListener(\"keydown\""))));

console.log("\n== K puts the names away ==");
qreset(); useRoll();
duet({0:"C4"}, {0:"C3"});
ok("they are on to begin with", T.showNames === true);
ok("and the roll is not marked otherwise", !T.rollEl.classList.contains("nonames"));
key("KeyK");
ok("K puts them away", T.showNames === false);
ok("the roll says so, and only the roll", T.rollEl.classList.contains("nonames"));
eq("the preference is kept, not the document", store[T.NAMES_KEY], "off");
ok("the mark takes all three away together — the rules', the guide's, the intervals'",
   /\.roll\.nonames\.octname,\.roll\.nonames\.gname,\.roll\.nonames\.ivl\{display:none;?\}/.test(css));
ok("and the lines themselves stay: it is the names that go, not the drawing",
   !/\.roll\.nonames\.octline/.test(css) && !/\.roll\.nonames\.rollguide/.test(css));
eq("the home rules are still ruled and still named underneath",
   ruleNames().length > 0, true);
eq("and nothing was written into the page", T.doc.steps[0], "C4");
eq("the interval is still computed underneath",
   T.ivls[0].firstChild.textContent, "P8");
ok("the footer said so", /names/.test(ids.footer.textContent), ids.footer.textContent);
key("KeyK");
ok("K brings them back", T.showNames === true);
ok("and the mark is gone", !T.rollEl.classList.contains("nonames"));
eq("the preference again", store[T.NAMES_KEY], "on");
ok("K is not a note key", !("KeyK" in T.NOTE_KEYS));
T.cursor = 0;
key("KeyK");
eq("and never moves the cursor", T.cursor, 0);
key("KeyK");
/* the pages own the keyboard while they are up, as they always have */
T.toggleKeyref();
const namesWere = T.showNames;
key("KeyK");
eq("K is inert while the key page is up", T.showNames, namesWere);
T.toggleKeyref();
T.toggleQuests();
key("KeyK");
eq("and while the quest log is up", T.showNames, namesWere);
T.toggleQuests();
qreset();

console.log("\n== the key page documents the names ==");
ok("K has a row of its own", /<dt>K<\/dt>/.test(keyPage));
ok("it says what it does", /the names on the drawing/.test(keyPage));
ok("and that they start on", /They are on to begin with/.test(keyPage));
ok("the octave convention is written down",
   /C4 is middle C/.test(keyPage) && /C2 to C6/.test(keyPage));
ok("it says the names are in the margin, not on the bars",
   /named once, at the side of its line/.test(keyPage));
ok("it says what placing or moving a note raises",
   /Place a note, or move one/.test(keyPage) && /holds for a moment and then fades/.test(keyPage));
ok("and it says the interval is tied to its pair",
   /hairline tie/.test(keyPage) && /belongs to that pair of notes/.test(keyPage));
ok("K's own row lists all three", /the home rules' names in the margin, the guide's/.test(keyPage));
ok("the page says the ruled line is home, and that it follows the key",
   /home note of the page/.test(keyPage) && /the tonic of its key/.test(keyPage) &&
   /they move the moment the key does/.test(keyPage));
ok("and it says what that buys: distance from the line is distance from home",
   /how far a note sits from it is how far it is from home/.test(keyPage));
ok("with the three keys spelled out",
   /in C major those rules are the Cs, in G major the Gs, in A minor the As/.test(keyPage));
ok("the simple interval names are listed",
   /P1, m2, M2, m3, M3, P4, TT, P5, m6, M6, m7, M7, P8/.test(keyPage));
ok("the compound convention is named and shown",
   /compound name/.test(keyPage) && /m10/.test(keyPage) && /P15/.test(keyPage));
ok("the tritone's compound is spelled out", /TT11/.test(keyPage));
ok("direction is said not to be named", /never the direction/.test(keyPage));
ok("and the page says plainly that it judges nothing",
   /Nothing here judges/.test(keyPage) && /for the ear/.test(keyPage));

/* ---- the names and the pad's own mode, in one page ----
   Start hands the d-pad the workspace rail; the names are a preference of the
   drawing. Neither knows about the other, and that is what is checked here:
   walking the rail must leave the names exactly as it found them, and the
   workspace it walks into must be drawn with its own names and its own
   intervals, computed from the page that arrived. */
console.log("\n== the names and the settings crossbar do not touch ==");
closePages(); T.resetDrills(); T.resetQuests(); reset(); useRoll();
duet({0:"C4", 4:"G4"}, {0:"C3", 4:"C3"});
const namesBefore = T.showNames;
eq("the interval is named before the pad is touched", T.ivls[0].firstChild.textContent, "P8");
press(GP.START);
ok("start raises the mode", ids.settings.classList.contains("on"));
eq("the names are untouched by raising it", T.showNames, namesBefore);
ok("and the drawing stands down whole, as it always has",
   !ids.roll.classList.contains("on") && ids.column.style.display === "none");
ok("nothing about the names was written into the mode",
   T.SETTINGS.every(s => !/name/i.test(s.label)), T.SETTINGS.map(s => s.label));
press(GP.DD);
eq("walking the rail arrives in the first workspace", T.qActive, T.QUESTS[0].id);
eq("and leaves the names exactly as they were", T.showNames, namesBefore);
press(GP.START);
ok("the mode put down, the drawing is back", ids.roll.classList.contains("on"));
ok("and the roll is not marked nameless", !T.rollEl.classList.contains("nonames"));
duet({0:"E4"}, {0:"C4"});
eq("the workspace walked into names its own interval",
   T.ivls[0].firstChild.textContent, "M3");
eq("and is ruled and named for its own pitches", ruleNames(), ["C4", "C5"]);
key("KeyK");
ok("K still answers after all of that", T.rollEl.classList.contains("nonames"));
eq("and the interval is still computed underneath",
   T.ivls[0].firstChild.textContent, "M3");
key("KeyK");
ok("and back", !T.rollEl.classList.contains("nonames"));
closePages(); T.resetQuests(); qreset();

console.log("\n== the page of the key documents both ==");
ok("the tempo has a row on the keyboard side", /the tempo, down and up by four/.test(html));
ok("and on the gamepad side", /the tempo, up and down by four/.test(html));
ok("the range is written down", /60&ndash;180/.test(html));
ok("the fine step is written down", /with shift, by one/.test(html) && /hold L1 or R1 for one/.test(html));
ok("and the pre-tuned quests are explained quietly",
   /arrives already tuned/.test(html));
ok("no rite survives anywhere in the app", !/\brite\b/i.test(html));
ok("nothing new blinks or animates",
   !/@keyframes/.test(html) && !/animation:(?!none)/.test(html));

console.log("\n== the spec says both ==");
ok("the spec has a tempo section", /## The tempo/.test(spec));
ok("it marks the L0 no-tempo-UI clause superseded",
   /SUPERSEDED/.test(spec) && /No tempo UI/.test(spec));
ok("it keeps the original clause as history", /costs nothing but shame/.test(spec));
ok("it has the seeded-workspaces section", /Seeded quest keys/.test(spec));
ok("with the whole table in it",
   Q.every(q => new RegExp("`" + q.id + "`").test(spec)));
ok("and the bindings table", /the two keys left of backspace/.test(spec));

console.log("\n== drills, documented ==");
ok("the key page has a line about drills", /under their own tab, sit the drills/.test(keyPage));
ok("it says they arrive without a reload", /without a reload/.test(keyPage));
ok("the divider has a style of its own", /\.qhair\{/.test(html) && /\.rhair\{/.test(html));
ok("the poll interval is written down", /POLL_MS = 10000/.test(html));
ok("the merge is narrow, and says so", /never seen\s*\(or has only as a ghost\)/.test(html));
ok("the spec has the section", /## Drill quests and live delivery/.test(spec));
ok("with the schema", /"drills": \[/.test(spec) && /"drill-itch"/.test(spec));
ok("the merge rule", /and nothing else, ever/.test(spec));
ok("the ETag", /ETag/.test(spec) && /If-None-Match/.test(spec));
ok("and the server-side preservation", /keeps any\s*\n?drill whose id the incoming body does not mention/.test(spec));
const diskLog = JSON.parse(fs.readFileSync(REPO + "/quests/quest-log.json","utf8"));
ok("the committed log carries the first drill",
   Array.isArray(diskLog.drills) && diskLog.drills.some(d => d.id === "drill-itch"));
const itchOnDisk = (diskLog.drills || []).find(d => d.id === "drill-itch") || {};
eq("with its key", itchOnDisk.pattern && itchOnDisk.pattern.key, "F major");
eq("its tempo", itchOnDisk.pattern && itchOnDisk.pattern.tempo, 104);
eq("its loop", itchOnDisk.pattern && itchOnDisk.pattern.loop, 8);
eq("and the rising scale it loops",
   itchOnDisk.pattern && itchOnDisk.pattern.steps.slice(0,8),
   ["F4","G4","A4","A#4","C5","D5","E5","F5"]);
ok("its summary is one line", /rank each ender/.test(itchOnDisk.summary || ""));
ok("and it teaches tendency tones", /tendency tones/.test(itchOnDisk.teaches || ""));
ok("the user's own melodies are still in the file",
   diskLog.folio === "quest-log" && diskLog.quests &&
   Object.keys(diskLog.quests).length >= 5, Object.keys(diskLog.quests || {}));
ok("and the app reads that file back whole", T.applyState(diskLog));
ok("with the drill in the list", T.drillById("drill-itch") !== null);
qreset();

/* ================= scenery: the quiet background ================= */
console.log("\n== scenery ==");
ok("the scenery ring is paper, forest, sea, quest",
   JSON.stringify(T.SCENERIES) === '["paper","forest","sea","quest"]', T.SCENERIES);
eq("paper is the default", document.body.getAttribute("data-scenery"), "paper");
key("KeyB", { shiftKey:true });
eq("shift+B walks to the forest", document.body.getAttribute("data-scenery"), "forest");
eq("and the preference is kept under its own key", store[T.SCENERY_KEY], "forest");
key("KeyB", { shiftKey:true });
eq("then to the sea", document.body.getAttribute("data-scenery"), "sea");
key("KeyB", { shiftKey:true });
/* the fourth is the workspace's own picture: the preference is quest, and in
   free play — which has no picture and never will — the body stays on paper */
eq("then to the workspace's own", store[T.SCENERY_KEY], "quest");
eq("which in free play is still paper", document.body.getAttribute("data-scenery"), "paper");
key("KeyB", { shiftKey:true });
eq("and home to paper — a ring", document.body.getAttribute("data-scenery"), "paper");
eq("the preference came home too", store[T.SCENERY_KEY], "paper");
key("KeyB");
eq("bare B is still a note, not the background", document.body.getAttribute("data-scenery"), "paper");
eq("(the G it has always been)", T.doc.steps[T.cursor - 2], "G4");
T.setScenery("attic");
eq("an unknown scene falls back to paper", document.body.getAttribute("data-scenery"), "paper");
ok("the scenery is a preference, not part of the page",
   T.exportJSON().indexOf("scenery") < 0 && JSON.stringify(T.stateToJSON()).indexOf("scenery") < 0);
T.setScenery("paper");

/* ================= the board, read one lesson at a time =================
   Tabs, favourites, the player's own order, and the standing hint under the
   footer. Everything here is keyboard-first and everything persistent is an
   optional field on a log that reads exactly as it always did without it. */
const L2A = { id:"l2-shadow-x", name:"⚔ a lesson two quest", lesson:2,
  summary:"declared, so it needs no table", teaches:"nothing",
  pattern:{ version:1, title:"two", tempo:100, loop:16, key:"A minor", steps: blank() } };
const L3A = { id:"l3-hold", name:"⚔ a lesson three quest", lesson:3,
  summary:"a lesson that does not exist in this file yet", teaches:"nothing",
  pattern:{ version:1, title:"three", tempo:100, loop:16, key:"A minor", steps: blank() } };
const KNOWN2 = { id:"shadow", name:"⚔ the shadow",
  summary:"the board delivered before there was a field for it", teaches:"nothing",
  pattern:{ version:1, title:"shadow", tempo:100, loop:16, key:"B minor", steps: blank() } };
const SWORDLESS = { id:"drill-pull", name:"the pull drill",
  summary:"an étude, not a quest", teaches:"nothing", pattern:null };
function tabLabels(){ return T.tabList().map(T.tabLabel); }
function questIndex(id){ return T.ALL.findIndex(q => q.id === id); }

console.log("\n== the quest board is read one lesson at a time ==");
qreset();
eq("the eight alone are one tab", tabLabels(), ["L1"]);
eq("and the tab holds all eight", T.viewOf(1).length, 8);
eq("a built-in is Lesson 1 by being built in", T.questGroup(T.ALL[0]), 1);

T.applyState(logWith([ITCH]));
eq("a drill with no sword is an étude", T.questGroup(T.ALL[questIndex("drill-itch")]), 0);
eq("and takes the last tab", tabLabels(), ["L1","drills"]);

T.applyState(logWith([L2A]));
eq("a drill that declares its lesson gets that tab", tabLabels(), ["L1","L2"]);
eq("and is grouped by it", T.questGroup(T.ALL[questIndex("l2-shadow-x")]), 2);

T.applyState(logWith([KNOWN2]));
eq("the Lesson 2 board is placed without a declaration", tabLabels(), ["L1","L2"]);
eq("by the table in the file", T.LESSON_OF.shadow, 2);

T.applyState(logWith([L2A, SWORDLESS]));
eq("sword and no sword sort apart", tabLabels(), ["L1","L2","drills"]);
eq("the étude is in the last tab", T.viewOf(0).map(i => T.ALL[i].id), ["drill-pull"]);

/* the point of the whole exercise: Lesson 3 needs no surgery here */
T.applyState(logWith([L2A, L3A]));
eq("a Lesson 3 quest brings a Lesson 3 tab with it", tabLabels(), ["L1","L2","L3"]);
eq("in order, lessons first and the drills last",
   (T.applyState(logWith([L3A, SWORDLESS, L2A])), tabLabels()), ["L1","L2","L3","drills"]);
eq("an unlabelled sword joins the newest lesson known",
   T.questGroup({ id:"nobody", name:"⚔ a quest from the future", drill:true }), 3);
eq("and the newest lesson is read off the board", T.newestLesson(), 3);

console.log("\n== the tabs, from the keyboard ==");
qreset(); T.applyState(logWith([L2A, SWORDLESS]));
T.setTab(1, true);
key("F3");
eq("the strip draws one tab per lesson", T.qtabsEl.children.length, 3);
eq("the one in hand is marked", T.qtabsEl.children[0].className, "qtab on");
eq("and the others are not", T.qtabsEl.children[1].className, "qtab");
eq("each tab says how many are in it",
   T.qtabsEl.children.map(c => c.children[1].textContent), [" 8", " 1", " 1"]);
key("ArrowRight");
eq("right turns to the next lesson", T.activeTab, 2);
eq("and the caret lands on its first quest", T.ALL[T.qsel].id, "l2-shadow-x");
eq("the list shows that lesson and nothing else",
   T.qlistEl.children.map(c => c.children[2].textContent), ["a lesson two quest"]);
key("ArrowRight");
eq("right again is the drills", T.activeTab, 0);
key("ArrowRight");
eq("and right once more wraps home", T.activeTab, 1);
key("ArrowLeft");
eq("left wraps the other way", T.activeTab, 0);
eq("the tab is a preference kept under its own key", store[T.TAB_KEY], "0");
ok("and never part of the log",
   JSON.stringify(T.stateToJSON()).indexOf("qtab") < 0 &&
   JSON.stringify(T.stateToJSON()).indexOf("activeTab") < 0);
T.setTab(1, true);
eq("the caret wraps inside its own tab", (key("ArrowUp"), T.ALL[T.qsel].id), T.ALL[7].id);
eq("and never walks out of it", T.questGroup(T.ALL[T.qsel]), 1);
key("ArrowDown");
eq("down wraps back to the head", T.qsel, 0);
/* the bumpers do on the pad what left and right do on the board */
press(GP.R1);
eq("R1 turns the lesson", T.activeTab, 2);
press(GP.L1);
eq("and L1 turns it back", T.activeTab, 1);
key("F3");

console.log("\n== choosing from the margin brings the lesson forward ==");
qreset(); T.applyState(logWith([L2A]));
T.setTab(1, true);
T.switchWorkspace("l2-shadow-x");
eq("the caret followed the workspace", T.ALL[T.qsel].id, "l2-shadow-x");
eq("and its lesson came forward with it", T.activeTab, 2);

console.log("\n== a quest kept to hand ==");
qreset(); key("F3");
eq("nothing is kept to hand to begin with", T.qsel, 0);
ok("and the row carries no mark", !T.qrowsNow[0].fav.textContent);
key("KeyF");
ok("F keeps it to hand", T.favOf(Q[0].id));
eq("the row says so", T.qrowsNow[0].fav.textContent, "✦");
ok("and the page says so", /kept to hand/.test(ids.qdstate.textContent), ids.qdstate.textContent);
key("KeyF");
ok("F again lets it go", !T.favOf(Q[0].id));
eq("and the mark goes with it", T.qrowsNow[0].fav.textContent, "");
/* a favourite is pinned to the head of its own tab */
T.qsel = 5; T.renderQuests(); key("KeyF");
eq("a favourite goes to the head of its lesson", T.view()[0], 5);
eq("with the rest behind it in the order they were", T.view().slice(1), [0,1,2,3,4,6,7]);
eq("the list draws a hairline where the run changes", hairs(T.qlistEl, "qhair"), 1);
eq("labelled with the lesson it goes back to",
   T.qlistEl.children.find(c => c.className === "qhair").children[0].textContent, "L1");
/* and to the head of the margin, whatever lesson it came from */
eq("the margin puts the favourites first", T.railSections()[0].label, "favourites");
eq("with that quest in them", T.railSections()[0].idx, [5]);
eq("the pad walks the margin in the same order", T.railOrder()[1], Q[5].id);
eq("and a divider names the run below", hairs(T.railEl, "rhair"), 1);
/* it rides out with the log, and only where it was made */
const favJSON = T.stateToJSON();
eq("the mark rides out with the quest", favJSON.quests[Q[5].id].fav, true);
ok("and nowhere it was not made",
   Object.keys(favJSON.quests).every(id => id === Q[5].id || favJSON.quests[id].fav === undefined),
   favJSON.quests);
ok("a log applied back keeps it", (T.applyState(favJSON), T.favOf(Q[5].id)));
/* □ is the same thing on the pad */
T.qsel = 2; T.renderQuests();
ok("the pad's quest is not kept to hand yet", !T.favOf(Q[2].id));
press(GP.SQ);
ok("□ keeps the chosen quest to hand", T.favOf(Q[2].id));
press(GP.SQ);
ok("and □ again lets it go", !T.favOf(Q[2].id));
/* △ held turns the d-pad from a step into a move */
T.qsel = 1; T.renderQuests();
const beforeCarry = T.view().slice();
frame([GP.TR, GP.DU]); frame([]);
ok("△ held, d-pad up carries the quest with the caret",
   JSON.stringify(T.view()) !== JSON.stringify(beforeCarry), [beforeCarry, T.view()]);
eq("and the caret is still on it", T.qsel, 1);
key("F3");

console.log("\n== moving a quest, and it staying put ==");
qreset(); key("F3");
eq("the board starts in the order it was written", T.view(), [0,1,2,3,4,5,6,7]);
T.qsel = 0; T.renderQuests();
key("ArrowDown", { shiftKey:true });
eq("shift and down move the quest, not the caret", T.view(), [1,0,2,3,4,5,6,7]);
eq("and the caret went with it", T.qsel, 0);
key("ArrowUp", { shiftKey:true });
eq("shift and up bring it back", T.view(), [0,1,2,3,4,5,6,7]);
key("ArrowUp", { shiftKey:true });
eq("at the head it refuses rather than wrapping", T.view(), [0,1,2,3,4,5,6,7]);
ok("and says so", /already at the head/.test(ids.footer.textContent), ids.footer.textContent);
T.qsel = 7; T.renderQuests();
key("ArrowDown", { shiftKey:true });
ok("at the foot too", /already at the foot/.test(ids.footer.textContent), ids.footer.textContent);
/* the hairline is not crossed by being nudged */
T.qsel = 3; T.renderQuests(); key("KeyF");
eq("a favourite heads the list", T.view()[0], 3);
key("ArrowUp", { shiftKey:true });
eq("and cannot be nudged above itself", T.view()[0], 3);
T.qsel = 0; T.renderQuests();
key("ArrowUp", { shiftKey:true });
eq("nor can the first of the rest climb over the favourites", T.view(), [3,0,1,2,4,5,6,7]);
ok("the quest is still where it was, under the hairline", T.view()[1] === 0);
/* the order rides out and back */
T.qsel = 5; T.renderQuests();
key("ArrowUp", { shiftKey:true });
const ordJSON = T.stateToJSON();
const moved = T.view().slice();
ok("an order is written for the run that was moved",
   Object.keys(ordJSON.quests).some(id => typeof ordJSON.quests[id].order === "number"));
T.applyState(ordJSON);
eq("and the board comes back arranged", T.view(), moved);
key("F3");

console.log("\n== a log that knows neither mark ==");
qreset();
ok("an untouched board applies", T.applyState(logWith([])));
const plainJSON = T.stateToJSON();
ok("and writes neither field anywhere",
   JSON.stringify(plainJSON).indexOf('"fav"') < 0 &&
   JSON.stringify(plainJSON).indexOf('"order"') < 0, plainJSON);
ok("a quest with neither mark and no page is still not written",
   Object.keys(plainJSON.quests || {}).length === 0, plainJSON.quests);
T.applyState({ folio:"quest-log", version:2, active:null, quests:{
  ladder:{ done:true, pattern:null } } });
ok("an older log reads clean", T.qState.ladder.done === true);
ok("with nothing kept to hand", !T.favOf("ladder"));
eq("and no order imposed", T.qState.ladder.order, null);
/* the lesson a drill declares survives the round trip */
T.applyState(logWith([L3A]));
const lessonJSON = T.stateToJSON();
eq("a declared lesson rides out with the definition", lessonJSON.drills[0].lesson, 3);
ok("and a definition that declares none writes none",
   (T.applyState(logWith([ITCH])), T.stateToJSON().drills[0].lesson === undefined));

console.log("\n== the standing hint under the footer ==");
qreset(); closePages();
ok("there is a hint strip", !!T.hintsEl);
ok("and it is never empty", T.hintsEl.children.length > 0);
function hintText(){ return T.hintsNow().map(h => h[0] + " " + h[1]).join(" · "); }
ok("on the page it names what writes a note", /notes/.test(hintText()), hintText());
ok("and the way out to the key", /F1 the key/.test(hintText()), hintText());
T.setRelative(true);
ok("in relative entry it names the shapes instead",
   /up, down, again, rest/.test(hintText()) && !/z…m/.test(hintText()), hintText());
T.setRelative(false);
key("F3");
ok("in the quest log it names the lesson keys", /← → lesson/.test(hintText()), hintText());
ok("and the two marks", /F keep to hand/.test(hintText()) && /move it/.test(hintText()), hintText());
key("F3"); key("F1");
ok("on the key page it names the key and the tempo",
   /the tonic/.test(hintText()) && /tempo/.test(hintText()), hintText());
key("F1");
T.toggleSettings();
ok("on the crossbar it names the crossbar", /workspace/.test(hintText()), hintText());
T.closeSettings();
ok("nothing in it is a letter a keyboard prints rather than a place",
   !/[A-Z]{4,}/.test(hintText()), hintText());
ok("it holds its height so nothing on the page moves",
   /\.hints\{[\s\S]*?min-height:/.test(html));
ok("and it is quieter than the footer above it",
   /\.hints\{[\s\S]*?opacity:0\.78/.test(html));
ok("the footer and the hint take one scrim between them",
   /\.foot\{/.test(html) && /body:not\(\[data-scenery="paper"\]\) \.foot::before/.test(html));

console.log("\n== the workspace's own scenery ==");
qreset();
eq("the picture is named after the quest",
   T.questBgUrl("shadow"), "quest-backgrounds/shadow.png");
ok("an id with anything odd in it is escaped",
   T.questBgUrl("a b").indexOf(" ") < 0, T.questBgUrl("a b"));
T.setScenery("quest", true);
eq("free play has no picture and stays on paper",
   document.body.getAttribute("data-scenery"), "paper");
T.switchWorkspace("stray");
eq("nor does a workspace whose picture cannot be had",
   document.body.getAttribute("data-scenery"), "paper");
/* the answer, once it is known, is what the body wears */
T.bgKnown["stray"] = true; T.applyScenery();
eq("and one whose picture is there wears it",
   document.body.getAttribute("data-scenery"), "quest");
T.switchWorkspace(null);
eq("stepping back to free play puts the paper back",
   document.body.getAttribute("data-scenery"), "paper");
T.setScenery("paper", true);
ok("the scene is still a preference and never part of the log",
   JSON.stringify(T.stateToJSON()).indexOf("quest-backgrounds") < 0);
ok("the rule reads the picture off the body, naming nothing",
   /body\[data-scenery="quest"\]\{[\s\S]*?var\(--questbg\)/.test(html));
ok("and veils it, as the other two scenes are veiled",
   /body\[data-scenery="quest"\]\{[\s\S]*?linear-gradient\(rgba/.test(html));
ok("the margins and the title take their scrim there too — the selector is by absence",
   /body:not\(\[data-scenery="paper"\]\) \.rail\{/.test(html));
ok("the server lends exactly one folder and no more",
   /STATIC_DIRS = \["quest-backgrounds"\]/.test(fs.readFileSync(REPO + "/server.mjs","utf8")));
ok("and still resolves what it serves back to that folder",
   /path\.dirname\(path\.resolve\(file\)\) !== path\.resolve\(dir\)/
     .test(fs.readFileSync(REPO + "/server.mjs","utf8")));
ok("the deploy takes the stills with it",
   /quest-backgrounds/.test(fs.readFileSync(REPO + "/scripts/build.mjs","utf8")));

console.log("\n== the new furniture keeps the house rules ==");
ok("the tabs are words under a hairline, not boxes",
   /\.qtabs\{/.test(html) && !/\.qtab\{[^}]*border:1px solid var\(--rule\)/.test(html));
ok("the one in hand is marked as the voice in hand is",
   /\.qtab\.on\{color:var\(--ink\);border-bottom-color:var\(--gilt\);\}/.test(html));
ok("still nothing that blinks", !/@keyframes/.test(html));
ok("still no pure white or black", !/#fff\b|#ffffff|#000\b|#000000/i.test(html));
ok("and still no repeating pattern anywhere",
   !/repeating-linear-gradient|background-repeat:repeat/.test(html));
qreset(); closePages();


/* ================= Lesson 3: the held note =================
   What is pinned here is the model and the input semantics — how long a note
   is written to be, how long it is actually heard for, what happens at the
   seam, what each binding does to the page, and what survives a trip through
   a file in both directions. How any of it is drawn is verified in a real
   browser with real screenshots instead. */
console.log("\n== the length beside the note ==");
reset();
const fresh3 = T.validate({ version:1, title:"t", tempo:112, loop:16, key:"C major",
                            steps: blank() });
eq("a fresh page holds a length for every step", fresh3.hold.length, 16);
ok("and every one of them is the plain sixteenth", fresh3.hold.every(n => n === 1));
eq("the second voice has its own", fresh3.basshold.length, 16);
ok("a page that arrived without them grows them on first touch",
   T.vhold(0).length === 16 && T.vhold(1).length === 16);
eq("the two fields are named beside the two voices", T.VOICE_HOLD, ["hold","basshold"]);

page({ 0:"C4" });
eq("a note written is one step long", T.writtenLen(T.doc, 0, 0), 1);
eq("and sounds for one step", T.spanOf(T.doc, 0, 0), 1);
eq("an empty step is no note at all", T.spanOf(T.doc, 0, 1), 0);
T.setLen(0, 0, 4, true);
eq("made four steps long, it is written as four", T.writtenLen(T.doc, 0, 0), 4);
eq("and sounds for four", T.spanOf(T.doc, 0, 0), 4);
eq("over its own step and the three after it", T.spanSteps(T.doc, 0, 0), [0,1,2,3]);
eq("which is where the ear finds it", T.sounding(T.doc, 0).slice(0, 6),
   [0,0,0,0,-1,-1]);

console.log("\n== a line is one line ==");
page({ 0:"C4" });
T.setLen(0, 0, 8, true);
eq("a hold is made eight steps long", T.writtenLen(T.doc, 0, 0), 8);
/* and then a note is written into the middle of it */
T.cursor = 2; key("KeyC");
eq("the note lands", T.doc.steps[2], "E4");
eq("the hold is still written as eight", T.writtenLen(T.doc, 0, 0), 8);
eq("but is heard only as far as the next note of its own voice",
   T.spanOf(T.doc, 0, 0), 2);
T.cursor = 2; key("Period");
eq("take that note away again and the hold rings its full length once more",
   T.spanOf(T.doc, 0, 0), 8);
eq("nothing was rewritten behind it", T.writtenLen(T.doc, 0, 0), 8);
/* asking for more than there is room for is simply capped */
page({ 0:"C4", 2:"E4" });
T.setLen(0, 0, 8, true);
eq("a length asked for over a neighbour stops at the neighbour",
   T.writtenLen(T.doc, 0, 0), 2);

console.log("\n== ringing across the seam ==");
page({ 14:"G4" });
T.setLen(0, 14, 4, true);
eq("a note held past the last step comes round with the loop",
   T.spanSteps(T.doc, 0, 14), [14,15,0,1]);
page({ 0:"C4", 14:"G4" });
T.setLen(0, 14, 4, true);
eq("unless the head of the page is taken", T.spanOf(T.doc, 0, 14), 2);
page({ 6:"A4" }, { loop:8 });
T.setLen(0, 6, 4, true);
eq("the seam is the loop's, not the page's", T.spanSteps(T.doc, 0, 6), [6,7,0,1]);
page({ 12:"A4" }, { loop:8 });
T.setLen(0, 12, 8, true);
eq("a note written past the loop never wraps - it stops at the page's end",
   T.spanSteps(T.doc, 0, 12), [12,13,14,15]);
page({ 0:"C4" });
T.setLen(0, 0, 16, true);
eq("one note alone may fill the whole loop", T.spanOf(T.doc, 0, 0), 16);
page({ 0:"C4" }, { loop:4 });
T.setLen(0, 0, 16, true);
eq("and no more than the loop it is in", T.spanOf(T.doc, 0, 0), 4);

console.log("\n== the two keys left of backspace ==");
reset();
key("KeyZ");                          /* C4 at step 1, cursor on 3 */
T.cursor = 0;
key("Equal");
eq("+ makes the note under the cursor longer", T.writtenLen(T.doc, 0, 0), 2);
key("Equal"); key("Equal");
eq("and again, a step at a time", T.writtenLen(T.doc, 0, 0), 4);
eq("without moving the cursor", T.cursor, 0);
key("Minus");
eq("- makes it shorter", T.writtenLen(T.doc, 0, 0), 3);
key("Minus"); key("Minus"); key("Minus");
eq("and never shorter than the step it begins on", T.writtenLen(T.doc, 0, 0), 1);
key("Equal", { shiftKey:true });
eq("shift and + take it as far as it will go", T.writtenLen(T.doc, 0, 0), 16);
key("Minus", { shiftKey:true });
eq("shift and - put it back to a plain sixteenth", T.writtenLen(T.doc, 0, 0), 1);

page({ 0:"C4", 8:"E4" });
T.cursor = 0; key("Equal", { shiftKey:true });
eq("as far as it will go is as far as the next note", T.writtenLen(T.doc, 0, 0), 8);
T.cursor = 4; key("Minus");
eq("the length is edited from any step the note is sounding on",
   T.writtenLen(T.doc, 0, 0), 7);
T.cursor = 12; key("Equal");
eq("an empty step has nothing to hold", T.writtenLen(T.doc, 0, 12), 0);
ok("and says so", /nothing to hold/.test(ids.footer.textContent), ids.footer.textContent);
page({ 0:"C4" }); T.setVoice(1); T.cursor = 0;
key("Equal");
eq("the length belongs to the voice in hand", T.writtenLen(T.doc, 0, 0), 1);
T.setVoice(0);

reset();
const tempo0 = T.doc.tempo;
key("F1"); key("Equal"); key("F1");
eq("the same pair is still the tempo on the key page", T.doc.tempo, tempo0 + T.TEMPO_STEP);
eq("and held nothing", T.vhold(0).filter(n => n !== 1).length, 0);

console.log("\n== keeping the key down ==");
reset();
key("KeyZ");
eq("the note goes in as the sixteenth it always was", T.writtenLen(T.doc, 0, 0), 1);
eq("and the cursor is two steps on", T.cursor, 2);
ok("with the key still down, that note is the one growing", T.grow && T.grow.i === 0);
padNow += 100; T.growTick();
eq("a tap is shorter than the wait, so nothing grew", T.writtenLen(T.doc, 0, 0), 1);
padNow += T.GROW_DELAY; T.growTick();
eq("held past the wait, it grows a step", T.writtenLen(T.doc, 0, 0), 2);
eq("and the cursor has not had to move for it", T.cursor, 2);
padNow += T.growStep(); T.growTick();
eq("and another", T.writtenLen(T.doc, 0, 0), 3);
eq("the cursor rides just past the end of what is being written", T.cursor, 3);
key("ArrowRight");
ok("any other key ends the growing", !T.grow);
padNow += 1000; T.growTick();
eq("so the note stops where it was let go", T.writtenLen(T.doc, 0, 0), 3);

reset();
page({ 4:"E4" }); T.cursor = 0;
key("KeyZ");
for (let i = 0; i < 12; i++){ padNow += 400; T.growTick(); }
eq("a note grown by hand still cannot swallow the next one",
   T.writtenLen(T.doc, 0, 0), 4);
T.growStop();
reset();
key("KeyZ"); key("F3");                /* a page comes up over the top */
padNow += 1000; T.growTick();
eq("a page coming up ends it too", T.writtenLen(T.doc, 0, 0), 1);
ok("and forgets it", !T.grow);
key("F3");

console.log("\n== the same gesture on the pad ==");
reset();
frame([GP.L2, GP.DL]);                 /* the crossbar's first slot: C */
eq("a crossbar slot writes its note", T.doc.steps[0], "C4");
ok("and it is the note under the thumb", T.grow && T.grow.btn === GP.DL);
padNow += 400; T.growTick();
eq("held, the slot goes on ringing it", T.writtenLen(T.doc, 0, 0), 2);
frame([GP.L2]);                        /* the slot comes up */
ok("letting the slot go stops it", !T.grow);
padNow += 1000; T.growTick();
eq("and the note stays as long as it was made", T.writtenLen(T.doc, 0, 0), 2);

reset(); T.setRelative(true);
frame([GP.TR]);
ok("in contour entry the shape button holds the note too",
   T.grow && T.grow.btn === GP.TR);
padNow += 400; T.growTick();
eq("and grows it", T.writtenLen(T.doc, 0, 0), 2);
frame([]);
reset(); T.setRelative(true);
frame([GP.B]);
ok("and so does the one that says the same note again", T.grow && T.grow.btn === GP.B);
frame([]); T.setRelative(false);

console.log("\n== the note's two edges, on the triggers ==");
reset(); T.setRelative(true);
page({ 4:"E4" }); T.cursor = 4;
hold(GP.R2, GP.DR);
eq("R2 and right moves the note's end later - it rings on", T.writtenLen(T.doc, 0, 4), 2);
eq("and the note is still where it was", T.doc.steps[4], "E4");
hold(GP.R2, GP.DL);
eq("R2 and left brings the end back in", T.writtenLen(T.doc, 0, 4), 1);
hold(GP.R2, GP.DL);
eq("never past the step it begins on", T.writtenLen(T.doc, 0, 4), 1);
hold(GP.L2, GP.DL);
eq("L2 and left moves the note's start earlier", T.doc.steps[3], "E4");
eq("leaving nothing behind it", T.doc.steps[4], null);
eq("and its far end where it was, so it is longer", T.writtenLen(T.doc, 0, 3), 2);
eq("the cursor stays on the note", T.cursor, 4);
hold(GP.L2, GP.DR);
eq("L2 and right moves the start back in", T.doc.steps[4], "E4");
eq("shortening it again", T.writtenLen(T.doc, 0, 4), 1);
hold(GP.L2, GP.DR);
eq("and never past its own end", T.doc.steps[4], "E4");
page({ 3:"C4", 4:"E4" }); T.cursor = 4;
hold(GP.L2, GP.DL);
eq("a start cannot move onto another note", T.doc.steps[4], "E4");
eq("which is left alone as well", T.doc.steps[3], "C4");
page({ 4:"E4" }); T.cursor = 8;
hold(GP.R2, GP.DR);
eq("an empty step has no edges to move", T.writtenLen(T.doc, 0, 4), 1);
ok("and says so", /no note to move/.test(ids.footer.textContent), ids.footer.textContent);
page({ 4:"E4" }); T.cursor = 4;
hold(GP.L2, GP.R2, GP.DR);
eq("both triggers at once move nothing", T.doc.steps[4], "E4");
eq("and hold nothing", T.writtenLen(T.doc, 0, 4), 1);
T.setRelative(false);
reset();
page({ 4:"E4" }); T.cursor = 4;
hold(GP.R2, GP.DR);
eq("in absolute entry the triggers are the crossbar, writing a pitch",
   T.doc.steps[4], "A#4");

console.log("\n== what a held note sounds like ==");
reset();
page({ 0:"C4" });
T.setLen(0, 0, 4, true);
sounded.length = 0; nowT = 0; T.schedFrom(0);
T.scheduler();
eq("the note is scheduled once", sounded.length, 1);
const dur1 = T.stepDur();
ok("for as long as it is written to last",
   Math.abs((sounded[0].off - sounded[0].at) - (4 * dur1 - T.TAIL + 0.01)) < 1e-9,
   { off: sounded[0].off, at: sounded[0].at, want: 4 * dur1 - T.TAIL + 0.01 });
for (let i = 1; i <= 4; i++){ nowT = i * dur1; T.scheduler(); }
eq("and the steps it covers strike nothing of their own", sounded.length, 1);
const env = sounded[0].gain.calls;
eq("its envelope begins in silence", [env[0][0], env[0][1]], ["set", 0]);
eq("and is ramped back to silence at its end", [env[env.length-1][0], env[env.length-1][1]],
   ["ramp", 0]);
ok("over the longer release a held note gets",
   Math.abs(env[env.length-1][2] - env[env.length-2][2] - T.TONE[0].hold) < 1e-9, env);
ok("which is longer than a struck note's", T.TONE[0].hold > T.TONE[0].release);
ok("and the bass has one of its own", T.TONE[1].hold > T.TONE[1].release);

page({ 0:"C4" });
sounded.length = 0; nowT = 0; T.schedFrom(0); T.scheduler();
const env1 = sounded[0].gain.calls;
ok("a plain sixteenth keeps the release it always had",
   Math.abs(env1[env1.length-1][2] - env1[env1.length-2][2] - T.TONE[0].release) < 1e-9,
   env1);

page({ 14:"G4" });
T.setLen(0, 14, 4, true);
sounded.length = 0; nowT = 0; T.schedFrom(14);
T.scheduler();
eq("a note at the seam is scheduled once", sounded.length, 1);
ok("and rings on through the wrap rather than being struck again",
   Math.abs((sounded[0].off - sounded[0].at) - (4 * dur1 - T.TAIL + 0.01)) < 1e-9,
   sounded[0]);
for (let i = 1; i <= 4; i++){ nowT = i * dur1; T.scheduler(); }
eq("the loop coming round strikes nothing", sounded.length, 1);

duet({ 0:"C4" }, { 0:"C3" });
T.setLen(0, 0, 4, true);
sounded.length = 0; nowT = 0; T.schedFrom(0); T.scheduler();
eq("both voices sound from the one clock as they always did", sounded.length, 2);
ok("and each is as long as it is written",
   Math.abs((sounded[0].off - sounded[0].at) - (4 * dur1 - T.TAIL + 0.01)) < 1e-9 &&
   Math.abs((sounded[1].off - sounded[1].at) - (1 * dur1 - T.TAIL + 0.01)) < 1e-9,
   sounded.map(x => x.off - x.at));

console.log("\n== a page that predates all of it ==");
const oldpage = { version:1, title:"before", tempo:112, loop:16, key:"C major",
                  steps: steps({ 0:"C4", 2:"E4" }) };
const v3 = T.validate(oldpage);
ok("an old page still reads", !!v3 && v3.steps[0] === "C4");
ok("with a length for every step", v3.hold.length === 16 && v3.hold.every(n => n === 1));
ok("and a silent bass with lengths of its own",
   v3.basshold.length === 16 && v3.basshold.every(n => n === 1));
eq("every note in it is one step long", T.spanOf(v3, 0, 0), 1);
const junk3 = T.validate(Object.assign({}, oldpage, { hold: "nonsense" }));
ok("junk where the lengths go costs the page nothing", junk3.steps[0] === "C4");
ok("and means the plain sixteenth", junk3.hold.every(n => n === 1));
const wild = T.validate(Object.assign({}, oldpage,
  { hold: [99, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1] }));
eq("a length longer than the page is brought back to it", wild.hold[0], 16);
eq("a length on a step with no note is nothing at all", wild.hold[1], 1);
ok("the notes are exactly what they were",
   JSON.stringify(wild.steps) === JSON.stringify(v3.steps));
{
  const sixteen = new Array(16).fill("C4");
  const rh = T.readHolds([99, 0, -4, null, "4", 2.6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                         sixteen);
  eq("a length of nought is one", rh[1], 1);
  eq("and a negative one is one", rh[2], 1);
  eq("a missing one is one", rh[3], 1);
  eq("a length that is not a number is one", rh[4], 1);
  eq("and one that is not whole is rounded", rh[5], 3);
}

console.log("\n== what leaves the app, and what comes back ==");
reset();
page({ 0:"C4", 4:"E4" });
eq("a page with nothing held is written as it always was",
   Object.keys(JSON.parse(T.exportJSON())).sort().join(),
   ["bass","key","loop","mute","solo","steps","tempo","title","version"].join());
ok("even though it carries lengths while it is open", T.vhold(0).length === 16);
T.setLen(0, 0, 4, true);
const outHeld = JSON.parse(T.exportJSON());
ok("a page with something held says so", Array.isArray(outHeld.hold));
eq("in the field beside the notes", outHeld.hold[0], 4);
ok("and says nothing about the voice that holds nothing", outHeld.basshold === undefined);
const back3 = T.validate(outHeld);
eq("read back, the hold is the hold that was written", T.spanOf(back3, 0, 0), 4);
ok("and the notes came through unharmed",
   JSON.stringify(back3.steps) === JSON.stringify(T.doc.steps));
/* an older build reads this file: it knows nothing of the field, drops it on
   its own way out, and what it writes is still a folio - the notes intact and
   every one of them a sixteenth again */
const older = JSON.parse(T.exportJSON());
delete older.hold; delete older.basshold;
const degraded = T.validate(older);
ok("an older build's copy is still a page", !!degraded);
ok("with every note where it was",
   JSON.stringify(degraded.steps) === JSON.stringify(back3.steps));
eq("and every note a sixteenth again", T.spanOf(degraded, 0, 0), 1);

console.log("\n== the lengths ride out with the quest log ==");
T.resetQuests(); T.resetDrills();
page({ 0:"C4" });
T.setLen(0, 0, 6, true);
const log3 = T.stateToJSON();
eq("free play's page carries them", log3.free.hold[0], 6);
T.applyState(JSON.parse(JSON.stringify(log3)));
eq("and they survive the round trip", T.writtenLen(T.doc, 0, 0), 6);
T.resetQuests();
page({ 0:"C4", 4:"E4" });
const plainLog = T.stateToJSON();
ok("a log in which nothing is held mentions no lengths at all",
   plainLog.free.hold === undefined && plainLog.free.basshold === undefined,
   Object.keys(plainLog.free));
ok("and the pattern in it is the pattern it always was",
   Object.keys(plainLog.free).sort().join() ===
   ["bass","key","loop","mute","solo","steps","tempo","title","version"].join());
T.resetQuests();

console.log("\n== the server itself ==");
const srv = fs.readFileSync(REPO + "/server.mjs", "utf8");
ok("it depends on nothing but node", !/^import .*from "(?!node:)/m.test(srv));
ok("it serves folio.html as the index", /INDEX = "folio.html"/.test(srv));
ok("it refuses traversal", /indexOf\("\.\."\) >= 0/.test(srv));
ok("it writes the log atomically", /fs\.rename\(tmp, LOG_FILE\)/.test(srv));
ok("it checks the marker before writing", /obj\.folio !== "quest-log"/.test(srv));
ok("it binds localhost by default", /LAN \? "0\.0\.0\.0" : "127\.0\.0\.1"/.test(srv));
ok("PORT is honoured", /process\.env\.PORT/.test(srv));
ok("and a taken port is explained", /EADDRINUSE/.test(srv));
ok("folio.cmd starts it", /server\.mjs/.test(fs.readFileSync(REPO + "/folio.cmd","utf8")));
ok("the log carries an ETag", /createHash\("sha1"\)/.test(srv) && /"etag": tag/.test(srv));
ok("and honours If-None-Match", /if-none-match/.test(srv) && /writeHead\(304/.test(srv));
ok("a PUT answers with the tag it wrote", /writeHead\(204, \{ "etag": etagOf\(text2\) \}\)/.test(srv));
ok("a stale PUT cannot lose a drill on disk",
   /disk\.drills\.filter/.test(srv) && /!have\.has\(d\.id\)/.test(srv));
ok("and only drills are preserved that way", /Nothing else on disk is preserved/.test(srv));
ok("the README says how to run it",
   /folio\.cmd/.test(fs.readFileSync(REPO + "/README.md","utf8")));

syncLive().then(drillsLive).then(function(){
  console.log("\n" + pass + " passed, " + fail + " failed\n");
  process.exit(fail ? 1 : 0);
}, function(e){
  console.log("  FAIL harness crashed -> " + (e && e.stack || e));
  console.log("\n" + pass + " passed, " + (fail + 1) + " failed\n");
  process.exit(1);
});
