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

console.log("\n== what a plain page writes out ==");
const outPlain = T.docOut(V(pageOf({ steps: noteAt({ 0:"C4" }) })));
ok("a page with nothing held writes no lead lengths", !("hold" in outPlain));
ok("and no bass lengths", !("basshold" in outPlain));
eq("its steps are there as they always were", outPlain.steps[0], "C4");
ok("and so is every other field",
   ["version","title","tempo","loop","key","steps","bass","mute","solo"]
     .every(k => k in outPlain), Object.keys(outPlain));
const outHeld = T.docOut(V(pageOf({ steps: noteAt({ 0:"C4" }),
                                    hold:[4,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1] })));
ok("a page with something held writes its lengths", "hold" in outHeld);
eq("exactly as they were asked for", outHeld.hold[0], 4);
ok("and still no bass lengths, nothing being held there", !("basshold" in outHeld));
ok("allPlain says so of an absent array", T.allPlain(undefined) === true);
ok("and of an array of ones", T.allPlain([1,1,1]) === true);
ok("and not of one with a two in it", T.allPlain([1,2,1]) === false);

console.log("\n== the round trip, both ways ==");
const rich = V(pageOf({ title:"the round trip", tempo:96, loop:8, key:"E minor",
  steps: noteAt({ 0:"E4", 2:"G4", 5:"B4", 11:"D5" }),
  bass:  noteAt({ 0:"E2", 8:"B2" }),
  hold:  [3,1,2,1,1,4,1,1,1,1,1,2,1,1,1,1],
  basshold:[8,1,1,1,1,1,1,1,4,1,1,1,1,1,1,1],
  mute:[false,true], solo:[false,false] }));
const wire = JSON.stringify(T.docOut(rich));
const back = V(JSON.parse(wire));
for (const k of ["title","tempo","loop","key"])
  eq("the round trip keeps " + k, back[k], rich[k]);
eq("it keeps the lead's notes", back.steps, rich.steps);
eq("it keeps the bass's notes", back.bass, rich.bass);
eq("it keeps the lead's lengths", back.hold, rich.hold);
eq("it keeps the bass's lengths", back.basshold, rich.basshold);
eq("it keeps mute", back.mute, rich.mute);
eq("it keeps solo", back.solo, rich.solo);
eq("and a second trip changes nothing", JSON.stringify(T.docOut(back)), wire);

console.log("\n== an older build meets a newer log ==");
/* an older folio knows `steps` and `bass` and nothing about lengths: it reads
   the page it always read, and simply does not see the holds */
const old = JSON.parse(wire);
eq("every lead note is where it was", old.steps, rich.steps);
eq("every bass note is where it was", old.bass, rich.bass);
ok("the lengths are beside the notes, never inside them",
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
                    hold:[4,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1] })));
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
ok("a quest nobody has touched is not in the log at all", !("summit" in st.quests));
ok("and no marks are written where none were made",
   !("fav" in st.quests.stray) && !("order" in st.quests.stray));
const roundState = JSON.parse(JSON.stringify(st));
T.resetQuests();
ok("applyState reads it back", T.applyState(roundState) === true);
eq("the quest's page came back", T.questPage("stray").steps[0], "E4");
eq("with its length", T.questPage("stray").hold[0], 4);
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
ok("done is read", T.qState.stray.done === true);
ok("kept-to-hand is read", T.favOf("stray") === true);
eq("and the order it was put in", T.orderOf("stray", 99), 3);
ok("a quest with neither mark has neither", T.favOf("summit") === false);
eq("and falls back to the order it was delivered in", T.orderOf("summit", 7), 7);
const marks = T.stateToJSON();
ok("the marks ride back out", marks.quests.stray.fav === true && marks.quests.stray.order === 3);
ok("and a quest carrying no mark and no work is not written at all",
   !("summit" in marks.quests), Object.keys(marks.quests));
T.resetQuests();
T.applyState({ folio:"quest-log", version:2, quests:{ stray:{ done:true } } });
ok("a log that knows neither mark still reads", T.qState.stray.done === true);
ok("with nothing kept to hand", T.favOf("stray") === false);
ok("and no order imposed", T.questSlotOrder === undefined || T.orderOf("stray", 5) === 5);

console.log("\n== the drill definitions the log carries ==");
const DRILL = { id:"t1-drill", name:"a drill", summary:"do the thing",
                teaches:"the thing", lesson:3,
                pattern:{ version:1, title:"seed", tempo:104, loop:8, key:"F major",
                          steps: noteAt({ 0:"F4", 2:"A4" }) } };
