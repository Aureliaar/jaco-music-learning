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

/* ================= external renderer =================
   Folio is still the clock, the transport and the thing in the player's
   hands.  On the local server only, a remembered Web MIDI permission hands the
   three existing lanes down one persistent installed MIDI cable to a monitored
   REAPER rack: slot zero is lead on channel 1, bass on 2, chords on 3. Further
   renderer slots occupy the next channel triplets. The rack launcher owns a
   tiny local status endpoint. Nothing in a page document knows or stores a
   renderer.

   There are two modes, and they are never inferred from whether a port happens
   to exist. Ordinary Folio uses its own tones and treats an absent rack as no
   error at all. Required-REAPER Folio — every page the local server serves on
   this machine, and any page opened with `?renderer=reaper` — was promised the
   rack, so an unavailable rack stops
   the transport and says which boundary failed. It never quietly substitutes a
   different instrument and calls that success. */
var MIDI_PORT = "Folio to REAPER";
var MIDI_HEALTH = "/api/renderer";
var MIDI_PERMISSION = "folio-midi-permission";
var MIDI_LATENCY = "folio-midi-latency-ms";
var MIDI_VELOCITY = [82, 88, 68];       /* the level-matched lineup's values */
var MIDI_SLOTS = [0, 0, 0];             /* which seat each voice is sitting in */
var MIDI_SLOT_COUNT = Math.floor(16 / LANES);
/* ---- and what is actually in those seats ----
   Not a list this file keeps: the rack project is the only honest catalogue,
   and the status service reads it and sends it along with the health. Null
   until a rack answers, and null again the moment one goes away, so nothing
   anywhere can draw a seat that has no instrument behind it. Each lane holds
   its seats in order, `{ seat, name }`. */
var midiRack = null;
/* The app's own envelope can reach silence inside six milliseconds.  The
   Windows MIDI path cannot preserve a boundary that small: live capture saw
   six milliseconds arrive as either one 15 ms service quantum or no gap at
   all.  Keep external note ends over one quantum clear of the next attack so
   a note-off cannot trade places with the following note-on at a loop seam. */
var MIDI_TAIL = 0.024;
var midiAccess = null, midiOut = null;
var midiAsked = false, midiConnecting = false;
var midiRackReady = false;

/* ---- Folio Native ----
   Inside folio-native's own window the rack is in the same process, and
   window.__JUCE__ is there before any script runs. Nothing below changes for
   it: the page still schedules every note itself and sends Web MIDI bytes with
   Web MIDI timestamps, only to an output that hands them to the host instead
   of down a cable — no port to lose, no permission to ask, no second process.
   The timestamps travel as wall-clock milliseconds (timeOrigin + the stamp),
   the one clock both sides can read, and the host lands each on its sample.
   A frame's sends go over in one message. */
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
  name: MIDI_PORT, state: "connected", connection: "open",
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

/* The launch promise, read once and held for the page session. It comes from
   the address, as folio-reaper.cmd opens it, or from the local server, which
   writes it into every page it serves: on this machine a link that forgets
   the parameter must not bring the own tone back. The server's promise binds
   only a page opened on this machine; a device reaching the folio over --lan
   has no cable to keep it with. */
var MIDI_REQUIRED = (function(){
  if (NATIVE) return true;          /* the window is the rack's own */
  try {
    if (/(^|[?&])renderer=reaper(&|$)/.test(location.search || "")) return true;
    var meta = document.querySelector('meta[name="folio-renderer"]');
    return !!(meta && meta.getAttribute("content") === "reaper" && midiLocal());
  } catch (e) { return false; }
})();
/* Until the first poll answers, a promised rack is starting, not absent. */
var midiState = MIDI_REQUIRED ? "starting" : "not-requested";
var midiPermission = "unknown";   /* unknown · granted · denied · absent */
var midiSendFailed = false;
var midiFault = null;             /* the failed boundary in required mode */

/* Player-facing copy for each boundary that can fail. The status service
   sends a short stable detail for diagnosis; these are the only words the
   page shows, and every one of them says the music is safe. */
