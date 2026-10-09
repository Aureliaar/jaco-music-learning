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
var audioClockNode = null, audioClockSink = null;

/* ================= the rack =================
   Folio is still the clock, the transport and the thing in the player's
   hands. On this machine the sound is Folio Native's: the same page, in a
   window whose own process hosts the instruments (folio-native/). The page
   schedules every note itself and sends Web MIDI bytes with Web MIDI
   timestamps to an output that hands them to the host — no port, no cable,
   no second program. Lead is channel 1, bass 2, chords 3; each further seat
   is the next channel triplet. Nothing in a page document knows or stores a
   renderer.

   There are two modes, and they are never inferred. Ordinary Folio —
   file://, the deployed static copy, a device on --lan, the test suite —
   plays its own tones and has no rack at all. A page that was promised the
   rack — inside the native window, or any page this machine's server
   serves, which writes the promise into it — plays the rack or nothing: on
   this machine there is no own tone (the 2026-09-11 ruling). A promised
   rack that cannot play stops the transport and says why, and never quietly
   substitutes a different instrument and calls that success. */
var MIDI_LATENCY = "folio-midi-latency-ms";
var MIDI_VELOCITY = [82, 88, 68];       /* the level-matched lineup's values */
var MIDI_SLOTS = [0, 0, 0];             /* which seat each voice is sitting in */
var MIDI_SLOT_COUNT = Math.floor(16 / LANES);
/* ---- and what is actually in those seats ----
   Not a list this file keeps: the host reads its own rack.json and sends it
   along with the health. Null until the rack answers, so nothing anywhere
   can draw a seat with no instrument behind it. Each lane holds its seats in
   order, `{ seat, name }`. */
var midiRack = null;
/* Note ends are kept a little clear of the next attack, so a note-off can
   never land after the following note-on at a loop seam. */
var MIDI_TAIL = 0.024;
var midiOut = null;
var midiRackReady = false;

/* ---- the native window ----
   window.__JUCE__ is there before any script runs. Timestamps travel as
   wall-clock milliseconds (timeOrigin + the stamp), the one clock both
   sides can read, and the host lands each on its sample. A frame's sends go
   over in one message. */
var NATIVE = !!(window.__JUCE__ && window.__JUCE__.backend &&
                typeof window.__JUCE__.backend.emitEvent === "function");
var nativeQueue = [], nativeQueued = false, nativeCalls = {}, nativeCallId = 0;
function nativeFlush(){
  nativeQueued = false;
  if (!nativeQueue.length) return;
  var events = nativeQueue;
  nativeQueue = [];
  window.__JUCE__.backend.emitEvent("folioMidi",
    { events: events, now: performance.timeOrigin + performance.now() });
}
function nativePush(at, a, b, c){
  nativeQueue.push(at, a | 0, b | 0, c | 0);
  if (!nativeQueued){ nativeQueued = true; Promise.resolve().then(nativeFlush); }
}
var nativeOut = !NATIVE ? null : {
  send: function(data, ts){
    nativePush(ts ? performance.timeOrigin + ts : 0, data[0], data[1], data[2]);
  },
  clear: function(){ nativePush(-1, 0, 0, 0); }   /* drops everything still queued */
};
/* a native function, answered through JUCE's own completion event */
if (NATIVE) window.__JUCE__.backend.addEventListener("__juce__complete", function(m){
  var done = m && nativeCalls[m.promiseId];
  if (done){ delete nativeCalls[m.promiseId]; done(m.result); }
});
function nativeCall(name){
  return new Promise(function(resolve){
    var id = nativeCallId++;
    nativeCalls[id] = resolve;
    window.__JUCE__.backend.emitEvent("__juce__invoke", { name: name, params: [], resultId: id });
  });
}

/* The promise, read once and held for the page session: the native window
   makes it by being the native window; this machine's server makes it by
   writing a meta into every page it serves, so a browser tab on this machine
   says where the sound is instead of playing its own. The server's promise
   binds only a page opened on this machine; a device reaching the folio over
   --lan has no rack. */
function midiLocal(){
  return location.protocol === "http:" &&
    (location.hostname === "localhost" || location.hostname === "127.0.0.1" ||
     location.hostname === "[::1]");
}
var MIDI_REQUIRED = (function(){
  if (NATIVE) return true;
  try {
    var meta = document.querySelector('meta[name="folio-renderer"]');
    return !!(meta && meta.getAttribute("content") === "native" && midiLocal());
  } catch (e) { return false; }
})();
/* Until the first answer, a promised rack is starting, not absent. */
var midiState = MIDI_REQUIRED ? "starting" : "not-requested";
var midiFault = null;             /* the failed boundary in required mode */

