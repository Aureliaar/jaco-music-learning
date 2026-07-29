/* Focused harness for the gamepad relative-entry leap path in folio.html.
   Same rig as reltest.js, but only what the leaps need — and unlike reltest's
   hold(), every sequence here is multi-frame: the modifier goes down on one
   frame, the face button edges several frames later, and the releases are
   staggered, which is how a hand actually plays it. */
const fs = require("fs");
const REPO = require("path").resolve(__dirname, "..").split("\\").join("/");
const path = REPO + "/folio.html";
const html = fs.readFileSync(path, "utf8");
const src = html.slice(html.indexOf("<script>") + 8, html.lastIndexOf("</script>"));

/* ---------- fake dom ---------- */
function mkEl(tag){
  const set = new Set();
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
    addEventListener(){}, click(){}, setAttribute(){}
  };
  return el;
}
const ids = {};
["column","footer","metatext","keyref","picker","quests","qlist",
 "roll","rollfield","rollbase",
 "qfree","qfreesigil","qdname","qdtext","qdteach","qdstate","qpreview",
 "railquests","railtitle","railtext","railteach","railstate",
 "settings","xbarpad","xbarface","voices","vname0","vname1","vmark0","vmark1"].forEach(i=>ids[i]=mkEl("div"));
let keyHandler = null;
const document = {
  getElementById: i => (i in ids ? ids[i] : null),
  createElement: mkEl,
  body: mkEl("body"),
  addEventListener(t,f){ if(t==="keydown") keyHandler = f; }
};
const winHandlers = {};
let padNow = 1000;
globalThis.performance = { now: () => padNow };
const window = {
  addEventListener(t,f){ (winHandlers[t]=winHandlers[t]||[]).push(f); },
  performance: { now: () => padNow },
  location: { protocol: "file:", origin: "null", href: "file:///folio.html" }
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
function param(){ return { setValueAtTime(){}, linearRampToValueAtTime(){}, cancelScheduledValues(){}, value:1 }; }
class FakeCtx {
  constructor(){ this.state = "running"; }
  get currentTime(){ return nowT; }
  resume(){}
  createGain(){ return { gain: param(), connect(){}, disconnect(){} }; }
  createBiquadFilter(){ return { type:"", frequency:param(), Q:param(), connect(){}, disconnect(){} }; }
  createOscillator(){
    const o = { type:"", frequency:{ setValueAtTime:(f,at)=>{ o._f=f; o._at=at; } },
      connect(){}, disconnect(){}, start(){ sounded.push({freq:o._f, at:o._at}); }, stop(){}, onended:null };
    return o;
  }
  get destination(){ return {}; }
}
let gamepads = [null];
const navigator = { getGamepads: () => gamepads };
const URL = { createObjectURL:()=>"blob:x", revokeObjectURL(){} };
function Blob(){}

const hook = `
  window.__t = { get doc(){return doc;}, get cursor(){return cursor;}, set cursor(v){cursor=v;},
    get baseOctave(){return baseOctave;}, set baseOctave(v){baseOctave=v;},
    setDoc: function(d){ doc = d; renderAll(); },
    pollPads: pollPads, relStep: relStep, moveDegrees: moveDegrees,
    nameOfMidi: nameOfMidi, anchorMidi: anchorMidi,
    get relative(){return relative;}, setRelative: setRelative,
    get lbUsed(){return lbUsed;}, get rbUsed(){return rbUsed;} };
`;
const patched = src.replace(/\}\)\(\);\s*$/, hook + "\n})();");
if (patched === src) throw new Error("could not inject hook");

const fn = new Function("document","window","localStorage","requestAnimationFrame",
  "navigator","URL","Blob","AudioContext","setTimeout","setInterval","clearInterval","fetch",
  patched);
window.AudioContext = FakeCtx;
fn(document, window, localStorage, requestAnimationFrame, navigator, URL, Blob, FakeCtx,
   setTimeout, setInterval, clearInterval, undefined);

const T = window.__t;

/* ---------- test rig ---------- */
let pass = 0, fail = 0;
function ok(name, cond, extra){
  if (cond){ pass++; console.log("  ok   " + name); }
  else { fail++; console.log("  FAIL " + name + (extra !== undefined ? "  -> " + JSON.stringify(extra) : "")); }
}
function eq(name, a, b){ ok(name, JSON.stringify(a) === JSON.stringify(b), {got:a, want:b}); }
function blank(){ return new Array(16).fill(null); }
function steps(o){ const s = blank(); for (const k in o) s[k|0] = o[k]; return s; }

const GP = { X:0, B:1, SQ:2, TR:3, L1:4, R1:5, L2:6, R2:7, SEL:8, START:9,
             L3:10, R3:11, DU:12, DD:13, DL:14, DR:15 };