var MIDI_FAULT_COPY = {
  "not-local":       ["This page cannot reach the sound rack.",
    "The REAPER rack answers only the local Folio server. Open Folio from folio-reaper.cmd."],
  "no-web-midi":     ["This browser cannot open the sound rack.",
    "It has no Web MIDI. Your music is safe. Open Folio in the browser folio-reaper.cmd uses."],
  "midi-unasked":    ["The sound rack is waiting for permission.",
    "Click once in the page, or press a key, and allow the browser's MIDI request."],
  "midi-denied":     ["The browser is refusing MIDI.",
    "Your music is safe. Allow MIDI for this page in the browser's site settings, then reopen Folio."],
  "service-absent":  ["The sound rack did not answer.",
    "No Folio renderer is running on this machine. Your music is safe. Start it with folio-reaper.cmd."],
  "starting":        ["The sound rack is still opening.",
    "REAPER is starting. Your music is safe; playing will work as soon as the rack answers."],
  "port-missing":    ["The sound rack did not answer.",
    "Folio found no “Folio to REAPER” MIDI port. Your music is safe. Start the installed MIDI cable, then reopen the Folio sound rack."],
  "reaper-missing":  ["The sound rack could not be opened.",
    "REAPER is not installed where Folio expects it. Your music is safe."],
  "rack-missing":    ["The sound rack could not be opened.",
    "The fixed REAPER rack project is missing. Your music is safe."],
  "reaper-failed":   ["The sound rack could not be opened.",
    "REAPER did not start. Your music is safe. Close any REAPER window and run folio-reaper.cmd again."],
  "renderer-lost":   ["The sound rack has gone.",
    "The REAPER rack closed while Folio was open. Your music is safe. Run folio-reaper.cmd again."],
  "send-failed":     ["The sound rack stopped listening.",
    "A note could not be sent down the MIDI cable. Your music is safe. Run folio-reaper.cmd again."],
  "browser-port":    ["The sound rack is not reaching this browser.",
    "The rack is running, but this browser cannot see its “Folio to REAPER” port. Your music is safe. If it stays this way, Experiments Hub reopens this browser."],
  "recovering":      ["Experiments Hub is reopening this browser.",
    "This browser has lost sight of the sound rack's MIDI port, and only a fresh browser sees it again. Every tab comes back. Your music is safe."],
  "moved":           ["Folio is open in the Hub window.",
    "This browser cannot hear the sound rack. Your music is safe and carries on in the Hub window, where the rack plays."],
  "browser-stuck":   ["This browser cannot see the sound rack.",
    "The rack is running, but its “Folio to REAPER” port is not reaching this browser, and reopening the browser did not bring it back. Your music is safe."],
  "hub-absent":      ["This browser cannot see the sound rack.",
    "The rack is running, but its port is not reaching this browser, and Experiments Hub did not answer to reopen it. Your music is safe."]
};

/* the same boundaries, as they fail inside the native window */
var NATIVE_FAULT_COPY = {
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
  "reaper-failed":  ["The sound rack could not be opened.",
    "The rack said something Folio does not understand. Your music is safe."]
};
function midiLocal(){
  return location.protocol === "http:" &&
    (location.hostname === "localhost" || location.hostname === "127.0.0.1" ||
     location.hostname === "[::1]");
}
function midiStored(key){
  try { return localStorage.getItem(key); } catch (e) { return null; }
}
function midiStore(key, value){
  try { localStorage.setItem(key, value); } catch (e) {}
}
function midiConnected(){
  return !!(midiRackReady && midiOut && midiOut.state !== "disconnected" &&
            midiOut.connection !== "closed");
}
/* Which boundary is failing, named from the outside in: the page's origin,
   then the renderer the launch promised, then the browser's MIDI, then the
   port itself. The renderer comes before the browser deliberately — while no
   rack is running at all, "start the rack" is the true and useful sentence,
   and a MIDI permission is not yet worth mentioning.
   Ordinary Folio never has a fault — an absent rack is not an error there. */
function midiFaultNow(){
  if (!MIDI_REQUIRED) return null;
  if (!midiLocal()) return "not-local";
  if (midiState !== "ready")
    return midiState === "not-requested" ? "service-absent" :
           (MIDI_FAULT_COPY[midiState] ? midiState : "reaper-failed");
  if (midiPermission === "absent") return "no-web-midi";
  if (midiPermission === "denied") return "midi-denied";
  if (midiPermission !== "granted") return "midi-unasked";
  if (midiSendFailed) return "send-failed";
  /* the rack answers, but this browser has no port by that name */
  if (!midiConnected())
    return midiRecovery === "asked" ? "recovering" :
           midiRecovery === "moved" ? "moved" :
           midiRecovery === "stuck" ? "browser-stuck" :
           midiRecovery === "hub-absent" ? "hub-absent" : "browser-port";
  return null;
}
/* A calm, persistent panel: no blink, no texture, no timer, no dismissal.
   It clears itself the moment the same expected rack becomes healthy again. */
