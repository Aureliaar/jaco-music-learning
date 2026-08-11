/* Folio — js/chords.js : the chord lane.

   Lesson 5's whole toolset, and the third stop on the ring the hands walk.
   A voice is one line of named pitches; this is not that. Its cell holds a
   chord as an OBJECT — where its root sits in the key, and what shape stands
   on it — and the pitches it actually sounds are worked out from the cell
   before it and never written down.

   That last part is the lesson. Voice leading is not a property of a chord,
   it is a property of the pair: the same chord after a different one is a
   different set of pitches, because the tones that were already sounding
   stay exactly where they are and only the rest move. So the page stores the
   relation and computes the sound, which is the only way the ear can be
   handed common tones for free.

   Nothing here names a chord. There is no spelling, no palette, no menu, and
   nothing anywhere asks which chord this is: every control says how this one
   sits against the one before it — a step up, a step down, the same again,
   thicker, thinner, nearer, plainer. That is player ruling and it is what
   the whole file is shaped by.

   What lives here: the field as the page carries it (read strictly, dropped
   whole), the shapes, the arithmetic that turns a lane of relations into a
   lane of pitches, and the lane's own edits. The length, the two edges and
   the carry are NOT here — those are the note lanes' verbs in edit.js, and
   the lane inherits them whole, because state.js asks nothing of a step but
   whether something is written on it.

   ---- the board, derived from the pad ----
   The pad shapes and the board names — that is the standing division here
   (edit.js, contour entry): the pad writes △ up, ✕ down, ○ again, □ rest,
   and the board writes by naming the pitch. A chord root has no pitch name
   in this lane; the only name it has is its degree of the key. So while the
   chord lane is in hand the two note rows name degrees instead of
   semitones — the same two rows, an octave each, by physical position —
   and the shape, which the pad holds a trigger for, is a press of A:

     Z X C V B N M ,     home, and the seven degrees above it
     Q W E R T Y U I     the octave above that
     A                   the shape under the cursor, round its ring
     shift+A             its voicing: rooted, or nearest

   Everything else on the board is what it always was: the arrows walk, − and
   + are the length, period is a rest, tab is the next lane. */
"use strict";

/* ---- the chord lane, as the page carries it ----
   Optional and beside the notes, as `len`, `tones`, `mirrors` and `echo`
   are, so a page with no chords is byte for byte the page it always was and
   an older build never sees the field:

     chords: [ {deg:0, shape:"triad"}, null, {deg:3, shape:"seventh",
               voicing:"root"}, … ]        one cell per step

   `deg` is the root as a scale degree of the page's own key: 0 is home,
   1..6 the steps above it, 7 the octave, and negatives below — the same
   integer vocabulary the echo's material is written in. It is counted from
   home in the chord register (CHORD_OCT), so the field is small, legible and
   hand-seedable, and it says nothing about which octave anything ends up in:
   that is the voicing's business, and the voicing is computed.

   `shape` is one of a closed set of literal strings, and an unknown one
   takes the whole field with it — so the set is a constant, in one place.

   `voicing` is "near" or "root", and "near" is the default and is never
   written out.

   Read strictly and dropped WHOLE, for the reason a mirror is read strictly:
   a length read wrong costs a little sound, but a chord lane read wrong
   would put pitches nobody wrote under everything the player plays, and go
   on doing it. Anything that is not exactly this and the lane is empty, the
   notes underneath it untouched. */
var CHORD_FIELD = "chords";
var CHORD_HOLD = "chordhold";
var CHORD_SHAPES = ["dyad", "triad", "seventh", "sus", "borrowed"];
/* the thickness dial, and only these three: how many voices are standing.
   `sus` and `borrowed` are flavours rather than thicknesses, and the dial
   walks onto the triad from either of them rather than pretending to. */
var CHORD_THICK = ["dyad", "triad", "seventh"];
var CHORD_VOICINGS = ["near", "root"];
/* the register the roots are counted in, and how far the lane may walk from
   home in either direction — three octaves, which is more than the range
   under it can hold anyway */