function pad(down, axes){
  const buttons = [];
  for (let i = 0; i < 17; i++) buttons.push({ pressed: down.indexOf(i) >= 0, value: down.indexOf(i) >= 0 ? 1 : 0 });
  return { connected:true, mapping:"standard", buttons, axes: axes || [0,0,0,0], index:0 };
}
function frame(down){ padNow += 16; gamepads = [pad(down||[])]; T.pollPads(); }
function frames(n, down){ for (let i = 0; i < n; i++) frame(down); }

/* a fresh relative page anchored on C4 behind step 1, octave 4 */
function stage(anchor, key){
  T.setDoc({ version:1, title:"t", tempo:112, loop:16, key: key || "C major",
             steps: steps({15: anchor === undefined ? "C4" : anchor}) });
  T.cursor = 0;
  T.baseOctave = 4;
  T.setRelative(true);
  gamepads = [pad([])]; T.pollPads(); frame([]);
}
/* what got written at step 1, and where the base octave ended up */
function wrote(){ return T.doc.steps[0]; }
function oct(){ return T.baseOctave; }

/* ================= 1. the same-frame baseline, as reltest has it ============ */
console.log("\n== same-frame leaps (the baseline) ==");
[["L1 + \u2715 is a third down", [GP.L1, GP.X], "A3"],
 ["L1 + \u25b3 is a third up",   [GP.L1, GP.TR], "E4"],
 ["R1 + \u2715 is a fifth down", [GP.R1, GP.X], "F3"],
 ["R1 + \u25b3 is a fifth up",   [GP.R1, GP.TR], "G4"],
 ["L1+R1 + \u2715 is a semitone down", [GP.L1, GP.R1, GP.X], "B3"],
 ["L1+R1 + \u25b3 is a semitone up",   [GP.L1, GP.R1, GP.TR], "C#4"],
 ["bare \u2715 is a step down", [GP.X], "B3"],
 ["bare \u25b3 is a step up",   [GP.TR], "D4"]
].forEach(([name, down, want]) => {
  stage(); frame(down); frame([]);
  eq(name, wrote(), want);
});

/* ================= 2. the modifier is already held ================= */
console.log("\n== (a) the bumper is already held when the face button edges ==");
/* down on frame N, the face edge on frame N+3, both released after */
function leapHeld(mods, face){
  stage();
  frames(3, mods);                    /* the bumper settles */
  frame(mods.concat([face]));         /* the face button edges */
  frames(2, mods);                    /* the face button is let go */
  frames(2, []);                      /* and then the bumper */
  return { note: wrote(), oct: oct() };
}
let r;
r = leapHeld([GP.L1], GP.X);
eq("L1 held three frames, then \u2715: a third down", r.note, "A3");
eq("and the octave did not move", r.oct, 4);
r = leapHeld([GP.R1], GP.X);
eq("R1 held three frames, then \u2715: a fifth down", r.note, "F3");
eq("and the octave did not move (no upward shift on release)", r.oct, 4);
r = leapHeld([GP.L1], GP.TR);
eq("L1 held, then \u25b3: a third up", r.note, "E4");
eq("octave still still", r.oct, 4);
r = leapHeld([GP.R1], GP.TR);
eq("R1 held, then \u25b3: a fifth up", r.note, "G4");
eq("octave still still", r.oct, 4);
r = leapHeld([GP.L1, GP.R1], GP.X);
eq("both bumpers held, then \u2715: a semitone down", r.note, "B3");
eq("and neither bumper shifted the octave", r.oct, 4);
r = leapHeld([GP.L1, GP.R1], GP.TR);
eq("both bumpers held, then \u25b3: a semitone up", r.note, "C#4");
eq("and neither shifted", r.oct, 4);

console.log("\n== the releases, staggered either way ==");
/* the bumper let go before the face button */
stage();
frames(3, [GP.R1]);
frame([GP.R1, GP.X]);
frames(2, [GP.X]);                    /* R1 released first, \u2715 still down */
frames(2, []);
eq("R1 released before \u2715: still a fifth down", wrote(), "F3");
eq("and still no octave shift", oct(), 4);
stage();
frames(3, [GP.L1]);
frame([GP.L1, GP.X]);
frames(2, [GP.X]);
frames(2, []);
eq("L1 released before \u2715: still a third down", wrote(), "A3");
eq("and no octave shift", oct(), 4);
/* both bumpers, released one at a time */
stage();
frames(3, [GP.L1, GP.R1]);
frame([GP.L1, GP.R1, GP.X]);
frames(2, [GP.L1, GP.R1]);
frames(2, [GP.L1]);                   /* R1 goes first */
frames(2, []);                        /* then L1 */
eq("the chromatic escape, bumpers released one at a time", wrote(), "B3");
eq("and neither release shifted the octave", oct(), 4);