function midiFaultRender(){
  var fault = midiFaultNow();
  if (fault === midiFault) return;
  var wasClear = !midiFault;
  midiFault = fault;
  if (!fault) midiRecovery = null;   /* heard again: a later loss may ask anew */
  var panel = document.getElementById("rackfault");
  if (panel){
    if (fault){
      var copy = (NATIVE && NATIVE_FAULT_COPY[fault]) || MIDI_FAULT_COPY[fault] ||
                 MIDI_FAULT_COPY["service-absent"];
      var name = document.getElementById("rackfaultname");
      var text = document.getElementById("rackfaulttext");
      if (name) name.textContent = copy[0];
      if (text) text.textContent = copy[1];
      panel.setAttribute("data-fault", fault);
    }
    panel.hidden = !fault;
  }
  /* A renderer that goes while the loop runs takes the transport with it;
     stop() clears the queue and panics the port it still has. */
  if (fault && playing && wasClear) stop();
  if (fault) say("the sound rack is not answering");
  else if (!wasClear) say(playing ? "playing · reaper" : "reaper sound connected");
}
function midiHealthSet(ready){
  ready = !!ready;
  if (ready === midiRackReady) return;
  if (!ready && midiOut) midiPanic(midiOut);
  midiRackReady = ready;
  if (MIDI_REQUIRED) return;      /* the panel speaks for required mode */
  if (playing) say(midiConnected() ? "playing · reaper" : "playing · own tone");
  else if (midiConnected()) say("reaper sound connected");
}
function midiHealthPoll(){
  if (!NATIVE && (!midiLocal() || !window.fetch)) return;
  (NATIVE ? nativeCall("folioRack") : fetch(MIDI_HEALTH, {cache:"no-store"}).then(function(response){
    if (!response.ok) throw new Error("renderer status " + response.status);
    return response.json();
  })).then(function(status){
    midiState = (status && typeof status.state === "string") ? status.state
              : ((status && status.ready) ? "ready" : "not-requested");
    midiRackSet(status && status.voices);
    midiHealthSet(midiState === "ready");
  }).catch(function(){
    midiState = "not-requested";
    midiRackSet(null);
    midiHealthSet(false);
  }).then(function(){
    midiFaultRender();
    midiRecoverCheck();
    setTimeout(midiHealthPoll, 1000);
  });
}
/* ---- a browser that has lost the rack ----
   The rack answers and the cable is there, but this browser's MIDI list has no
   port by that name. Chrome lists MIDI ports once per browser process, so a
   browser that was open across a MIDI service restart never sees the cable
   again, and nothing inside the page can make it look. After a short grace (a
   port still being opened looks missing for a moment) the page asks its server
   to have the Hub deal with it, naming itself with a token on its own <html>.
   A page in a browser the Hub owns (the Hub window, or Folio's managed
   browser) has that browser restarted with all its tabs; a page anywhere
   else is opened in the Hub window instead. Which of the two happened comes
   back, and decides what the panel says. Once per loss: a fresh browser that still cannot see
   the port says so and stops asking, and the Hub refuses a second restart
   inside ninety seconds whatever the page does. */
