/* Folio — js/state.js : the document, and everything that is true of it.

   The page as data — sixteen steps a voice, the lengths beside them, the key
   and the tempo — and the arithmetic that reads it: what a note is, what is
   written at a step and what is heard there, scale degrees, intervals, the
   keymap by physical position. Then persistence: the validator every page
   passes through however it arrives, what is written back out, the autosave,
   and the import and export of a file.

   Nothing here touches the DOM. It is the file to read to know what a folio
   IS; the map at the head of folio.html says where the rest lives. */
"use strict";

/* ================= model ================= */
/* ---- how long a page is ----
   Sixteen steps was a global once, and every loop in the app counted to it.
   It is two things now, and they were only ever the same number by accident:

     STEPS   the default length of a page, and the length of every page
             written before there was a choice
     WIN     how much of a page a view shows before anything has been
             measured — the fallback, and the sixteen the folio always drew

   How much is actually on screen is not a constant at all: it is whatever
   the screen has room for, measured by views.js and different in the two
   views, because they read in different directions. See the window below.

   The length itself belongs to the document, as the key and the tempo do:
   `len`, optional, one of PAGE_LENS, and written out only where it is not
   the default — so a sixteen-step page is byte for byte the page it always
   was, and an older build reads it without ever knowing the field exists.
   Everything derived from it — the steps, the holds, the seals — follows
   the page it is on. */
var STEPS = 16;
var PAGE_LENS = [16, 32, 64];
var MAX_STEPS = 64;
var WIN = 16;
var PAGE_FIELD = "len";
var NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
var STORE_KEY = "folio.v1";
var LEGACY_KEY = "folio.v0";
var SCENERY_KEY = "folio.scenery.v1";
/* files written by the short-lived rhythm-mark experiment carry "x" entries;
   they are read and dropped, never written */
var LEGACY_MARK = "x";

var DEFAULT_KEY = "C major";
/* the tempo, set on the key page beside the key: coarse steps of four, a
   fine step of one, and a range wide enough for a study and no wider */
var TEMPO_MIN = 60, TEMPO_MAX = 180, TEMPO_STEP = 4, TEMPO_FINE = 1;

/* ---- two voices, from Lesson 2 on ----
   The page holds two monophonic lines that play together and are written
   one at a time. They share everything a page has always shared — title,
   tempo, loop, key — and differ only in their notes and their timbre.

   `steps` stays exactly what it was: the lead. The second voice is a new
   optional field beside it, so a page written before Lesson 2 — a file, a
   quest workspace, a drill's seed — loads and plays precisely as it did,
   with a silent bass underneath it. Nothing was renamed and nothing moved. */
var VOICES = 2;
var VOICE_NAMES = ["lead", "bass"];
var VOICE_FIELD = ["steps", "bass"];

/* ---- the held note, from Lesson 3 on ----
   A step is still a sixteenth and a note still begins on one. What is new
   is that it may go on ringing over the steps after it instead of stopping
   at the end of its own: a length, in steps, beside each note.

   It is a field of its own — one array per voice, parallel to that voice's
   steps — and never a change to what a step *is*. That matters twice over.
   A page written before Lesson 3 has no length array at all and every note
   in it is one step long, which is precisely what it always was; and an
   older build handed a page with lengths reads the notes exactly as it
   always did and simply does not see the lengths. Had the length been put
   *inside* the step — a note become an object — that same older build would
   have rejected the whole page as unreadable. So it is beside, not inside.

   A length of 1 is the plain sixteenth and is never written out: a log from
   a board on which nothing is held is byte for byte the log it always was. */
var VOICE_HOLD = ["hold", "basshold"];

/* ---- what each voice sounds like ----
   One entry per voice: null is the voice's own synth tone, the one the folio
   has always had, and a string is the name of a kit on the shelf. It belongs
   to the page rather than to the browser, so a workspace remembers its own
   sound and switching workspaces switches it; and it is optional, so every
   page written before it reads exactly as it always did, in the two tones
   audio.js draws. A name this folio has never heard of is not an error: that
   voice plays its own tone and the name is kept, because the page may well
   travel back somewhere the kit exists. js/tones.js does the playing. */
var VOICE_TONE = "tones";

/* ---- the sealed note ----
   A quest may hand a page notes that are not the player's to unwrite. A seal
   is not a mode and not a permission system: it is a per-note fact, beside
   the note as the length is beside it, one array per voice — so a page that
   seals nothing is byte for byte the page it always was, and an older build
   handed a sealed page simply does not see the seals.

   An entry is a string of letters, or null for a note that wears nothing:

     p   the pitch is sealed — it may be carried elsewhere, it may be made
         longer or shorter, but it will sound the note it sounds
     r   the onset is pinned — it will not leave the step it begins on
     l   the written hold is sealed — it may be renamed, it may be carried,
         but it rings for as long as it was given

   The letters are canonical in that order, so "prl" is the whole of it and
   an immutable note. And any seal at all keeps the note from being taken
   away: nothing is left half-sealed by a delete.

   What a seal constrains is that note's OWN written fields and nothing else.
   The neighbourhood is never fenced off — writing elsewhere is always
   allowed, including a note that shortens a sealed note's HEARD span, since
   written and heard are kept apart here (see spanOf) and a length seal
   freezes the written hold alone. */
