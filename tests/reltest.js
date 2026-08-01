/* Headless regression harness for folio.html: the instrument's identity.
   726 checks.

   What the hands do, and what the page does about it — plain entry by
   physical position, the contour moves the pad writes, the leaps and the
   chromatic escape, the snap rule, the anchor, the nudge, the clamp, the key
   and its scale degrees, the held note and its two edges, the transport, the
   quest board's own logic. Everything that is *data* — a page out and back,
   the quest log's schema, the server — belongs to tier1.js and is not
   repeated here; everything that is *layout* is measured in a real browser
   by bootcheck.js and is not inspected here either.

   The bench — the fake document, the fake audio, the fake pad, the loader —
   is tests/rig.js, which tier1.js stands on too. */
const fs = require("fs");
const rig = require("./rig.js");
const REPO = rig.REPO;
const R = rig.boot();
const { T, ids, store, blobs, sounded, gains, clock,
        ok, eq, key, frame, frames, hold, press, stick, holdLong, blank, steps, GP,
        document, window } = R;

/* Every source scan below asks one question — does the app say this
   anywhere — so it is asked of everything the page is made of: its markup,
   its script and its stylesheet, whether those are one file or seven. */
const src = R.appSource();
const html = [R.appMarkup(), src, R.appStyle()].join(String.fromCharCode(10));

/* The written column was the default view when this suite was first written;
   the roll is the default now. Everything below the roll's own section reads
   the column and its d-pad bindings (↑↓ time, ←→ nudge), so the baseline is
   set explicitly here rather than assumed. */
function useColumn(){ if (T.viz !== "column") T.toggleViz(); }
function useRoll(){ if (T.viz !== "roll") T.toggleViz(); }
function reset(){
  T.setDoc({ version:1, title:"untitled folio", tempo:112, loop:16, key:"C major",
             steps: blank(), bass: blank(), mute:[false,false], solo:[false,false] });
  T.setVoice(0); /* the lead is the baseline hand */
  T.cursor = 0;
  T.baseOctave = 4;
  useColumn();
  sounded.length = 0;
}
function page(o, extra){
  T.setDoc(Object.assign({ version:1, title:"t", tempo:112, loop:16, key:"C major",
                           steps: steps(o), bass: blank(),
                           mute:[false,false], solo:[false,false] }, extra||{}));
}
/* a page with something in the second voice as well */
function duet(lead, bass, extra){ page(lead, Object.assign({ bass: steps(bass) }, extra||{})); }
/* The roll's horizontal rules sit on the *home* note of the page's key, and
   each margin label carries two words: the pitch, and what that pitch is to
   the piece. So the name is the label's first child, not the label. */
function ruleNames(){ return T.octlines.map(l => l.firstChild.children[0].textContent); }
function ruleHomes(){ return T.octlines.map(l => l.firstChild.children[1].textContent); }

/* the pages are exclusive and none of them may be left open behind a check */
function closePages(){
  if (ids.quests.classList.contains("on")) T.toggleQuests();
}
/* a clean board: no pages up, no drills, no workspaces, no sync */
function qreset(){
  closePages(); reset(); useColumn(); T.resetDrills(); T.resetQuests();
  delete store[T.QUEST_KEY]; delete store[T.QUEST_KEY_V1];
  T.syncOn = false; T.syncState = "idle";
}
const Q = T.QUESTS;


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
key("Tab"); eq("tab is inert", T.cursor, 6);
key("Tab"); /* back in the lead */
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
key("End"); eq("end -> step 16", T.cursor, 15);
key("PageDown"); eq("page down lowers the octave", T.baseOctave, 3);
key("PageUp"); eq("page up raises it", T.baseOctave, 4);
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
/* Seven things, of which five were said better elsewhere or said nothing:
   the title, the quest (both margins), the voice and its state (the strip
   below), the loop (the page draws it), the base octave (entry is relative;
   the roll shows where you are). Two settings are left. */
eq("the meta line is the tempo and the key", ids.metatext.textContent,
   "112 \u00b7 C major");
T.setKey("E minor");
eq("and follows the key", ids.metatext.textContent,
   "112 \u00b7 E minor");
reset();
key("KeyL");
eq("the loop is not repeated there \u2014 the page draws it", ids.metatext.textContent,
   "112 \u00b7 C major");
ok("nor is the title, which never said anything",
   ids.metatext.textContent.indexOf("untitled") < 0, ids.metatext.textContent);
reset();

/* The page of the key is gone — it went stale faster than the bindings it
   described — and with it went the only way in to the tonic and the tempo
   from either hand. The arithmetic behind both is still here and still the
   piece's own, so it is driven straight, from the model. */
console.log("\n== the key of the piece ==");
reset();
T.shiftTonic(1);  eq("the tonic goes up a semitone", T.doc.key, "C# major");
T.shiftTonic(-1); T.shiftTonic(-1); eq("and down", T.doc.key, "B major");
eq("the tonic wraps", T.keyOf().pc, 11);
T.toggleKeyMode(); eq("the mode turns minor", T.doc.key, "B minor");
T.toggleKeyMode(); eq("and major again", T.doc.key, "B major");
ok("the footer says so", /the key · B major/.test(ids.footer.textContent), ids.footer.textContent);
ok("the key is autosaved", JSON.parse(store["folio.v1"]).key === "B major",
   JSON.parse(store["folio.v1"]).key);
/* the settings crossbar never carried the key and still does not */
press(GP.START); ok("start raises the settings crossbar", ids.settings.classList.contains("on"));
ok("no slot of it is the key",
   T.SETTINGS.every(s => !/^the key$/.test(s.label)), T.SETTINGS.map(s => s.label));
press(GP.START);
ok("start put it down again", !ids.settings.classList.contains("on"));

console.log("\n== relative moves from an anchor ==");
function rel(setup, buttons, opts){
  reset();
  page(setup.steps, setup.doc);
  T.cursor = setup.cursor === undefined ? 0 : setup.cursor;
  if (setup.octave) T.baseOctave = setup.octave;
  /* where it was written, not where the cursor ended up: the advance is two
     steps now and this helper is about the pitch, not the walk */
  const at = T.cursor;
  hold(...buttons);
  return T.doc.steps[at];
}
const A = { steps:{15:"C4"}, cursor:0 }; /* the anchor is C4, behind step 1 */
eq("△ writes one scale step up", rel(A, [GP.TR]), "D4");
eq("✕ writes one scale step down", rel(A, [GP.X]), "B3");
eq("○ repeats the anchor", rel(A, [GP.B]), "C4");
eq("L2 + △ leaps a third", rel(A, [GP.L2, GP.TR]), "E4");
eq("L2 + ✕ leaps a third down", rel(A, [GP.L2, GP.X]), "A3");
eq("R2 + △ leaps a fifth", rel(A, [GP.R2, GP.TR]), "G4");
eq("R2 + ✕ leaps a fifth down", rel(A, [GP.R2, GP.X]), "F3");
eq("L2 + R2 + △ is a semitone up", rel(A, [GP.L2, GP.R2, GP.TR]), "C#4");
eq("L2 + R2 + ✕ is a semitone down", rel(A, [GP.L2, GP.R2, GP.X]), "B3");
/* the steps of the key, not of the keyboard: C major from B3 */
eq("a step up from B3 is C4", rel({steps:{15:"B3"}, cursor:0}, [GP.TR]), "C4");
eq("a step down from C4 is B3", rel({steps:{15:"C4"}, cursor:0}, [GP.X]), "B3");
eq("a step up from E4 is F4", rel({steps:{15:"E4"}, cursor:0}, [GP.TR]), "F4");
/* and they follow the key */
const Em = { steps:{15:"E4"}, cursor:0, doc:{ key:"E minor" } };
eq("in E minor a step up from E4 is F#4", rel(Em, [GP.TR]), "F#4");
eq("in E minor a third up from E4 is G4", rel(Em, [GP.L2, GP.TR]), "G4");
eq("in E minor a fifth up from E4 is B4", rel(Em, [GP.R2, GP.TR]), "B4");
eq("in E minor a step down from E4 is D4", rel(Em, [GP.X]), "D4");