/* Player-facing copy for each boundary that can fail. The host sends a short
   stable detail for diagnosis; these are the only words the page shows, and
   every one of them says the music is safe. */
var MIDI_FAULT_COPY = {
  "not-native":     ["Folio plays in its own window.",
    "This browser tab has no instruments. Your music is safe. Open Folio from folio.cmd."],
  "starting":       ["The sound rack is still opening.",
    "The instruments are loading. Your music is safe; playing will work as soon as they are in."],
  "audio-failed":   ["The sound rack has no speaker.",
    "No audio output could be opened. Your music is safe. Choose one under Rack, Audio settings."],
  "rack-missing":   ["The sound rack could not be opened.",
    "There is no rack.json beside the native folio. Your music is safe."],
  "plugin-missing": ["The sound rack could not be opened.",
    "An instrument the rack lists is not installed. Your music is safe."],
  "plugin-failed":  ["The sound rack could not be opened.",
    "An instrument would not load. Your music is safe."],
  "unknown":        ["The sound rack could not be opened.",
    "The rack said something Folio does not understand. Your music is safe."]
};

function midiStored(key){
  try { return localStorage.getItem(key); } catch (e) { return null; }
}
function midiConnected(){
  return !!(midiRackReady && midiOut);
}
/* Ordinary Folio never has a fault — it has no rack to miss. */
function midiFaultNow(){
  if (!MIDI_REQUIRED) return null;
  if (!NATIVE) return "not-native";
  if (midiState !== "ready") return MIDI_FAULT_COPY[midiState] ? midiState : "unknown";
  return null;
}
/* A calm, persistent panel: no blink, no texture, no timer, no dismissal.
   It clears itself the moment the rack is ready. */
function midiFaultRender(){
  var fault = midiFaultNow();
  if (fault === midiFault) return;
  var wasClear = !midiFault;
  midiFault = fault;
  var panel = document.getElementById("rackfault");
  if (panel){
    if (fault){
      var copy = MIDI_FAULT_COPY[fault];
      var name = document.getElementById("rackfaultname");
      var text = document.getElementById("rackfaulttext");
      if (name) name.textContent = copy[0];
      if (text) text.textContent = copy[1];
      panel.setAttribute("data-fault", fault);
    }
    panel.hidden = !fault;
  }
  /* A rack that goes while the loop runs takes the transport with it;
     stop() clears the queue and silences what is still sounding. */
  if (fault && playing && wasClear) stop();
  if (fault) say("the sound rack is not answering");
  else if (!wasClear) say(playing ? "playing · the rack" : "the rack is ready");
}
function midiHealthPoll(){
  if (!NATIVE) return;
  nativeCall("folioRack").then(function(status){
    midiState = (status && typeof status.state === "string") ? status.state : "unknown";
    midiRackSet(status && status.voices);
    var ready = midiState === "ready";
    if (!ready && midiRackReady) midiPanic();
    midiRackReady = ready;
    midiOut = nativeOut;
  }).then(function(){
    midiFaultRender();
    setTimeout(midiHealthPoll, 1000);
  });
}
/* ---- the catalogue, read ----
   Read as permissively as everything that arrives from outside is: anything
   that is not a lane of seats is no catalogue at all, and the page falls back
   to its own voices rather than believing half of one. A seat whose number is
   past the seats the routing has is dropped, because there is no channel to
   send it on. */
function midiRackSet(voices){
  var out = [], i, k, list, e, seats;
  if (!Array.isArray(voices) || !voices.length){ midiRack = null; return; }
  for (i = 0; i < LANES; i++){
    list = voices[i];
    seats = [];
    if (Array.isArray(list)){
      for (k = 0; k < list.length; k++){
        e = list[k];
        if (!e || typeof e !== "object") continue;
        if (typeof e.seat !== "number" || !isFinite(e.seat) ||
            e.seat !== Math.round(e.seat) ||
            e.seat < 0 || e.seat >= MIDI_SLOT_COUNT) continue;
        if (typeof e.name !== "string" || !e.name.trim()) continue;
        seats.push({ seat: e.seat, name: e.name.trim().slice(0, 40) });
      }
    }
    out.push(seats);
  }
  for (i = 0; i < LANES; i++) if (out[i].length) { midiRack = out; return; }
  midiRack = null;
}
/* the seats one voice can be put in, and where it is sitting now. Both answer
   for a folio with no rack at all, so the screen asks without checking. */