/* ================= 3. the face button is already held ================= */
console.log("\n== (b) the face button is held when the bumper edges ==");
stage();
frames(3, [GP.X]);                    /* \u2715 edges bare: one step down */
eq("\u2715 alone wrote a bare step down", wrote(), "B3");
frames(3, [GP.X, GP.L1]);             /* L1 arrives late — no new edge on \u2715 */
eq("a bumper arriving after \u2715 writes nothing more", T.doc.steps[1], null);
frames(2, [GP.X]);                    /* L1 released while \u2715 still down */
eq("and the unused bumper is still the octave, downward", oct(), 3);
stage();
frames(3, [GP.X]);
frames(3, [GP.X, GP.R1]);
frames(2, [GP.X]);
eq("R1 arriving late is the octave, upward", oct(), 5);
eq("but it never turned the step into an upward leap", wrote(), "B3");

/* ================= 4. the same frame, and the tie rule ================= */
console.log("\n== (c) bumper and face button edging on the same frame ==");
stage(); frame([GP.L1, GP.X]); frames(3, []);
eq("L1 and \u2715 together: a third down", wrote(), "A3");
eq("and no octave shift", oct(), 4);
stage(); frame([GP.R1, GP.X]); frames(3, []);
eq("R1 and \u2715 together: a fifth down", wrote(), "F3");
eq("and no octave shift", oct(), 4);

console.log("\n== (d) \u25b3 wins a same-frame tie, bumper or not ==");
stage(); frame([GP.TR, GP.X]); frames(3, []);
eq("\u25b3 and \u2715 on one frame: \u25b3 wins, a step up", wrote(), "D4");
stage(); frames(3, [GP.L1]); frame([GP.L1, GP.TR, GP.X]); frames(3, []);
eq("with L1 held, \u25b3 still wins: a third up", wrote(), "E4");
eq("and only one note was written", T.doc.cursor === undefined ? T.cursor : T.cursor, 1);
stage(); frames(3, [GP.R1]); frame([GP.R1, GP.TR, GP.X]); frames(3, []);
eq("with R1 held, \u25b3 wins: a fifth up", wrote(), "G4");
/* and the far more common case: \u2715 alone with a bumper is never read as \u25b3 */
let up = 0;
for (const mods of [[GP.L1], [GP.R1], [GP.L1, GP.R1]]){
  for (let gap = 1; gap <= 6; gap++){
    stage();
    frames(gap, mods);
    frame(mods.concat([GP.X]));
    frames(2, mods);
    frames(2, []);
    const m = { "A3":1, "F3":1, "B3":1 };
    if (!m[wrote()] || oct() !== 4) { up++; console.log("      swing up at gap " + gap, mods, wrote(), oct()); }
  }
}
ok("\u2715 under every bumper, at every gap, swings down and leaves the octave alone", up === 0, up);

/* ================= 5. the octave shift on release ================= */
console.log("\n== (e) the bumper release, after a leap and without one ==");
stage();
frames(3, [GP.L1]); frames(3, []);
eq("a bare hold-and-release of L1 is the octave down", oct(), 3);
stage();
frames(3, [GP.R1]); frames(3, []);
eq("a bare hold-and-release of R1 is the octave up", oct(), 5);
/* a leap, then the bumper released, then a second bare tap */
stage();
frames(2, [GP.R1]); frame([GP.R1, GP.X]); frames(2, [GP.R1]); frames(2, []);
eq("the leap is written", wrote(), "F3");
eq("the used bumper did not shift", oct(), 4);
frames(2, [GP.R1]); frames(2, []);
eq("but the next bare tap of it does", oct(), 5);
/* several taps of the face button under one held bumper */
stage();
frames(2, [GP.L1]);
frame([GP.L1, GP.X]); frames(2, [GP.L1]);
frame([GP.L1, GP.X]); frames(2, [GP.L1]);
frame([GP.L1, GP.X]); frames(2, [GP.L1]);
frames(3, []);
eq("three thirds down under one held L1", T.doc.steps.slice(0,3), ["A3","F3","D3"]);
eq("and the release still does not shift the octave", oct(), 4);

console.log("\n== the ugly one: the bumper let go on the very frame \u2715 edges ==");
/* rolling off the bumper as the thumb lands is a real hand movement; the
   poll can catch both in one frame, and it is still one leap, not a lost
   modifier plus a bare tap of the octave */