console.log("\n== rest, advance and audition ==");
reset(); page({0:"C4", 1:"E4"}); T.cursor = 1;
sounded.length = 0;
hold(GP.SQ);
eq("□ writes a rest", T.doc.steps[1], null);
eq("and advances by two, as everything that writes does", T.cursor, 3);
eq("a rest sounds nothing", sounded.length, 0);
reset(); page({15:"C4"});
sounded.length = 0;
hold(GP.TR);
eq("a relative note advances by two", T.cursor, 2);
eq("and is auditioned", sounded.length, 1);
ok("at the pitch it wrote", Math.abs(sounded[0].freq - 293.6647679174076) < 1e-6, sounded);
ok("the footer names the note and the step", /D-4 at step 1/.test(ids.footer.textContent),
   ids.footer.textContent);

console.log("\n== the anchor ==");
reset();
hold(GP.TR);
eq("an empty page starts on the tonic", T.doc.steps[0], "C4");
reset(); T.setKey("E minor");
hold(GP.TR); eq("in E minor, on E", T.doc.steps[0], "E4");
reset(); T.baseOctave = 2;
hold(GP.TR); eq("in the base octave", T.doc.steps[0], "C2");
reset();
hold(GP.B); eq("○ on an empty page is the tonic too", T.doc.steps[0], "C4");
reset();
hold(GP.X); eq("✕ on an empty page is the tonic too", T.doc.steps[0], "C4");
/* rests do not break the chain */
reset(); page({0:"G4"}); T.cursor = 4;
hold(GP.TR);
eq("the scan steps over rests", T.doc.steps[4], "A4");
/* the nearest note behind wins */
reset(); page({0:"G4", 2:"C4"}); T.cursor = 5;
hold(GP.TR);
eq("the nearest note behind is the anchor", T.doc.steps[5], "D4");
/* it wraps */
reset(); page({15:"A4"}); T.cursor = 0;
hold(GP.TR);
eq("the scan wraps around the page", T.doc.steps[0], "B4");
/* around the loop, when the cursor is inside it */
reset(); page({3:"D4", 15:"A4"}, { loop:4 }); T.cursor = 0;
hold(GP.TR);
eq("inside a short loop it wraps at the loop", T.doc.steps[0], "E4");
/* outside the loop it wraps around the whole page */
reset(); page({15:"A4"}, { loop:4 }); T.cursor = 8;
hold(GP.TR);
eq("outside the loop it wraps around the whole page", T.doc.steps[8], "B4");
/* the note under the cursor is the last resort */
reset(); page({4:"C4"}); T.cursor = 4;
hold(GP.TR);
eq("a lone note under the cursor still anchors", T.doc.steps[4], "D4");

console.log("\n== out of the key: the snap rule ==");
/* C major, F#4: up goes to the nearest scale tone above, and that is the step */
reset(); page({15:"F#4"});
hold(GP.TR); eq("a step up from F#4 is G4", T.doc.steps[0], "G4");
reset(); page({15:"F#4"});
hold(GP.X); eq("a step down from F#4 is F4", T.doc.steps[0], "F4");
reset(); page({15:"F#4"});
hold(GP.L2, GP.TR); eq("a third up from F#4 is A4", T.doc.steps[0], "A4");
reset(); page({15:"F#4"});
hold(GP.L2, GP.X); eq("a third down from F#4 is E4", T.doc.steps[0], "E4");
reset(); page({15:"F#4"});
hold(GP.B); eq("○ repeats an out-of-key note exactly", T.doc.steps[0], "F#4");
reset(); page({15:"F#4"});
hold(GP.L2, GP.R2, GP.TR); eq("the chromatic move ignores the key", T.doc.steps[0], "G4");
reset(); page({15:"C#4"});
hold(GP.X); eq("a step down from C#4 is C4", T.doc.steps[0], "C4");
reset(); page({15:"A#4"});
hold(GP.TR); eq("a step up from A#4 is B4", T.doc.steps[0], "B4");
/* the escape hatch and back: a chromatic note then a diatonic step */
reset();
hold(GP.TR); /* C4, the tonic */
hold(GP.L2, GP.R2, GP.TR); /* C#4 */
hold(GP.TR); /* snaps up to D4 */
/* on 1, 3 and 5 now: three writes, each two steps on */
eq("a chromatic detour rejoins the key",
   [T.doc.steps[0], T.doc.steps[2], T.doc.steps[4]], ["C4","C#4","D4"]);

console.log("\n== nudge: change the note, stay put ==");
reset(); page({0:"C4", 1:"E4"}); T.cursor = 1;
hold(GP.DR);
eq("d-pad right nudges the note up a step", T.doc.steps[1], "F4");
eq("and does not advance", T.cursor, 1);
hold(GP.DL); hold(GP.DL);
eq("d-pad left nudges it down", T.doc.steps[1], "D4");
eq("still no advance", T.cursor, 1);
sounded.length = 0; hold(GP.DR);
eq("a nudge auditions", sounded.length, 1);
reset(); page({0:"C4"}); T.cursor = 1;
hold(GP.DR);
eq("nudging an empty step writes nothing", T.doc.steps[1], null);
ok("and says so", /nothing to nudge/.test(ids.footer.textContent), ids.footer.textContent);
eq("and does not move", T.cursor, 1);
/* out-of-key nudge follows the same snap rule */
reset(); page({0:"F#4"}); T.cursor = 0;
hold(GP.DR); eq("nudging F#4 up gives G4", T.doc.steps[0], "G4");
/* the nudge is not a mode and never was one to leave: with the second entry
   method gone, ←→ in the column are the nudge and nothing else, and they
   still leave the cursor exactly where it stands */
reset(); page({0:"C4"}); T.cursor = 0;
hold(GP.DR);
eq("the nudge does not move the cursor", T.cursor, 0);
eq("and the note is what moved", T.doc.steps[0], "D4");

/* ---- the escape hatch reaches the nudge as well ----
   Both triggers together mean one thing — out of the key, a semitone — and it
   used to be heard only by △ and ✕. The nudge is the same logical move made
   on a note already written, so it answers the same hand, whichever pair of
   the d-pad the view has put it on. */
console.log("\n== the chromatic escape, on the d-pad ==");
reset(); page({0:"C4"}); T.cursor = 0;
hold(GP.L2, GP.R2, GP.DR);
eq("both triggers make the nudge chromatic", T.doc.steps[0], "C#4");
eq("and it still does not advance", T.cursor, 0);
eq("the triggers wrote nothing of their own", T.baseOctave, 4);
hold(GP.L2, GP.R2, GP.DL);
eq("and back down a semitone the same way", T.doc.steps[0], "C4");
reset(); page({0:"G4"}); T.cursor = 0;
hold(GP.L2, GP.R2, GP.DR);
eq("a semitone above G4 is G#4, not the key's A4", T.doc.steps[0], "G#4");
/* one trigger alone is not the hatch and is not the nudge either: since
   Lesson 3 it is the note's own edge, checked in full further down. What has
   to be true here is that it never nudges — neither in the key nor out of it —
   because the pitch is not what a single trigger is asking about. */
