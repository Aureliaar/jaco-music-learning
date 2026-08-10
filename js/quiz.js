/* Folio — js/quiz.js : up or down.

   Lesson 4's other tool, and the opposite kind of thing to the echo. An echo
   holds one call and asks the whole of it: shape, then degrees, then rhythm,
   written out on the grid and judged when it is asked. This asks the
   smallest question there is, over and over, and never writes anything down:
   two notes, which way did the second one go, one press, next.

   That is the whole of it, and the reason for it is volume. A fixed call can
   be learned; a hundred fresh pairs cannot, and the only way through them is
   to actually hear the direction. So nothing here is kept: no page, no
   pattern, no ruling, no line in the quest log. The run lives for as long as
   the workspace is the one in front of you and ends the moment it is not.

   What it says is deliberately almost nothing — right or wrong, and the
   running tally. Never the interval, never the notes, never which way it
   actually went. The correction is the next question. */
"use strict";

/* ---- the workspace, which is a tool and not a quest ----
   It sits on the rail with the quests because that is where the hand goes
   looking, and it is marked `tool` so that everything which treats a rail
   line as a quest — the pattern written into the log, the done mark, the
   ruling, the favourite — steps over it instead. quests.js does that
   stepping; this file only says which line it is. */
var QUIZ_ID = "updown";
var TOOLS = [
  { id:QUIZ_ID, name:"up or down", short:"up or down", tool:true, lesson:4,
    text:"Two notes. Which way did the second one go?\n" +
         "- △ up, ✕ down, ○ the same again\n" +
         "- □ plays the question again, as often as you like\n" +
         "- leave the workspace and the run is over",
    teaches:"direction, on its own." }
];

/* ---- what is asked ----
   One key, one register, no chromatics: what is being trained is the
   direction, and a question that also has to be decoded is a different
   question. C major between C3 and C5 — high enough to be plain, low enough
   not to shriek, and comfortably inside the folio's own range. */
var QUIZ_LO = 48, QUIZ_HI = 72;               /* C3 … C5, well inside 36–84 */
var QUIZ_PCS = [0, 2, 4, 5, 7, 9, 11];        /* the major scale, on C */
var QUIZ_SCALE = (function(){
  var out = [], m;
  for (m = QUIZ_LO; m <= QUIZ_HI; m++) if (QUIZ_PCS.indexOf(m % 12) >= 0) out.push(m);
  return out;
})();

var QUIZ_GAP   = 0.55;         /* seconds between the two notes */
var QUIZ_RING  = 0.5;          /* how long each of them rings */
var QUIZ_BEAT  = 900;          /* ms after an answer before the next question */
var QUIZ_AGAIN = 0.2;          /* about one question in five is the same note twice */

/* ---- how it narrows ----
   Wide while the ear is cold — a fifth or an octave, which nobody misses
   twice — and closer as the streak grows, until it is asking about single
   scale steps, which is where the judgement actually lives. A miss puts it
   back where it started, because a miss means the band it was in was too
   close for now. The ramp is the streak divided by three and nothing
   cleverer: it must be readable here and felt there. */
var QUIZ_BANDS = [[4, 7], [2, 3], [1]];       /* in scale steps: wide, thirds, steps */
var QUIZ_RAMP  = 3;                           /* right answers per narrowing */

/* ---- the ear log: every answer, written down and never shown ----
   The tally is what the player needs and it is all the player gets. It is
   not what the *ear* needs looking at. A run of two hundred answers has a
   pattern in it — which intervals, which direction, how fast — and that
   pattern is the whole research value of the drill (EAR-NOTES.md): a miss
   that repeats is a finding, and a footer cannot hold one. So every answered
   question is written down, and none of it is ever said out loud here.

   It rides the ordinary autosave out to quests/quest-log.json as one
   top-level field of the log — not a page field, because it belongs to no
   page and no workspace:

     "earlog": [ { "d":-4, "dir":"down", "said":"up", "ok":false, "ms":310 } ]

   `d` is the interval asked as a signed **scale-degree delta** inside the
   drill's own scale — -4 is four scale steps down, 0 is the same note twice.
   Degrees, not semitones, because degrees are what the questions are built
   out of. `dir` is what the question did and `said` is what the hand
   answered, both in the words the buttons are named by. `ms` is from the end
   of the question's playback — the last note's ring, of the most recent
   hearing, so a replay restarts the clock — to the press: a negative number
   is an answer given while it was still sounding, which is legal and is
   exactly the sort of thing worth knowing. It is null where no sound played.

   Read permissively, as `tones` is, and dropped WHOLE if it is anything but
   a list of well-formed entries: half a record of what an ear did is worse
   than none, and the dropping never touches anything else in the log. The
   most recent EAR_CAP are kept, so the file cannot grow without end. */
var EAR_FIELD = "earlog";
var EAR_CAP = 500;
var EAR_DIRS = ["down", "again", "up"];       /* indexed by the direction, plus one */
var earLog = [];
function earName(dir){ return EAR_DIRS[dir + 1]; }
function earNow(){
  return (typeof performance !== "undefined" && performance.now)
           ? performance.now() : Date.now();
}
function earEntry(o){
  if (!o || typeof o !== "object" || Array.isArray(o)) return null;
  if (typeof o.d !== "number" || !isFinite(o.d) || o.d !== Math.round(o.d)) return null;
  if (EAR_DIRS.indexOf(o.dir) < 0 || EAR_DIRS.indexOf(o.said) < 0) return null;
  if (typeof o.ok !== "boolean") return null;
  if (o.ms !== null && (typeof o.ms !== "number" || !isFinite(o.ms))) return null;
  return { d:o.d, dir:o.dir, said:o.said, ok:o.ok,
           ms:(o.ms === null ? null : Math.round(o.ms)) };
}
function readEarLog(a){
  if (!Array.isArray(a)) return [];
  var out = [], i, e;
  for (i = 0; i < a.length; i++){
    e = earEntry(a[i]);
    if (!e) return [];                        /* malformed: dropped whole */
    out.push(e);
  }
  return out.slice(-EAR_CAP);
}
function earWrite(d, dir, said, ok, ms){
  earLog.push({ d:d, dir:earName(dir), said:earName(said), ok:!!ok,
                ms:(ms === null || ms === undefined) ? null : Math.round(ms) });
  if (earLog.length > EAR_CAP) earLog.splice(0, earLog.length - EAR_CAP);
}

