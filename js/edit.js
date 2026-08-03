/* Folio — js/edit.js : what the hands do.

   Writing a note and advancing by an eighth; the held note — its length, its
   two ends, and the growing that happens while a key is kept down; contour
   entry, which is the pad's only way of writing, and the nudge; choosing a
   voice, soloing and muting one; the key, the tempo and the loop; clearing,
   the cursor and the octave; and raising or putting down the two pages.

   Every edit here goes through the model in state.js and then asks views.js
   to draw it. */
"use strict";

/* ================= editing ================= */
/* ---- what "next" means after writing ----
   A step is a sixteenth, so a bar is the sixteen of the page. Almost
   everything written here is thought in eighths, so that is what entry
   assumes: writing a note (or a rest) leaves the cursor two steps on, and
   a run of entries lays notes on 1, 3, 5, 7 … without anyone counting.
   A sixteenth is still there and costs one deliberate movement — step back
   with an arrow (or the d-pad, or the stick) and write. Nothing is snapped
   and nothing is aligned to a grid: it is two from wherever the cursor is,
   and it wraps around the page exactly as the arrows do. Moving the cursor
   by hand is untouched, and still one step at a time. */
var ADVANCE = 2;
function advance(){ cursor = (cursor + ADVANCE) % STEPS; renderCursor(); }
/* every edit lands in the voice the hands are in, and nowhere else.
   A step written into is a step struck afresh: unless a length is handed in
   (the nudge keeps the one the note already had), it is the plain sixteenth
   the folio has always written, so nothing about writing a note changed at
   Lesson 3 — the hold is always something asked for afterwards, or asked
   for by keeping hold of the key. */

/* ---- what a seal refuses ----
   The guards live here, on the four things that actually change the model —
   writing a step, changing a length, growing one under a held key, and
   carrying a note to another step — and never in a key or a button handler.
   Every way in therefore inherits them, including ways in that do not exist
   yet: a refusal is the mutation declining, not a handler remembering.

   A refusal changes nothing at all and says so, once, in the ordinary voice
   of the footer. Nothing flashes and nothing is marked in red; the seal was
   already on the page before the hand moved. */
function refuse(msg){ say(msg); return false; }
var SEAL_SAY = {
  p: "that note's pitch is sealed",
  r: "that note is pinned to its step",
  l: "that note's length is sealed",
  "": "that note is sealed — it stays"
};

/* the one door every write goes through. It answers whether the page
   changed, so that a caller can hold its tongue — and its cursor — when the
   page did not. */
function setStep(i, v, len){
  var s = vsteps(voice), lk = sealOf(doc, voice, i);
  var want = (v && typeof len === "number") ? Math.max(1, len) : 1;
  if (lk){
    /* any seal at all keeps the note: it is never unwritten out from under
       whatever the quest sealed it for */
    if (!v) return refuse(SEAL_SAY[""]);
    if (lk.indexOf("p") >= 0 && v !== s[i]) return refuse(SEAL_SAY.p);
    if (lk.indexOf("l") >= 0 && want !== writtenLen(doc, voice, i))
      return refuse(SEAL_SAY.l);
  }
  s[i] = v;
  vhold(voice)[i] = want;
  if (!v) vlock(voice)[i] = null;      /* nothing there to be sealed against */
  renderNotes(); save();
  return true;
}
/* carrying a note whole: the same pitch and the same seal, at another step.
   moveEdge is the only caller today; it is a function of its own so that
   anything later which moves a note has one guarded door to come through. */
function carryNote(v, i, j, len){
  var s = vsteps(v), h = vhold(v), l = vlock(v);
  if (sealed(doc, v, i, "r")) return refuse(SEAL_SAY.r);
  if (len !== writtenLen(doc, v, i) && sealed(doc, v, i, "l"))
    return refuse(SEAL_SAY.l);
  s[j] = s[i]; h[j] = len; l[j] = l[i] || null;
  s[i] = null; h[i] = 1; l[i] = null;
  return true;
}

/* ================= the held note =================
   Length is edited on whatever note is *sounding* at the cursor, not only
   on one that begins there: with a four-step note under the hand, every one
   of those four steps is that note as far as the ear is concerned, so all
   four are it as far as the hands are concerned too. */
