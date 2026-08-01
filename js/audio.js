/* Folio — js/audio.js : the sound, and the clock.

   One oscillator through one lowpass into one gain envelope, per note; the
   two timbres the voices are; the lookahead scheduler that reads mute, solo,
   tempo and the held note's length afresh at the top of every window; the
   transport; the audition of a note as it is written; and the animation frame
   that drives the playhead off the audio clock rather than off a timer. */
"use strict";

/* ================= audio ================= */
var ctx = null, master = null;
var playing = false;
var timer = null;
var nextStepTime = 0, schedStep = 0;
var queue = [];          /* {step, time} scheduled but not yet reached */
var live = [];           /* oscillators currently scheduled */

var LOOKAHEAD_MS = 25;
var AHEAD = 0.1;
var ATTACK = 0.008, RELEASE = 0.040, TAIL = 0.006;
var LEVEL = 0.22;

function stepDur(){ return 60 / doc.tempo / 4; }   /* 112 bpm 16ths = 0.1339 s */

function audio(){
  if (!ctx){
    var AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.setValueAtTime(1, ctx.currentTime);
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

/* the autoplay policy does not count gamepad buttons as a user gesture, so
   a pad-only session leaves the context suspended and every note lands on a
   frozen clock; the first real key or pointer press unlocks it for the pad */
function unlockAudio(){ audio(); }
window.addEventListener("pointerdown", unlockAudio, true);
window.addEventListener("keydown", unlockAudio, true);

/* ---- the two timbres ----
   The lead is the voice the folio has always had: a triangle under a gentle
   lowpass, bright enough to carry a tune. The bass is rounder and darker on
   purpose — a sine, a low cutoff, a slower attack and a longer release — so
   that the two lines separate by colour as well as by pitch, and a bass
   written up in the melody's octave still reads as the bass.

   From Lesson 3 each also carries the release it uses when a note is *held*
   rather than struck: a note that has been ringing for half a second does
   not stop the way a sixteenth does, and a longer taper is both what the
   ear expects of it and what keeps the end of a long note from clicking.
   The shape is otherwise identical — the same attack, the same level, the
   same silence at both ends — only the sustain in the middle is longer. */
var TONE = [
  { type:"triangle", cut:2500, q:0.7, level:LEVEL, attack:ATTACK,
    release:RELEASE, hold:0.10 },
  { type:"sine",     cut:820,  q:0.9, level:0.30,  attack:0.014,
    release:0.070,   hold:0.17 }
];

/* One note: oscillator -> lowpass -> gain envelope. Gain starts at 0 and
   ends at 0, so nothing ever switches on or off abruptly. Release finishes
   TAIL seconds before the next step begins. */
function playNote(name, at, dur, v, held){
  var f = noteToFreq(name);
  if (!f) return;
  /* the sampled voice first, and only if this voice's tone is a kit: the
     page says what each voice sounds like, and tones.js says no over file://,
     before a sample has decoded, on a kit this folio has not got, and
     wherever the tone is simply null — in which case what follows is the
     folio's own tone, exactly as it always was */
  if (typeof samplePlay === "function" && samplePlay(f, at, dur, v, held)) return;
  var t = TONE[v || 0] || TONE[0];
  /* one note, however long: a held note is not a run of struck ones, so
     nothing is retriggered inside `dur` — the envelope simply stays up. The
     release is the only part that knows the difference. */
  var rel = held ? t.hold : t.release;
  var osc = ctx.createOscillator();
  osc.type = t.type;
  osc.frequency.setValueAtTime(f, at);

  var lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(t.cut, at);
  lp.Q.setValueAtTime(t.q, at);

  var g = ctx.createGain();
  var relEnd = at + dur - TAIL;
  var relStart = Math.max(at + t.attack + 0.001, relEnd - rel);
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(t.level, at + t.attack);
  g.gain.setValueAtTime(t.level, relStart);
  g.gain.linearRampToValueAtTime(0, relEnd);

  osc.connect(lp); lp.connect(g); g.connect(master);
  osc.start(at);
  osc.stop(relEnd + 0.01);
  live.push(osc);
  osc.onended = function(){
    var k = live.indexOf(osc);
    if (k >= 0) live.splice(k, 1);
    try { osc.disconnect(); lp.disconnect(); g.disconnect(); } catch (e){}
  };
}

function scheduler(){
  var dur = stepDur();
  /* If the tab was backgrounded the timer was throttled; never schedule
     notes in the past (that is what produces a burst of clicks). */
  if (nextStepTime < ctx.currentTime - 0.02){
    nextStepTime = ctx.currentTime + 0.02;
    queue.length = 0;
  }
  while (nextStepTime < ctx.currentTime + AHEAD){
    /* both voices, in step, from the one clock — a mute or a solo is read
       here and nowhere else, so it lands on the next scheduled step without
       a restart, exactly as a tempo change does */
    for (var v = 0; v < VOICES; v++){
      if (!audible(v)) continue;
      var n = vsteps(v)[schedStep];
      /* a note is scheduled once, for as long as it is written to last; the
         steps it covers hold no note of their own and so retrigger nothing.
         A note that runs past the last step of the loop is simply longer
         than the run to the seam — it goes on sounding while the playhead
         comes round, which is what ringing across the seam is. */
      if (n){
        var len = spanOf(doc, v, schedStep);
        playNote(n, nextStepTime, dur * len, v, len > 1);
      }
    }
    queue.push({ step: schedStep, time: nextStepTime });
    nextStepTime += dur;
    schedStep = (schedStep + 1) % doc.loop;
  }
}

function play(){
  audio();
  playing = true;
  queue.length = 0;
  schedStep = 0;
  master.gain.cancelScheduledValues(ctx.currentTime);
  master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
  master.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.02);
  nextStepTime = ctx.currentTime + 0.06;
  scheduler();
  timer = setInterval(scheduler, LOOKAHEAD_MS);
  say(ctx.state !== "running"
      ? "playing · press any key or click once to enable sound"
      : "playing");
}

function stop(){
  playing = false;
  if (timer){ clearInterval(timer); timer = null; }
  queue.length = 0;
  if (ctx){
    var t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value, t);
    master.gain.linearRampToValueAtTime(0, t + 0.03);   /* fade, never a cut */
    for (var i = 0; i < live.length; i++){
      try { live[i].stop(t + 0.04); } catch (e){}
    }
    master.gain.setValueAtTime(1, t + 0.06);
  }
  renderPlayhead(-1);
  say("stopped");
}

