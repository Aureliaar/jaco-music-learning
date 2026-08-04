/* tests/tier1.js — data integrity, and nothing else.

   This is the suite that must be green before a change is begun and green
   again before it is committed, with no exceptions and no explanations. It
   asks one question over and over: can the folio still read what it wrote,
   and can everything else still read it too?

   Four things, in order:

     1. a page, out and back — every field, the held note's lengths, the
        elision of a plain page, and the permissive reads that keep a file's
        notes when everything around them is wrong;
     2. the quest log, at version 2 — the marker, the workspaces, the marks,
        the drill definitions, the version-1 migration, and the round trip;
     3. server.mjs, driven for real — the ETag, the conditional GET, the
        atomic write, the stale-tab drill guard, and what it refuses;
     4. a boot that finds a log already there, and raises nothing.

   It is fast, it writes nothing outside a temp directory, and it never reads
   the player's own quests/quest-log.json — that file is their music, not a
   fixture. Everything the app itself does is driven through tests/rig.js. */
const fs = require("fs");
const os = require("os");
const net = require("net");
const path = require("path");
const { spawn } = require("child_process");
const rig = require("./rig.js");

const REPO = rig.REPO;
const R = rig.boot();
const { T, ok, eq } = R;

const wait = ms => new Promise(r => setTimeout(r, ms));
function freePort(start){
  return new Promise(res => {
    const s = net.createServer();
    s.once("error", () => res(freePort(start + 1)));
    s.once("listening", () => s.close(() => res(start)));
    s.listen(start, "127.0.0.1");
  });
}
const blank = R.blank, steps = R.steps;
function noteAt(o){ return steps(o); }
function pageOf(extra){
  return Object.assign({ version:1, title:"t", tempo:112, loop:16, key:"C major",
                         steps: blank(), bass: blank() }, extra || {});
}

/* ================= 1. a page, out and back ================= */
console.log("\n== the page, as the validator reads it ==");
const V = T.validate;
const d0 = V(pageOf());
ok("a plain page validates", !!d0);
eq("it is version 1", d0.version, 1);
eq("its title survives", d0.title, "t");
eq("its tempo survives", d0.tempo, 112);
eq("its loop survives", d0.loop, 16);
eq("its key survives", d0.key, "C major");
eq("it has sixteen steps", d0.steps.length, 16);
eq("and sixteen for the second voice", d0.bass.length, 16);
eq("with a length beside every lead step", d0.hold.length, 16);
eq("and beside every bass step", d0.basshold.length, 16);
eq("every length is one", d0.hold.join(), blank().map(() => 1).join());
eq("mute is a flag per voice", d0.mute, [false, false]);
eq("and solo likewise", d0.solo, [false, false]);

ok("nothing is not a page", V(null) === null);
ok("a string is not a page", V("steps") === null);
ok("an array is not a page", V([1, 2, 3]) === null);
ok("a page with no steps is not a page", V({ tempo:112 }) === null);
ok("fifteen steps is not a page", V(pageOf({ steps: new Array(15).fill(null) })) === null);
ok("seventeen steps is not a page", V(pageOf({ steps: new Array(17).fill(null) })) === null);
ok("a step that is not a note is not a page",
   V(pageOf({ steps: noteAt({ 0:"H9" }) })) === null);
ok("nor is a number where a note should be",
   V(pageOf({ steps: noteAt({ 0: 60 }) })) === null);

console.log("\n== the notes themselves ==");
const named = V(pageOf({ steps: noteAt({ 0:"C4", 3:"F#3", 7:"A#5", 15:"B2" }) }));
eq("a natural comes back as it went in", named.steps[0], "C4");
eq("a sharp likewise", named.steps[3], "F#3");
eq("high and low alike", [named.steps[7], named.steps[15]], ["A#5", "B2"]);
eq("and the rests between them are null",
   named.steps.filter(v => v === null).length, 12);
eq("a unicode sharp is normalised to the ascii one",
   V(pageOf({ steps: noteAt({ 0:"F♯4" }) })).steps[0], "F#4");
eq("whitespace around a note is forgiven",
   V(pageOf({ steps: noteAt({ 0:" C4 " }) })).steps[0], "C4");

console.log("\n== the permissive fields ==");
eq("a page with no key at all is in C major", V({ steps: blank() }).key, "C major");
eq("a key that cannot be read is C major too",
   V(pageOf({ key:"H flat wistful" })).key, "C major");
eq("a key with an underscore is read", V(pageOf({ key:"G_minor" })).key, "G minor");
eq("and one in capitals", V(pageOf({ key:"E MINOR" })).key, "E minor");
eq("a missing tempo is 112", V({ steps: blank() }).tempo, 112);
eq("a tempo that is not a number is 112", V(pageOf({ tempo:"fast" })).tempo, 112);
eq("a negative tempo is 112", V(pageOf({ tempo:-40 })).tempo, 112);
eq("a missing title is untitled", V({ steps: blank() }).title, "untitled folio");
eq("a title is cut to sixty characters",
   V(pageOf({ title:"x".repeat(200) })).title.length, 60);
eq("a loop of 4 is kept", V(pageOf({ loop:4 })).loop, 4);
eq("a loop of 8 is kept", V(pageOf({ loop:8 })).loop, 8);
eq("any other loop is the whole page", V(pageOf({ loop:5 })).loop, 16);
eq("and so is a missing one", V({ steps: blank() }).loop, 16);
eq("a missing second voice is silence", V({ steps: blank() }).bass.join(), blank().join());
eq("a second voice that cannot be read is silence, not a rejection",
   V(pageOf({ bass:["nonsense"] })).bass.join(), blank().join());
ok("and the lead is never risked for it",
   V(pageOf({ steps: noteAt({ 0:"C4" }), bass:"rubbish" })).steps[0] === "C4");
eq("mute that is not an array is two falses", V(pageOf({ mute:7 })).mute, [false, false]);
eq("solo likewise", V(pageOf({ solo:null })).solo, [false, false]);
eq("a truthy flag is read as a flag", V(pageOf({ solo:[1, 0] })).solo, [true, false]);

console.log("\n== the marks from the removed rhythm experiment ==");
const marked = V(pageOf({ steps: noteAt({ 0:"C4", 1:"x", 2:"E4" }) }));
ok("a page carrying them still reads", !!marked);
eq("the mark itself is dropped", marked.steps[1], null);
eq("and the notes around it are kept", [marked.steps[0], marked.steps[2]], ["C4", "E4"]);

/* ---- the held note: the one field Lesson 3 added ---- */
console.log("\n== the lengths beside the notes ==");
const held = V(pageOf({ steps: noteAt({ 0:"C4", 8:"E4" }),
                        hold:[4,1,1,1,1,1,1,1, 2,1,1,1,1,1,1,1] }));
eq("a length is read where there is a note", held.hold[0], 4);
eq("and the second one too", held.hold[8], 2);
eq("a step with no note has no length", held.hold[3], 1);
const messy = V(pageOf({ steps: noteAt({ 0:"C4" }),
                         hold:[99,"four",null,-3,0,1.6,NaN,Infinity,1,1,1,1,1,1,1,1] }));
eq("a length past the page is capped at sixteen", messy.hold[0], 16);
eq("a length that is not a number is one", messy.hold[1], 1);
eq("null is one", messy.hold[2], 1);
eq("negative is one", messy.hold[3], 1);
eq("zero is one", messy.hold[4], 1);
eq("a fraction is rounded", V(pageOf({ steps: noteAt({ 0:"C4" }),
   hold:[2.6,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1] })).hold[0], 3);
eq("not-a-number is one", messy.hold[6], 1);
eq("infinity is one", messy.hold[7], 1);
eq("a hold array that is not an array is all ones",
   V(pageOf({ steps: noteAt({ 0:"C4" }), hold:"long" })).hold.join(),
   blank().map(() => 1).join());
eq("a short hold array is filled out",
   V(pageOf({ steps: noteAt({ 0:"C4", 15:"G4" }), hold:[3] })).hold.length, 16);
eq("and the notes past its end are plain",
   V(pageOf({ steps: noteAt({ 0:"C4", 15:"G4" }), hold:[3] })).hold[15], 1);