reset(); page({0:"C4"}); T.cursor = 0; T.setLen(0, 0, 3, true);
hold(GP.L2, GP.DR);
eq("L2 alone moves no pitch — it is the note's start", T.doc.steps[0], null);
eq("the note is where its start was moved to", T.doc.steps[1], "C4");
eq("with its far end left where it was", T.writtenLen(T.doc, 0, 1), 2);
reset(); page({0:"C4"}); T.cursor = 0;
hold(GP.R2, GP.DR);
eq("R2 alone moves no pitch either — it is the note's end", T.doc.steps[0], "C4");
eq("it lengthened it instead", T.writtenLen(T.doc, 0, 0), 2);
reset(); page({0:"C4"}); T.cursor = 0;
hold(GP.DR);
eq("and a bare d-pad is the step it always was", T.doc.steps[0], "D4");
/* the roll trades the pairs, so there the hatch is on ↑ and ↓ */
reset(); page({0:"C4"}); T.cursor = 0; useRoll();
hold(GP.L2, GP.R2, GP.DU);
eq("in the roll the hatch is on d-pad up", T.doc.steps[0], "C#4");
hold(GP.L2, GP.R2, GP.DD);
eq("and on d-pad down", T.doc.steps[0], "C4");
hold(GP.DU);
eq("bare, the roll's up is still a step of the key", T.doc.steps[0], "D4");
/* the left stick is the same move behind the same pair */
reset(); page({0:"C4"}); T.cursor = 0; useRoll();
frame([GP.L2, GP.R2], [0,-1,0,0]); frame([]);
eq("the left stick takes the hatch too", T.doc.steps[0], "C#4");
useColumn();
/* an out-of-key note nudged chromatically moves by semitone, never by snap */
reset(); page({0:"D#4"}); T.cursor = 0;
hold(GP.L2, GP.R2, GP.DR);
eq("a chromatic nudge from D#4 is E4", T.doc.steps[0], "E4");
reset(); page({0:"D#4"}); T.cursor = 0;
hold(GP.L2, GP.R2, GP.DL);
eq("and down from D#4 is D4, not the key's D4 by snap", T.doc.steps[0], "D4");
/* the clamp and the empty step are unchanged by the hatch */
reset(); page({0:"C6"}); T.cursor = 0;
hold(GP.L2, GP.R2, GP.DR);
eq("a chromatic nudge clamps at the ceiling too", T.doc.steps[0], "C6");
reset(); page({0:"C2"}); T.cursor = 0;
hold(GP.L2, GP.R2, GP.DL);
eq("and at the floor", T.doc.steps[0], "C2");
reset(); T.cursor = 0;
hold(GP.L2, GP.R2, GP.DR);
ok("the hatch on an empty step still says there is nothing to nudge",
   /nothing to nudge/.test(ids.footer.textContent), ids.footer.textContent);
eq("and the octave, which is nowhere near the pad now, did not move", T.baseOctave, 4);
/* it writes into the hand you are in, as every edit does */
reset(); page({0:"C4"}); T.setDoc(Object.assign({}, T.doc, { bass: (function(){
  const s = blank(); s[0] = "C3"; return s; })() }));
T.cursor = 0; T.setVoice(1);
hold(GP.L2, GP.R2, GP.DR);
eq("a chromatic nudge lands in the bass when the bass is in hand", T.doc.bass[0], "C#3");
eq("and the lead is untouched", T.doc.steps[0], "C4");
T.setVoice(0);

console.log("\n== the range is clamped ==");
reset(); page({15:"C6"});
hold(GP.TR);
eq("a move above C6 stops at C6", T.doc.steps[0], "C6");
ok("and says so", /end of the range/.test(ids.footer.textContent), ids.footer.textContent);
reset(); page({15:"C2"});
hold(GP.X);
eq("a move below C2 stops at C2", T.doc.steps[0], "C2");
reset(); page({15:"B5"});
hold(GP.R2, GP.TR);
eq("a fifth past the ceiling clamps", T.doc.steps[0], "C6");
reset(); page({0:"C6"}); T.cursor = 0;
hold(GP.DR); eq("nudge clamps too", T.doc.steps[0], "C6");
eq("the range is C2 to C6", [T.MIDI_LO, T.MIDI_HI], [36, 84]);
eq("nameOfMidi agrees at the floor", T.nameOfMidi(36), "C2");
eq("and at the ceiling", T.nameOfMidi(84), "C6");

console.log("\n== the four shoulders, sorted by the hand ==");
/* The bumpers were the base octave and, in the method that has now gone, the
   leap modifiers as well — which meant every bumper press had to be held open
   until release to find out which of the two it had been. That was the one
   place on the pad where the same button could surprise you, and it is gone:
   a trigger is leaned on and modifies, a bumper is tapped and changes hands,
   and neither does two jobs. */
reset();
eq("the lead is the hand at rest", T.voice, 0);
press(GP.R1); eq("R1 taps on to the next voice", T.voice, 1);
press(GP.L1); eq("L1 walks the ring the other way", T.voice, 0);
eq("the ring is the order the voices are named in", T.VOICE_NAMES, ["lead","bass"]);
press(GP.R1);
key("KeyZ");
eq("and the note that follows goes into the hand it chose", T.doc.bass[0], "C4");
eq("and not into the other", T.doc.steps[0], null);
eq("changing hands wrote nothing by itself", T.cursor, 2);
press(GP.L1);
/* the octave is not on the shoulders and is nowhere on the pad: an octave
   setting has nothing to say to a method that counts from the note before */
reset();
press(GP.L1); eq("a tap of a bumper is not the octave", T.baseOctave, 4);
ok("nor is the octave anywhere on the pad at all",
   T.SETTINGS.every(s => !/octave/i.test(s.label)), T.SETTINGS.map(s => s.label));
press(GP.R1);
/* the triggers modify and write nothing at all on their own */
reset(); page({15:"C4"});
press(GP.L2);
eq("a trigger alone writes nothing", T.doc.steps[0], null);
press(GP.R2);
eq("nor does the other", T.doc.steps[0], null);
eq("and neither is the voice", T.voice, 0);
reset(); page({15:"C4"});
hold(GP.L2, GP.TR);
eq("a trigger held is the leap", T.doc.steps[0], "E4");
eq("and the octave is untouched by it", T.baseOctave, 4);
reset(); page({15:"C4"});
hold(GP.L2, GP.R2, GP.TR);
eq("both held is the semitone, out of the key", T.doc.steps[0], "C#4");
reset(); page({15:"C4"});
hold(GP.L2, GP.B);
eq("○ ignores the triggers", T.doc.steps[0], "C4");
/* the bumpers are inert on every page that has its own use for them */
reset();
press(GP.START);
press(GP.R1); eq("nor inside the settings crossbar", T.voice, 0);
key("Escape");
reset();

console.log("\n== the bare face buttons are the contour, and only that ==");
/* □ was a clear in absolute entry and a rest in relative, which were the same
   move under two names; it is simply the rest now. △ was the voice when it was
   free and a move when it was not; it is simply the move. */
reset();
page({3:"C4"}); T.cursor = 3;
press(GP.SQ); eq("□ still clears the step", T.doc.steps[3], null);
eq("and advances by two, as a note does", T.cursor, 5);
reset(); page({15:"C4"});
press(GP.B); eq("○ is the note again, never a jump home", T.doc.steps[0], "C4");
reset(); page({15:"C4"});
press(GP.TR); eq("△ is a move, never the voice", T.doc.steps[0], "D4");
eq("and did not change hands", T.voice, 0);
reset(); page({15:"C4"});
press(GP.X); eq("✕ is the move down", T.doc.steps[0], "B3");