var quiz = null;               /* { q, asked, right, streak, answered, timer, endsAt } */
function quizOn(){ return !!quiz; }
function quizBand(){
  var i = Math.floor(quiz.streak / QUIZ_RAMP);
  return QUIZ_BANDS[i >= QUIZ_BANDS.length ? QUIZ_BANDS.length - 1 : i];
}
function quizPick(n){ return Math.floor(Math.random() * n); }

/* a question: two notes, the answer to it (-1, 0 or 1) and the move it made,
   in signed scale steps, which is what the ear log records. The first note is
   drawn from the part of the scale that has room for the move, so a question
   is never quietly shrunk by the edge of the register. */
function quizMake(){
  var band, size, dir, lo, hi, from;
  if (Math.random() < QUIZ_AGAIN){
    from = quizPick(QUIZ_SCALE.length);
    return { a:QUIZ_SCALE[from], b:QUIZ_SCALE[from], dir:0, d:0 };
  }
  band = quizBand();
  size = band[quizPick(band.length)];
  dir  = (Math.random() < 0.5) ? -1 : 1;
  lo = (dir > 0) ? 0 : size;
  hi = (dir > 0) ? QUIZ_SCALE.length - 1 - size : QUIZ_SCALE.length - 1;
  from = lo + quizPick(hi - lo + 1);
  return { a:QUIZ_SCALE[from], b:QUIZ_SCALE[from + dir * size],
           dir:dir, d:dir * size };
}

/* the tally, said the one way it is ever said */
function quizTally(){
  return quiz && quiz.asked ? " · " + quiz.right + " of " + quiz.asked : "";
}
/* and the same fact at the margin's size, for the rail's last line */
function quizLine(){
  if (!quiz) return "enter to begin";
  return quiz.asked ? quiz.right + " of " + quiz.asked + " rang true" : "listening";
}

/* ---- the question, played ----
   The scheduler's own playNote, so it sounds like the instrument the answer
   will be written on one day; the loop stopped first, for the same reason the
   echo stops it — two pieces of music at once and the ear holds neither. It
   may be played again as often as wanted and nothing is spent by listening:
   a replay is not an answer and does not advance anything. */
function quizPlay(){
  if (!quiz || !quiz.q) return;
  if (playing) stop();
  audio();
  if (ctx.state !== "running"){
    say("press any key or click once to enable sound");
    return;
  }
  var t0 = ctx.currentTime + 0.12;
  playNote(nameOfMidi(quiz.q.a), t0, QUIZ_RING, 0, false);
  playNote(nameOfMidi(quiz.q.b), t0 + QUIZ_GAP, QUIZ_RING, 0, false);
  /* where the sound will have finished, on the clock a keypress is read by:
     the reaction time is measured from there, and a replay moves it, because
     the hearing the hand answered is the last one it had */
  quiz.endsAt = earNow() + (t0 + QUIZ_GAP + QUIZ_RING - ctx.currentTime) * 1000;
  say("listen" + quizTally());
}

function quizDeal(){
  if (!quiz) return;
  if (quiz.timer){ clearTimeout(quiz.timer); quiz.timer = null; }
  quiz.q = quizMake();
  quiz.answered = false;
  quiz.endsAt = null;                  /* no sound, no reaction time to report */
  quizPlay();
}
function quizStart(){
  quizEnd();
  quiz = { q:null, asked:0, right:0, streak:0, answered:false, timer:null, endsAt:null };
  quizDeal();
}
/* leaving the workspace, by whichever of the ordinary roads: the run is over
   and the tally goes with it. Nothing was written, so nothing is lost. */
function quizEnd(){
  if (!quiz) return;
  if (quiz.timer) clearTimeout(quiz.timer);
  quiz = null;
}

/* ---- the answer ----
   Pressed while the question is still sounding is perfectly legal: an ear
   that already knows is right to say so, and waiting politely for the sound
   to finish is not part of the skill. Pressed twice is one answer — the
   second press is the hand, not the ear.

   What comes back is right or wrong and the tally, and that is the whole
   vocabulary. Naming the interval would turn a hearing test into a naming
   test, and telling the player which way it went would spend the question
   that the next one is about to ask again. */
function quizAnswer(dir){
  if (!quiz || !quiz.q || quiz.answered) return;
  quiz.answered = true;
  var right = (dir === quiz.q.dir);
  quiz.asked++;
  if (right){ quiz.right++; quiz.streak++; } else quiz.streak = 0;
  say((right ? "rang true" : "astray") + quizTally());
  /* written down before it is drawn: what was asked, what was said, and how
     long the hand took about it. Not a word of this reaches the page. */
  earWrite(quiz.q.d, quiz.q.dir, dir, right,
           (quiz.endsAt === null || quiz.endsAt === undefined) ? null
                                                              : earNow() - quiz.endsAt);
  renderRails();                       /* the margin carries the run's own line */
  save();                              /* and the log rides the ordinary autosave */
  quiz.timer = setTimeout(function(){
    quiz.timer = null;
    quizDeal();
  }, QUIZ_BEAT);
}