eq("the second voice has lengths of its own",
   V(pageOf({ bass: noteAt({ 0:"C2" }),
              basshold:[5,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1] })).basshold[0], 5);
ok("and they never leak into the lead's",
   V(pageOf({ steps: noteAt({ 0:"C4" }), bass: noteAt({ 0:"C2" }),
              basshold:[5,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1] })).hold[0] === 1);

/* ---- what each voice sounds like: the one field this build added ---- */
console.log("\n== the tones beside the voices ==");
eq("a page with no tones is two own tones", V(pageOf()).tones, [null, null]);
eq("a named kit is kept as it was written",
   V(pageOf({ tones:["piano", "sub"] })).tones, ["piano", "sub"]);
eq("one voice may name one and the other not",
   V(pageOf({ tones:[null, "sub"] })).tones, [null, "sub"]);
eq("a tone that is not a string is no tone", V(pageOf({ tones:[7, {}] })).tones, [null, null]);
eq("an empty name is no tone", V(pageOf({ tones:["", "  "] })).tones, [null, null]);
eq("a name is trimmed", V(pageOf({ tones:["  piano  ", null] })).tones, ["piano", null]);
eq("and capped, so a page cannot carry prose here",
   V(pageOf({ tones:["k".repeat(200), null] })).tones[0].length, 32);
eq("tones that are not an array at all are two own tones",
   V(pageOf({ tones:"piano" })).tones, [null, null]);
eq("a third entry is not a third voice", V(pageOf({ tones:["a","b","c"] })).tones.length, 2);
ok("and a page is never rejected for its tones",
   V(pageOf({ steps: noteAt({ 0:"C4" }), tones:"rubbish" })).steps[0] === "C4");
ok("allOwnTone says so of an absent array", T.allOwnTone(undefined) === true);
ok("and of an array of nulls", T.allOwnTone([null, null]) === true);
ok("and not of one with a name in it", T.allOwnTone([null, "sub"]) === false);

/* ---- the sealed note: what a quest may hand a page ---- */
console.log("\n== the seals beside the notes ==");
const L = i => { const a = blank(); Object.keys(i).forEach(k => { a[k] = i[k]; }); return a; };
eq("a page with no seals seals nothing",
   V(pageOf({ steps: noteAt({ 0:"C4" }) })).lock.join(","), blank().join(","));
const sealedPage = V(pageOf({ steps: noteAt({ 0:"C4", 4:"E4", 8:"G4" }),
                              lock: L({ 0:"p", 4:"rl", 8:"prl" }) }));
eq("a seal is read where there is a note", sealedPage.lock[0], "p");
eq("two letters keep both", sealedPage.lock[4], "rl");
eq("and all three make an immutable note", sealedPage.lock[8], "prl");
eq("a step with no note has no seal", sealedPage.lock[1], null);
eq("the letters come back in the canonical order however they went in",
   V(pageOf({ steps: noteAt({ 0:"C4" }), lock: L({ 0:"lrp" }) })).lock[0], "prl");
eq("a letter this folio has never heard of is dropped",
   V(pageOf({ steps: noteAt({ 0:"C4" }), lock: L({ 0:"pxq" }) })).lock[0], "p");
eq("and a seal of nothing but nonsense is no seal",
   V(pageOf({ steps: noteAt({ 0:"C4" }), lock: L({ 0:"xyz" }) })).lock[0], null);
eq("a seal that is not a string is no seal",
   V(pageOf({ steps: noteAt({ 0:"C4" }), lock: L({ 0:7 }) })).lock[0], null);
eq("a seal on an empty step is no seal",
   V(pageOf({ steps: blank(), lock: L({ 3:"prl" }) })).lock[3], null);
eq("a lock array that is not an array seals nothing",
   V(pageOf({ steps: noteAt({ 0:"C4" }), lock:"prl" })).lock.join(","), blank().join(","));
eq("a short lock array is filled out",
   V(pageOf({ steps: noteAt({ 0:"C4", 15:"G4" }), lock:["p"] })).lock.length, 16);
eq("and the notes past its end are free",
   V(pageOf({ steps: noteAt({ 0:"C4", 15:"G4" }), lock:["p"] })).lock[15], null);
eq("the second voice has seals of its own",
   V(pageOf({ bass: noteAt({ 0:"C2" }), basslock: L({ 0:"r" }) })).basslock[0], "r");
ok("and they never leak into the lead's",
   V(pageOf({ steps: noteAt({ 0:"C4" }), bass: noteAt({ 0:"C2" }),
              basslock: L({ 0:"r" }) })).lock[0] === null);
ok("a page is never rejected for its seals",
   V(pageOf({ steps: noteAt({ 0:"C4" }), lock:{ nonsense:true } })).steps[0] === "C4");
eq("sealOf reads the note's letters", T.sealOf(sealedPage, 0, 4), "rl");
ok("sealed asks after one of them", T.sealed(sealedPage, 0, 4, "r") === true);
ok("and says no to one it does not wear", T.sealed(sealedPage, 0, 4, "p") === false);
ok("and to any seal at all on a free note", T.sealed(sealedPage, 0, 2) === false);
ok("allFree says so of an absent array", T.allFree(undefined) === true);
ok("and of an array of nulls", T.allFree([null, null]) === true);
ok("and not of one with a seal in it", T.allFree([null, "p"]) === false);

console.log("\n== what a plain page writes out ==");
const outPlain = T.docOut(V(pageOf({ steps: noteAt({ 0:"C4" }) })));
ok("a page with nothing held writes no lead lengths", !("hold" in outPlain));
ok("and no bass lengths", !("basshold" in outPlain));
ok("a page on its own tones writes no tones", !("tones" in outPlain));
ok("and a page that seals nothing writes no seals", !("lock" in outPlain));
ok("nor bass seals", !("basslock" in outPlain));
eq("its steps are there as they always were", outPlain.steps[0], "C4");
ok("and so is every other field",
   ["version","title","tempo","loop","key","steps","bass","mute","solo"]
     .every(k => k in outPlain), Object.keys(outPlain));
const outHeld = T.docOut(V(pageOf({ steps: noteAt({ 0:"C4" }),
                                    hold:[4,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1] })));
ok("a page with something held writes its lengths", "hold" in outHeld);
eq("exactly as they were asked for", outHeld.hold[0], 4);
ok("and still no bass lengths, nothing being held there", !("basshold" in outHeld));
const outTone = T.docOut(V(pageOf({ steps: noteAt({ 0:"C4" }), tones:[null, "sub"] })));
ok("a page wearing a kit writes its tones", "tones" in outTone);
eq("both of them, so the null is not a hole", outTone.tones, [null, "sub"]);
const outSealed = T.docOut(V(pageOf({ steps: noteAt({ 0:"C4" }), lock: L({ 0:"pr" }) })));
ok("a page with a sealed note writes its seals", "lock" in outSealed);
eq("exactly as they were read", outSealed.lock[0], "pr");
ok("and still no bass seals, nothing being sealed there", !("basslock" in outSealed));
ok("allPlain says so of an absent array", T.allPlain(undefined) === true);
ok("and of an array of ones", T.allPlain([1,1,1]) === true);
ok("and not of one with a two in it", T.allPlain([1,2,1]) === false);

console.log("\n== the round trip, both ways ==");
const rich = V(pageOf({ title:"the round trip", tempo:96, loop:8, key:"E minor",
  steps: noteAt({ 0:"E4", 2:"G4", 5:"B4", 11:"D5" }),
  bass:  noteAt({ 0:"E2", 8:"B2" }),
  hold:  [3,1,2,1,1,4,1,1,1,1,1,2,1,1,1,1],
  basshold:[8,1,1,1,1,1,1,1,4,1,1,1,1,1,1,1],
  lock:  L({ 0:"p", 5:"rl", 11:"prl" }),
  basslock: L({ 8:"r" }),
  tones:["music-box", "pluck-bass"],
  mute:[false,true], solo:[false,false] }));
const wire = JSON.stringify(T.docOut(rich));
const back = V(JSON.parse(wire));
for (const k of ["title","tempo","loop","key"])
  eq("the round trip keeps " + k, back[k], rich[k]);