console.log("\n== the rest of the pad ==");
reset();
press(GP.L3); eq("L3 cycles the loop length", T.doc.loop, 8);
press(GP.DU); eq("d-pad up moves the cursor", T.cursor, 15);
press(GP.DD); eq("d-pad down moves the cursor", T.cursor, 0);
stick([0, 1]); eq("left stick down moves the cursor", T.cursor, 1);
stick([0, 0, 0, 1]); eq("the right stick strides by fours", T.cursor, 5);
reset();
press(GP.DU); eq("relative: d-pad up still moves the cursor", T.cursor, 15);
press(GP.DD); eq("relative: d-pad down still moves the cursor", T.cursor, 0);
stick([0, 0, 0, 1]); eq("relative: the right stick still strides", T.cursor, 4);
press(GP.L3); eq("relative: L3 is still the loop", T.doc.loop, 8);
press(GP.R3); eq("relative: R3 is still the roll", T.viz, "roll");
press(GP.R3);
reset();
press(GP.START); ok("start raises the settings crossbar", ids.settings.classList.contains("on"));
press(GP.START); ok("and start puts it down again", !ids.settings.classList.contains("on"));

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
sounded.length = 0; clock.t = 0; T.schedFrom(0);
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
duet({0:"E4"}, {0:"E2"}); T.cursor = 0; key("Tab");
hold(GP.DR);
eq("nudge moves the bass note", T.doc.bass[0], "F2");
eq("and not the lead's", T.doc.steps[0], "E4");
/* the anchor relative entry counts from is the hand's own line */
reset();
duet({15:"C5"}, {15:"C3"}); key("Tab");
hold(GP.TR);
eq("a step up is counted from the bass's own anchor", T.doc.bass[0], "D3");
/* the pages hold tab still, as they hold note entry */
reset();
key("F3"); key("Tab");
eq("tab is inert in the quest log", T.voice, 0);
key("F3");
press(GP.START); key("Tab");
eq("and inside the settings crossbar", T.voice, 0);
key("Escape");
/* the pad: △ is a move and never the voice, which is the other half of the
   rework the shoulders' section proves from its own side */
reset(); page({15:"C4"});
press(GP.TR);
eq("△ writes a move", T.doc.steps[0], "D4");
eq("and does not change hands", T.voice, 0);

console.log("\n== solo and mute ==");
reset();
duet({0:"C4"}, {0:"C2"});
ok("both voices are audible at rest", T.audible(0) && T.audible(1));
key("KeyP");
ok("P mutes the voice in hand", !T.audible(0));
ok("and leaves the other alone", T.audible(1));
ok("the strip says so", /muted/.test(ids.vmark0.textContent), ids.vmark0.textContent);
ok("and the header does not say it a second time",
   !/muted/.test(ids.metatext.textContent), ids.metatext.textContent);
key("KeyP");
ok("P again gives it back", T.audible(0));
key("Tab"); key("KeyO");
ok("O solos the voice in hand", T.audible(1));
ok("and takes the other away", !T.audible(0));
ok("the strip marks the solo", /solo/.test(ids.vmark1.textContent), ids.vmark1.textContent);
/* and the voice it silenced says so in a word, not in a dash */
ok("and marks the voice it silenced", /silent/.test(ids.vmark0.textContent),
   ids.vmark0.textContent);
