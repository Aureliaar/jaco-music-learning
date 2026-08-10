/* Folio — js/echo.js : the call, and what is made of the answer.

   Lesson 4's one tool. Every other part of this folio exists to get music out
   of the hands and onto the page; this one goes the other way — the folio
   plays a short fragment nobody can see, the hands answer it back on the grid
   with the ordinary writing gestures, and when it is asked, the folio says how
   much of the answer rang true.

   Three things live here and nothing else does: the field read off the page
   (strictly, as the mirrors are), the call played (through the scheduler's own
   playNote, so it sounds like the instrument), and the judgement (on demand,
   per stage, and never a word about what the right answer was).

   The seats the two commands sit in are lent from solo and mute and belong to
   entry.js and quests.js; the marks are drawn by views.js. This file decides
   what they mean. */
"use strict";

/* ---- the echo, as the page carries it ----
   Optional, and beside the notes rather than inside them — as `len`, `tones`
   and `mirrors` are — so a page with no echo is byte for byte the page it
   always was and an older build never sees the field:

     echo: { stage:"contour", voice:0, at:0,
             call:[ {step:0, note:"C4", len:1}, {step:2, note:"E4", len:2} ] }

   `stage` is which of the three questions is being asked, and only ever one
   of them: the shape, the degrees, or the rhythm. `voice` is the line that
   answers, `at` the step of the page the answer begins on, and `call` the
   fragment itself — events counted from nought *inside the call*, so the
   fragment can be moved along the page by changing one number.

   Read strictly and dropped whole, for the same reason a mirror is: a length
   read wrong costs a little sound, but an echo read wrong would mark a page
   right or wrong on arithmetic nobody meant. Anything that is not exactly
   this and the field is gone, the notes underneath it untouched, and the
   workspace is an ordinary drill. */
var ECHO_FIELD = "echo";
var ECHO_STAGES = ["contour", "degrees", "rhythm"];

function echoInt(n, lo, hi, dflt){
  if (n === null || n === undefined) return dflt;
  if (typeof n !== "number" || !isFinite(n) || n !== Math.round(n)) return null;
  return (n < lo || n > hi) ? null : n;
}
function readEcho(o, N){
  if (!o || typeof o !== "object" || Array.isArray(o)) return null;
  if (ECHO_STAGES.indexOf(o.stage) < 0) return null;
  var v = echoInt(o.voice, 0, VOICES - 1, 0);
  var at = echoInt(o.at, 0, N - 1, 0);
  if (v === null || at === null) return null;
  if (!Array.isArray(o.call) || !o.call.length || o.call.length > N) return null;
  var call = [], i, e, step, len, p, last = -1;
  for (i = 0; i < o.call.length; i++){
    e = o.call[i];
    if (!e || typeof e !== "object" || Array.isArray(e)) return null;
    step = echoInt(e.step, 0, N - 1, null);
    len = echoInt(e.len, 1, N, 1);
    if (step === null || len === null) return null;
    if (step <= last) return null;                 /* in order, and never twice */
    p = parseNote(e.note);
    if (!p) return null;
    if (at + step + len > N) return null;          /* the call fits the page */
    last = step;
    /* the note written the one way the page writes notes, whatever spelling
       the definition arrived in */
    call.push({ step: step, note: NAMES[p.pc] + p.oct, len: len });
  }
  return { stage: o.stage, voice: v, at: at, call: call };
}
function docEcho(d){
  var e = d && d[ECHO_FIELD];
  return (e && typeof e === "object" && !Array.isArray(e) &&
          ECHO_STAGES.indexOf(e.stage) >= 0 && Array.isArray(e.call) && e.call.length)
           ? e : null;
}
/* the echo in hand, if the page in front of you is one */
function echoNow(){ return docEcho(doc); }
/* how far the call reaches: the last step of it, ring and all */
function echoSpan(e){
  var n = 0, i, k;
  for (i = 0; i < e.call.length; i++){
    k = e.call[i].step + e.call[i].len;
    if (k > n) n = k;
  }
  return n;
}

/* ---- the call, played ----
   Not a preview and not a separate instrument: the same playNote the
   scheduler uses, on the page's own tempo, in the answering voice — so the
   call wears whatever the scriptorium gave that voice, and the answer is
   compared against something that sounded the way the answer will sound.

   It stops the loop first. The call over a running loop is two pieces of
   music at once, and the ear cannot hold the one it is being asked to hold.
   It may be replayed as often as wanted; nothing is spent by listening. */