eq("it keeps the lead's notes", back.steps, rich.steps);
eq("it keeps the bass's notes", back.bass, rich.bass);
eq("it keeps the lead's lengths", back.hold, rich.hold);
eq("it keeps the bass's lengths", back.basshold, rich.basshold);
eq("it keeps the lead's seals", back.lock, rich.lock);
eq("it keeps the bass's seals", back.basslock, rich.basslock);
eq("it keeps the tones", back.tones, rich.tones);
eq("it keeps mute", back.mute, rich.mute);
eq("it keeps solo", back.solo, rich.solo);
eq("and a second trip changes nothing", JSON.stringify(T.docOut(back)), wire);

console.log("\n== an older build meets a newer log ==");
/* an older folio knows `steps` and `bass` and nothing about lengths: it reads
   the page it always read, and simply does not see the holds */
const old = JSON.parse(wire);
eq("every lead note is where it was", old.steps, rich.steps);
eq("every bass note is where it was", old.bass, rich.bass);
ok("the lengths and the seals are beside the notes, never inside them",
   old.steps.every(v => v === null || typeof v === "string"), old.steps);
ok("so an older reader takes the page whole",
   V({ version:old.version, title:old.title, tempo:old.tempo, loop:old.loop,
       key:old.key, steps:old.steps, bass:old.bass,
       mute:old.mute, solo:old.solo }) !== null);
console.log("\n== a newer build meets an older log ==");
const older = { version:1, title:"before lesson 3", tempo:100, loop:16, key:"A minor",
                steps: noteAt({ 0:"A3", 4:"C4", 8:"E4" }) };
const lifted = V(older);
ok("it reads", !!lifted);
eq("with every note where it was", lifted.steps, older.steps);
eq("a silent second voice under it", lifted.bass.join(), blank().join());
eq("and every note one step long", lifted.hold.join(), blank().map(() => 1).join());
eq("and it writes back out byte for byte what it read",
   JSON.stringify(T.docOut(lifted)),
   JSON.stringify(Object.assign({}, older, { bass: blank(), mute:[false,false], solo:[false,false] })));

/* ---- how long a page is ----
   The length is a field of the document like the key, optional and written
   only where it is not the sixteen it always was. The two things that must
   outlive any rewrite of the drawing are here: an old page still reads as
   sixteen without saying so, and a long page survives the round trip with
   every array beside its notes the same length as its notes. */
console.log("\n== how long the page is ==");
const long32 = new Array(32).fill(null);
long32[0] = "C4"; long32[20] = "G4";
const long = V(pageOf({ len:32, steps: long32, bass: new Array(32).fill(null),
                        loop:32, hold: new Array(32).fill(1) }));
ok("a page that says it is 32 reads", !!long);
eq("with all 32 of its steps", long.steps.length, 32);
eq("its note past the sixteenth kept", long.steps[20], "G4");
eq("a silent second voice of the same length", long.bass.length, 32);
eq("and lengths beside them of the same length", long.hold.length, 32);
eq("and seals", long.lock.length, 32);
eq("docLen says so", T.docLen(long), 32);
eq("a whole-page loop is the whole of THIS page", long.loop, 32);
const longWire = JSON.stringify(T.docOut(long));
const longBack = V(JSON.parse(longWire));
eq("the round trip keeps the length", T.docLen(longBack), 32);
eq("and every note of it", longBack.steps, long.steps);
eq("and a second trip changes nothing", JSON.stringify(T.docOut(longBack)), longWire);
ok("a long page writes the field", "len" in JSON.parse(longWire));
const plain16 = V(pageOf({ steps: noteAt({ 0:"C4" }) }));
eq("a page that says nothing is sixteen", T.docLen(plain16), 16);
ok("and writes no length field at all", !("len" in T.docOut(plain16)));
eq("a length nobody offers is sixteen too", T.docLen({ len:20 }), 16);
eq("and so is junk", T.docLen({ len:"long" }), 16);
ok("a page claiming 32 with sixteen steps in it is refused",
   V(pageOf({ len:32, steps: noteAt({ 0:"C4" }) })) === null);
eq("the rungs of a sixteen page", T.loopRungs(16), [4,8,16]);
eq("the rungs grow with the page", T.loopRungs(32), [4,8,16,32]);
eq("and again", T.loopRungs(64), [4,8,16,32,64]);
/* an older build handed a long page reads a page it cannot measure: the
   length is beside the notes, not inside them, so its notes are still notes */
ok("the length is a field, never a change to what a step is",
   JSON.parse(longWire).steps.every(v => v === null || typeof v === "string"));

console.log("\n== the autosave, saved and loaded ==");
T.resetQuests();
T.setDoc(rich);
T.save();
ok("the page is in storage", typeof R.store[T.STORE_KEY] === "string");
ok("and the whole log beside it", typeof R.store[T.QUEST_KEY] === "string");
T.setDoc(V(pageOf()));
eq("the page in hand is blank again", T.doc.steps.join(), blank().join());
ok("load() finds the autosave", T.load() === true);
eq("and brings the notes back", T.doc.steps, rich.steps);
eq("with their lengths", T.doc.hold, rich.hold);
eq("and its key", T.doc.key, "E minor");
delete R.store[T.STORE_KEY];
delete R.store[T.LEGACY_KEY];
ok("with nothing there, load() says so", T.load() === false);
R.store[T.STORE_KEY] = "{not json";
ok("and rubbish there is not a crash", T.load() === false);
delete R.store[T.STORE_KEY];

/* ================= 2. the quest log, at version 2 ================= */
console.log("\n== what is a quest log ==");
ok("the marker makes one", T.isQuestLog({ folio:"quest-log", quests:{} }));
ok("so does a bare quests map", T.isQuestLog({ quests:{} }));
ok("a page is not one", !T.isQuestLog(V(pageOf())));
ok("nothing is not one", !T.isQuestLog(null));
ok("an array is not one", !T.isQuestLog([]));
ok("and neither is a string", !T.isQuestLog("quest-log"));