var VOICE_LOCK = ["lock", "basslock"];
var LOCK_KINDS = "prl";

/* ---- the mirrored span ----
   A quest may want to say that these eight steps and those eight steps are
   the same music — a reprise — or that the bass repeats on fours. Written by
   hand that is two copies to keep in step, and they drift.

   A mirror is one cell of music pointed at from several places on the page.
   Not a source and a copy: there is no original and no direction. A cell of
   length `cell` has a list of `sites`, and the music at every one of them IS
   the cell — writing at any site writes the cell, and every other site is
   already changed by the time the page is drawn again. It binds one voice:
   a mirror on the bass leaves the lead free to answer it.

     mirrors: [ { voice:1, cell:4, sites:[0,4,8,12,16,20,24,28] } ]

   The Return is a cell of 8 with sites at 0 and 24 in both voices — two
   mirrors, one a voice. An ostinato is the eight sites above. Even spacing
   is only what a site list happens to say: the primitive is a list, not a
   period, and a cell may sit anywhere with anything between.

   Sites are step indices, from nought, as every index in this file is.

   It arrives with the workspace, like the key, the tempo and the length, and
   NOTHING in the instrument makes or unmakes one (player ruling 2026-08-05):
   there is no binding, nothing on the pad, no way in. A hand for it comes at
   the arrangement lesson.

   What is shared is the *written* music — the note, its written length, and
   any seal on it. What is heard is still computed at each site by the rule
   that has always governed it (spanOf): a note whose ring runs past the end
   of its site goes on ringing into whatever follows it *there*, so one cell
   can sound different in different places. That is the point, not a leak.

   Optional and written only where one exists, as `tones` and `len` are: a
   page with no mirror is byte for byte the page it always was, and a build
   that predates this simply does not see the field. */
var MIRROR_FIELD = "mirrors";

/* a page: the whole document. Every workspace holds one of these. */
function defaultDoc(){
  return {
    version: 1,
    title: "untitled folio",
    tempo: 112,
    loop: STEPS,           /* playback repeats the first `loop` steps: 4, 8, or 16 */
    key: DEFAULT_KEY,      /* the key of the piece: relative entry counts in it */
    steps: new Array(STEPS).fill(null),   /* the lead */
    bass: new Array(STEPS).fill(null),    /* the second voice */
    hold: new Array(STEPS).fill(1),       /* how long each lead note rings */
    basshold: new Array(STEPS).fill(1),   /* and each bass note */
    lock: new Array(STEPS).fill(null),    /* what a lead note is sealed against */
    basslock: new Array(STEPS).fill(null),/* and a bass note */
    tones: [null, null],                  /* what each voice sounds like */
    mirrors: [],                          /* cells bound to several places */
    mute: [false, false],
    solo: [false, false]
  };
}
var doc = defaultDoc();
var baseOctave = 4;      // C2 - C6
var cursor = 0;
var voice = 0;           /* which voice the hands are writing into */
/* ---- what each view is showing ----
   Two windows, not one. The column reads downwards and the roll reads
   across, so they are bound by different edges of the screen and there is
   no reason on earth they should be showing the same number of steps: a
   wide short screen may have the whole page in the drawing and two thirds
   of it in the writing at the same moment. Each therefore keeps its own
   size and its own first step, and both follow the one cursor, so that
   turning from one to the other lands on the step you left.

   The sizes are measured (views.js, fitViews) and the sixteens here are
   only what stands until something has been measured — which is also what
   a harness with no layout in it sees. Neither is a preference of the
   document: none of this is saved. */
var winCol = WIN, winRoll = WIN;
var startCol = 0, startRoll = 0;

/* how long a page is, read as permissively as everything optional here:
   absent, junk, a number nobody offers — all of it means the sixteen the
   folio has always had */
function docLen(d){
  var n = d && d[PAGE_FIELD];
  return (PAGE_LENS.indexOf(n) >= 0) ? n : STEPS;
}
function pageLen(){ return docLen(doc); }
/* the loop rungs a page of this length offers: the short ones are kept
   whatever the page is — a deliberate four-step loop on a sixty-four-step
   page is a thing somebody wants — and the page's own length is the top */