var MIDI_RECOVER_GRACE = 3000, MIDI_RESTART_WAIT = 10000;
var midiMissingSince = 0, midiRecovery = null;
var midiRecoverToken = String(Math.random()).slice(2, 12);
function midiRecoverCheck(){
  if (!MIDI_REQUIRED || midiFault !== "browser-port"){ midiMissingSince = 0; return; }
  if (!midiMissingSince){ midiMissingSince = Date.now(); return; }
  if (midiRecovery || Date.now() - midiMissingSince < MIDI_RECOVER_GRACE) return;
  midiRecovery = "asked";
  midiFaultRender();
  try { document.documentElement.setAttribute("data-recover", midiRecoverToken); } catch (e) {}
  fetch("/api/recover", { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ path: location.pathname + location.search, token: midiRecoverToken })
  }).then(function(response){
    return response.json().then(function(body){
      if (!response.ok) throw new Error((body && body.state) || "recover failed");
      return body;
    });
  }).then(function(body){
    if (body.state === "restarted"){
      /* this very browser is being replaced; a page still here long after
         means the restart did not go the way it was meant to */
      setTimeout(function(){
        if (midiRecovery === "asked"){ midiRecovery = "stuck"; midiFaultRender(); }
      }, MIDI_RESTART_WAIT);
      return;
    }
    midiRecovery = (body.state === "stuck") ? "stuck" : "moved";
    midiFaultRender();
  }).catch(function(){
    midiRecovery = "hub-absent";
    midiFaultRender();
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
function midiPanic(out){
  out = out || midiOut;
  if (!out) return;
  try { if (out.clear) out.clear(); } catch (e) {}
  for (var ch = 0; ch < 16; ch++){
    try { out.send([0xB0 | ch, 123, 0]); } catch (e) {} /* all notes off */
    try { out.send([0xB0 | ch, 120, 0]); } catch (e) {} /* all sound off */
  }
}
/* Hidden renderer seam for the later instrument page.  Selection is local
   runtime state, not composition data: callers choose a voice and a rack seat.
   Notes for seat N travel on MIDI channel `voice + N * 3`; REAPER needs only a
   monitored instrument track on that channel, with no stateful MIDI effect. */
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
function midiRefresh(){
  if (!midiAccess) return;
  var found = null;
  try {
    midiAccess.outputs.forEach(function(out){
      if (!found && String(out.name || "").trim().toLowerCase() === MIDI_PORT.toLowerCase() &&
          out.state !== "disconnected") found = out;
    });
  } catch (e) {}
  if (found === midiOut) return;
  if (midiOut) midiPanic(midiOut);
  midiOut = null;
  if (!found){
    if (MIDI_REQUIRED) midiFaultRender();
    else if (playing) say("playing · own tone");
    return;
  }
  function arrived(){
    midiOut = found;
    midiSendFailed = false;       /* a fresh port is not the one that threw */
    if (MIDI_REQUIRED){ midiFaultRender(); return; }
    if (midiConnected())
      say(playing ? "playing · reaper" : "reaper sound connected");
  }
  try {
    var opened = found.open && found.open();
    if (opened && opened.then) opened.then(arrived).catch(function(){});
    else arrived();
  } catch (e) {}
}
function midiConnect(){
  if (NATIVE){
    if (midiOut) return;
    midiAccess = {};
    midiPermission = "granted";
    midiOut = nativeOut;
    midiFaultRender();
    return;
  }
  if (!midiLocal() || midiAccess || midiConnecting || midiAsked) return;
  if (!navigator.requestMIDIAccess){
    midiPermission = "absent";
    midiFaultRender();
    return;
  }
  midiAsked = true;
  midiConnecting = true;
  navigator.requestMIDIAccess().then(function(access){
    midiConnecting = false;
    midiAccess = access;
    midiPermission = "granted";
    midiStore(MIDI_PERMISSION, "yes");
    access.onstatechange = midiRefresh;
    midiRefresh();
    midiFaultRender();
  }).catch(function(){
    midiConnecting = false;
    midiPermission = "denied";
    midiFaultRender();
  });
}
function midiNote(name, at, dur, v, seat){
  if (!midiConnected()) return false;
  var voiceChannel = Math.max(0, Math.min(LANES - 1, v || 0));
  /* a block may put this one note on another of the voice's seats; the
     voice's own seat is left where it is */
  var slot = (typeof seat === "number" && seat >= 0 && seat < MIDI_SLOT_COUNT)
               ? seat : MIDI_SLOTS[voiceChannel];
  var note = midiOf(name), ch = voiceChannel + slot * LANES;
  if (note === null || note === undefined) return false;
  var when = performance.now() + Math.max(0, at - ctx.currentTime) * 1000;
  var off = when + Math.max(1, dur * 1000 - MIDI_TAIL * 1000);
  try {
    midiOut.send([0x90 | ch, note, MIDI_VELOCITY[ch] || 80], when);
    midiOut.send([0x80 | ch, note, 0], off);
    return true;
  } catch (e) {
    midiOut = null;
    midiSendFailed = true;
    if (MIDI_REQUIRED) midiFaultRender();
    return false;
  }
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
function unlockAudio(){ audio(); midiConnect(); }
window.addEventListener("pointerdown", unlockAudio, true);
window.addEventListener("keydown", unlockAudio, true);
/* Once Chrome has granted the local page permission, later sessions can
   reconnect without spending the player's first press on setup. */
/* A page launched with the rack promised should not spend the player's first
   press on setup either; it asks at once, and the panel says so meanwhile. */
if (midiLocal() && (MIDI_REQUIRED || midiStored(MIDI_PERMISSION) === "yes"))
  setTimeout(midiConnect, 0);
if (midiLocal()) setTimeout(midiHealthPoll, 0);
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
function playNote(name, at, dur, v, held, seat){
  var f = noteToFreq(name);
  if (!f) return;
  /* REAPER is a renderer, never a second layer.  A successful MIDI send is
     the note; only an absent or failed port reaches Folio's sample/synth
     path, which is the complete offline fallback. */
  if (midiNote(name, at, dur, v, seat)) return;
  /* Required-REAPER mode has no fallback by design: a promised rack that
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
  /* the blocks, where they are what is playing: each pass of the loop is
     one block, and what it does to a voice is read here, as mute is */
  var arr = arrOn(), bm;
  while (nextStepTime < ctx.currentTime + AHEAD){
    /* both voices, in step, from the one clock — a mute or a solo is read
       here and nowhere else, so it lands on the next scheduled step without
       a restart, exactly as a tempo change does */
    for (var v = 0; v < VOICES; v++){
      if (!audible(v)) continue;
      bm = arr ? blockMod(schedBlock, v) : PLAIN_LANE;
      if (bm.off) continue;
      var n = vsteps(v)[schedStep];
      /* a note is scheduled once, for as long as it is written to last; the
         steps it covers hold no note of their own and so retrigger nothing.
         A note that runs past the last step of the loop is simply longer
         than the run to the seam — it goes on sounding while the playhead
         comes round, which is what ringing across the seam is. */
      if (n){
        var len = spanOf(doc, v, schedStep);
        playNote(shiftNote(n, bm.oct || 0), nextStepTime, dur * len, v, len > 1, bm.seat);
      }
    }
    /* and the chord lane, which is one cell and several pitches: what those
       pitches are is worked out from the lane, not read off it, so it is
       asked here once a step and never stored anywhere */
    bm = arr ? blockMod(schedBlock, CHORD_LANE) : PLAIN_LANE;
    if (audible(CHORD_LANE) && !bm.off && chordAt(doc, schedStep)){
      var ps = chordVoicings(doc)[schedStep], clen = spanOf(doc, CHORD_LANE, schedStep);
      for (var ci = 0; ps && ci < ps.length; ci++)
        playNote(nameOfMidi(Math.max(0, Math.min(127, ps[ci] + 12 * (bm.oct || 0)))),
                 nextStepTime, dur * clen, CHORD_LANE, clen > 1, bm.seat);
    }
    queue.push({ step: schedStep, time: nextStepTime + midiVisualDelay(),
                 block: arr ? schedBlock : -1 });
    nextStepTime += dur;
    /* where the run turns round: the loop, or the window the echo's two
       stick presses set inside it. Read afresh every step, as mute and solo
       are, so a window asked for mid-run lands on the next step round */
    if (schedStep >= echoPlayTo()){
      schedStep = echoPlayFrom();
      if (arr) schedBlock = (schedBlock + 1) % docBlocks(doc).length;
    } else schedStep++;
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
  schedBlock = arrOn() ? Math.min(bsel, docBlocks(doc).length - 1) : 0;
  master.gain.cancelScheduledValues(ctx.currentTime);
  master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
  master.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.02);
  nextStepTime = ctx.currentTime + 0.06;
  scheduler();
  timer = setInterval(scheduler, LOOKAHEAD_MS);
  say(ctx.state !== "running"
      ? "playing · press any key or click once to enable sound"
      : (midiConnected() ? "playing · reaper" : "playing · own tone"));
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
  renderBlockPlay(-1);
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
    var now = ctx.currentTime, step = shownPlayhead, blk = shownBlock, q;
    while (queue.length && queue[0].time <= now){
      q = queue.shift(); step = q.step; blk = q.block;
    }
    if (step !== shownPlayhead) renderPlayhead(step);
    if (blk !== shownBlock) renderBlockPlay(blk);
  }
  growTick();                      /* a note still under the finger goes on growing */
  pollPads();                      /* additive input layer; never touches audio timing */
  requestAnimationFrame(frame);
}