var CHORD_OCT = 3;
var CHORD_DEG_LO = -14, CHORD_DEG_HI = 21;
/* one glyph a shape, for the written column: the chord is ONE mark, and the
   mark thickens as the chord does */
var CHORD_GLYPH = { dyad:"◦", triad:"◇", seventh:"◈", sus:"○", borrowed:"◆" };
/* and what each is called when the folio says it out loud — never a name,
   always how many are standing and what is odd about them */
var CHORD_SAID = { dyad:"two voices", triad:"three voices",
                   seventh:"four voices", sus:"three voices, no third",
                   borrowed:"three voices, borrowed" };
/* the scale steps above the root each shape stands on. The third and the
   seventh are whatever the KEY makes of them at that degree — which is the
   whole reason the lane is written in degrees: the shapes come out major,
   minor and diminished by themselves, and nobody had to choose. */
var CHORD_STEPS = { dyad:[0,4], triad:[0,2,4], seventh:[0,2,4,6],
                    sus:[0,3,4], borrowed:[0,2,4] };

function chordInt(n, lo, hi){
  if (typeof n !== "number" || !isFinite(n) || n !== Math.round(n)) return null;
  return (n < lo || n > hi) ? null : n;
}
/* a cell, made the one way cells are made: clean, fresh, and carrying the
   default voicing only as its absence */
function chordCell(deg, shape, voicing){
  var c = { deg: Math.max(CHORD_DEG_LO, Math.min(CHORD_DEG_HI, deg)),
            shape: (CHORD_SHAPES.indexOf(shape) >= 0) ? shape : "triad" };
  if (voicing === "root") c.voicing = "root";
  return c;
}
function readChords(a, N){
  var out = new Array(N).fill(null), i, o, deg;
  if (a === null || a === undefined) return out;
  if (!Array.isArray(a) || a.length > N) return out;
  for (i = 0; i < a.length; i++){
    o = a[i];
    if (o === null || o === undefined) continue;
    if (typeof o !== "object" || Array.isArray(o)) return new Array(N).fill(null);
    deg = chordInt(o.deg, CHORD_DEG_LO, CHORD_DEG_HI);
    if (deg === null) return new Array(N).fill(null);
    if (CHORD_SHAPES.indexOf(o.shape) < 0) return new Array(N).fill(null);
    if (o.voicing !== null && o.voicing !== undefined &&
        CHORD_VOICINGS.indexOf(o.voicing) < 0) return new Array(N).fill(null);
    out[i] = chordCell(deg, o.shape, o.voicing);
  }
  return out;
}
/* the lane in hand, and the cell at a step of it */
function onChords(){ return voice === CHORD_LANE; }
function chordAt(d, i){
  var s = docSteps(d || doc, CHORD_LANE);
  return (s && s[i]) ? s[i] : null;
}
/* is there a chord anywhere on this page? what the drawing asks before it
   makes room for a lane nobody is using */
function chordsHere(d){
  var s = docSteps(d || doc, CHORD_LANE), i;
  for (i = 0; s && i < s.length; i++) if (s[i]) return true;
  return false;
}

/* ================= from a relation to a sound =================
   Home in the chord register, counted in degrees, is where every root is
   measured from; the shape is stacked on it in scale steps, so what comes
   out is diatonic without anything having chosen a quality. The borrowed
   chord is the one exception and it is exactly one semitone: the third,
   leant the other way — out of the key, which is what both triggers have
   always meant everywhere else on this pad. */
function chordHomeDeg(){ return degreeOfMidi((CHORD_OCT + 1) * 12 + keyOf().pc); }
function chordRootMidi(c){ return midiOfDegree(chordHomeDeg() + c.deg); }
/* the chord in root position, low to high, before anything is voiced */
function chordStack(c){
  var st = CHORD_STEPS[c.shape] || CHORD_STEPS.triad, rd = chordHomeDeg() + c.deg;
  var out = [], i;
  for (i = 0; i < st.length; i++) out.push(midiOfDegree(rd + st[i]));
  if (c.shape === "borrowed") out[1] += (keyOf().mode === "major") ? -1 : 1;
  return out;
}
/* inside the range the whole folio writes in, moved by whole octaves only so
   that nothing about the chord changes on the way */