function loopRungs(n){
  var out = [], i;
  for (i = 0; i < PAGE_LENS.length; i++) if (PAGE_LENS[i] < n) out.push(PAGE_LENS[i]);
  return [4, 8].concat(out, [n]);
}
/* ---- the window, and how it follows ----
   A page longer than the room a view has is read a window at a time, at
   the size the cells have always been: nothing shrinks, nothing is
   squeezed, and a long page reads exactly as a sixteen-step page does —
   there is simply more of it behind and ahead. The window moves only when
   the cursor walks out of it, and then by a half of itself, so that half of
   what was on screen is still there afterwards: the eye keeps its place,
   and a step near an edge does not send the page sliding under it one row
   at a time.

   Where a view has room for the whole page there is no window at all: the
   start pins at nought and stays there, and nothing anywhere says a word
   about which part of the page you are on, because you are on all of it. */
function follow(start, win, n){
  var max = n - win, half = Math.max(1, win >> 1);
  if (max <= 0) return 0;
  while (cursor < start) start -= half;
  while (cursor >= start + win) start += half;
  return Math.max(0, Math.min(max, start));
}
/* both windows follow the one cursor, always, whichever view is up: the
   view not being read is kept exactly as coherent as the one that is, so
   that F2 is a turn of the page and never a jump */
function syncWindow(){
  var n = pageLen(), a = startCol, b = startRoll;
  startCol = follow(startCol, winCol, n);
  startRoll = follow(startRoll, winRoll, n);
  return startCol !== a || startRoll !== b;
}
/* the view being read, and what it is showing. viz belongs to views.js and
   is the roll until it says otherwise. */
function colView(){ return typeof viz === "string" && viz === "column"; }
function winNow(){ return colView() ? winCol : winRoll; }
function winStartNow(){ return colView() ? startCol : startRoll; }
/* is this view holding less than the page? the one question the label — and
   the stride, and every line that mentions a window — is allowed to ask */
function windowed(){ return winNow() < pageLen(); }
/* which part of the page is on screen, said the way the header says things */
function windowLabel(){
  var s = winStartNow();
  return (s + 1) + "–" + Math.min(pageLen(), s + winNow()) + " of " + pageLen();
}
/* an array beside the steps, made to fit the page it is beside: short is
   filled out, long is cut down, and neither costs the page anything it had */
function fit(a, n, filler){
  if (!Array.isArray(a)) a = [];
  while (a.length < n) a.push(filler);
  if (a.length > n) a.length = n;
  return a;
}

/* Every reader of a voice goes through here, and every one of them tolerates
   a page that predates the second voice: the field is made on first touch
   rather than assumed. The same for the two flag pairs. */
function vsteps(v){
  var f = VOICE_FIELD[v || 0], n = pageLen();
  if (!doc[f] || doc[f].length !== n) doc[f] = fit(doc[f], n, null);
  return doc[f];
}
function docSteps(d, v){
  var a = d && d[VOICE_FIELD[v || 0]];
  return Array.isArray(a) ? a : null;
}
/* the lengths of one voice, made on first touch exactly as its steps are */
function vhold(v){
  var f = VOICE_HOLD[v || 0], n = pageLen();
  if (!Array.isArray(doc[f]) || doc[f].length !== n) doc[f] = fit(doc[f], n, 1);
  return doc[f];
}
function docHold(d, v){
  var a = d && d[VOICE_HOLD[v || 0]];
  return Array.isArray(a) ? a : null;
}
/* the seals beside one voice, made on first touch exactly as its lengths are */
function vlock(v){
  var f = VOICE_LOCK[v || 0], n = pageLen();
  if (!Array.isArray(doc[f]) || doc[f].length !== n) doc[f] = fit(doc[f], n, null);
  return doc[f];
}
function docLock(d, v){
  var a = d && d[VOICE_LOCK[v || 0]];
  return Array.isArray(a) ? a : null;
}
/* what the note at a step wears: the letters, or "" for a free note and for
   a step with nothing on it — a seal without a note under it is not a seal */
function sealOf(d, v, i){
  var s = docSteps(d, v);
  if (!s || !s[i]) return "";
  var a = docLock(d, v), t = a ? a[i] : null;
  return (typeof t === "string") ? t : "";
}
/* sealed against one thing in particular, or against anything at all. Every
   guard in edit.js asks through here, and so must anything later that moves,
   renames or unwrites a note — the mutation checks, never the handler. */
function sealed(d, v, i, kind){
  var t = sealOf(d, v, i);
  return kind ? t.indexOf(kind) >= 0 : !!t;
}
/* ---- the mirror, read off the page ----
   The whole of it is four small questions, and everything that writes music
   asks one of them. A page with no mirrors answers every one of them exactly
   as the folio always did — mirrorSites of a free step is that step alone —
   which is why the doors in edit.js could be moved onto these without a
   single `if` about mirrors anywhere in them. */
function docMirrors(d){
  var a = d && d[MIRROR_FIELD];
  return Array.isArray(a) ? a : [];
}
/* which cell covers this step of this voice, and how far into it we are */
function mirrorAt(d, v, i){
  var ms = docMirrors(d), k, j, m;
  for (k = 0; k < ms.length; k++){
    m = ms[k];
    if (m.voice !== v) continue;
    for (j = 0; j < m.sites.length; j++)
      if (i >= m.sites[j] && i < m.sites[j] + m.cell)
        return { m: m, off: i - m.sites[j] };
  }
  return null;
}
function mirrored(d, v, i){ return !!mirrorAt(d, v, i); }
/* every step that IS this step: the same offset at every site of its cell,
   ascending, this one among them — and just this one where nothing binds it */