/* audition a note as it is entered, over playback too — writing into a
   running loop should be heard as it happens */
function audition(name, len){
  audio();
  /* still suspended: the gesture that unlocks audio has not happened yet;
     scheduling now would pile notes onto a frozen currentTime */
  if (ctx.state !== "running"){
    say("press any key or click once to enable sound");
    return;
  }
  /* auditioned in the voice being written into, so the ear is told which
     line it just changed even before it hears it in the loop */
  /* a struck note is auditioned as the short thing it is; a note whose
     length has just been changed is auditioned at that length, so that
     lengthening one is heard as lengthening rather than described */
  var n = (typeof len === "number" && len > 1) ? len : 1.6;
  playNote(name, ctx.currentTime + 0.01,
           Math.min(stepDur() * n, 1.6), voice, n > 1.6);
}

/* Playhead UI is driven by the audio clock: a step lights when its
   scheduled time actually arrives, and only then. */
function frame(){
  if (playing && ctx){
    var now = ctx.currentTime, step = shownPlayhead;
    while (queue.length && queue[0].time <= now){ step = queue.shift().step; }
    if (step !== shownPlayhead) renderPlayhead(step);
  }
  growTick();                      /* a note still under the finger goes on growing */
  pollPads();                      /* additive input layer; never touches audio timing */
  requestAnimationFrame(frame);
}