T.resetQuests();
T.applyState({ folio:"quest-log", version:2, active:null, quests:{}, drills:[DRILL] });
const dr = T.drillById("t1-drill");
ok("the definition is adopted", !!dr);
eq("with its name", dr.name, "a drill");
eq("its summary", dr.summary, "do the thing");
eq("what it teaches", dr.teaches, "the thing");
eq("and the lesson it says it is for", dr.lesson, 3);
ok("its pattern is validated on the way in", !!dr.pattern && dr.pattern.steps[0] === "F4");
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
ok("its done flag is not lost", T.qState["t1-orphan"].done === true);
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
ok("the done flag came across", T.qState.summit.done === true);
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

console.log("\n== the cut, and the manifest that records it ==");
const cutMe = T.encodeWAV(new Float32Array(1000), 22050);
eq("truncating takes the frames asked for",
   T.truncate(T.decodeWAV(cutMe).data, 100, 300).length, 200);
eq("downsampling halves the frames with the rate",
   T.resample(T.decodeWAV(cutMe).data, 22050, 11025).length, 500);
const gen = T.generate("glass", 60, 0.4, 0.7, 22050);
ok("a generated wave comes with a loop", gen.loopEnd > gen.loopStart);
ok("that sits inside it", gen.loopEnd <= gen.data.length);
const lp = T.autoLoop(gen.data, 22050, 60);
ok("a spliced loop starts before it ends", lp.loopEnd > lp.loopStart);
ok("and stays inside the sample", lp.loopEnd <= gen.data.length && lp.loopStart >= 0);

const rec = { file:"piano-c4.wav", root:60, rate:11025, frames:5000, bytes:10044,
              loopStart:3000, loopEnd:4200, decay:2.4, source:"a piano, curated" };
const line = T.manifestLine(rec);
ok("the line names the file", /`piano-c4\.wav`/.test(line), line);
ok("and reads as prose", / — root C4 · 11025 Hz/.test(line), line);
const readBack = T.parseManifest(T.manifestText("piano", [rec]))["piano-c4.wav"];
ok("the manifest is read back at all", !!readBack);
eq("with the root note", readBack.root, 60);
eq("the rate", readBack.rate, 11025);
eq("the loop points", [readBack.loopStart, readBack.loopEnd], [3000, 4200]);
eq("the imposed decay", readBack.decay, 2.4);
eq("and where the material came from", readBack.source, "a piano, curated");
const plain = T.parseManifest("# kit: x\n\nprose about nothing\n- `hat.wav` — 8000 Hz · 900 B\n");
eq("a line with no loop and no decay is still a sample", Object.keys(plain).join(), "hat.wav");
eq("with no loop", [plain["hat.wav"].loopStart, plain["hat.wav"].loopEnd], [0, 0]);
eq("and no decay", plain["hat.wav"].decay, 0);
eq("prose around it is not a sample", Object.keys(T.parseManifest("just a sentence")).length, 0);

console.log("\n== the sampled voice, and what it refuses ==");
T.kitSamples = [{ file:"a.wav", rate:8000, data:new Float32Array(80), frames:80,
                  root:48, loopStart:0, loopEnd:0, decay:0, buf:null },
                { file:"b.wav", rate:8000, data:new Float32Array(80), frames:80,
                  root:72, loopStart:0, loopEnd:0, decay:0, buf:null }];
T.kitWorn = true;
eq("the nearer root is the one that plays", T.nearestSample(T.midiFreq(50)).root, 48);
eq("and from above, likewise", T.nearestSample(T.midiFreq(70)).root, 72);
T.kitWorn = false;
ok("nothing is worn, nothing is chosen", T.nearestSample(T.midiFreq(60)) === null);
ok("and the sampled voice declines, so the folio's own tone plays",
   T.samplePlay(440, 0, 0.2, 0, false) === false);
T.kitWorn = true;
ok("the bass is never the kit's", T.samplePlay(440, 0, 0.2, 1, false) === false);
T.kitWorn = false;
T.kitSamples = [];

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
        { PORT:String(port), FOLIO_LOG: LOG, FOLIO_KITS: KITS }) });
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
  const dropDone = JSON.parse(JSON.stringify(both));
  dropDone.quests.stray.done = false;
  await fetch(BASE + "/api/quest-log",
    { method:"PUT", headers:{ "content-type":"application/json" }, body: JSON.stringify(dropDone) });
  eq("nothing else on disk is preserved — a done flag belongs to the page",
     JSON.parse(fs.readFileSync(LOG, "utf8")).quests.stray.done, false);

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
    R.store[T.QUEST_KEY] = JSON.stringify(seedLog);
    const restored = T.bootState();
    ok("bootState says it restored something", restored === true);
    eq("the free-play page is the one in the log", T.doc.steps[0], "C4");
    ok("the quest's page is there too", T.questPage("stray").steps[0] === "E4");
    ok("and its done flag", T.qState.stray.done === true);
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