function mirrorSites(d, v, i){
  var a = mirrorAt(d, v, i), out = [], k;
  if (!a) return [i];
  for (k = 0; k < a.m.sites.length; k++) out.push(a.m.sites[k] + a.off);
  return out;
}
/* a seal anywhere in the cell is a seal on the cell: the sites are one note
   wearing one seal, so the letters are read as the union of what they wear,
   in the canonical order the file writes them in */
function sealAll(d, v, i){
  var sites = mirrorSites(d, v, i), t = "", s = "", k, j, x, c;
  for (k = 0; k < sites.length; k++){
    x = sealOf(d, v, sites[k]);
    for (j = 0; j < x.length; j++) if (t.indexOf(x.charAt(j)) < 0) t += x.charAt(j);
  }
  for (k = 0; k < LOCK_KINDS.length; k++){
    c = LOCK_KINDS.charAt(k);
    if (t.indexOf(c) >= 0) s += c;
  }
  return s;
}
function sealedAll(d, v, i, kind){
  var t = sealAll(d, v, i);
  return kind ? t.indexOf(kind) >= 0 : !!t;
}
/* how long this note may be *written*, which is a question about the cell and
   not about one site of it. The written length is shared and the heard length
   is not, so the room is the most any site has: a note at the foot of the
   cell may be given a ring that runs past the end of one site — it simply
   stops earlier where something stands in its way, which is what spanOf has
   always done to every note on the page. */
function roomAll(d, v, i){
  var sites = mirrorSites(d, v, i), r = 0, k;
  for (k = 0; k < sites.length; k++) r = Math.max(r, roomAt(d, v, sites[k]));
  return r;
}
/* what is *written* at a step: the length the page holds, whatever else is
   on the page around it */
function writtenLen(d, v, i){
  var s = docSteps(d, v);
  if (!s || !s[i]) return 0;
  var h = docHold(d, v), n = h ? h[i] : 1;
  if (typeof n !== "number" || !isFinite(n)) n = 1;
  n = Math.round(n);
  return Math.max(1, Math.min(docLen(d), n));
}
/* ---- and what is *heard* ----
   A voice is one line: it cannot hold a note through another note of its
   own. So the sounding length of a note is its written length or the
   distance to the next note of that voice, whichever is shorter — counted
   round the loop, because a note begun inside the loop goes on ringing
   across the seam and into the repeat, which is the whole point of the
   thing. A note written past the loop is never played and never wraps; it
   simply stops at the end of the page.

   Written and heard are kept apart rather than reconciled, so that writing
   a note into the middle of a hold shortens the hold for as long as it is
   there and no longer: take the new note away again and the hold rings its
   full written length once more. Nothing is ever quietly rewritten. */
function spanOf(d, v, i){
  var s = docSteps(d, v);
  if (!s || !s[i]) return 0;
  var want = writtenLen(d, v, i);
  var N = docLen(d), loop = (d && d.loop) || N;
  var wrap = i < loop, lim = wrap ? loop : N - i, k, j;
  for (k = 1; k < lim; k++){
    j = wrap ? (i + k) % loop : i + k;
    if (s[j]) break;
  }
  return Math.max(1, Math.min(want, k));
}
/* every step a note occupies, its own first: one run, wrapped at the seam
   where it wraps */
function spanSteps(d, v, i){
  var n = spanOf(d, v, i), loop = (d && d.loop) || docLen(d);
  var wrap = i < loop, out = [], k;
  for (k = 0; k < n; k++) out.push(wrap ? (i + k) % loop : i + k);
  return out;
}
/* which note of a voice is sounding at each step: the index it began on,
   or −1 where the voice is silent */
function sounding(d, v){
  var s = docSteps(d, v), N = docLen(d), out = new Array(N), i, k, run;
  for (i = 0; i < N; i++) out[i] = -1;
  if (!s) return out;
  for (i = 0; i < N; i++){
    if (!s[i]) continue;
    run = spanSteps(d, v, i);
    for (k = 0; k < run.length; k++) if (out[run[k]] < 0) out[run[k]] = i;
  }
  return out;
}
/* the last step each held note is still sounding on: where its stroke ends
   on the page, and where the release actually happens */