function chordInRange(p){
  var out = p.slice(), i;
  while (out[out.length - 1] > MIDI_HI) for (i = 0; i < out.length; i++) out[i] -= 12;
  while (out[0] < MIDI_LO) for (i = 0; i < out.length; i++) out[i] += 12;
  return (out[out.length - 1] > MIDI_HI) ? null : out;
}
/* ---- the plain arrangement ----
   The root at the bottom and the rest stacked over it, wherever the degree
   put it and with no regard for what came before. It is one half of the pair
   the lesson is about: flip a chord to this and the movement it was hiding
   is audible at once. */
function chordRooted(c){ return chordInRange(chordStack(c)) || chordStack(c); }
/* ---- and the near one ----
   The same chord, arranged so that as little as possible moves. Every
   stacked arrangement of it is tried — each tone taken as the bottom, at
   every octave the range allows — and the one that moves least from the
   chord before it wins. Movement is measured both ways: how far each new
   pitch is from the nearest old one, and how far each old pitch is from the
   nearest new one. A pitch that is in both chords therefore costs nothing at
   all, which is why the winner holds it: common tones are not a special case
   here, they are what the arithmetic falls into. */
function chordCandidate(stack, r, oct){
  var k = stack.length, out = [stack[r] + 12 * oct], j, p;
  for (j = 1; j < k; j++){
    p = stack[(r + j) % k];
    while (p <= out[j - 1]) p += 12;
    while (p - 12 > out[j - 1]) p -= 12;
    out.push(p);
  }
  return out;
}
function chordMove(a, b){
  var s = 0, i, j, d, best;
  for (i = 0; i < a.length; i++){
    best = 1e9;
    for (j = 0; j < b.length; j++){ d = Math.abs(a[i] - b[j]); if (d < best) best = d; }
    s += best;
  }
  for (j = 0; j < b.length; j++){
    best = 1e9;
    for (i = 0; i < a.length; i++){ d = Math.abs(a[i] - b[j]); if (d < best) best = d; }
    s += best;
  }
  return s;
}
function chordNear(c, prev){
  var stack = chordStack(c), best = null, bs = 1e9, bb = 1e9, r, o, cand, s, b;
  for (r = 0; r < stack.length; r++){
    for (o = -2; o <= 2; o++){
      cand = chordCandidate(stack, r, o);
      if (cand[0] < MIDI_LO || cand[cand.length - 1] > MIDI_HI) continue;
      s = chordMove(cand, prev);
      b = Math.abs(cand[0] - prev[0]);
      /* least movement; and where two arrangements move the same, the one
         whose bottom stayed nearer the old bottom, which is the one the ear
         reads as the same chord moved rather than a new one */
      if (s < bs || (s === bs && b < bb)){ best = cand; bs = s; bb = b; }
    }
  }
  return best || chordRooted(c);
}
/* ---- the lane, voiced ----
   One pass down the page, because every chord is near the one before it and
   nothing else. The first chord of a lane is rooted — there is nothing to be
   near — and so is any chord the page says is rooted, which then becomes
   what the next one is near to. Nothing wraps: a lane read from the seam
   backwards would have no beginning to start the chain at. */
function chordVoicings(d){
  var s = docSteps(d || doc, CHORD_LANE), N = docLen(d || doc);
  var out = new Array(N).fill(null), prev = null, i, c;
  for (i = 0; i < N; i++){
    c = s ? s[i] : null;
    if (!c) continue;
    out[i] = (!prev || c.voicing === "root") ? chordRooted(c) : chordNear(c, prev);
    prev = out[i];
  }
  return out;
}
function chordPitches(i){ return chordVoicings(doc)[i]; }