function echoPlay(){
  var e = echoNow(), i, ev, dur, t0;
  if (!e) return;
  if (playing) stop();
  audio();
  if (ctx.state !== "running"){
    say("press any key or click once to enable sound");
    return;
  }
  dur = stepDur();
  t0 = ctx.currentTime + 0.12;
  for (i = 0; i < e.call.length; i++){
    ev = e.call[i];
    playNote(ev.note, t0 + ev.step * dur, dur * ev.len, e.voice, ev.len > 1);
  }
  say("the call · listen");
}

/* ---- the answer, as it stands on the page ----
   Whatever is written in the window, in the answering voice, in order. The
   written length is what is read, not the heard one: rhythm is a question
   about what was written down. */
function echoAnswer(e){
  var s = vsteps(e.voice), out = [], i, n = echoSpan(e);
  for (i = e.at; i < e.at + n && i < pageLen(); i++)
    if (s[i]) out.push({ step: i, midi: midiOf(s[i]), len: writtenLen(doc, e.voice, i) });
  return out;
}

/* ---- the judgement ----
   Per stage, and never more than one question at a time. What comes back is
   one boolean per note of the ANSWER — the player's own writing is what is
   marked, so the marks can never draw the call for anybody. */
function sgn(n){ return n > 0 ? 1 : n < 0 ? -1 : 0; }
function judgeContour(e, ans){
  var out = [], i, want, got;
  for (i = 0; i < ans.length; i++){
    if (i === 0){ out.push(true); continue; }      /* any pitch may begin a shape */
    if (i >= e.call.length){ out.push(false); continue; }
    want = sgn(midiOf(e.call[i].note) - midiOf(e.call[i - 1].note));
    got = sgn(ans[i].midi - ans[i - 1].midi);
    out.push(want === got);
  }
  return out;
}
/* the degrees of the key, and the whole answer allowed to sit an octave out:
   the offset is taken from the first note answered and has to be a whole
   number of octaves — seven degrees — so the shape of the degrees is what is
   asked about and not which octave the pad happened to land in */
function judgeDegrees(e, ans){
  var out = [], i, off = 0, a0, c0, d, c;
  if (ans.length){
    a0 = degreeOfMidi(ans[0].midi);
    c0 = degreeOfMidi(midiOf(e.call[0].note));
    if (a0 !== null && c0 !== null && (a0 - c0) % 7 === 0) off = a0 - c0;
  }
  for (i = 0; i < ans.length; i++){
    if (i >= e.call.length){ out.push(false); continue; }
    d = degreeOfMidi(ans[i].midi);
    c = degreeOfMidi(midiOf(e.call[i].note));
    out.push(d !== null && c !== null && d === c + off);
  }
  return out;
}
/* the onsets and the written lengths, on whatever pitch: a note is true where
   the call begins on exactly that step and rings exactly as long */
function judgeRhythm(e, ans){
  var out = [], i, k, hit;
  for (i = 0; i < ans.length; i++){
    hit = false;
    for (k = 0; k < e.call.length; k++)
      if (e.at + e.call[k].step === ans[i].step && e.call[k].len === ans[i].len) hit = true;
    out.push(hit);
  }
  return out;
}

/* ---- the marks ----
   A snapshot of the last judgement and nothing more: which steps of which
   voice rang true. Any edit clears them (save() is on every modification),
   so a mark never outlives the note it was made about. */
var echoMarks = null;                  /* { voice, hit:{step:bool} } */
function echoClear(){ echoMarks = null; }
/* what the drawing asks, on every step of both views */
function echoMark(v, i){
  if (!echoMarks || echoMarks.voice !== v) return "";
  if (!Object.prototype.hasOwnProperty.call(echoMarks.hit, i)) return "";
  return echoMarks.hit[i] ? "rang" : "astray";
}

/* ---- and what is said about it ----
   Useful and mute at the same time. The count is the player's own count, the
   marks are on the player's own notes, and nothing here ever says a name, a
   step or a direction: the drill corrects by ear, and an explanation is the
   one thing that would take that away. */
function echoJudge(){
  var e = echoNow(), ans, hits = [], i, n = 0, msg;
  if (!e) return;
  ans = echoAnswer(e);
  if (!ans.length){
    echoClear(); renderNotes();
    say("nothing answered yet · " + e.stage);
    return;
  }
  hits = (e.stage === "contour") ? judgeContour(e, ans)
       : (e.stage === "degrees") ? judgeDegrees(e, ans)
       : judgeRhythm(e, ans);
  echoMarks = { voice: e.voice, hit: {} };
  for (i = 0; i < ans.length; i++){
    echoMarks.hit[ans[i].step] = !!hits[i];
    if (hits[i]) n++;
  }
  renderNotes();
  if (n === ans.length && ans.length === e.call.length) msg = "the echo rings true";
  else msg = n + " of your " + ans.length + " rang true" +
             (ans.length === e.call.length ? "" : " · a different number of notes");
  say(msg + " · " + e.stage);
}