function midiSeats(v){
  return (midiRack && midiRack[v]) ? midiRack[v] : [];
}
function midiSeatName(v){
  var s = midiSeats(v), i;
  for (i = 0; i < s.length; i++) if (s[i].seat === MIDI_SLOTS[v]) return s[i].name;
  return "";
}
/* along the rail and round again, exactly as a tone rail is walked. The seat
   is runtime state and never the page's — nothing is saved, because what the
   rack is playing is not part of the music. */
function midiSeatStep(v, d){
  var s = midiSeats(v), at = -1, i;
  if (!s.length) return false;
  for (i = 0; i < s.length; i++) if (s[i].seat === MIDI_SLOTS[v]) at = i;
  if (at < 0) at = 0;
  return midiSelectInstrument(v, s[((at + d) % s.length + s.length) % s.length].seat);
}
function midiVisualDelay(){
  if (!midiConnected()) return 0;
  var ms = Number(midiStored(MIDI_LATENCY));
  return isFinite(ms) ? Math.max(0, Math.min(500, ms)) / 1000 : 0;
}
function midiPanic(){
  if (!midiOut) return;
  try { midiOut.clear(); } catch (e) {}
  for (var ch = 0; ch < 16; ch++){
    try { midiOut.send([0xB0 | ch, 123, 0]); } catch (e) {} /* all notes off */
    try { midiOut.send([0xB0 | ch, 120, 0]); } catch (e) {} /* all sound off */
  }
}
/* Which instrument a voice plays. Selection is local runtime state, not
   composition data: callers choose a voice and a rack seat. Notes for seat N
   travel on MIDI channel `voice + N * 3`, and the host plays each channel on
   the instrument rack.json gives it. */
function midiSelectInstrument(v, slot){
  v = Math.floor(Number(v));
  slot = Math.floor(Number(slot));
  if (!isFinite(v) || v < 0 || v >= LANES ||
      !isFinite(slot) || slot < 0 || slot >= MIDI_SLOT_COUNT) return false;
  if (MIDI_SLOTS[v] === slot) return true;
  if (midiConnected()) midiPanic();
  MIDI_SLOTS[v] = slot;
  return true;
}
function midiNote(name, at, dur, v){
  if (!midiConnected()) return false;
  var voiceChannel = Math.max(0, Math.min(LANES - 1, v || 0));
  var note = midiOf(name), ch = voiceChannel + MIDI_SLOTS[voiceChannel] * LANES;
  if (note === null || note === undefined) return false;
  var when = performance.now() + Math.max(0, at - ctx.currentTime) * 1000;
  var off = when + Math.max(1, dur * 1000 - MIDI_TAIL * 1000);
  midiOut.send([0x90 | ch, note, MIDI_VELOCITY[ch] || 80], when);
  midiOut.send([0x80 | ch, note, 0], off);
  return true;
}

/* how long one step lasts. The page's own tempo, and then the echo's pace
   over the top of it — half or a quarter of the speed, for an ear that
   cannot yet hear the line at the speed it was written at. The pace is a
   multiplier on the step and never a change to doc.tempo, so the page still
   says what it always said and the header never moves. */
function stepDur(){ return 60 / doc.tempo / 4 * echoPace; }   /* 112 bpm 16ths = 0.1339 s */

/* setInterval is only a foreground convenience. Chrome batches a hidden
   tab's timers at one second and later one minute; the AudioContext clock
   keeps moving meanwhile, so the old scheduler woke for one small window and
   then left almost a whole second silent. An AudioWorklet pulse comes from
   the rendering clock instead of the page timer. It schedules no sound of
   its own and carries no musical state: Folio still reads the page and owns
   every timestamp here on the main thread. The interval remains the fallback
   for file:// and browsers without AudioWorklet. */
function startAudioClock(){
  if (audioClockNode || !ctx.audioWorklet || typeof AudioWorkletNode === "undefined") return;
  var source = "class FolioClock extends AudioWorkletProcessor{" +
    "constructor(){super();this.n=0}" +
    "process(){this.n+=128;if(this.n>=1024){this.n=0;this.port.postMessage(0)}return true}" +
    "}registerProcessor('folio-clock',FolioClock)";
  var url;
  try { url = URL.createObjectURL(new Blob([source], {type:"text/javascript"})); }
  catch (e) { return; }
  ctx.audioWorklet.addModule(url).then(function(){
    URL.revokeObjectURL(url);
    if (audioClockNode) return;
    audioClockNode = new AudioWorkletNode(ctx, "folio-clock");
    audioClockSink = ctx.createGain();
    audioClockSink.gain.setValueAtTime(0, ctx.currentTime);
    audioClockNode.connect(audioClockSink); audioClockSink.connect(ctx.destination);
    audioClockNode.port.onmessage = function(){ if (playing) scheduler(); };
  }).catch(function(){ URL.revokeObjectURL(url); });
}