/* ================= what the folio says about a chord =================
   The root said as the pitch it is — the same way the column writes a note
   and the drawing names its home rules — and then how many voices are
   standing and how they are arranged. Never a chord name: there is nothing
   here to identify, only a place in the key and a thickness. */
function chordSay(c){
  return pitchName(nameOfMidi(chordRootMidi(c))) + " · " + CHORD_SAID[c.shape] +
         (c.voicing === "root" ? " · rooted" : "");
}
function chordGlyph(c){ return CHORD_GLYPH[c.shape] || "◇"; }
/* ---- the three things every lane is asked ----
   The length verbs and the two time verbs in edit.js are shared by all three
   lanes, and these are the only places they have to know which lane they are
   in: what to call what is written there, what to sound, and where to lay
   the drawing's guide. */
function stepText(v, i){
  var s = vsteps(v);
  if (!s[i]) return "";
  return (v === CHORD_LANE) ? chordSay(s[i]) : display(s[i]);
}
function stepGuide(v, i){
  var s = vsteps(v);
  if (!s[i]) return;
  showGuide(v === CHORD_LANE ? chordRootMidi(s[i]) : midiOf(s[i]));
}
function stepAudition(v, i, len){
  var s = vsteps(v);
  if (!s[i]) return;
  if (v !== CHORD_LANE){ audition(s[i], len); return; }
  chordAudition(chordPitches(i), len);
}
/* a chord heard as it is written: every pitch of it at once, at the length
   the writing asked for, through the scheduler's own playNote so that it
   sounds like the lane it is going into */
function chordAudition(pitches, len){
  var n = (typeof len === "number" && len > 1) ? len : 1.6, i, dur;
  if (!pitches) return;
  audio();
  if (ctx.state !== "running"){ say("press any key or click once to enable sound"); return; }
  dur = Math.min(stepDur() * n, 1.6);
  for (i = 0; i < pitches.length; i++)
    playNote(nameOfMidi(pitches[i]), ctx.currentTime + 0.01, dur, CHORD_LANE, n > 1.6);
}

/* ================= writing =================
   The pad's four face buttons, exactly as they are on the note lanes: △ the
   root a step up, ✕ a step down, ○ the same chord again, □ a rest. The
   anchor is the chord before the cursor, scanned backwards and wrapping
   round the loop, which is the same scan contour entry has always used — so
   a lane is written by shape, without a number anywhere in the hand.

   The triggers say the shape while it is being written, mirroring what they
   already do to a note: L2 the seventh, R2 the sus, both together the
   borrowed chord, out of the key. */
var CHORD_BY_LEAD = ["triad", "seventh", "sus", "borrowed"];

function chordAnchor(){
  var span = (cursor < doc.loop) ? doc.loop : pageLen(), s = vsteps(CHORD_LANE), k, i;
  for (k = 1; k <= span; k++){
    i = ((cursor - k) % span + span) % span;
    if (s[i]) return s[i];
  }
  return null;
}
function chordWrite(c, tail){
  var at = cursor + 1;
  /* a refused write leaves the cursor where it is as well as the page */
  if (!setStep(cursor, c, 1)) return;
  stepGuide(CHORD_LANE, at - 1);
  stepAudition(CHORD_LANE, at - 1);
  advance();
  say(chordSay(c) + " at step " + at + (tail ? " · " + tail : ""));
}
function chordEnter(dir, lead){
  var a = chordAnchor(), shape = CHORD_BY_LEAD[lead || 0] || "triad";
  if (!a){ chordWrite(chordCell(0, shape), "home"); return; }
  chordWrite(chordCell(a.deg + dir, shape));
}
function chordRepeat(){
  var a = chordAnchor();
  if (!a){ chordWrite(chordCell(0, "triad"), "home"); return; }
  chordWrite(chordCell(a.deg, a.shape, a.voicing), "again");
}