function ringEnds(d, v){
  var s = docSteps(d, v), N = docLen(d), out = new Array(N), i, run;
  for (i = 0; i < N; i++) out[i] = false;
  if (!s) return out;
  for (i = 0; i < N; i++){
    if (!s[i]) continue;
    run = spanSteps(d, v, i);
    if (run.length > 1) out[run[run.length - 1]] = true;
  }
  return out;
}
/* the longest this note could be made without swallowing another of its own */
function roomAt(d, v, i){
  var s = docSteps(d, v);
  if (!s || !s[i]) return 0;
  var N = docLen(d), loop = (d && d.loop) || N;
  var wrap = i < loop, lim = wrap ? loop : N - i, k, j;
  for (k = 1; k < lim; k++){
    j = wrap ? (i + k) % loop : i + k;
    if (s[j]) break;
  }
  return k;
}
function flag(kind, v){ var a = doc[kind]; return !!(a && a[v]); }
function setFlag(kind, v, on){
  if (!Array.isArray(doc[kind])) doc[kind] = [false, false];
  doc[kind][v] = !!on;
}
function anySolo(){ return flag("solo", 0) || flag("solo", 1); }
/* solo wins over mute, as it does on every desk ever built */
function audible(v){ return anySolo() ? flag("solo", v) : !flag("mute", v); }
var storageOK = true;
var droppedMarks = false;   /* the last thing validated carried "x" entries */