function audio(){
  if (!ctx){
    var AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.setValueAtTime(1, ctx.currentTime);
    master.connect(ctx.destination);
    startAudioClock();
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
if (NATIVE) setTimeout(midiHealthPoll, 0);
if (MIDI_REQUIRED) setTimeout(midiFaultRender, 0);

/* ---- the two timbres ----
   The lead is the voice the folio has always had: a triangle under a gentle
   lowpass, bright enough to carry a tune. The bass is rounder and darker on
   purpose — a sine, a low cutoff, a slower attack and a longer release — so
   that the two lines separate by colour as well as by pitch, and a bass
   written up in the melody's octave still reads as the bass.

   From Lesson 3 each also carries the release it uses when a note is *held*
   rather than struck — a longer taper, so the end of a long note does not
   click — and a *decay*: the time constant of the die-away a hold rides,
   because a tone that stands at one volume for four beats is an organ,
   whatever the waveform. The bass dies slower than the lead on purpose,
   the way longer strings do. */
var TONE = [
  /* decay is the struck shape, measured off the piano kit's own C4: a fast
     first fall (tau), a knee (when), and the long quiet tail after it
     (tail tau) — it loses most of itself inside a second and then sings
     small, which is what a hold sounds like when something real was hit */
  /* `track` keeps the brightness relative to the note rather than absolute:
     a fixed cutoff hands a high note almost nothing but its fundamental, so
     the lead thinned to a whistle above middle C and the whole folio learned
     to live low. The cutoff is now at least `track` times the fundamental —
     the same overtones in reach at every octave — and the fixed `cut` stays
     as the floor, so below middle C nothing changes at all. */
  /* The lead was the last voice on a bare waveform, and the chord lane
     showed it up: a triangle carries odd partials only — no octave at all,
     the stopped-flute hollowness — and its 8 ms front edge read as a click
     next to the chords' bloom. The player stopped being able to listen to
     it (2026-08-28). So it gets what the other two got: a hand-built
     spectrum with the octave restored and a little air above, and a front
     edge softened toward the chord tone's without losing the lead's right
     to speak first. */
  { type:"triangle", cut:2500, q:0.7, level:LEVEL, attack:0.018,
    release:0.080, hold:0.10, decay:[0.37, 1.0, 3.0], track:9.5,
    wave:[1, 0.30, 0.12, 0.05] },
  /* `wave` is the bass's own spectrum — the fundamental, a soft octave,
     a whisper of the twelfth — instead of the pure sine it was. A sine
     stands its whole voice on one frequency, and one frequency is what a
     room mode seizes: bass-heavy pages boomed on whichever notes the
     room liked, and wore the ear out even on headphones. Spreading the
     energy a little keeps the tone as dark as before under the same
     cutoff, but nothing left for the room to grab whole. */
  /* and the bass's edges eased the same day, for the same reason — its
     spectrum was already built (below), only its attack still snapped. */
  { type:"sine",     cut:820,  q:0.9, level:0.30,  attack:0.022,
    release:0.100,   hold:0.17, decay:[0.60, 1.4, 4.0],
    wave:[1, 0.22, 0.09] },
  /* ---- and the chord lane, from Lesson 5 ----
     Three or four of these sound at once, so the first thing it is is
     QUIET: but voices on different pitches add by power, not amplitude —
     a third of the lead's level each landed a triad near half a melody
     note's weight, and the player heard the gap at once (2026-08-28). Per
     voice it is now the lead's level over √3, shaded down a touch, which
     puts a triad just under one melody note and keeps the tune on top of
     it where it belongs. Soft-edged besides — a slow attack, a long release,
     a slow decay — because a chord is the ground the other two stand on
     and a ground that speaks first is a ground in the way. */
  /* Second correction by ear (2026-08-28, the player): still reading as
     very muted against single notes. Loudness lives in the mids the dark
     cutoff was holding back, so this pass opens the filter a little as
     well as raising the level — presence through brightness costs less
     ground-ness than gain alone would. */
  { type:"triangle", cut:1800, q:0.6, level:0.14, attack:0.030,
    release:0.120,   hold:0.22, decay:[0.90, 1.6, 5.0], track:6.0,
    wave:[1, 0.13, 0.05] }
];
/* the spectrum is built once per tone, on the context the notes play on */
function toneWave(t){
  if (!t.wave) return null;
  if (!t._pw){
    var re = new Float32Array(t.wave.length + 1);
    var im = new Float32Array(t.wave.length + 1);
    for (var i = 0; i < t.wave.length; i++) im[i + 1] = t.wave[i];
    t._pw = ctx.createPeriodicWave(re, im);
  }
  return t._pw;
}

/* One note: oscillator -> lowpass -> gain envelope. Gain starts at 0 and
   ends at 0, so nothing ever switches on or off abruptly. Release finishes
   TAIL seconds before the next step begins. */
function playNote(name, at, dur, v, held){
  var f = noteToFreq(name);
  if (!f) return;
  /* The rack is a renderer, never a second layer. A note it takes is the
     note; only ordinary Folio, which has no rack, reaches the sample/synth
     path below. */
  if (midiNote(name, at, dur, v)) return;
  /* A promised rack has no fallback by design: a promised rack that
     cannot be reached is an error the player is told about, never a quieter
     instrument standing in for it. Nothing reaches samplePlay or the
     oscillator below. */
  if (MIDI_REQUIRED) return;
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
  if (t.wave) osc.setPeriodicWave(toneWave(t));
  else osc.type = t.type;
  osc.frequency.setValueAtTime(f, at);

  var lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(t.track ? Math.max(t.cut, f * t.track) : t.cut, at);
  lp.Q.setValueAtTime(t.q, at);

  var g = ctx.createGain();
  var relEnd = at + dur - TAIL;
  var relStart = Math.max(at + t.attack + 0.001, relEnd - rel);
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(t.level, at + t.attack);
  if (held){
    /* a held tone dies the way the piano does: fast to the knee, then a
       long quiet tail. The release starts from wherever the decay has got
       to, so a note let go early is at its own height when it is let go. */
    var d = t.decay, knee = at + d[1];
    var vKnee = t.level * Math.exp(-d[1] / d[0]);
    if (relStart <= knee + 0.001){
      g.gain.exponentialRampToValueAtTime(
        Math.max(0.0001, t.level * Math.exp(-(relStart - at) / d[0])), relStart);
    } else {
      g.gain.exponentialRampToValueAtTime(Math.max(0.0001, vKnee), knee);
      g.gain.exponentialRampToValueAtTime(
        Math.max(0.0001, vKnee * Math.exp(-(relStart - knee) / d[2])), relStart);
    }
  } else {
    g.gain.setValueAtTime(t.level, relStart);
  }
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
    /* and the chord lane, which is one cell and several pitches: what those
       pitches are is worked out from the lane, not read off it, so it is
       asked here once a step and never stored anywhere */
    if (audible(CHORD_LANE) && chordAt(doc, schedStep)){
      var ps = chordVoicings(doc)[schedStep], clen = spanOf(doc, CHORD_LANE, schedStep);
      for (var ci = 0; ps && ci < ps.length; ci++)
        playNote(nameOfMidi(ps[ci]), nextStepTime, dur * clen, CHORD_LANE, clen > 1);
    }
    queue.push({ step: schedStep, time: nextStepTime + midiVisualDelay() });
    nextStepTime += dur;
    /* where the run turns round: the loop, or the window the echo's two
       stick presses set inside it. Read afresh every step, as mute and solo
       are, so a window asked for mid-run lands on the next step round */
    schedStep = (schedStep >= echoPlayTo()) ? echoPlayFrom() : schedStep + 1;
  }
}

function play(){
  /* In required mode the transport does not start without its renderer. */
  if (MIDI_REQUIRED){
    midiFaultRender();
    if (midiFault) return;
  }
  audio();
  playing = true;
  queue.length = 0;
  schedStep = echoPlayFrom();
  master.gain.cancelScheduledValues(ctx.currentTime);
  master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
  master.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.02);
  nextStepTime = ctx.currentTime + 0.06;
  scheduler();
  timer = setInterval(scheduler, LOOKAHEAD_MS);
  say(ctx.state !== "running"
      ? "playing · press any key or click once to enable sound"
      : (midiConnected() ? "playing · the rack" : "playing · own tone"));
}

function stop(){
  playing = false;
  if (timer){ clearInterval(timer); timer = null; }
  queue.length = 0;
  midiPanic();
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
  if (MIDI_REQUIRED){
    midiFaultRender();
    if (midiFault) return;
  }
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