/* ================= editing the chord under the cursor =================
   The pitch pair of the d-pad, and the three rungs the player agreed: bare
   it moves the root, one trigger walks the thickness, both flip the voicing.
   Which pair is "pitch" trades with the view exactly as it does for a note,
   because it is the same handler underneath (padNudge in entry.js).

   All three go through one door, so that a chord under a cursor is edited in
   one place and the cursor's own idea of which chord that is — the chord
   *sounding* here, not only one struck here — is asked once. */
function chordHere(){
  var i = headAt(CHORD_LANE, cursor);
  if (i < 0){ say("step " + (cursor + 1) + " is empty — no chord there"); return -1; }
  return i;
}
function chordPut(i, c, tail){
  if (!setStep(i, c, writtenLen(doc, CHORD_LANE, i))) return;
  stepGuide(CHORD_LANE, i);
  stepAudition(CHORD_LANE, i);
  say(chordSay(c) + " at step " + (i + 1) + (tail ? " · " + tail : ""));
}
/* the root, a scale step, staying where it is — the nudge, for a chord */
function chordNudge(n){
  var i = chordHere(), c;
  if (i < 0) return;
  c = vsteps(CHORD_LANE)[i];
  chordPut(i, chordCell(c.deg + n, c.shape, c.voicing));
}
/* thicker and thinner: two voices, three, four. A dial and not a ring — the
   ends hold, so leaning on it never wraps round to the thin end by surprise.
   From a shape that is not on the dial it steps onto the triad, which is
   where both of the others already stand. */
function chordThicken(n){
  var i = chordHere(), c, k;
  if (i < 0) return;
  c = vsteps(CHORD_LANE)[i];
  k = CHORD_THICK.indexOf(c.shape);
  if (k < 0) k = CHORD_THICK.indexOf("triad");
  k = Math.max(0, Math.min(CHORD_THICK.length - 1, k + (n > 0 ? 1 : -1)));
  chordPut(i, chordCell(c.deg, CHORD_THICK[k], c.voicing));
}
/* the voicing: up is the plain rooted arrangement, down is the nearest one.
   Two states on a pair of directions rather than a toggle, so that pressing
   the same way twice says the same thing twice. */
function chordVoice(n){
  var i = chordHere(), c, want;
  if (i < 0) return;
  c = vsteps(CHORD_LANE)[i];
  want = (n > 0) ? "root" : "near";
  chordPut(i, chordCell(c.deg, c.shape, want),
           want === "root" ? "rooted" : "nearest");
}
/* the board holds no pair of directions for this one, so there it is the
   flip the two states already are */
function chordFlip(){
  var i = chordHere();
  if (i < 0) return;
  chordVoice(vsteps(CHORD_LANE)[i].voicing === "root" ? -1 : 1);
}
/* the board's one extra: the shape under the cursor, round the whole ring —
   the thickness dial and the two flavours together, since the board holds no
   trigger to say which of them it means */
function chordShape(n){
  var i = chordHere(), c, k;
  if (i < 0) return;
  c = vsteps(CHORD_LANE)[i];
  k = (CHORD_SHAPES.indexOf(c.shape) + (n > 0 ? 1 : -1) + CHORD_SHAPES.length) %
      CHORD_SHAPES.length;
  chordPut(i, chordCell(c.deg, CHORD_SHAPES[k], c.voicing));
}
/* ---- the degree rows ----
   The board's own way in, and the one place in this file a number is typed:
   the two note rows, by physical position, naming home and the degrees above
   it instead of the semitones they name in a voice. A chord written this way
   is a triad — the plain thing — and A walks it to whatever else it wants to
   be, which is the two presses the pad does in one because the pad's hand is
   already holding a trigger. */
var CHORD_KEYS = {
  KeyZ:0, KeyX:1, KeyC:2, KeyV:3, KeyB:4, KeyN:5, KeyM:6, Comma:7,
  KeyQ:7, KeyW:8, KeyE:9, KeyR:10, KeyT:11, KeyY:12, KeyU:13, KeyI:14
};
function chordDegree(deg){ chordWrite(chordCell(deg, "triad")); }