console.log("\n== the state, out and back ==");
T.resetQuests();
T.switchWorkspace("stray");
T.setDoc(V(pageOf({ key:"E minor", tempo:96, steps: noteAt({ 0:"E4", 4:"F4" }),
                    hold:[4,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
                    lock: L({ 4:"pl" }) })));
T.save();
T.switchWorkspace(null);
T.setDoc(V(pageOf({ title:"free", steps: noteAt({ 0:"C4" }) })));
T.save();
const st = T.stateToJSON();
eq("it carries the marker", st.folio, "quest-log");
eq("at version 2", st.version, 2);
eq("it names the active workspace", st.active, null);
ok("it carries the free-play page", !!st.free && st.free.steps[0] === "C4");
ok("and the quest's own", !!st.quests.stray && st.quests.stray.pattern.steps[0] === "E4");
ok("with its lengths", st.quests.stray.pattern.hold[0] === 4);
ok("and with its seals", st.quests.stray.pattern.lock[4] === "pl");
ok("a quest nobody has touched is not in the log at all", !("summit" in st.quests));
ok("and no marks are written where none were made",
   !("fav" in st.quests.stray) && !("order" in st.quests.stray));
const roundState = JSON.parse(JSON.stringify(st));
T.resetQuests();
ok("applyState reads it back", T.applyState(roundState) === true);
eq("the quest's page came back", T.questPage("stray").steps[0], "E4");
eq("with its length", T.questPage("stray").hold[0], 4);
eq("and its seal", T.questPage("stray").lock[4], "pl");
eq("free play came back too", T.wsFree.steps[0], "C4");
eq("and a second trip is the same log",
   JSON.stringify(T.stateToJSON()), JSON.stringify(roundState));
ok("applyState refuses something that is not a log", T.applyState({ steps: blank() }) === false);
ok("and nothing at all", T.applyState(null) === false);

console.log("\n== the two marks a quest can carry ==");
T.resetQuests();
T.applyState({ folio:"quest-log", version:2, active:null, quests:{
  stray:{ done:true, fav:true, order:3, pattern:null },
  summit:{ done:false, pattern:null } } });
ok("the log's old done flag seeds the ruling", T.isDone("stray") === true);
ok("kept-to-hand is read", T.favOf("stray") === true);
eq("and the order it was put in", T.orderOf("stray", 99), 3);
ok("a quest with neither mark has neither", T.favOf("summit") === false);
eq("and falls back to the order it was delivered in", T.orderOf("summit", 7), 7);
const marks = T.stateToJSON();
ok("the marks ride back out", marks.quests.stray.fav === true && marks.quests.stray.order === 3);
ok("but the verdict never does - it is not the log's to carry",
   JSON.stringify(marks).indexOf('"done"') < 0, marks.quests);
ok("and a quest carrying no mark and no work is not written at all",
   !("summit" in marks.quests), Object.keys(marks.quests));
T.resetQuests();
T.applyState({ folio:"quest-log", version:2, quests:{ stray:{ done:true } } });
ok("a log that knows neither mark still reads", T.isDone("stray") === true);
ok("with nothing kept to hand", T.favOf("stray") === false);
ok("and no order imposed", T.questSlotOrder === undefined || T.orderOf("stray", 5) === 5);

/* ---- the rulings: the verdicts, in a file of their own ----
   A quest is closed by evaluation, never by the tab, so the flag lives in
   quests/rulings.json and the log has stopped carrying it. What must outlive
   any rewrite: the file's shape, its round trip, the per-id merge (a fragment
   is a fragment, not a denial of everything it leaves out), and the
   permissive read of a log that still says `done`. */
console.log("\n== the rulings, apart from the log ==");
T.resetRulings();
ok("nothing is complete until something says so", T.isDone("stray") === false);
ok("a rulings file is read", T.applyRulings({ folio:"rulings", version:1,
  complete:{ stray:true, summit:true } }) === true);
ok("and both are marked", T.isDone("stray") && T.isDone("summit"));
ok("reading the same file again changes nothing",
   T.applyRulings({ folio:"rulings", version:1, complete:{ stray:true } }) === false);
ok("a fragment names only what it names",
   T.applyRulings({ folio:"rulings", version:1, complete:{ ladder:true } }) === true &&
   T.isDone("stray") === true && T.isDone("summit") === true);
ok("and a retraction is said out loud, by name",
   T.applyRulings({ folio:"rulings", version:1, complete:{ summit:false } }) === true &&
   T.isDone("summit") === false && T.isDone("stray") === true);
ok("a quest log is not a rulings file", T.applyRulings({ folio:"quest-log", quests:{} }) === false);
ok("nor is nothing", T.applyRulings(null) === false);
ok("nor an array", T.applyRulings([]) === false);
ok("nor one with no verdicts in it", T.applyRulings({ folio:"rulings" }) === false);
ok("the verdicts are cached in the browser too", (function(){
  T.cacheRulings();
  const cached = JSON.parse(R.store[T.RULE_KEY]);
  return cached.folio === "rulings" && cached.complete.stray === true;
})(), R.store[T.RULE_KEY]);
ok("and read back out of it", (function(){
  T.resetRulings();
  T.loadRulings();
  return T.isDone("stray") === true && T.isDone("summit") === false;
})());
/* the whole point: the log is written while a verdict stands, and says
   nothing about it either way */
T.resetQuests();
T.applyRulings({ folio:"rulings", version:1, complete:{ stray:true } });
T.switchWorkspace("stray");
T.save();
ok("the log written under a standing verdict never mentions it",
   JSON.stringify(T.stateToJSON()).indexOf('"done"') < 0);
ok("while the folio still shows it", T.isDone("stray") === true);
/* and a log that predates the file is still read, as a seed and no more */
T.resetQuests();
T.applyState({ folio:"quest-log", version:2, quests:{ stray:{ done:true } } });
ok("an older log's flag becomes a ruling", T.isDone("stray") === true);
T.resetRulings();
T.applyRulings({ folio:"rulings", version:1, complete:{ stray:false } });
T.applyState({ folio:"quest-log", version:2, quests:{ stray:{ done:true } } });
ok("but never over one the rulings file has already settled", T.isDone("stray") === false);
T.resetRulings();

console.log("\n== the drill definitions the log carries ==");
const DRILL = { id:"t1-drill", name:"a drill", summary:"do the thing",
                teaches:"the thing", lesson:3,
                /* a seeded quest may hand the page notes it has sealed */
                pattern:{ version:1, title:"seed", tempo:104, loop:8, key:"F major",
                          steps: noteAt({ 0:"F4", 2:"A4" }),
                          lock: L({ 0:"prl", 2:"r" }) } };
T.resetQuests();
T.applyState({ folio:"quest-log", version:2, active:null, quests:{}, drills:[DRILL] });
const dr = T.drillById("t1-drill");
ok("the definition is adopted", !!dr);
eq("with its name", dr.name, "a drill");
eq("its summary", dr.summary, "do the thing");
eq("what it teaches", dr.teaches, "the thing");
eq("and the lesson it says it is for", dr.lesson, 3);
ok("its pattern is validated on the way in", !!dr.pattern && dr.pattern.steps[0] === "F4");
/* the seeds are the only way a seal ever reaches a page, so the seals must
   survive every step of the way from the definition to the workspace it
   materialises — which is the whole feature, end to end */
const seeded = T.seededDoc("t1-drill");
eq("the workspace it materialises is sealed as the definition asked", seeded.lock[0], "prl");
eq("and the second note with it", seeded.lock[2], "r");
eq("a free note in the seed stays free", seeded.lock[4], null);
ok("the seals ride back out with the definition",
   T.stateToJSON().drills[0].pattern.lock[0] === "prl");
ok("it is a workspace like any other", !!T.questById("t1-drill") ||
   T.ALL.some(q => q.id === "t1-drill"));
eq("on its own lesson's tab", T.questGroup(T.ALL.filter(q => q.id === "t1-drill")[0]), 3);
const N = T.normDrill;
ok("a definition with no id is not one", N({ name:"x" }) === null);
ok("nor one whose id is blank", N({ id:"   " }) === null);
ok("nor a string", N("t1") === null);
ok("nor an array", N([]) === null);
ok("a drill never shadows a built-in quest", N({ id:"stray", name:"impostor" }) === null);
eq("a nameless drill is named by its id", N({ id:"t1-x" }).name, "t1-x");
eq("an id is cut to sixty characters", N({ id:"z".repeat(90) }).id.length, 60);
eq("a summary is cut to two hundred and forty", N({ id:"t1-y", summary:"s".repeat(400) }).summary.length, 240);
eq("a lesson out of range is no lesson at all", N({ id:"t1-z", lesson:44 }).lesson, 0);
eq("and a lesson that is not a number likewise", N({ id:"t1-w", lesson:"three" }).lesson, 0);
eq("a lesson of 1 is kept", N({ id:"t1-v", lesson:1 }).lesson, 1);
eq("a lesson of 9 is kept", N({ id:"t1-u", lesson:9 }).lesson, 9);
ok("a pattern that cannot be read is no pattern, not a refusal",
   N({ id:"t1-t", pattern:{ steps:"rubbish" } }) !== null &&
   N({ id:"t1-t", pattern:{ steps:"rubbish" } }).pattern === null);
const dstate = T.stateToJSON();
ok("the definitions ride out with the log", (dstate.drills || []).length === 1);
eq("with the lesson they declared", dstate.drills[0].lesson, 3);
eq("and their pattern as it was", dstate.drills[0].pattern.steps[0], "F4");

console.log("\n== a workspace whose definition has gone ==");
T.resetQuests();
T.applyState({ folio:"quest-log", version:2, active:null,
  quests:{ "t1-orphan":{ done:true, pattern: pageOf({ steps: noteAt({ 0:"G4" }) }) } } });
const ghost = T.drillById("t1-orphan");
ok("it is kept, as a ghost", !!ghost && ghost.ghost === true);
eq("named by its id", ghost.name, "t1-orphan");
ok("its page is not lost", T.questPage("t1-orphan").steps[0] === "G4");
ok("the verdict it carried is not lost", T.isDone("t1-orphan") === true);
const ghostOut = T.stateToJSON();
ok("the ghost is never written out as a definition",
   !(ghostOut.drills || []).some(d => d.id === "t1-orphan"));
ok("but its workspace is", !!ghostOut.quests["t1-orphan"]);
T.mergeDrills({ folio:"quest-log", drills:[{ id:"t1-orphan", name:"found again",
  summary:"s", teaches:"t" }] });
const found = T.drillById("t1-orphan");
ok("a definition arriving fills the ghost in", !found.ghost);
eq("and gives it its name back", found.name, "found again");
ok("without disturbing the page in that workspace",
   T.questPage("t1-orphan").steps[0] === "G4");

console.log("\n== the drill merge is as narrow as it can be ==");
T.resetQuests();
T.applyState({ folio:"quest-log", version:2, active:null, quests:{}, drills:[DRILL] });
eq("a definition already known is never overwritten",
   T.mergeDrills({ folio:"quest-log", drills:[
     Object.assign({}, DRILL, { name:"renamed on disk" })] }), 0);
eq("and it keeps the name it had", T.drillById("t1-drill").name, "a drill");
eq("a new one is adopted", T.mergeDrills({ folio:"quest-log",
  drills:[{ id:"t1-second", name:"the second" }] }), 1);
eq("nothing is ever removed by a merge", T.DRILLS.length, 2);
eq("a log with no drills array merges nothing",
   T.mergeDrills({ folio:"quest-log", quests:{} }), 0);
eq("and something that is not a log merges nothing", T.mergeDrills({ steps: blank() }), 0);

console.log("\n== version 1, migrated forward ==");
T.resetQuests();
ok("a version-1 log reads", T.applyState({ folio:"quest-log", version:1, active:"summit",
  quests:{ summit:{ done:true, motif: pageOf({ steps: noteAt({ 0:"D4", 6:"A4" }) }) } } }));
eq("its motif became the quest's page", T.questPage("summit").steps[0], "D4");
eq("with the rest of it", T.questPage("summit").steps[6], "A4");
ok("the done flag came across", T.isDone("summit") === true);
eq("and the active workspace with it", T.qActive, "summit");
const migrated = T.stateToJSON();
eq("it is written forward as version 2", migrated.version, 2);
ok("with the motif under its own name now", !!migrated.quests.summit.pattern &&
   !("motif" in migrated.quests.summit));

/* ========== 2b. the samples the scriptorium writes, and their labels ======
   A kit is WAV files and a manifest line each. Both are formats that outlive
   whatever the panel above them looks like, which is the whole test. */
console.log("\n== the WAV, out and back ==");
const wavIn = Float32Array.from([0, 0.5, -0.5, 1, -1, 0.25]);
const enc = T.encodeWAV(wavIn, 11025);
eq("a mono PCM16 file is 44 bytes and two a frame", enc.length, 44 + wavIn.length * 2);
eq("it opens RIFF", String.fromCharCode(enc[0], enc[1], enc[2], enc[3]), "RIFF");
eq("and says WAVE", String.fromCharCode(enc[8], enc[9], enc[10], enc[11]), "WAVE");
const dec = T.decodeWAV(enc);
ok("it decodes", !!dec);
eq("at the rate it was written", dec.rate, 11025);
eq("with every frame back", dec.data.length, wavIn.length);
ok("and the samples within a bit of themselves",
   Array.prototype.every.call(dec.data, (v, i) => Math.abs(v - wavIn[i]) < 0.0001),
   Array.from(dec.data));
eq("a rate of 8000 survives too", T.decodeWAV(T.encodeWAV(wavIn, 8000)).rate, 8000);
const clipped = T.decodeWAV(T.encodeWAV(Float32Array.from([4, -4]), 8000)).data;
ok("anything past full scale is clamped, not wrapped", clipped[0] > 0.99 && clipped[1] < -0.99,
   Array.from(clipped));
ok("nonsense is not a WAV", T.decodeWAV(new Uint8Array(80)) === null);
ok("and neither is something too short to be one", T.decodeWAV(new Uint8Array(8)) === null);

console.log("\n== the manifest, which is where a sample's root and loop live ==");
const read = T.parseManifest(
  "# kit: piano\n\nprose about nothing\n" +
  "- `piano-c4.wav` \u2014 root C4 \u00b7 11025 Hz \u00b7 0.45 s \u00b7 10044 B \u00b7 " +
  "loop 3000\u20134200 \u00b7 decay 2.4 s \u00b7 source: a piano, curated\n")["piano-c4.wav"];
ok("a sample line is read at all", !!read);
eq("with the root note", read.root, 60);
eq("the rate", read.rate, 11025);
eq("the loop points", [read.loopStart, read.loopEnd], [3000, 4200]);
eq("the imposed decay", read.decay, 2.4);
eq("and where the material came from", read.source, "a piano, curated");
const plain = T.parseManifest("# kit: x\n\nprose about nothing\n- `hat.wav` \u2014 8000 Hz \u00b7 900 B\n");
eq("a line with no loop and no decay is still a sample", Object.keys(plain).join(), "hat.wav");
eq("with no loop", [plain["hat.wav"].loopStart, plain["hat.wav"].loopEnd], [0, 0]);
eq("and no decay", plain["hat.wav"].decay, 0);
eq("prose around it is not a sample", Object.keys(T.parseManifest("just a sentence")).length, 0);

/* The kits are checked in, so what is on the shelf is a data format like any
   other: the label has to name files that are there, at the rate and the roots
   it claims, and every sample on disk has to be on the label. Size is not
   checked — the 64KB honour budget was waived by player ruling on 2026-08-02,
   and the recut piano is deliberately far past it. Read here exactly as the
   page reads them. */
console.log("\n== the kits on the shelf, as the page will read them ==");
for (const kit of fs.readdirSync(REPO + "/kits", { withFileTypes:true })
                    .filter(e => e.isDirectory()).map(e => e.name).sort()){
  const dir = REPO + "/kits/" + kit;
  const meta = T.parseManifest(fs.readFileSync(dir + "/manifest.md", "utf8"));
  const names = Object.keys(meta), bad = [];
  for (const n of names){
    if (!fs.existsSync(dir + "/" + n)){ bad.push(n + ": not on disk"); continue; }
    const w = T.decodeWAV(new Uint8Array(fs.readFileSync(dir + "/" + n)));
    if (!w) bad.push(n + ": will not decode");
    else if (w.rate !== meta[n].rate) bad.push(n + ": rate " + w.rate + " not " + meta[n].rate);
    else if (!(meta[n].loopEnd === 0 || (meta[n].loopStart < meta[n].loopEnd &&
               meta[n].loopEnd <= w.data.length))) bad.push(n + ": loop outside the sample");
    if (!(meta[n].root >= 24 && meta[n].root <= 96)) bad.push(n + ": root " + meta[n].root);
  }
  ok(kit + ": its label names samples, and every one of them holds up",
     names.length > 0 && bad.length === 0, bad);
  ok(kit + ": and every sample on disk is on the label",
     fs.readdirSync(dir).filter(n => n.endsWith(".wav")).every(n => names.includes(n)));
}

console.log("\n== the sampled voice, per voice, and what it refuses ==");
const twoRoots = [{ file:"a.wav", rate:8000, data:new Float32Array(80), frames:80,
                    root:48, loopStart:0, loopEnd:0, decay:0, buf:null },
                  { file:"b.wav", rate:8000, data:new Float32Array(80), frames:80,
                    root:72, loopStart:0, loopEnd:0, decay:0, buf:null }];
eq("the nearer root is the one that plays", T.nearestSample(twoRoots, T.midiFreq(50)).root, 48);
eq("and from above, likewise", T.nearestSample(twoRoots, T.midiFreq(70)).root, 72);
ok("no samples, nothing chosen", T.nearestSample(null, T.midiFreq(60)) === null);
T.audioInit();                       /* the sampled voice needs a context to ask */
T.kitBank.demo = twoRoots;
T.doc.tones = [null, null];
ok("both voices on their own tone: nothing is sampled",
   T.voiceSamples(0) === null && T.voiceSamples(1) === null);
ok("and the sampled voice declines, so the folio's own tone plays",
   T.samplePlay(440, 0, 0.2, 0, false) === false);
T.doc.tones = [null, "demo"];
ok("a kit named on the bass is the bass's", T.voiceSamples(1) === twoRoots);
ok("and the lead is untouched by it", T.voiceSamples(0) === null);
ok("the bass plays a buffer now", T.samplePlay(T.midiFreq(48), 0, 0.2, 1, false) === true);
ok("while the lead still plays its own tone",
   T.samplePlay(T.midiFreq(48), 0, 0.2, 0, false) === false);
T.doc.tones = ["nowhere", null];
ok("a kit this folio has not got is its own tone, not an error",
   T.voiceSamples(0) === null && T.samplePlay(440, 0, 0.2, 0, false) === false);
ok("and the rail says as much", T.toneHere("nowhere") === false && T.toneHere(null) === true);
eq("a folder name is not what is said out loud", T.toneLabel("music-box"), "music box");
eq("and no tone at all has a name too", T.toneLabel(null), "own tone");
delete T.kitBank.demo;
T.doc.tones = [null, null];

/* ================= 3. server.mjs, driven for real ================= */
console.log("\n== the server, against a log of its own ==");
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "folio-tier1-"));
const LOG = path.join(TMP, "quest-log.json");
const LOGDIR = TMP;
const KITS = path.join(TMP, "kits");     /* never the player's own shelf either */
const seedLog = { folio:"quest-log", version:2, active:null,
  free: pageOf({ title:"the server's page", steps: noteAt({ 0:"C4" }) }),
  quests:{ stray:{ done:true, pattern: pageOf({ steps: noteAt({ 0:"E4" }) }) } },
  drills:[{ id:"t1-onDisk", name:"already on disk", summary:"s", teaches:"t", pattern:null }] };