stage();
frames(3, [GP.R1]);
frame([GP.X]);                        /* R1 gone, \u2715 arrives, same poll */
frames(3, []);
eq("R1 released as \u2715 edges: still a fifth down", wrote(), "F3");
eq("and the octave is not dragged up under it", oct(), 4);
stage();
frames(3, [GP.L1]);
frame([GP.X]);
frames(3, []);
eq("L1 released as \u2715 edges: still a third down", wrote(), "A3");
eq("and the octave is not dragged down under it", oct(), 4);
stage();
frames(3, [GP.R1]);
frame([GP.TR]);
frames(3, []);
eq("the same roll-off upward is still a fifth up", wrote(), "G4");
eq("and no octave shift either", oct(), 4);
/* one frame of grace, and no more: a bumper let go and then \u2715 a frame
   later is a plain tap of the octave and a plain step */
stage();
frames(3, [GP.R1]);
frame([]);                            /* the release lands alone */
frame([GP.X]);
frames(3, []);
eq("a whole frame after the release, \u2715 is a bare step down", wrote(), "B3");
eq("and the bumper was the octave, as a tap should be", oct(), 5);

/* ================= 6. the crossbar is not the leap ================= */
console.log("\n== the triggers are the crossbar, in relative entry too ==");
stage(); frames(3, [GP.L2]); frame([GP.L2, GP.X]); frames(3, []);
eq("L2 + \u2715 is slot 8, an absolute pitch", wrote(), "G4");
stage(); frames(3, [GP.R2]); frame([GP.R2, GP.X]); frames(3, []);
eq("R2 + \u2715 is slot 8 of the second bar", wrote(), "D#5");
stage(); frames(3, [GP.L2, GP.R2]); frame([GP.L2, GP.R2, GP.X]); frames(3, []);
eq("both triggers + \u2715 is slot 8 of the third", wrote(), "B5");
/* a bumper held under a trigger is not a leap and must not be lost */
stage();
frames(2, [GP.L1]); frames(2, [GP.L1, GP.L2]);
frame([GP.L1, GP.L2, GP.X]); frames(2, [GP.L1, GP.L2]);
frames(2, [GP.L1]); frames(2, []);
eq("a bumper under a trigger writes the crossbar pitch", wrote(), "G4");

/* ================= 7. direction, in another key and out of it ============== */
console.log("\n== the signs, key by key ==");
function held(mods, face, anchor, key){
  stage(anchor, key);
  frames(3, mods);
  frame(mods.concat([face]));
  frames(2, mods); frames(2, []);
  return wrote();
}
eq("E minor: R1 + \u2715 from E4 is a fifth down", held([GP.R1], GP.X, "E4", "E minor"), "A3");
eq("E minor: L1 + \u2715 from E4 is a third down", held([GP.L1], GP.X, "E4", "E minor"), "C4");
eq("E minor: R1 + \u25b3 from E4 is a fifth up", held([GP.R1], GP.TR, "E4", "E minor"), "B4");
/* out of the key: the snap must not reverse the leap */
eq("out of key, L1 + \u2715 from F#4 is E4", held([GP.L1], GP.X, "F#4"), "E4");
eq("out of key, R1 + \u2715 from F#4 is C4", held([GP.R1], GP.X, "F#4"), "C4");
eq("out of key, L1 + \u25b3 from F#4 is A4", held([GP.L1], GP.TR, "F#4"), "A4");
/* the snap counts as the first step of the move, so a fifth up from F#4 is
   G A B C, not G A B C D */
eq("out of key, R1 + \u25b3 from F#4 is C5", held([GP.R1], GP.TR, "F#4"), "C5");
eq("out of key, the chromatic move down from F#4 is F4",
   held([GP.L1, GP.R1], GP.X, "F#4"), "F4");
/* every leap from every anchor is on the correct side of it */
console.log("\n== nothing labelled down ever lands above the anchor ==");
const MIDI = n => { const m = /^([A-G]#?)(\d)$/.exec(n); const N =
  ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
  return (parseInt(m[2],10) + 1) * 12 + N.indexOf(m[1]); };
let wrong = 0;
for (const key of ["C major","E minor","F# major","A minor"]){
  for (const a of ["C4","D4","E4","F4","F#4","G4","A4","A#4","B4","C#4","D#4","G#4"]){
    for (const mods of [[GP.L1], [GP.R1], [GP.L1, GP.R1]]){
      const dn = held(mods, GP.X, a, key), upn = held(mods, GP.TR, a, key);
      if (MIDI(dn) >= MIDI(a)){ wrong++; console.log("      down went up", key, a, mods, dn); }
      if (MIDI(upn) <= MIDI(a)){ wrong++; console.log("      up went down", key, a, mods, upn); }
    }
  }
}
ok("144 leaps in four keys, from twelve anchors, all on the right side", wrong === 0, wrong);

console.log("\n" + pass + " passed, " + fail + " failed\n");
process.exit(fail ? 1 : 0);