function headAt(v, i){
  var s = vsteps(v);
  if (s[i]) return i;
  var snd = sounding(doc, v);
  return snd[i];
}
/* the length that can be asked for here: never past the next note of the
   same voice, and never longer than one turn of the loop */
function roomHere(v, i){ return roomAt(doc, v, i); }
function setLen(v, i, n, quiet){
  var s = vsteps(v);
  if (!s[i]) return false;
  if (sealed(doc, v, i, "l")){ if (!quiet) refuse(SEAL_SAY.l); return false; }
  var cap = roomHere(v, i);
  var was = writtenLen(doc, v, i);
  n = Math.max(1, Math.min(cap, n));
  if (n === was){
    if (!quiet)
      say(display(s[i]) + " at step " + (i + 1) + " · " +
          (n === 1 ? "one step" : n + " steps") +
          (n === cap ? " · as long as it will go here" : ""));
    return false;
  }
  vhold(v)[i] = n;
  renderNotes(); save();
  if (!quiet){
    showGuide(midiOf(s[i]));
    audition(s[i], n);
    say(display(s[i]) + " at step " + (i + 1) + " · " +
        (n === 1 ? "one step" : n + " steps") +
        (n < was ? " · shorter" : " · ringing on"));
  }
  return true;
}
/* ---- holding it down ----
   The fast way is not a second key at all: keep hold of whatever wrote the
   note and the note goes on growing, a step at a time, for as long as you
   hold it — the key on the board, or the face button on the pad, which is
   now the only thing on the pad that writes. Let go and it stops where it
   is. A tap is
   shorter than the first delay, so writing at speed is exactly what it
   always was and nothing grows by accident.

   The cursor keeps out of the way: while the note is growing past the
   eighth the cursor rides just past its end, so letting go and writing
   again puts the next note where the last one stopped. */
var GROW_DELAY = 300;                /* held this long before it starts */
var grow = null;                     /* {v, i, next, code, btn} */

/* and then a step every step: the note grows in the page's own time, so
   holding a key through one beat writes one beat. Kept inside sane bounds
   at the ends of the tempo range, where a step is very short or very long. */
function growStep(){
  return Math.max(70, Math.min(400, stepDur() * 1000));
}

function nowMs(){
  return (window.performance && performance.now) ? performance.now() : Date.now();
}
function growStart(v, i, code, btn){
  grow = { v:v, i:i, next: nowMs() + GROW_DELAY, code:code, btn:btn };
}
function growStop(){ grow = null; }
function growTick(){
  if (!grow) return;
  if (anyPage()){ growStop(); return; }   /* a page came up under the finger */
  var now = nowMs();
  if (now < grow.next) return;
  grow.next = now + growStep();
  var v = grow.v, i = grow.i, s = vsteps(v);
  if (!s[i]){ growStop(); return; }             /* it went away underneath us */
  /* a sealed length does not grow under the finger either; said once, and
     then the growing is let go of so it is not said again every step */
  if (sealed(doc, v, i, "l")){ growStop(); refuse(SEAL_SAY.l); return; }
  var n = writtenLen(doc, v, i) + 1;
  if (n > roomHere(v, i)) return;               /* at the wall: hold there */
  vhold(v)[i] = n;
  renderNotes(); save();
  if (n > ADVANCE){ cursor = (i + n) % STEPS; renderCursor(); }
  say(display(s[i]) + " at step " + (i + 1) + " · " + n + " steps");
}

/* ---- the two ends of a note, moved one at a time ----
   A note has two edges and they are not the same decision. Moving its
   *end* leaves it where it is and changes how long it rings — the release,
   made later or sooner. Moving its *start* carries the note itself, and
   leaves the far end exactly where it was — the attack, made earlier or
   later, against an ending that is already decided. Both matter at Lesson
   3 and the pad gives each its own modifier, so that a phrase can be
   shaped from either end without ever thinking in numbers.

   Neither edge may run over another note of the same voice, and neither
   may leave a note with less than the step it begins on. */