(async function server(){
  const port = await freePort(4184);
  const BASE = "http://127.0.0.1:" + port;
  const srv = spawn(process.execPath, [REPO + "/server.mjs"],
    { cwd: REPO, stdio:["ignore","pipe","pipe"],
      env: Object.assign({}, process.env,
        { PORT:String(port), FOLIO_LOG: LOG, FOLIO_KITS: KITS,
          FOLIO_RULINGS: path.join(TMP, "rulings.json") }) });
  let srvlog = "";
  srv.stdout.on("data", d => { srvlog += d; });
  srv.stderr.on("data", d => { srvlog += d; });
  for (let i = 0; i < 100; i++){
    try { const r = await fetch(BASE + "/"); if (r.ok) break; } catch (e){}
    await wait(60);
  }
  ok("it says where the log is", srvlog.indexOf(LOG) >= 0 ||
     srvlog.indexOf(LOG.split(path.sep).join("/")) >= 0, srvlog.slice(0, 200));
  ok("and it is not the player's own", srvlog.indexOf("daw-l3" + path.sep + "quests") < 0);

  /* --- no log yet --- */
  const absent = await fetch(BASE + "/api/quest-log");
  ok("a missing log is a 404", absent.status === 404, absent.status);
  ok("in JSON, which is what tells a server from a static host",
     /json/.test(absent.headers.get("content-type") || ""), absent.headers.get("content-type"));
  const absentBody = await absent.json();
  eq("and it carries the marker anyway", absentBody.folio, "quest-log");
  ok("saying plainly that there is nothing there", absentBody.absent === true);

  /* --- a PUT makes one --- */
  const put1 = await fetch(BASE + "/api/quest-log",
    { method:"PUT", headers:{ "content-type":"application/json" },
      body: JSON.stringify(seedLog) });
  eq("a good PUT is a 204", put1.status, 204);
  const tag1 = put1.headers.get("etag");
  ok("and answers with the tag it wrote", !!tag1, tag1);
  ok("the file is there now", fs.existsSync(LOG));
  const onDisk = JSON.parse(fs.readFileSync(LOG, "utf8"));
  eq("holding what was sent", onDisk.free.steps[0], "C4");
  ok("written as readable JSON, not one line", /\n/.test(fs.readFileSync(LOG, "utf8")));
  ok("and ending in a newline", /\n$/.test(fs.readFileSync(LOG, "utf8")));
  ok("with no temporary file left beside it",
     fs.readdirSync(LOGDIR).every(n => !/\.tmp$/.test(n)), fs.readdirSync(LOGDIR));

  /* --- the conditional GET --- */
  const get1 = await fetch(BASE + "/api/quest-log");
  eq("the log comes back", get1.status, 200);
  const tag2 = get1.headers.get("etag");
  eq("under the tag the write reported", tag2, tag1);
  ok("as JSON", /json/.test(get1.headers.get("content-type") || ""));
  const body1 = await get1.json();
  eq("with the quest's page intact", body1.quests.stray.pattern.steps[0], "E4");
  const get304 = await fetch(BASE + "/api/quest-log", { headers:{ "if-none-match": tag2 } });
  eq("an unchanged log is a 304", get304.status, 304);
  eq("carrying the same tag", get304.headers.get("etag"), tag2);
  const getStale = await fetch(BASE + "/api/quest-log", { headers:{ "if-none-match": '"nonsense"' } });
  eq("a tag that is not the file's is a 200", getStale.status, 200);
  /* the tag is the content, not the clock */
  const put2 = await fetch(BASE + "/api/quest-log",
    { method:"PUT", headers:{ "content-type":"application/json" },
      body: JSON.stringify(seedLog) });
  eq("writing the same bytes again gives the same tag", put2.headers.get("etag"), tag1);
  const changed = JSON.parse(JSON.stringify(seedLog));
  changed.free.steps[2] = "G4";
  const put3 = await fetch(BASE + "/api/quest-log",
    { method:"PUT", headers:{ "content-type":"application/json" },
      body: JSON.stringify(changed) });
  ok("and different bytes a different one", put3.headers.get("etag") !== tag1);

  /* --- the stale-tab drill guard --- */
  const stale = JSON.parse(JSON.stringify(changed));
  delete stale.drills;
  stale.free.steps[4] = "A4";
  const put4 = await fetch(BASE + "/api/quest-log",
    { method:"PUT", headers:{ "content-type":"application/json" }, body: JSON.stringify(stale) });
  eq("a PUT that has never heard of the drill is accepted", put4.status, 204);
  const kept = JSON.parse(fs.readFileSync(LOG, "utf8"));
  eq("but the drill on disk is kept anyway",
     (kept.drills || []).map(d => d.id).join(), "t1-onDisk");
  eq("while what the tab did send is written", kept.free.steps[4], "A4");
  const halfStale = JSON.parse(JSON.stringify(kept));
  halfStale.drills = [{ id:"t1-known", name:"the tab's own" }];
  await fetch(BASE + "/api/quest-log",
    { method:"PUT", headers:{ "content-type":"application/json" }, body: JSON.stringify(halfStale) });
  const both = JSON.parse(fs.readFileSync(LOG, "utf8"));
  eq("the tab's drills come first, the disk's after",
     both.drills.map(d => d.id).join(), "t1-known,t1-onDisk");

  /* --- the rulings, over the same server --- */
  console.log("\n== the rulings, over the same server ==");
  const RULE = path.join(TMP, "rulings.json");
  const ruleGet = h => fetch(BASE + "/api/rulings", { headers: h || {} });
  const rulePut = body => fetch(BASE + "/api/rulings",
    { method:"PUT", headers:{ "content-type":"application/json" }, body });
  const absentR = await ruleGet();
  eq("nothing ruled yet is a 404", absentR.status, 404);
  ok("in JSON, as the log's is, so a static host is still told apart",
     /json/.test(absentR.headers.get("content-type") || ""));
  eq("carrying the marker anyway", (await absentR.json()).folio, "rulings");
  const rp1 = await rulePut(JSON.stringify({ folio:"rulings", version:1,
    complete:{ stray:true } }));
  eq("a ruling is written with a 204", rp1.status, 204);
  ok("and answers with the tag it wrote", !!rp1.headers.get("etag"));
  ok("the file is there now", fs.existsSync(RULE));
  const onRule = JSON.parse(fs.readFileSync(RULE, "utf8"));
  eq("carrying the marker", onRule.folio, "rulings");
  eq("at version 1", onRule.version, 1);
  eq("and the verdict itself", onRule.complete, { stray:true });
  ok("written as readable JSON ending in a newline",
     /\n$/.test(fs.readFileSync(RULE, "utf8")));
  ok("with no temporary file left beside it",
     fs.readdirSync(TMP).every(n => !/\.tmp$/.test(n)), fs.readdirSync(TMP));
  const rg = await ruleGet();
  eq("it reads back", rg.status, 200);
  const rtag = rg.headers.get("etag");
  eq("under the tag the write reported", rtag, rp1.headers.get("etag"));
  eq("an unchanged file is a 304", (await ruleGet({ "if-none-match": rtag })).status, 304);
  await rulePut(JSON.stringify({ folio:"rulings", version:1, complete:{ summit:true } }));
  eq("a PUT that names one quest leaves every other alone",
     JSON.parse(fs.readFileSync(RULE, "utf8")).complete, { stray:true, summit:true });
  await rulePut(JSON.stringify({ folio:"rulings", version:1, complete:{ stray:false } }));
  eq("and a retraction, said by name, is taken",
     JSON.parse(fs.readFileSync(RULE, "utf8")).complete, { stray:false, summit:true });
  eq("a PUT that is not JSON is a 400", (await rulePut("{not json")).status, 400);
  eq("a PUT with no marker is a 400",
     (await rulePut(JSON.stringify({ complete:{} }))).status, 400);
  eq("a PUT with the wrong marker is a 400",
     (await rulePut(JSON.stringify({ folio:"quest-log", complete:{} }))).status, 400);
  eq("a PUT with no verdicts in it is a 400",
     (await rulePut(JSON.stringify({ folio:"rulings" }))).status, 400);
  eq("an array of verdicts is not a map of them",
     (await rulePut(JSON.stringify({ folio:"rulings", complete:[1,2] }))).status, 400);
  eq("and none of them touched the file",
     JSON.parse(fs.readFileSync(RULE, "utf8")).complete, { stray:false, summit:true });
  eq("POST is not a method it knows",
     (await fetch(BASE + "/api/rulings", { method:"POST", body:"{}" })).status, 405);
  eq("the rulings are never served as a plain file either",
     (await fetch(BASE + "/quests/rulings.json")).status, 404);

  /* --- the race this whole file exists to lose --- */
  console.log("\n== the ruling a stale tab cannot take back ==");
  await rulePut(JSON.stringify({ folio:"rulings", version:1, complete:{ ouroboros:true } }));
  const oblivious = JSON.parse(JSON.stringify(both));   /* a full state, a second old */
  oblivious.free.steps[6] = "B4";
  eq("the tab pushes everything it has", (await fetch(BASE + "/api/quest-log",
    { method:"PUT", headers:{ "content-type":"application/json" },
      body: JSON.stringify(oblivious) })).status, 204);
  eq("its music lands", JSON.parse(fs.readFileSync(LOG, "utf8")).free.steps[6], "B4");
  eq("and the ruling it never heard of is still standing",
     JSON.parse(fs.readFileSync(RULE, "utf8")).complete.ouroboros, true);
  const late = JSON.parse(JSON.stringify(both));
  late.quests.stray.done = true;         /* an old client, still saying it in the log */
  await fetch(BASE + "/api/quest-log",
    { method:"PUT", headers:{ "content-type":"application/json" }, body: JSON.stringify(late) });
  eq("and a log that still speaks of done reaches no verdict at all",
     JSON.parse(fs.readFileSync(RULE, "utf8")).complete.stray, false);

  /* --- the migration, on fixtures of its own --- */
  console.log("\n== the flags walked out of a log ==");
  const MIG = fs.mkdtempSync(path.join(os.tmpdir(), "folio-mig-"));
  const migLog = path.join(MIG, "quest-log.json"), migRule = path.join(MIG, "rulings.json");
  fs.writeFileSync(migLog, JSON.stringify({ folio:"quest-log", version:2, active:null,
    quests:{ stray:{ done:true, pattern: pageOf({ steps: noteAt({ 0:"E4" }) }) },
             summit:{ done:false, pattern:null },
             ladder:{ done:true, fav:true } } }, null, 2) + "\n");
  const mig = () => new Promise(res => {
    const p3 = spawn(process.execPath, [REPO + "/scripts/migrate-rulings.mjs", migLog, migRule],
                     { stdio:"ignore" });
    p3.on("exit", c => res(c));
  });
  eq("the migration runs", await mig(), 0);
  eq("every flag that was set is a ruling now",
     JSON.parse(fs.readFileSync(migRule, "utf8")).complete, { stray:true, ladder:true });
  const migAfter = JSON.parse(fs.readFileSync(migLog, "utf8"));
  ok("and the log speaks of them no more",
     JSON.stringify(migAfter).indexOf('"done"') < 0, migAfter.quests);
  eq("while every page in it is untouched", migAfter.quests.stray.pattern.steps[0], "E4");
  eq("and every other mark", migAfter.quests.ladder.fav, true);
  eq("running it twice is not a second migration", await mig(), 0);
  eq("and rules nothing new", JSON.parse(fs.readFileSync(migRule, "utf8")).complete,
     { stray:true, ladder:true });
  try { fs.rmSync(MIG, { recursive:true, force:true }); } catch (e){}

  /* --- what it refuses --- */
  const bad = (body, why) => fetch(BASE + "/api/quest-log",
    { method:"PUT", headers:{ "content-type":"application/json" }, body });
  eq("a PUT that is not JSON is a 400", (await bad("{not json")).status, 400);
  eq("a PUT of an array is a 400", (await bad("[1,2,3]")).status, 400);
  eq("a PUT of null is a 400", (await bad("null")).status, 400);
  eq("a PUT with no marker is a 400", (await bad(JSON.stringify({ quests:{} }))).status, 400);
  eq("a PUT with the wrong marker is a 400",
     (await bad(JSON.stringify({ folio:"something else", quests:{} }))).status, 400);
  const untouched = JSON.parse(fs.readFileSync(LOG, "utf8"));
  ok("and none of them touched the file", untouched.free.steps[4] === "A4");
  eq("POST is not a method it knows",
     (await fetch(BASE + "/api/quest-log", { method:"POST", body:"{}" })).status, 405);
  eq("nor DELETE", (await fetch(BASE + "/api/quest-log", { method:"DELETE" })).status, 405);

  /* --- what it serves, and what it does not --- */
  eq("the root is the folio", (await fetch(BASE + "/")).status, 200);
  ok("and it really is the folio",
     /<title>Folio<\/title>/.test(await (await fetch(BASE + "/")).text()));
  eq("folio.html by name too", (await fetch(BASE + "/folio.html")).status, 200);
  /* node's fetch resolves a path before it sends it, so a traversal has to
     go down the wire by hand to be asked for at all */
  const raw = p2 => new Promise(res => {
    require("http").request({ host:"127.0.0.1", port, path:p2, method:"GET" },
      r => { r.resume(); res(r.statusCode); }).on("error", () => res(0)).end();
  });
  eq("the traversal is refused", await raw("/../server.mjs"), 403);
  eq("encoded, it is refused too", await raw("/%2e%2e/server.mjs"), 403);
  eq("and so is a backslash", await raw("/%5Cserver.mjs"), 403);
  eq("the markdown is not web content", (await fetch(BASE + "/CURRICULUM.md")).status, 404);
  eq("nor is the budget", (await fetch(BASE + "/BUDGET.md")).status, 404);
  eq("the player's own log is never served as a file",
     (await fetch(BASE + "/quests/quest-log.json")).status, 404);
  eq("nor is anything in any other folder",
     (await fetch(BASE + "/tests/rig.js")).status, 404);
  eq("the one folder that is served is the stills'",
     (await fetch(BASE + "/quest-backgrounds/nothing-here.png")).status, 404);
  eq("and a bare directory is not a file", (await fetch(BASE + "/quest-backgrounds/")).status, 404);
  eq("a NUL in the path is refused",
     (await fetch(BASE + "/folio%00.html")).status, 403);

  /* --- the shelf of kits --- */
  console.log("\n== the kits, over the same server ==");
  const rawReq = (method, p2, body) => new Promise(res => {
    const rq = require("http").request(
      { host:"127.0.0.1", port, path:p2, method },
      r => { const bits = []; r.on("data", d => bits.push(d));
             r.on("end", () => res({ status:r.statusCode, headers:r.headers,
                                     body:Buffer.concat(bits) })); });
    rq.on("error", () => res({ status:0, headers:{}, body:Buffer.alloc(0) }));
    if (body) rq.write(body);
    rq.end();
  });
  const wav = T.encodeWAV(Float32Array.from([0, 0.5, -0.5, 1]), 11025);
  const empty = await (await fetch(BASE + "/api/kits")).json();
  eq("an empty shelf still carries the marker", empty.folio, "kits");
  eq("and says what the budget is", empty.budget, 65536);
  eq("with no kits on it", empty.kits, []);

  const put = await rawReq("PUT", "/api/kits/bench/tone.wav", Buffer.from(wav));
  eq("a sample is written", put.status, 204);
  eq("and the server says how many bytes it took", put.headers["x-folio-bytes"], String(wav.length));
  ok("the file is on disk", fs.existsSync(path.join(KITS, "bench", "tone.wav")));
  ok("byte for byte what was sent",
     Buffer.compare(fs.readFileSync(path.join(KITS, "bench", "tone.wav")), Buffer.from(wav)) === 0);
  ok("with no temporary file left beside it",
     fs.readdirSync(path.join(KITS, "bench")).every(n => !/\.tmp$/.test(n)));
  eq("the manifest goes the same way",
     (await rawReq("PUT", "/api/kits/bench/manifest.md",
                   Buffer.from("# kit: bench\n\n- `tone.wav` — root C4 · 11025 Hz\n"))).status, 204);

  const shelf = await (await fetch(BASE + "/api/kits")).json();
  eq("the kit is on the shelf now", shelf.kits.map(k => k.name).join(), "bench");
  eq("with its one sample", shelf.kits[0].files.map(f => f.name).join(), "tone.wav");
  eq("and the sample's size", shelf.kits[0].files[0].bytes, wav.length);
  eq("the kit's bytes are the samples' — the manifest is the label, not the load",
     shelf.kits[0].bytes, wav.length);
  ok("and the manifest travels with it", /root C4/.test(shelf.kits[0].manifest));
  const back = await rawReq("GET", "/api/kits/bench/tone.wav");
  eq("the sample comes back", back.status, 200);
  eq("as audio", back.headers["content-type"], "audio/wav");
  ok("unchanged", Buffer.compare(back.body, Buffer.from(wav)) === 0);
  ok("and it round-trips through the decoder",
     T.decodeWAV(new Uint8Array(back.body)).rate === 11025);

  eq("a .wav that is not a WAVE file is refused",
     (await rawReq("PUT", "/api/kits/bench/lie.wav", Buffer.from("hello"))).status, 400);
  ok("and nothing was written for it", !fs.existsSync(path.join(KITS, "bench", "lie.wav")));
  eq("a traversal in the kit's name is refused",
     (await rawReq("PUT", "/api/kits/..%2f..%2fevil/x.wav", Buffer.from(wav))).status, 403);
  eq("a traversal in the sample's name too",
     (await rawReq("PUT", "/api/kits/bench/..%2f..%2fevil.wav", Buffer.from(wav))).status, 403);
  eq("a dotted name is refused as well",
     (await rawReq("PUT", "/api/kits/bench/a..b.wav", Buffer.from(wav))).status, 403);
  eq("and so is anything that is not a sample or a manifest",
     (await rawReq("PUT", "/api/kits/bench/boot.js", Buffer.from("alert(1)"))).status, 403);
  eq("a NUL is refused", (await rawReq("PUT", "/api/kits/bench/x%00.wav", Buffer.from(wav))).status, 403);
  ok("nothing escaped the kits directory",
     !fs.existsSync(path.join(TMP, "evil.wav")) && !fs.existsSync(path.join(TMP, "evil")));
  const huge = Buffer.concat([Buffer.from(wav), Buffer.alloc(300 * 1024)]);
  eq("a sample past the cap is refused", (await rawReq("PUT", "/api/kits/bench/huge.wav", huge)).status, 413);
  ok("and it is not on disk", !fs.existsSync(path.join(KITS, "bench", "huge.wav")));
  eq("the shelf itself takes no writes", (await rawReq("PUT", "/api/kits", Buffer.from("x"))).status, 405);
  eq("nor does POST reach a sample",
     (await rawReq("POST", "/api/kits/bench/tone.wav", Buffer.from(wav))).status, 405);
  eq("a sample can be struck out", (await rawReq("DELETE", "/api/kits/bench/tone.wav")).status, 204);
  ok("and it is gone", !fs.existsSync(path.join(KITS, "bench", "tone.wav")));
  eq("striking out what is not there is a 404",
     (await rawReq("DELETE", "/api/kits/bench/tone.wav")).status, 404);
  eq("a sample that is not there is a 404 to read as well",
     (await rawReq("GET", "/api/kits/bench/tone.wav")).status, 404);

  srv.kill();
  await wait(200);
  try { fs.rmSync(TMP, { recursive:true, force:true }); } catch (e){}

  /* ================= 4. a boot that finds a log already there ============= */
  console.log("\n== booting onto a log that is already there ==");
  let raised = null;
  try {
    T.resetQuests();
    delete R.store[T.RULE_KEY];        /* a browser that has never seen a verdict */
    R.store[T.QUEST_KEY] = JSON.stringify(seedLog);
    const restored = T.bootState();
    ok("bootState says it restored something", restored === true);
    eq("the free-play page is the one in the log", T.doc.steps[0], "C4");
    ok("the quest's page is there too", T.questPage("stray").steps[0] === "E4");
    ok("and its verdict, read out of the log it predates", T.isDone("stray") === true);
  } catch (e){ raised = String(e && e.stack || e); }
  ok("and nothing was raised doing it", raised === null, raised);

  raised = null;
  try {
    T.resetQuests();
    delete R.store[T.QUEST_KEY];
    R.store[T.QUEST_KEY_V1] = JSON.stringify({ folio:"quest-log", version:1,
      quests:{ ladder:{ done:true, motif: pageOf({ steps: noteAt({ 0:"C4" }) }) } } });
    ok("a version-1 log boots", T.bootState() === true);
    ok("with its motif as the quest's page", T.questPage("ladder").steps[0] === "C4");
    ok("and it is written forward", !!R.store[T.QUEST_KEY] &&
       JSON.parse(R.store[T.QUEST_KEY]).version === 2);
    delete R.store[T.QUEST_KEY_V1];
  } catch (e){ raised = String(e && e.stack || e); }
  ok("nothing raised by the migration either", raised === null, raised);

  raised = null;
  try {
    T.resetQuests();
    delete R.store[T.QUEST_KEY];
    delete R.store[T.STORE_KEY];
    ok("an empty browser boots to nothing restored", T.bootState() === false);
    eq("on a blank page", T.doc.steps.join(), blank().join());
    eq("in free play", T.qActive, null);
  } catch (e){ raised = String(e && e.stack || e); }
  ok("and a blank boot raises nothing", raised === null, raised);

  raised = null;
  try {
    T.resetQuests();
    R.store[T.QUEST_KEY] = "{ this is not json at all";
    T.bootState();
  } catch (e){ raised = String(e && e.stack || e); }
  ok("a corrupt log is not a crash", raised === null, raised);
  delete R.store[T.QUEST_KEY];

  raised = null;
  try {
    T.resetQuests();
    ok("the server's own state can be applied over the top",
       T.applyServerState(seedLog) === true);
    eq("and the page in hand is the log's", T.doc.steps[0], "C4");
    ok("something that is not a log is refused instead",
       T.applyServerState({ steps: blank() }) === false);
  } catch (e){ raised = String(e && e.stack || e); }
  ok("with nothing raised", raised === null, raised);

  R.done();
})().catch(e => {
  console.log("  FAIL harness crashed -> " + (e && e.stack || e));
  console.log("\n" + R.tally.pass + " passed, " + (R.tally.fail + 1) + " failed\n");
  process.exit(1);
});