/* ================= note helpers ================= */
var NOTE_RE = /^([A-G])(#|♯)?(-?\d{1,2})$/;

function parseNote(s){
  if (typeof s !== "string") return null;
  var m = NOTE_RE.exec(s.trim());
  if (!m) return null;
  var pc = {C:0,D:2,E:4,F:5,G:7,A:9,B:11}[m[1]] + (m[2] ? 1 : 0);
  return { pc: pc, oct: parseInt(m[3], 10) };
}
function noteFromOffset(oct, off){
  var total = oct * 12 + off;
  var o = Math.floor(total / 12);
  return NAMES[total - o * 12] + o;
}
function noteToFreq(s){
  var p = parseNote(s);
  if (!p) return null;
  var midi = (p.oct + 1) * 12 + p.pc;      // C4 = 60
  return 440 * Math.pow(2, (midi - 69) / 12);
}
function display(s){
  var m = NOTE_RE.exec(s);
  if (!m) return "·";
  return m[1] + (m[2] ? "♯" : "-") + m[3];
}
/* the same name without the column's alignment dash: what a bar is labelled
   with, and what anyone would write on a page — C4, F♯3, the octave number
   international (C4 is middle C, MIDI 60) */
function pitchName(s){
  var m = NOTE_RE.exec(s);
  if (!m) return "";
  return m[1] + (m[2] ? "♯" : "") + m[3];
}

/* ---- naming the distance between two notes ----
   Descriptive only. An interval is a number of semitones; below the octave
   it has the ordinary short name, and above it the compound one, which is
   the simple number plus seven for every octave crossed: a minor third and
   an octave is a minor tenth, m10. The tritone keeps its name and takes the
   compound number with it, so TT is a tritone and TT11 is a tritone and an
   octave. Direction is not named: the distance is what is measured, so a
   crossed pair reads the same as an uncrossed one. */
var IVL_QUALITY = ["P","m","M","m","M","P","TT","P","m","M","m","M"];
var IVL_NUMBER  = [ 1,  2,  2,  3,  3,  4,  4,   5,  6,  6,  7,  7 ];
function intervalName(semitones){
  var n = Math.abs(Math.round(semitones));
  var oct = Math.floor(n / 12), r = n - oct * 12;
  var num = IVL_NUMBER[r] + 7 * oct;
  if (r === 6) return oct ? "TT" + num : "TT";
  return IVL_QUALITY[r] + num;
}

/* ================= the key of the piece =================
   A key is a tonic and a mode. It is not a data model change: steps stay
   absolute note strings everywhere. The key exists so that relative entry
   can count in scale steps rather than semitones, and so that the header
   can say what the page is in. Persisted as an optional "key" field. */
var SCALES = { major:[0,2,4,5,7,9,11], minor:[0,2,3,5,7,8,10] };
var KEY_RE = /^([A-G])(#|♯)?[ _-]+(major|minor)$/i;
var LETTER_PC = { C:0, D:2, E:4, F:5, G:7, A:9, B:11 };
/* the range the app writes into: C2 to C6, as the base octave allows */
var MIDI_LO = 36, MIDI_HI = 84;

function parseKey(s){
  if (typeof s !== "string") return null;
  var m = KEY_RE.exec(s.trim());
  if (!m) return null;
  return { pc: (LETTER_PC[m[1].toUpperCase()] + (m[2] ? 1 : 0)) % 12,
           mode: m[3].toLowerCase() };
}
function normalizeKey(s){
  var k = parseKey(s);
  return k ? NAMES[k.pc] + " " + k.mode : DEFAULT_KEY;
}
function keyOf(){ return parseKey(doc.key) || { pc:0, mode:"major" }; }

function nameOfMidi(m){
  var o = Math.floor(m / 12) - 1;
  return NAMES[m - (o + 1) * 12] + o;
}
function clampMidi(m){ return Math.max(MIDI_LO, Math.min(MIDI_HI, m)); }

/* Scale degrees are absolute: degree 0 is the tonic at the octave the
   tonic's pitch class sits in, 7 is the tonic an octave up, -1 the seventh
   below. Every relative move is arithmetic on this number. */
function degreeOfMidi(m){
  var k = keyOf(), sc = SCALES[k.mode];
  var oct = Math.floor((m - k.pc) / 12), off = m - k.pc - oct * 12;
  var i = sc.indexOf(off);
  return (i >= 0) ? oct * 7 + i : null;      /* null: out of the key */
}
function midiOfDegree(d){
  var k = keyOf(), sc = SCALES[k.mode];
  var o = Math.floor(d / 7);
  return k.pc + o * 12 + sc[d - o * 7];
}
/* out-of-key note: the nearest scale tone in the direction of travel.
   Snapping counts as the first step of the move, so "up one" from F♯ in
   C major is G, and "down one" from F♯ is F. */
function snapDegree(m, dir){
  var k = keyOf(), sc = SCALES[k.mode], i;
  var oct = Math.floor((m - k.pc) / 12), off = m - k.pc - oct * 12;
  if (dir > 0){
    for (i = 0; i < 7; i++) if (sc[i] > off) return oct * 7 + i;
    return oct * 7 + 7;
  }
  for (i = 6; i >= 0; i--) if (sc[i] < off) return oct * 7 + i;
  return oct * 7 - 1;
}
function moveDegrees(m, n){
  if (!n) return m;
  var dir = n > 0 ? 1 : -1;
  var deg = degreeOfMidi(m);
  if (deg === null) return midiOfDegree(snapDegree(m, dir) + (n - dir));
  return midiOfDegree(deg + n);
}

/* ================= keymap, by physical position ================= */
/* Z-row = base octave, Q-row = one octave up. Offsets in semitones from C. */
var NOTE_KEYS = {
  KeyZ:0, KeyS:1, KeyX:2, KeyD:3, KeyC:4, KeyV:5, KeyG:6,
  KeyB:7, KeyH:8, KeyN:9, KeyJ:10, KeyM:11, Comma:12,
  KeyQ:12, Digit2:13, KeyW:14, Digit3:15, KeyE:16, KeyR:17, Digit5:18,
  KeyT:19, Digit6:20, KeyY:21, Digit7:22, KeyU:23, KeyI:24
};


/* ================= persistence ================= */
/* one voice's steps, read the way they have always been read — as many of
   them as the page says it is long, which for a page that says nothing is
   the sixteen it always was */
function readSteps(arr, n){
  n = n || STEPS;
  if (!Array.isArray(arr) || arr.length !== n) return null;
  var out = [];
  for (var i = 0; i < n; i++){
    var v = arr[i];
    if (v === null || v === undefined){ out.push(null); continue; }
    /* a rhythm mark from the removed two-pass entry: accepted, then dropped */
    if (v === LEGACY_MARK){ out.push(null); droppedMarks = true; continue; }
    var p = parseNote(v);
    if (!p) return null;
    out.push(NAMES[p.pc] + p.oct);
  }
  return out;
}
function silence(n){ return new Array(n || STEPS).fill(null); }
/* the lengths beside one voice, read as permissively as the key is: absent,
   short, long, junk, a length where there is no note — all of it means the
   plain sixteenth at that step, and none of it can cost the page its notes */
function readHolds(a, steps, N){
  var out = [], i, n;
  N = N || STEPS;
  for (i = 0; i < N; i++){
    n = (Array.isArray(a) && typeof a[i] === "number" && isFinite(a[i]))
          ? Math.round(a[i]) : 1;
    if (!(n > 1)) n = 1;
    if (n > N) n = N;
    out.push(steps[i] ? n : 1);
  }
  return out;
}
/* nothing is held here: the array says only what the absence of it says */
function allPlain(a){
  if (!Array.isArray(a)) return true;
  for (var i = 0; i < a.length; i++) if (a[i] !== 1) return false;
  return true;
}
/* the seals, read as permissively as the lengths beside them: absent, short,
   long, junk, a letter nobody has ever heard of, a seal where there is no
   note — all of it means a free note at that step, and none of it can cost
   the page its notes. What survives is kept in the canonical order however
   it was written, so "lp" and "prl" and "pxrl" read back as letters this
   folio knows, in the one order it writes them in. */
function readLocks(a, steps, N){
  var out = [], i, k, t, s, c;
  N = N || STEPS;
  for (i = 0; i < N; i++){
    t = (Array.isArray(a) && typeof a[i] === "string") ? a[i].toLowerCase() : "";
    s = "";
    for (k = 0; k < LOCK_KINDS.length; k++){
      c = LOCK_KINDS.charAt(k);
      if (t.indexOf(c) >= 0) s += c;
    }
    out.push((s && steps[i]) ? s : null);
  }
  return out;
}
/* nothing is sealed here: the array says only what the absence of it says */
function allFree(a){
  if (!Array.isArray(a)) return true;
  for (var i = 0; i < a.length; i++) if (a[i]) return false;
  return true;
}
/* the tones, read as permissively as everything optional here is: absent,
   short, long, junk, a number where a name should be — all of it means the
   voice's own tone, and none of it can cost the page its notes. A name is
   trimmed and capped and otherwise believed, kit or no kit. */
function readTones(a){
  var out = [], i, t;
  for (i = 0; i < VOICES; i++){
    t = Array.isArray(a) ? a[i] : null;
    out.push((typeof t === "string" && t.trim()) ? t.trim().slice(0, 32) : null);
  }
  return out;
}
/* ---- the mirrors, read ----
   Read strictly and dropped freely, which is the opposite of everything else
   optional here and is the right way round for this one: a length or a tone
   read wrong costs the page a little sound, but a mirror read wrong would
   fan a write out into steps nobody meant, and go on doing it. So a mirror
   that is not exactly what a mirror is — a voice that is not a voice, a cell
   shorter than a step or longer than the page, a site that is not a whole
   number, a site that runs off the end, a site named twice, a site lying
   over another site of its own cell or over any cell already read — is
   dropped whole, and the notes underneath it are not touched. A page keeps
   its music whatever its mirrors say.

   Dropped whole, and not the field: a good mirror beside a bad one is read.
   Two cells of the same voice may not overlap, because a step that belonged
   to two cells would have no answer to what writing on it means. */
function readMirrors(a, N){
  var out = [], taken = [], k, i, j, v, m, cell, sites, s, bad, seen;
  for (v = 0; v < VOICES; v++) taken.push(new Array(N).fill(false));
  if (!Array.isArray(a)) return out;
  for (k = 0; k < a.length; k++){
    m = a[k];
    if (!m || typeof m !== "object" || Array.isArray(m)) continue;
    v = m.voice;
    if (typeof v !== "number" || !isFinite(v) || v !== Math.round(v) ||
        v < 0 || v >= VOICES) continue;
    cell = m.cell;
    if (typeof cell !== "number" || !isFinite(cell) || cell !== Math.round(cell) ||
        cell < 1 || cell > N) continue;
    if (!Array.isArray(m.sites) || !m.sites.length) continue;
    sites = []; bad = false; seen = {};
    for (i = 0; i < m.sites.length; i++){
      s = m.sites[i];
      if (typeof s !== "number" || !isFinite(s) || s !== Math.round(s) ||
          s < 0 || s + cell > N){ bad = true; break; }
      if (seen["s" + s]){ bad = true; break; }
      seen["s" + s] = true;
      sites.push(s);
    }
    if (bad) continue;
    sites.sort(function(x, y){ return x - y; });
    for (i = 1; i < sites.length; i++) if (sites[i] < sites[i - 1] + cell) bad = true;
    for (i = 0; i < sites.length; i++)
      for (j = 0; j < cell; j++) if (taken[v][sites[i] + j]) bad = true;
    if (bad) continue;
    for (i = 0; i < sites.length; i++)
      for (j = 0; j < cell; j++) taken[v][sites[i] + j] = true;
    out.push({ voice: v, cell: cell, sites: sites });
  }
  return out;
}
/* nothing is bound here: the array says only what the absence of it says */
function allUnbound(a){ return !Array.isArray(a) || !a.length; }
/* every voice on its own tone: the array says only what the absence of it says */
function allOwnTone(a){
  if (!Array.isArray(a)) return true;
  for (var i = 0; i < a.length; i++) if (a[i]) return false;
  return true;
}
/* a page on its way out of the app — a file, the autosave, the quest log.
   The lengths are written only where something is actually held, the tones
   only where a voice is wearing one, and the seals only where a note wears
   one, so a page with no holds, no kits and nothing sealed in it is the page
   it always was, to the byte, and an older build reads what it wrote. */
function docOut(d){
  if (!d || typeof d !== "object") return d;
  var out = {}, k, v;
  for (k in d) if (Object.prototype.hasOwnProperty.call(d, k)) out[k] = d[k];
  for (v = 0; v < VOICES; v++){
    if (allPlain(out[VOICE_HOLD[v]])) delete out[VOICE_HOLD[v]];
    if (allFree(out[VOICE_LOCK[v]])) delete out[VOICE_LOCK[v]];
  }
  if (allOwnTone(out[VOICE_TONE])) delete out[VOICE_TONE];
  if (allUnbound(out[MIRROR_FIELD])) delete out[MIRROR_FIELD];
  /* the echo is written only where there is one, and only where it is one:
     the validator is the single door it comes through, so anything else
     wearing the name leaves here rather than being written back out */
  if (!docEcho(out)) delete out[ECHO_FIELD];
  /* and the length only where the page is longer than the page always was */
  if (docLen(out) === STEPS) delete out[PAGE_FIELD];
  return out;
}
function readFlags(a){
  var out = [];
  for (var i = 0; i < VOICES; i++) out.push(!!(Array.isArray(a) && a[i]));
  return out;
}
function validate(obj){
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return null;
  droppedMarks = false;
  /* the length is read before anything that is measured by it, and a page
     that says nothing is the sixteen-step page it has always been */
  var N = docLen(obj);
  var steps = readSteps(obj.steps, N);
  if (!steps) return null;
  /* The second voice is optional and permissive, as the key is: a page from
     before Lesson 2 has no `bass` at all and gets a silent one, and a `bass`
     that cannot be read is silence rather than a rejected file — the lead is
     what the file is for, and it is never risked for the sake of the bass. */
  var bass = (obj.bass === null || obj.bass === undefined)
               ? silence(N) : (readSteps(obj.bass, N) || silence(N));
  var tempo = (typeof obj.tempo === "number" && isFinite(obj.tempo) && obj.tempo > 0) ? obj.tempo : 112;
  var title = (typeof obj.title === "string" && obj.title.trim()) ? obj.title.trim().slice(0, 60) : "untitled folio";
  /* version 1 files may carry a loop length; anything the page does not
     offer as a rung means the whole page, whatever the page is */
  var loop = (loopRungs(N).indexOf(obj.loop) >= 0) ? obj.loop : N;
  /* the key is optional and permissive: a file without one is in C major,
     and so is a file whose key cannot be read */
  var key = normalizeKey(obj.key);
  var out = { version: 1, title: title, tempo: tempo, loop: loop, key: key,
           steps: steps, bass: bass,
           hold: readHolds(obj.hold, steps, N),
           basshold: readHolds(obj.basshold, bass, N),
           lock: readLocks(obj.lock, steps, N),
           basslock: readLocks(obj.basslock, bass, N),
           tones: readTones(obj.tones),
           mirrors: readMirrors(obj[MIRROR_FIELD], N),
           mute: readFlags(obj.mute), solo: readFlags(obj.solo) };
  /* the hidden call, if the page is an echo's: read strictly by js/echo.js,
     which is where the whole of that idea lives, and simply absent — not
     null, not empty — on every page that is not one */
  var ec = readEcho(obj[ECHO_FIELD], N);
  if (ec) out[ECHO_FIELD] = ec;
  if (N !== STEPS) out[PAGE_FIELD] = N;
  return out;
}
/* The autosave is now the autosave of a workspace. Every modification runs
   through here, exactly as before; what changed is where it lands — the
   page is written back into whichever workspace is active, and the whole
   set of workspaces is written out together. STORE_KEY keeps a copy of the
   active page so an older build (or anything else reading the browser's
   storage) still finds a pattern where it always was. */
function save(){
  if (!storageOK) return;
  /* the echo's marks are a snapshot of a judgement, and every modification
     of the page comes through here: a mark never outlives the note it was
     made about */
  echoClear();
  stash();
  try {
    localStorage.setItem(QUEST_KEY, JSON.stringify(stateToJSON()));
    /* the old single autosave is the page you were writing; a tool's blank
       sheet is not one, and must not become what an older build reads back */
    if (!isTool(qActive)) localStorage.setItem(STORE_KEY, JSON.stringify(docOut(doc)));
  }
  catch (e){ storageOK = false; say("autosave unavailable in this window"); }
  renderRails();
  syncPush();
}
function load(){
  var raw = null;
  try { raw = localStorage.getItem(STORE_KEY) || localStorage.getItem(LEGACY_KEY); }
  catch (e){ storageOK = false; return false; }
  if (!raw) return false;
  try {
    var v = validate(JSON.parse(raw));
    if (!v) return false;
    doc = v;
    if (droppedMarks) save();     /* rewrite the autosave without the marks */
    return true;
  } catch (e){ return false; }
}

function exportFile(){
  var name = doc.title.replace(/[^A-Za-z0-9 _-]/g, "").trim() || "untitled folio";
  var blob = new Blob([JSON.stringify(docOut(doc), null, 2)], { type: "application/json" });
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url; a.download = name + ".folio.json";
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
  say("exported " + name + ".folio.json");
}
function importText(text, label){
  var o = null, v = null;
  try { o = JSON.parse(text); } catch (e){ o = null; }
  /* a quest log opens as a quest log, wherever it is dropped */
  if (isQuestLog(o)){ importQuests(o, label); return; }
  try { v = validate(o); } catch (e){ v = null; }
  if (!v){ say("that file is not a folio — nothing changed"); return; }
  var dropped = droppedMarks;
  doc = v;
  cursor = 0;
  if (playing) stop();
  renderAll(); save();
  say("opened " + (label || doc.title) +
      (dropped ? " · marks from an older file were dropped" : ""));
}
function importFile(file){
  if (!file){ return; }
  var r = new FileReader();
  r.onload = function(){ importText(String(r.result), file.name); };
  r.onerror = function(){ say("could not read that file"); };
  r.readAsText(file);
}