function moveEdge(end, d){
  var i = headAt(voice, cursor);
  if (i < 0){ say("step " + (cursor + 1) + " is empty — no note to move"); return; }
  if (end){ setLen(voice, i, writtenLen(doc, voice, i) + d); return; }
  var s = vsteps(voice), len = writtenLen(doc, voice, i);
  var j = i + d;
  if (j < 0 || j >= STEPS){
    say("that note is already at the " + (d < 0 ? "head" : "foot") + " of the page");
    return;
  }
  if (s[j]){ say("step " + (j + 1) + " is taken"); return; }
  if (len - d < 1){
    say(display(s[i]) + " is one step long — its start cannot pass its end");
    return;
  }
  var name = s[i], n = Math.min(STEPS, len - d);
  /* this mover trades length for position — it holds the far end still — so
     a note with its length sealed cannot be moved this way, and one pinned
     to its step cannot be moved at all */
  if (!carryNote(voice, i, j, n)) return;
  renderNotes();
  /* the cursor stays on the note it was on, wherever the note has got to */
  if (headAt(voice, cursor) !== j){ cursor = j; renderCursor(); }
  save();
  showGuide(midiOf(name));
  audition(name, n);
  say(display(name) + " begins at step " + (j + 1) + " · " +
      (n === 1 ? "one step" : n + " steps"));
}

/* ---- and the note itself, carried ----
   The third thing that can be done to a note in time, and the one the
   other two are not: moving its start alone re-times the attack against an
   ending already decided, and moving its end alone re-decides the ending —
   but a note that is simply in the wrong place wants neither. It wants to
   go where it belongs and arrive the same length it left, because its
   length was never the mistake. So this carries both edges at once and
   changes nothing but where the note sits.

   Only the step it lands on is asked about. What its length does once it
   is there is the page's business and not a thing to be quietly rewritten:
   the written length is kept whole, and the ring caps itself against
   whatever it now runs into, exactly as it would have if the note had been
   written there in the first place. Move it back and it rings as it did. */
function moveNote(d){
  var i = headAt(voice, cursor);
  if (i < 0){ say("step " + (cursor + 1) + " is empty — no note to move"); return; }
  var j = i + d;
  if (j < 0 || j >= STEPS){
    say("that note is already at the " + (d < 0 ? "head" : "foot") + " of the page");
    return;
  }
  var s = vsteps(voice);
  if (s[j]){ say("step " + (j + 1) + " is taken"); return; }
  var name = s[i], len = writtenLen(doc, voice, i);
  /* through the guarded door: the length rides whole, so only a pinned
     step refuses — the carry is exactly what a length seal permits */
  if (!carryNote(voice, i, j, len)) return;
  renderNotes();
  /* the cursor rides along, so holding the direction walks the note and not
     out from under it */
  if (headAt(voice, cursor) !== j){ cursor = j; renderCursor(); }
  save();
  showGuide(midiOf(name));
  audition(name, spanOf(doc, voice, j));
  say(display(name) + " at step " + (j + 1) + " · " +
      (len === 1 ? "one step" : len + " steps"));
}

/* − and +, and the same pair with shift: a step at a time, or the whole
   room there is and back to a plain sixteenth */
function stretch(d, whole){
  var i = headAt(voice, cursor);
  if (i < 0){
    say("step " + (cursor + 1) + " is empty — nothing to hold");
    return;
  }
  var want = whole ? (d > 0 ? STEPS : 1) : writtenLen(doc, voice, i) + d;
  setLen(voice, i, want);
}

function writeNote(name, tail){
  var at = cursor + 1;
  /* a refused write leaves the cursor where it is as well as the page: the
     seal has already said what happened, and there is nothing to hear */
  if (!setStep(cursor, name)) return;
  showGuide(midiOf(name));         /* the drawing says which pitch that was */
  audition(name);
  advance();
  say(display(name) + " at step " + at + (tail ? " · " + tail : ""));
}
function enterNote(off){
  writeNote(noteFromOffset(baseOctave, off));
}