key("KeyO");
ok("O again brings both back", T.audible(0) && T.audible(1));
/* solo beats mute, as it does on every desk */
reset(); duet({0:"C4"}, {0:"C2"});
key("KeyP"); /* the lead muted */
key("Tab"); key("KeyO"); /* the bass soloed */
ok("a soloed voice is heard even so", T.audible(1));
key("Tab"); key("KeyO");
ok("and a muted voice soloed is heard too", T.audible(0), [T.doc.mute, T.doc.solo]);
/* what the scheduler actually does with all that */
function heard(){
  T.audioInit(); T.setPlaying(true);
  sounded.length = 0; clock.t = 0; T.schedFrom(0);
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
sounded.length = 0; clock.t = 0; T.schedFrom(0);
T.scheduler(); clock.t = 0.14; T.scheduler();
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
/* the strip names the hand, and it is the only thing that does */
reset();
ok("the strip marks the voice in hand", /on/.test(ids.vname0.className), ids.vname0.className);
key("Tab");
ok("and follows it", /on/.test(ids.vname1.className) && !/on/.test(ids.vname0.className),
   [ids.vname0.className, ids.vname1.className]);
ok("the header names no voice at all", !/lead|bass/.test(ids.metatext.textContent),
   ids.metatext.textContent);
key("Tab");

console.log("\n== the scheduler still only sounds real notes ==");
reset();
page({0:"C4", 1:"E4"});
T.audioInit(); T.setPlaying(true);
sounded.length = 0; clock.t = 0; T.schedFrom(0);
T.scheduler(); clock.t = 0.14; T.scheduler();
ok("C4 sounds at 261.63", sounded.length >= 1 && Math.abs(sounded[0].freq - 261.6255653005986) < 1e-6, sounded);
ok("E4 sounds at 329.63", sounded.length >= 2 && Math.abs(sounded[1].freq - 329.6275569128699) < 1e-6, sounded);
T.setPlaying(false);

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
key("F3"); press(GP.START);
ok("the crossbar closes the quest log", !ids.quests.classList.contains("on"));
key("Escape");
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
key("ArrowLeft"); eq("and so is left", T.qsel, 0);
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
ok("the meta line does not name the quest — both margins already do",
   ids.metatext.textContent.indexOf("summit") < 0, ids.metatext.textContent);
ok("it carries that workspace's own tempo and key instead",
   /^112 · D major$/.test(ids.metatext.textContent),
   ids.metatext.textContent);
eq("and the margin is where the quest is named", ids.railtitle.textContent, "The Summit");
eq("stored as the id", JSON.parse(store[T.QUEST_KEY]).active, Q[2].id);
eq("and the storage key is version 2", JSON.parse(store[T.QUEST_KEY]).version, 2);
T.resetQuests(); T.loadQuests(); T.renderQuests();
eq("restored from storage", T.qActive, Q[2].id);
closePages();

console.log("\n== nothing is ever copied between workspaces ==");
qreset();
key("KeyZ"); /* free play: C4 */
key("F3"); key("Enter"); key("F3"); /* quest A, empty */
eq("entering a quest does not bring the page with it", T.doc.steps[0], null);
key("KeyX"); /* A: D4 */
key("F3"); key("Enter"); key("F3"); /* back to free play */
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
key("Enter"); /* back to free play */
eq("and a quest with something written shows the dot", T.questGlyph(Q[0].id), "•");
eq("the row agrees", T.qrows[0].stat.textContent, "•");
key("KeyC");
/* complete used to take that column and hide the sword saying you are
   standing in it; it has a mark of its own at the end of the line now */
eq("complete does not take the column from the dot", T.questGlyph(Q[0].id), "•");
eq("the row says complete in its own place", T.qrows[0].stat.textContent, "❧");
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
key("F3"); key("Enter"); key("F3"); /* into quest A */
key("KeyZ"); key("Period"); key("KeyN"); /* C4 on 1, a rest on 3, A4 on 5 */
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
/* the margin is one lesson deep now, so it has nothing to divide */
eq("nor any in the margin, ever", hairs(T.railEl, "rhair"), 0);

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
eq("the left rail has a line for it too", T.rrowsNow.length, 10);
/* the margin shows the tab the board is on, and not before */
eq("but the margin is on Lesson 1, and shows Lesson 1", T.railOrder().length, 9);
T.setTab(0, true);
eq("turning to the drills turns the margin with it",
   T.railOrder(), [null, "drill-itch"]);
eq("and the drill's name in the margin", T.rrowsNow[9].name.textContent, "the itch drill");
eq("with no divider needed to say so", hairs(T.railEl, "rhair"), 0);
T.setTab(1, true);
eq("a second drill lands after the first", (T.applyState(logWith([ITCH, SECOND])), T.ALL.length), 10);
eq("still the two tabs", T.tabList().length, 2);

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

/* ================= 5. the documentation ================= */
console.log("\n== the tempo of the piece ==");
qreset();
eq("112 is still where a fresh page starts", T.doc.tempo, 112);
eq("the range is 60 to 180", [T.TEMPO_MIN, T.TEMPO_MAX], [60, 180]);
eq("the coarse step is four, the fine step one", [T.TEMPO_STEP, T.TEMPO_FINE], [4, 1]);
/* − and + on the page are the note's length and nothing else now that the
   page of the key is gone; the tempo is not on them anywhere */
key("Equal"); key("Minus");
eq("the two keys left of backspace never reach the tempo", T.doc.tempo, 112);
T.shiftTempo(T.TEMPO_STEP);  eq("the coarse step raises it by four", T.doc.tempo, 116);
T.shiftTempo(-T.TEMPO_STEP); eq("and lowers it by four", T.doc.tempo, 112);
T.shiftTempo(T.TEMPO_FINE);  eq("the fine step, by one", T.doc.tempo, 113);
T.shiftTempo(-T.TEMPO_FINE); eq("and down by one", T.doc.tempo, 112);
ok("the footer says the new tempo", /tempo · 112/.test(ids.footer.textContent), ids.footer.textContent);
ok("the header meta leads with it", /^112 · /.test(ids.metatext.textContent), ids.metatext.textContent);
for (let i = 0; i < 40; i++) T.shiftTempo(T.TEMPO_STEP);
eq("it clamps at 180", T.doc.tempo, 180);
ok("and says so", /the end of the range/.test(ids.footer.textContent), ids.footer.textContent);
T.shiftTempo(T.TEMPO_FINE); eq("the fine step clamps too", T.doc.tempo, 180);
for (let i = 0; i < 40; i++) T.shiftTempo(-T.TEMPO_STEP);
eq("and at 60 the other way", T.doc.tempo, 60);
T.shiftTempo(-T.TEMPO_FINE); eq("finely too", T.doc.tempo, 60);
T.shiftTempo(T.TEMPO_FINE);  eq("one off the floor", T.doc.tempo, 61);
ok("the tempo is autosaved like everything else",
   JSON.parse(store["folio.v1"]).tempo === 61, store["folio.v1"]);
T.shiftTonic(-1); T.shiftTonic(1);
eq("moving the key left the tempo alone", T.doc.tempo, 61);

console.log("\n== the tempo belongs to the workspace ==");
qreset();
T.shiftTempo(T.TEMPO_STEP); T.shiftTempo(T.TEMPO_STEP); /* free play: 120 */
eq("free play took the change", T.doc.tempo, 120);
key("F3"); key("Enter"); key("F3"); /* into quest A (ladder) */
eq("the quest arrived at its own tempo", T.doc.tempo, 120);
for (let i = 0; i < 5; i++) T.shiftTempo(T.TEMPO_STEP);
eq("and takes its own change", T.doc.tempo, 140);
key("F3"); key("ArrowDown"); key("Enter"); key("F3"); /* into quest B (whitespace) */
eq("quest B is not carrying quest A's tempo", T.doc.tempo, 88);
key("F3"); key("ArrowUp"); key("Enter"); key("F3"); /* back into A */
eq("A kept its 140", T.doc.tempo, 140);
key("F3"); key("Enter"); key("F3"); /* back to free play */
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
page({}); /* every step sounds, so every window shows */
for (let i = 0; i < 16; i++) T.doc.steps[i] = "C4";
T.audioInit(); T.setPlaying(true);
sounded.length = 0; clock.t = 0; T.schedFrom(0);
const d112 = 60 / 112 / 4;
ok("the step duration follows the tempo", Math.abs(T.stepDur() - d112) < 1e-12, T.stepDur());
T.scheduler();
eq("the first window schedules one step", sounded.length, 1);
ok("at the top of the clock", Math.abs(sounded[0].at - 0) < 1e-12, sounded[0]);
T.doc.tempo = 60; /* the dial moves while it runs */
const d60 = 60 / 60 / 4;
ok("the duration follows immediately", Math.abs(T.stepDur() - d60) < 1e-12, T.stepDur());
clock.t = d112; T.scheduler();
eq("the next window still schedules exactly one step", sounded.length, 2);
ok("the step already committed keeps its time — nothing is rescheduled",
   Math.abs(sounded[0].at - 0) < 1e-12, sounded[0]);
ok("and the one that was already queued lands where it was promised",
   Math.abs(sounded[1].at - d112) < 1e-12, sounded[1]);
clock.t = d112 + d60; T.scheduler();
eq("and the window after that", sounded.length, 3);
ok("the gap after the change is the new step duration",
   Math.abs((sounded[2].at - sounded[1].at) - d60) < 1e-12,
   sounded[2].at - sounded[1].at);
T.doc.tempo = 180;
const d180 = 60 / 180 / 4;
clock.t = d112 + 2 * d60; T.scheduler(); /* this step was promised at the old rate */
ok("a step already promised keeps the old spacing",
   Math.abs((sounded[3].at - sounded[2].at) - d60) < 1e-12,
   sounded[3].at - sounded[2].at);
clock.t = d112 + 2 * d60 + d180; T.scheduler();
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
/* the whole table in one check, so that a seed changing anywhere is caught
   without eight near-identical lines saying it */
eq("every seed is the table it should be",
   Q.map(q => [q.id, T.SEEDS[q.id].key, T.SEEDS[q.id].tempo]),
   Q.map(q => [q.id, SEED_TABLE[q.id][0], SEED_TABLE[q.id][1]]));
/* and that the seed is what a fresh workspace actually arrives holding —
   which is one rule, so it is driven for the first quest and the last */
for (const i of [0, Q.length - 1]){
  qreset(); key("F3");
  for (let j = 0; j < i; j++) key("ArrowDown");
  key("Enter"); key("F3");
  const want = SEED_TABLE[Q[i].id];
  eq("entering " + Q[i].id + " lands in " + want[0] + " at " + want[1],
     [T.doc.key, T.doc.tempo], want);
  ok("… and the header says so",
     ids.metatext.textContent.indexOf(want[1] + " · ") === 0 &&
     ids.metatext.textContent.indexOf(want[0]) > 0, ids.metatext.textContent);
  eq("… with an empty page, its whole loop and its untouched title",
     [T.doc.steps.filter(Boolean).length, T.doc.loop, T.doc.title],
     [0, 16, "untitled folio"]);
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
qreset(); key("F3"); key("Enter"); key("F3"); /* ladder: G major 120 */
eq("seeded", [T.doc.key, T.doc.tempo], ["G major", 120]);
T.shiftTonic(1); T.shiftTempo(-T.TEMPO_STEP); T.shiftTempo(-T.TEMPO_STEP);
eq("a change overrides the seeded key", T.doc.key, "G# major");
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
key("F3"); for (let i = 0; i < 6; i++) key("ArrowDown"); key("Enter"); key("F3"); /* stray: E minor */
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
closePages();

console.log("\n== the seeded tempo is the tempo that plays ==");
qreset();
key("F3"); key("ArrowDown"); key("Enter"); key("F3"); /* whitespace: 88 */
eq("whitespace plays at 88", T.doc.tempo, 88);
ok("and the scheduler agrees", Math.abs(T.stepDur() - 60/88/4) < 1e-12, T.stepDur());
T.doc.steps[0] = "C4"; T.doc.steps[1] = "D4"; /* written into the seeded page itself */
T.audioInit(); T.setPlaying(true);
sounded.length = 0; clock.t = 0; T.schedFrom(0);
T.scheduler(); clock.t = 60/88/4; T.scheduler();
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
/* compound: the simple number plus seven for every octave crossed. One case
   an octave up, one two octaves up, and the tritone at each — which is the
   only name that is not a number and so the only one that can go wrong. */
eq("13 semitones compounds to m9", T.intervalName(13), "m9");
eq("18 — a tritone and an octave — to TT11", T.intervalName(18), "TT11");
eq("two octaves to P15", T.intervalName(24), "P15");
eq("27 to m17", T.intervalName(27), "m17");
eq("30 to TT18", T.intervalName(30), "TT18");
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
/* ================= the board, read one lesson at a time =================
   Tabs, favourites and the player's own order.
   Everything here is keyboard-first and everything persistent is an
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

console.log("\n== choosing from the margin brings the lesson forward ==");
qreset(); T.applyState(logWith([L2A]));
T.setTab(1, true);
T.switchWorkspace("l2-shadow-x");
eq("the caret followed the workspace", T.ALL[T.qsel].id, "l2-shadow-x");
eq("and its lesson came forward with it", T.activeTab, 2);

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

console.log("\n== keeping the key down ==");
reset();
key("KeyZ");
eq("the note goes in as the sixteenth it always was", T.writtenLen(T.doc, 0, 0), 1);
eq("and the cursor is two steps on", T.cursor, 2);
ok("with the key still down, that note is the one growing", T.grow && T.grow.i === 0);
clock.pad += 100; T.growTick();
eq("a tap is shorter than the wait, so nothing grew", T.writtenLen(T.doc, 0, 0), 1);
clock.pad += T.GROW_DELAY; T.growTick();
eq("held past the wait, it grows a step", T.writtenLen(T.doc, 0, 0), 2);
eq("and the cursor has not had to move for it", T.cursor, 2);
clock.pad += T.growStep(); T.growTick();
eq("and another", T.writtenLen(T.doc, 0, 0), 3);
eq("the cursor rides just past the end of what is being written", T.cursor, 3);
key("ArrowRight");
ok("any other key ends the growing", !T.grow);
clock.pad += 1000; T.growTick();
eq("so the note stops where it was let go", T.writtenLen(T.doc, 0, 0), 3);

reset();
page({ 4:"E4" }); T.cursor = 0;
key("KeyZ");
for (let i = 0; i < 12; i++){ clock.pad += 400; T.growTick(); }
eq("a note grown by hand still cannot swallow the next one",
   T.writtenLen(T.doc, 0, 0), 4);
T.growStop();
reset();
key("KeyZ"); key("F3");                /* a page comes up over the top */
clock.pad += 1000; T.growTick();
eq("a page coming up ends it too", T.writtenLen(T.doc, 0, 0), 1);
ok("and forgets it", !T.grow);
key("F3");

console.log("\n== the same gesture on the pad ==");
/* the crossbar this used to be written against is gone: the pad's only way of
   writing is the face buttons, so they are the only thing that can hold a
   note down */
reset();
frame([GP.TR]);
ok("the shape button holds the note it just wrote",
   T.grow && T.grow.btn === GP.TR);
clock.pad += 400; T.growTick();
eq("and grows it", T.writtenLen(T.doc, 0, 0), 2);
frame([]);
ok("letting the button go stops it", !T.grow);
clock.pad += 1000; T.growTick();
eq("and the note stays as long as it was made", T.writtenLen(T.doc, 0, 0), 2);
reset();
frame([GP.X]);
ok("the downward one holds it too", T.grow && T.grow.btn === GP.X);
frame([]);
reset();
frame([GP.B]);
ok("and so does the one that says the same note again", T.grow && T.grow.btn === GP.B);
frame([]);
reset();
frame([GP.SQ]);
ok("the rest writes nothing, so it grows nothing", !T.grow);
frame([]);
/* the leap still writes, and the note it writes is the one under the thumb */
reset();
page({ 0:"C4" }); T.cursor = 2;
frame([GP.L2]); frame([GP.L2, GP.TR]);
eq("a leap under a trigger still writes its note", T.doc.steps[2], "E4");
ok("and that note is the one growing", T.grow && T.grow.btn === GP.TR);
clock.pad += 400; T.growTick();
eq("so a leap can be held down as well", T.writtenLen(T.doc, 0, 2), 2);
frame([]);

console.log("\n== the note's two edges, on the triggers ==");
/* the designed collision, resolved: one trigger under the d-pad's ←→ is an
   edge, both of them are the nudge out of the key, and either of them under a
   face button is still the leap. The leap reads a button edge and the edge
   reads a direction, so neither can take the other's input. */
reset();
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
/* both triggers together are what they always were on this pair: the nudge,
   out of the key. No edge is moved, and no length is spent. */
page({ 4:"E4" }); T.cursor = 4;
hold(GP.L2, GP.R2, GP.DR);
eq("both triggers at once are the chromatic nudge, not an edge", T.doc.steps[4], "F4");
eq("and no length is spent on it", T.writtenLen(T.doc, 0, 4), 1);
page({ 4:"E4" }); T.cursor = 4;
T.setLen(0, 4, 3, true);
hold(GP.L2, GP.R2, GP.DR);
eq("a held note nudged out of key keeps its length", T.writtenLen(T.doc, 0, 4), 3);
eq("and is the note it was moved to", T.doc.steps[4], "F4");
/* the edge does not swallow the leap, nor the leap the edge */
page({ 4:"E4" }); T.cursor = 4;
frame([GP.L2]); frame([GP.L2, GP.DR]); frame([GP.L2]);
eq("an edge moved under L2 wrote no note of its own",
   T.doc.steps.filter(Boolean).length, 1);
frame([GP.L2, GP.TR]); frame([]);
eq("and the very next face button under the same held trigger is a leap",
   T.doc.steps[4], "G4");
page({ 4:"E4" }); T.cursor = 4;
frame([GP.R2]); frame([GP.R2, GP.TR]);
eq("a leap under R2 then an edge under the same hold: the leap wrote",
   T.doc.steps[4], "B4");
T.cursor = 4;                          /* the leap advanced, as writing does */
frame([GP.R2, GP.DR]); frame([]);
eq("and the edge lengthened, without a second note", T.writtenLen(T.doc, 0, 4), 2);
eq("and nothing else was written", T.doc.steps.filter(Boolean).length, 1);
/* letting a trigger go is not a tap of anything: it has no bare job at all */
reset();
const voice0 = T.voice, oct0 = T.baseOctave;
frame([GP.L2]); frame([GP.L2, GP.DR]); frame([]); frame([]);
eq("a released trigger changes no hand", T.voice, voice0);
eq("nor the octave", T.baseOctave, oct0);
eq("and wrote nothing", T.doc.steps.filter(Boolean).length, 0);

console.log("\n== the pad across frames ==");
/* Everything above presses the pad one frame at a time, which is not how a
   hand plays it: the modifier goes down several frames before the thumb
   lands, the releases stagger, and the poll can catch a roll-off in a single
   frame. This section was a harness of its own (leaptest.js) that enumerated
   every combination; what is left is one case per rule, because the rules
   themselves are proved above and what is at issue here is only timing. */
function stagePad(anchor, key){
  T.setDoc({ version:1, title:"t", tempo:112, loop:16, key: key || "C major",
             steps: steps({ 15: anchor === undefined ? "C4" : anchor }) });
  T.cursor = 0; T.baseOctave = 4; useColumn();
  frame([]); frame([]);
}
function wrote(){ return T.doc.steps[0]; }
/* the modifier settles, the button edges under it, both let go after */
function leapHeld(mods, face){
  stagePad();
  frames(3, mods);
  frame(mods.concat([face]));
  frames(2, mods);
  frames(2, []);
  return wrote();
}
eq("L2 held, then \u2715 three frames later: still a third down", leapHeld([GP.L2], GP.X), "A3");
eq("R2 held, then \u25b3: still a fifth up", leapHeld([GP.R2], GP.TR), "G4");
eq("both held, then \u2715: still the semitone", leapHeld([GP.L2, GP.R2], GP.X), "B3");
eq("and no hold of a trigger ever moved the octave", T.baseOctave, 4);
/* the trigger let go before the face button, which is the commoner grip */
stagePad();
frames(3, [GP.R2]); frame([GP.R2, GP.X]); frames(2, [GP.X]); frames(2, []);
eq("R2 released before \u2715: still a fifth down", wrote(), "F3");
/* a trigger arriving after the button is not retroactive */
stagePad();
frames(3, [GP.X]);
eq("\u2715 alone wrote a bare step down", wrote(), "B3");
frames(3, [GP.X, GP.L2]); frames(2, [GP.X]); frames(2, []);
eq("a trigger arriving late writes nothing more", T.doc.steps[2], null);
eq("and did not widen what was already written", wrote(), "B3");
/* the same frame, and the tie */
stagePad(); frame([GP.L2, GP.X]); frames(3, []);
eq("L2 and \u2715 on one frame: a third down", wrote(), "A3");
stagePad(); frames(3, [GP.R2]); frame([GP.R2, GP.TR, GP.X]); frames(3, []);
eq("\u25b3 wins a same-frame tie with \u2715, trigger and all", wrote(), "G4");
/* and the far commoner case: \u2715 under a trigger never reads as \u25b3,
   at any gap between the two presses */
let swung = 0;
for (const mods of [[GP.L2], [GP.R2], [GP.L2, GP.R2]]){
  for (let gap = 1; gap <= 6; gap++){
    stagePad();
    frames(gap, mods); frame(mods.concat([GP.X])); frames(2, mods); frames(2, []);
    if (!{ "A3":1, "F3":1, "B3":1 }[wrote()] || T.baseOctave !== 4) swung++;
  }
}
ok("\u2715 under every trigger, at every gap, swings down", swung === 0, swung);
/* the roll-off: the trigger let go on the very frame the thumb lands is one
   movement and one leap, not a lost modifier and a bare step. A whole frame
   later it is a bare step, and that is the whole of the grace. */
stagePad(); frames(3, [GP.R2]); frame([GP.X]); frames(3, []);
eq("R2 released as \u2715 edges: still a fifth down", wrote(), "F3");
stagePad(); frames(3, [GP.R2]); frame([]); frame([GP.X]); frames(3, []);
eq("a whole frame later it is a bare step down", wrote(), "B3");
/* a trigger has no bare job: pressed and released with nothing under it, it
   writes nothing, moves no octave and changes no hand */
stagePad(); frames(3, [GP.L2]); frames(3, []);
eq("a bare hold-and-release of L2 writes nothing", wrote(), null);
eq("and touches neither the octave nor the voice", [T.baseOctave, T.voice], [4, 0]);
/* several taps under one unbroken hold, each two steps on */
stagePad();
frames(2, [GP.L2]);
for (let i = 0; i < 3; i++){ frame([GP.L2, GP.X]); frames(2, [GP.L2]); }
frames(3, []);
eq("three thirds down under one held L2",
   [T.doc.steps[0], T.doc.steps[2], T.doc.steps[4]], ["A3","F3","D3"]);
/* the three jobs of a trigger, told apart across frames: one alone under a
   direction is the note's edge, both under a direction are the hatch, and
   either under a face button is still the leap */
function nudgeHeld(mods, dir, note, key){
  T.setDoc({ version:1, title:"t", tempo:112, loop:16, key: key || "C major",
             steps: steps({ 0: note === undefined ? "C4" : note }) });
  T.cursor = 0; T.baseOctave = 4;
  frame([]); frame([]);
  frames(3, mods); frame(mods.concat([dir])); frames(2, mods); frames(2, []);
  return wrote();
}
useColumn();
eq("both held, then the d-pad: the semitone", nudgeHeld([GP.L2, GP.R2], GP.DR), "C#4");
eq("R2 alone leaves the pitch alone \u2014 it is the note's end",
   nudgeHeld([GP.R2], GP.DR), "C4");
eq("and lengthened it instead", T.writtenLen(T.doc, 0, 0), 2);
eq("bare, the d-pad is the step of the key it always was", nudgeHeld([], GP.DR), "D4");
/* an edge and a leap under one unbroken hold, in that order */
T.setDoc({ version:1, title:"t", tempo:112, loop:16, key:"C major", steps: steps({0:"C4"}) });
T.cursor = 0; T.baseOctave = 4; frame([]); frame([]);
frames(3, [GP.R2]);
frame([GP.R2, GP.DR]); frames(2, [GP.R2]);
frame([GP.R2, GP.TR]); frames(2, [GP.R2]); frames(2, []);
eq("an edge then a leap under one hold: the leap leapt", wrote(), "G4");
/* rolling off the triggers as the d-pad lands is one move as well */
T.setDoc({ version:1, title:"t", tempo:112, loop:16, key:"C major", steps: steps({0:"C4"}) });
T.cursor = 0; T.baseOctave = 4; frame([]); frame([]);
frame([GP.L2, GP.R2]); frame([GP.DR]); frames(2, []);
eq("rolling off the triggers as the d-pad lands is still the semitone", wrote(), "C#4");
/* in the roll the pairs trade places, and the modifier means the same thing */
useRoll();
eq("both held, then the roll's up: the semitone", nudgeHeld([GP.L2, GP.R2], GP.DU), "C#4");
eq("and bare it is a step of the key", nudgeHeld([], GP.DU), "D4");
useColumn();
/* the bumpers, which are the voice and nothing else, across frames */
stagePad();
frames(2, [GP.R1]); frames(2, []);
eq("a tap of R1 changes hands", T.voice, 1);
eq("and writes nothing", wrote(), null);
frames(2, [GP.L1]); frames(2, []);
eq("and L1 walks the ring back", T.voice, 0);
frames(1, [GP.R1]); frames(20, [GP.R1]); frames(2, []);
eq("holding a bumper changes hands once and then stops", T.voice, 1);
frames(2, [GP.L1]); frames(2, []);
eq("and once more to come back", T.voice, 0);
/* a bumper under a face button is not a modifier: it changes hands, so the
   note lands in the other line, and the move itself is untouched */
T.setDoc({ version:1, title:"t", tempo:112, loop:16, key:"C major",
           steps: steps({15:"C4"}), bass: steps({15:"C4"}) });
T.cursor = 0; T.baseOctave = 4; frame([]); frame([]);
frames(3, [GP.L1]); frame([GP.L1, GP.X]); frames(3, []);
eq("L1 held under \u2715 did not widen the move", T.doc.bass[0], "B3");
eq("it changed hands instead, which is all it does", T.voice, 1);
eq("and the lead was left alone", T.doc.steps[0], null);
frames(2, [GP.R1]); frames(2, []);
eq("and back to the lead", T.voice, 0);
reset();

console.log("\n== what a held note sounds like ==");
reset();
page({ 0:"C4" });
T.setLen(0, 0, 4, true);
sounded.length = 0; clock.t = 0; T.schedFrom(0);
T.scheduler();
eq("the note is scheduled once", sounded.length, 1);
const dur1 = T.stepDur();
ok("for as long as it is written to last",
   Math.abs((sounded[0].off - sounded[0].at) - (4 * dur1 - T.TAIL + 0.01)) < 1e-9,
   { off: sounded[0].off, at: sounded[0].at, want: 4 * dur1 - T.TAIL + 0.01 });
for (let i = 1; i <= 4; i++){ clock.t = i * dur1; T.scheduler(); }
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
sounded.length = 0; clock.t = 0; T.schedFrom(0); T.scheduler();
const env1 = sounded[0].gain.calls;
ok("a plain sixteenth keeps the release it always had",
   Math.abs(env1[env1.length-1][2] - env1[env1.length-2][2] - T.TONE[0].release) < 1e-9,
   env1);

page({ 14:"G4" });
T.setLen(0, 14, 4, true);
sounded.length = 0; clock.t = 0; T.schedFrom(14);
T.scheduler();
eq("a note at the seam is scheduled once", sounded.length, 1);
ok("and rings on through the wrap rather than being struck again",
   Math.abs((sounded[0].off - sounded[0].at) - (4 * dur1 - T.TAIL + 0.01)) < 1e-9,
   sounded[0]);
for (let i = 1; i <= 4; i++){ clock.t = i * dur1; T.scheduler(); }
eq("the loop coming round strikes nothing", sounded.length, 1);

duet({ 0:"C4" }, { 0:"C3" });
T.setLen(0, 0, 4, true);
sounded.length = 0; clock.t = 0; T.schedFrom(0); T.scheduler();
eq("both voices sound from the one clock as they always did", sounded.length, 2);
ok("and each is as long as it is written",
   Math.abs((sounded[0].off - sounded[0].at) - (4 * dur1 - T.TAIL + 0.01)) < 1e-9 &&
   Math.abs((sounded[1].off - sounded[1].at) - (1 * dur1 - T.TAIL + 0.01)) < 1e-9,
   sounded.map(x => x.off - x.at));

/* ================= the key overlay =================
   Not what it looks like — a browser's question — but what the press does:
   F1 raises it and puts it down, is never handed on (loose, F1 is Chrome's
   help window and the folio loses the frame it animates on), and while it is
   up the board is inert. */
console.log("\n== the key overlay ==");
reset(); let swallowed = false;
const f1 = () => key("F1", { preventDefault(){ swallowed = true; } });
f1();
ok("F1 raises it, and the press never reaches the browser", T.keysOpen() && swallowed);
const wasPage = T.docJSON(); key("KeyZ"); key("Period"); key("ArrowDown"); key("F3");
eq("the board writes nothing at all while it is up", T.docJSON(), wasPage);
ok("and no other page opens under it", !ids.quests.classList.contains("on"));
eq("it names the mode it is describing", T.keysNow().where.indexOf("the folio"), 0);
f1(); ok("F1 again puts it down", !T.keysOpen());
key("KeyZ"); ok("and the board writes again", T.doc.steps[0] !== null);
reset(); f1(); key("Escape");
ok("escape puts it down too", !T.keysOpen());
T.toggleQuests(); f1();
ok("it opens over the quest log as well", T.keysOpen());
eq("and says so there", T.keysNow().where, "the quest log");
T.closeKeys(); T.toggleQuests(); reset();

/* ================= the crossbar's scriptorium =================
   The room with the dials in it is gone. What a voice sounds like is a rail
   on the crossbar's second drawing: L1 and R1 turn to it, and then the four
   directions are two rails — up and down the lead's, left and right the
   bass's. Walking is arriving, and where it arrives is the *page*, so it
   autosaves and it follows the workspace. */
console.log("\n== the crossbar, turned to the scriptorium ==");
closePages(); reset();
page({}); T.cursor = 0;
R.key("KeyW");
ok("W is the note it has always been, no room to swallow it", T.doc.steps[0] !== null,
   T.doc.steps[0]);
ok("and F4 raises nothing", (R.key("F4"), !T.keysOpen() &&
   !ids.quests.classList.contains("on") && !ids.settings.classList.contains("on")));
reset();
eq("a fresh page is on its own tones", T.validate(T.doc).tones, [null, null]);
/* an earlier check up the file leaves the crossbar on whichever drawing it
   was turned to, so the drawing is set here rather than assumed */
T.xbarMode = 0;
press(GP.START);
ok("start raises the crossbar", ids.settings.classList.contains("on"));
eq("it opens on the drawing it was left on", T.XBAR_MODES[T.xbarMode].name, "settings");
press(GP.R1);
eq("R1 turns it to the scriptorium", T.XBAR_MODES[T.xbarMode].name, "scriptorium");
press(GP.L1);
eq("and L1 turns it back", T.XBAR_MODES[T.xbarMode].name, "settings");
press(GP.L1);
eq("the drawings wrap", T.XBAR_MODES[T.xbarMode].name, "scriptorium");
const slots = T.xbarSlots();
eq("all four directions are the head of the slot", slots.slice(0, 4).map(x => !!x.head),
   [true, true, true, true]);
eq("up and down are the lead", [slots[1].label, slots[3].label], ["the lead", "the lead"]);
eq("left and right are the bass", [slots[0].label, slots[2].label], ["the bass", "the bass"]);
ok("and nothing is on the face buttons but the way out",
   [4, 5, 7].every(i => !slots[i].run) && !!slots[6].run);

console.log("\n== the two rails, walked ==");
frames(2, [GP.DD]); frames(2, []);
eq("down walks the lead's rail on", T.doc.tones[0], T.TONE_RAIL[0][1]);
eq("and leaves the bass alone", T.doc.tones[1], null);
frames(2, [GP.DU]); frames(2, []);
eq("up walks it back", T.doc.tones[0], null);
frames(2, [GP.DU]); frames(2, []);
eq("and past the head it wraps to the end",
   T.doc.tones[0], T.TONE_RAIL[0][T.TONE_RAIL[0].length - 1]);
press(GP.DR);
eq("right walks the bass's rail on", T.doc.tones[1], T.TONE_RAIL[1][1]);
eq("and the lead is where it was", T.doc.tones[0], T.TONE_RAIL[0][T.TONE_RAIL[0].length - 1]);
press(GP.DL);
eq("left walks it back", T.doc.tones[1], null);
press(GP.DL);
eq("and it wraps too", T.doc.tones[1], T.TONE_RAIL[1][T.TONE_RAIL[1].length - 1]);
ok("every rail begins on the voice's own tone, and neither shares a kit",
   T.TONE_RAIL.every(r => r[0] === null) &&
   T.TONE_RAIL[0].every(t => t === null || T.TONE_RAIL[1].indexOf(t) < 0));
ok("a kit that is not on this folio's shelf says so",
   / · not here$/.test(T.xbarSlots()[3].value()), T.xbarSlots()[3].value());
ok("the tones are autosaved with the page",
   JSON.stringify(JSON.parse(store["folio.v1"]).tones) === JSON.stringify(T.doc.tones),
   store["folio.v1"]);
ok("the overlay describes the drawing that is up",
   T.keysNow().where === "the settings · the scriptorium", T.keysNow().where);
press(GP.B);
ok("○ puts the crossbar down as it always did", !ids.settings.classList.contains("on"));

console.log("\n== a tone belongs to the workspace ==");
T.switchWorkspace(null);
T.doc.tones = ["piano", "sub"]; T.save();
T.switchWorkspace("stray");
eq("another workspace has its own tones", T.doc.tones, [null, null]);
T.doc.tones = ["pluck", null]; T.save();
T.switchWorkspace(null);
eq("and free play still has the ones it was left with", T.doc.tones, ["piano", "sub"]);
T.switchWorkspace("stray");
eq("as does the quest", T.doc.tones, ["pluck", null]);
ok("the log carries them per workspace",
   T.stateToJSON().quests.stray.pattern.tones.join() === "pluck,");
T.doc.tones = [null, null]; T.switchWorkspace(null);
T.doc.tones = [null, null]; T.save();
closePages(); reset();

R.done();