/* ================= relative (contour) entry =================
   The pad's one and only way of writing. An input method, not a data
   model: the page still holds absolute note strings. Relative entry asks
   for a direction and writes whatever pitch that direction lands on,
   counted in scale steps of the current key.

   There is no other method and nothing to choose between: naming pitches
   is what the keyboard is for, and the pad is for shapes.

   The anchor is the previous sounding note, scanned backwards from the
   cursor. Rests do not break the chain, and the scan wraps — around the
   loop while the cursor is inside it, around the whole page otherwise.
   A page with nothing on it anchors on the tonic in the base octave. */

function anchorMidi(){
  var span = (cursor < doc.loop) ? doc.loop : STEPS, s = vsteps(voice);
  for (var k = 1; k <= span; k++){
    var i = ((cursor - k) % span + span) % span;
    if (s[i]) return clampMidi(midiOf(s[i]));
  }
  return null;
}
function tonicMidi(){ return clampMidi((baseOctave + 1) * 12 + keyOf().pc); }

/* n scale steps, signed; chromatic asks for n semitones instead */
function relStep(n, chromatic){
  var a = anchorMidi();
  if (a === null){ writeNote(nameOfMidi(tonicMidi()), "the tonic"); return; }
  var want = chromatic ? a + n : moveDegrees(a, n);
  var m = clampMidi(want);
  writeNote(nameOfMidi(m), m !== want ? "the end of the range" : null);
}
function relRepeat(){
  var a = anchorMidi();
  if (a === null){ writeNote(nameOfMidi(tonicMidi()), "the tonic"); return; }
  writeNote(nameOfMidi(a), "again");
}
/* the note under the cursor, moved a scale step, staying where it is.
   `chromatic` is the escape hatch relStep already had, asked for the same
   way (both bumpers) and meaning the same thing: n semitones, out of the
   key. A stray is as often a note already written that wants to lean a
   half-step as it is a note about to be written, and correcting one should
   not cost the constraint the whole page is under. */
function nudge(n, chromatic){
  /* the note under the cursor is whichever note is sounding there, so a
     held note can be leant on from any step it covers; its length is its
     own and is not spent by moving it */
  var at = headAt(voice, cursor);
  if (at < 0){ say("step " + (cursor + 1) + " is empty — nothing to nudge"); return; }
  var v = vsteps(voice)[at];
  var from = clampMidi(midiOf(v));
  var m = clampMidi(chromatic ? from + n : moveDegrees(from, n));
  var name = nameOfMidi(m);
  if (!setStep(at, name, writtenLen(doc, voice, at))) return;
  showGuide(m);                    /* the note moved: the line moves with it */
  audition(name);
  say(display(name) + " at step " + (at + 1));
}

/* ---- choosing a voice, and taking one away ----
   One voice is written into at a time; both always play. Choosing is not a
   mode and costs nothing — the cursor stays where it is, the loop keeps
   running, and the other line is still on the page in front of you, only
   quieter. Solo and mute are what the ear needs to check its work: the
   brother's solo test is one keystroke. */
function voiceName(v){ return VOICE_NAMES[v]; }
function voiceState(v){
  if (anySolo()) return flag("solo", v) ? "solo" : "silent under the solo";
  return flag("mute", v) ? "muted" : "";
}
function setVoice(v){
  voice = ((v % VOICES) + VOICES) % VOICES;
  renderNotes(); renderCursor(); renderMeta(); renderVoices();
  var st = voiceState(voice);
  say("the " + voiceName(voice) + (st ? " · " + st : ""));
}
/* ---- the ring the hands walk ----
   The voices are a ring, walked in the order they are named above the page.
   Two of them for now; a lesson that adds a third adds it to that list and
   nothing here changes — which is why changing hands is a ring walked both
   ways rather than a switch flipped between two things. With three voices
   either neighbour is still one press away, whichever way round you go.

   It is reached from three places, deliberately, because it is the most
   frequent movement on the page: tab and shift+tab on the keyboard, L1 and
   R1 on the pad — a tap, on the page, with no mode to raise first — and
   the strip above the page for a mouse. It is deliberately *not* in the
   settings crossbar any more: a movement made every few notes does not
   belong behind a menu. */
function cycleVoice(d){ setVoice(voice + d); }
function nextVoice(){ cycleVoice(1); }
function prevVoice(){ cycleVoice(-1); }
function toggleSolo(v){
  v = (v === undefined) ? voice : v;
  setFlag("solo", v, !flag("solo", v));
  renderMeta(); renderVoices(); save();
  say(flag("solo", v) ? "the " + voiceName(v) + " alone" : "both voices again");
}
function toggleMute(v){
  v = (v === undefined) ? voice : v;
  setFlag("mute", v, !flag("mute", v));
  renderMeta(); renderVoices(); save();
  say("the " + voiceName(v) + (flag("mute", v) ? " · muted" : " · back"));
}

/* the key is set on the key page, where it is also explained. The drawing's
   home rules are laid on the tonic, so a key change re-places them there and
   then: rollLayout is the one thing that has to be said again — the notes,
   the window and the bars are all exactly what they were. */
function shiftTonic(d){
  var k = keyOf();
  doc.key = NAMES[((k.pc + d) % 12 + 12) % 12] + " " + k.mode;
  renderMeta(); rollLayout(); save(); say("the key · " + doc.key);
}
function toggleKeyMode(){
  var k = keyOf();
  doc.key = NAMES[k.pc] + " " + (k.mode === "major" ? "minor" : "major");
  renderMeta(); rollLayout(); save(); say("the key · " + doc.key);
}

/* ---- the tempo, set on the same page as the key ----
   Tempo belongs to the document, so it belongs to the workspace: each quest
   keeps its own, free play keeps its own, and none of them can see another.
   Playback needs no special handling — the lookahead scheduler reads the
   step duration afresh at the top of every window, so a change lands on the
   next scheduled step, with no restart and no click. */
function shiftTempo(d){
  var want = doc.tempo + d;
  var n = Math.max(TEMPO_MIN, Math.min(TEMPO_MAX, want));
  doc.tempo = n;
  renderMeta(); save();
  say("tempo · " + n + (n !== want ? " — the end of the range" : ""));
}

/* the loop: playback repeats the first 4, 8, or all 16 steps. Editing is
   never fenced in — the cursor still walks the whole page. */
function setLoop(n){
  doc.loop = n;
  if (schedStep >= n) schedStep = 0;   /* mid-playback shortening snaps home */
  /* the loop is where a held note wraps, so the page has to be drawn again
     and not merely re-shaded: a note that rang across the old seam may ring
     across a different one now, or stop at the end of the page instead */
  renderNotes(); renderLoop(); renderMeta(); save();
  say(n === STEPS ? "loop · the whole page" : "loop · first " + n + " steps");
}
function cycleLoop(){ setLoop(doc.loop === STEPS ? 8 : doc.loop === 8 ? 4 : STEPS); }

function clearStep(){
  /* clearing takes away whatever is sounding here, which for a step in the
     middle of a hold is the held note itself: the ear hears one note there
     and one note is what goes */
  var at = headAt(voice, cursor);
  if (at < 0){
    setStep(cursor, null);
    say("cleared step " + (cursor + 1));
    advance();
    return;
  }
  var held = writtenLen(doc, voice, at) > 1;
  if (!setStep(at, null)) return;   /* a sealed note is not cleared, or passed */
  say("cleared step " + (at + 1) + (held ? " · and the hold with it" : ""));
  advance();
}
function moveCursor(d){
  cursor = (cursor + d + STEPS) % STEPS;
  renderCursor();
  say("step " + (cursor + 1));
}
function jump(i){ cursor = i; renderCursor(); say("step " + (i + 1)); }
function shiftOctave(d){
  var n = Math.min(6, Math.max(2, baseOctave + d));
  if (n === baseOctave){ say("octave " + baseOctave + " — end of the range"); return; }
  baseOctave = n; renderMeta(); say("octave " + baseOctave);
}
function toggleQuests(){
  var on = !questsEl.classList.contains("on");
  questsEl.classList.toggle("on", on);
  if (on){ settingsEl.classList.remove("on"); markSettings(false); }
  applyViz();
  renderRails();
  if (on) renderQuests();
  say(on ? "the quest log · " + selQuest().short : "‸ cursor row");
}
