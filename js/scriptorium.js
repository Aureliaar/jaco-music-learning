/* Folio — js/scriptorium.js : the foundry, the shelf, and the sampled voice.

   The Scriptorium is a curation lesson wearing a tool. A kit is a folder of
   WAV files and a manifest.md that says what each of them is, and the whole
   kit is meant to fit inside 64KB — the console's sample RAM, which is the
   cause of the sound the interlude is after. Nothing here is clever: the
   craft is in throwing material away.

   What is in this file:

     the WAV, encoded and decoded — PCM16 mono, the only format written
     the manifest, written and read — one line per sample, human first
     the foundry — waves, a plucked string, three noise hits, an FM blip,
       all rendered here in arithmetic; no sound ever arrives from outside
     the hand — a local file the player already owns, and the microphone
     the cut — truncate, downsample, loop-splice, and the imposed decay
     the shelf — kits over /api/kits, the byte count stated plainly
     the sampled voice — one buffer per note, pitched by playbackRate, with
       the loop and the decay a piano needs to stay a piano while it is held
     the page — F4 raises it, W makes the lead voice wear the kit

   Nothing in here reaches the pattern, and the instrument is untouched when
   the page is down. Over file:// there is no shelf to read and nothing to
   save to: the foundry still makes sounds, the voice quietly falls back to
   the folio's own tone, and nothing raises. */
"use strict";

var KIT_BUDGET = 65536;               /* the honour-system budget, stated plainly */
var KIT_KEY  = "folio.kit";
var WEAR_KEY = "folio.kit.worn";
var KIT_API  = "api/kits";
var FOUNDRY_RATE = 22050;             /* what the foundry renders at, before the cut */
var KIT_LEVEL = 0.34;                 /* samples are peak-normalised, so one level does */

/* ================= the WAV, both ways =================
   PCM16 mono and nothing else is ever written: it is what the era wrote, it
   is trivially correct, and the size of a kit is then simply two bytes a
   frame — which is the number the budget is about. */
function encodeWAV(data, rate){
  var n = data.length, bytes = n * 2, out = new Uint8Array(44 + bytes);
  var dv = new DataView(out.buffer);
  function tag(at, s){ for (var i = 0; i < s.length; i++) out[at + i] = s.charCodeAt(i); }
  tag(0, "RIFF");  dv.setUint32(4, 36 + bytes, true);
  tag(8, "WAVEfmt ");
  dv.setUint32(16, 16, true);         /* fmt chunk size */
  dv.setUint16(20, 1, true);          /* PCM */
  dv.setUint16(22, 1, true);          /* one channel */
  dv.setUint32(24, rate, true);
  dv.setUint32(28, rate * 2, true);   /* byte rate */
  dv.setUint16(32, 2, true);          /* block align */
  dv.setUint16(34, 16, true);         /* bits */
  tag(36, "data"); dv.setUint32(40, bytes, true);
  for (var i = 0; i < n; i++){
    var s = data[i];
    s = s < -1 ? -1 : s > 1 ? 1 : s;
    dv.setInt16(44 + i * 2, Math.round(s * 32767), true);
  }
  return out;
}
/* Read back anything ordinary — 8, 16 or 32-bit float, however many channels,
   whatever chunks are in the way — and hand back one mono track of floats.
   Ours is always the simple case; a file the player already owns need not be. */
function decodeWAV(bytes){
  var u = (bytes instanceof Uint8Array) ? bytes : new Uint8Array(bytes);
  if (u.length < 44) return null;
  var dv = new DataView(u.buffer, u.byteOffset, u.byteLength);
  function tag(at){ return String.fromCharCode(u[at], u[at+1], u[at+2], u[at+3]); }
  if (tag(0) !== "RIFF" || tag(8) !== "WAVE") return null;
  var at = 12, fmt = 0, ch = 1, rate = 0, bits = 0, dstart = -1, dlen = 0;
  while (at + 8 <= u.length){
    var id = tag(at), size = dv.getUint32(at + 4, true);
    if (id === "fmt "){
      fmt = dv.getUint16(at + 8, true);
      ch = dv.getUint16(at + 10, true) || 1;
      rate = dv.getUint32(at + 12, true);
      bits = dv.getUint16(at + 22, true);
    } else if (id === "data"){
      dstart = at + 8;
      dlen = Math.min(size, u.length - dstart);
    }
    at += 8 + size + (size & 1);
  }
  if (dstart < 0 || !rate) return null;
  var wide = bits === 8 ? 1 : bits / 8;
  var frames = Math.floor(dlen / (wide * ch));
  var out = new Float32Array(frames);
  for (var i = 0; i < frames; i++){
    var acc = 0;
    for (var c = 0; c < ch; c++){
      var p = dstart + (i * ch + c) * wide;
      if (fmt === 3 && bits === 32)      acc += dv.getFloat32(p, true);
      else if (bits === 8)               acc += (u[p] - 128) / 128;
      else if (bits === 32)              acc += dv.getInt32(p, true) / 2147483648;
      else                               acc += dv.getInt16(p, true) / 32768;
    }
    out[i] = acc / ch;
  }
  return { rate: rate, data: out };
}

/* ================= the manifest =================
   One line per sample, readable as prose and parseable as a record — the
   drawer's label is also the only place the loop points, the imposed decay
   and where the material came from are written down. */
function manifestLine(s){
  var bits = ["root " + nameOfMidi(s.root), s.rate + " Hz",
              (s.frames / s.rate).toFixed(2) + " s", s.bytes + " B"];
  if (s.loopEnd > s.loopStart) bits.push("loop " + s.loopStart + "–" + s.loopEnd);
  if (s.decay > 0) bits.push("decay " + s.decay.toFixed(1) + " s");
  var line = "- `" + s.file + "` — " + bits.join(" · ");
  if (s.source) line += " · source: " + s.source;
  return line;
}
function parseManifest(text){
  var out = {};
  var lines = String(text || "").split("\n");
  for (var i = 0; i < lines.length; i++){
    var m = /^\s*-\s*`([^`]+)`/.exec(lines[i]);
    if (!m) continue;
    var line = lines[i], rec = { file: m[1], root: 60, rate: 0, loopStart: 0,
                                 loopEnd: 0, decay: 0, source: "" };
    var g;
    if ((g = /root\s+([A-G]#?-?\d)/.exec(line)))       rec.root = midiOf(g[1]) || 60;
    if ((g = /(\d+)\s*Hz/.exec(line)))                 rec.rate = parseInt(g[1], 10);
    if ((g = /loop\s+(\d+)\s*[–-]\s*(\d+)/.exec(line))){
      rec.loopStart = parseInt(g[1], 10); rec.loopEnd = parseInt(g[2], 10);
    }
    if ((g = /decay\s+([\d.]+)\s*s/.exec(line)))       rec.decay = parseFloat(g[1]);
    if ((g = /source:\s*(.+?)\s*$/.exec(line)))        rec.source = g[1];
    out[rec.file] = rec;
  }
  return out;
}
function manifestText(kit, samples){
  var out = ["# kit: " + kit, "",
             "One line per sample. The budget is 64KB of samples; this file is the",
             "label on the drawer and is not counted against it.", ""];
  for (var i = 0; i < samples.length; i++) out.push(manifestLine(samples[i]));
  return out.join("\n") + "\n";
}

/* ================= the foundry =================
   Every sound in here is arithmetic. The point is not synthesis — it is that
   raw material can always be made, on a train, offline, without asking
   anyone for anything. Three knobs, whatever the generator: how high, how
   long, how bright. */
function midiFreq(m){ return 440 * Math.pow(2, (m - 69) / 12); }
function normalize(data){
  var peak = 0, i;
  for (i = 0; i < data.length; i++){ var a = Math.abs(data[i]); if (a > peak) peak = a; }
  if (peak > 0.0001){ var g = 0.92 / peak; for (i = 0; i < data.length; i++) data[i] *= g; }
  return data;
}
/* a one-pole lowpass, the only filter here, used to take the edge off */
function lowpass(data, rate, cut){
  var a = Math.exp(-2 * Math.PI * cut / rate), y = 0;
  for (var i = 0; i < data.length; i++){ y = (1 - a) * data[i] + a * y; data[i] = y; }
  return data;
}
var WAVES = {
  sine:     function(p){ return Math.sin(p); },
  triangle: function(p){ return 2 / Math.PI * Math.asin(Math.sin(p)); },
  saw:      function(p){ return 1 - 2 * ((p / (2 * Math.PI)) % 1); },
  square:   function(p){ return Math.sin(p) >= 0 ? 1 : -1; },
  /* two blends, because a bare wave is a starting point and a blend is a
     voice: glass is a sine with a quiet fifth and twelfth over it, reed is
     the saw and the square leaning on each other */
  glass:    function(p){ return Math.sin(p) + 0.28 * Math.sin(3 * p) + 0.12 * Math.sin(5 * p); },
  reed:     function(p){ return 0.6 * (1 - 2 * ((p / (2 * Math.PI)) % 1)) +
                                0.4 * (Math.sin(p) >= 0 ? 1 : -1); }
};
/* a periodic wave, rendered on an integer number of frames per cycle so that
   the loop it comes with is seamless by construction */
function genWave(kind, midi, len, tone, rate){
  var f = midiFreq(midi);
  var cyc = Math.max(2, Math.round(rate / f));
  var n = Math.max(cyc * 4, Math.round(rate * len));
  var cycles = Math.max(2, Math.round(n / cyc));
  n = cycles * cyc;
  var w = WAVES[kind] || WAVES.sine, data = new Float32Array(n);
  for (var i = 0; i < n; i++) data[i] = w(2 * Math.PI * (i % cyc) / cyc);
  if (tone < 0.98) lowpass(data, rate, 200 + tone * tone * 9000);
  normalize(data);
  /* the loop is the last four cycles: short, seamless, and the whole reason
     a single-cycle wave costs nothing at all */
  var loopLen = Math.min(n, cyc * 4);
  return { data: data, rate: rate, loopStart: n - loopLen, loopEnd: n, decay: 0 };
}
/* Karplus-Strong: a burst of noise round a delay line that averages itself
   quieter. A plucked string for the price of an array. */
function genPluck(midi, len, tone, rate){
  var f = midiFreq(midi);
  var N = Math.max(2, Math.round(rate / f));
  var n = Math.round(rate * Math.max(0.2, len));
  var data = new Float32Array(n), buf = new Float32Array(N), i;
  for (i = 0; i < N; i++) buf[i] = Math.random() * 2 - 1;
  if (tone < 0.9) lowpass(buf, rate, 300 + tone * 6000);
  /* the delay line averages itself quieter: two neighbours in, one out, and
     the missing half a percent is the string giving up */
  var damp = 0.487 + 0.011 * tone, p = 0;
  for (i = 0; i < n; i++){
    var cur = buf[p];
    data[i] = cur;
    buf[p] = (cur + buf[(p + 1) % N]) * damp;
    p = (p + 1) % N;
  }
  normalize(data);
  return { data: data, rate: rate, loopStart: 0, loopEnd: 0, decay: 0 };
}
function genKick(midi, len, tone, rate){
  var n = Math.round(rate * Math.max(0.12, len)), data = new Float32Array(n);
  var f0 = midiFreq(midi) * 2.6, f1 = midiFreq(midi) * 0.55, ph = 0;
  for (var i = 0; i < n; i++){
    var t = i / n;
    var f = f1 + (f0 - f1) * Math.exp(-t * (6 + tone * 10));
    ph += 2 * Math.PI * f / rate;
    data[i] = Math.sin(ph) * Math.exp(-t * 5.5);
  }
  normalize(data);
  return { data: data, rate: rate, loopStart: 0, loopEnd: 0, decay: 0 };
}
function genSnare(midi, len, tone, rate){
  var n = Math.round(rate * Math.max(0.1, len)), data = new Float32Array(n);
  var noise = new Float32Array(n), i;
  for (i = 0; i < n; i++) noise[i] = Math.random() * 2 - 1;
  lowpass(noise, rate, 1500 + tone * 7000);
  var f = midiFreq(midi) * 1.4, ph = 0;
  for (i = 0; i < n; i++){
    var t = i / n;
    ph += 2 * Math.PI * f / rate;
    data[i] = noise[i] * Math.exp(-t * 9) * 0.8 +
              Math.sin(ph) * Math.exp(-t * 22) * 0.5;
  }
  normalize(data);
  return { data: data, rate: rate, loopStart: 0, loopEnd: 0, decay: 0 };
}
function genHat(midi, len, tone, rate){
  var n = Math.round(rate * Math.max(0.03, Math.min(len, 0.5))), data = new Float32Array(n);
  var prev = 0;
  for (var i = 0; i < n; i++){
    var x = Math.random() * 2 - 1;
    var hp = x - prev;                       /* the whole treble filter there is */
    prev = x;
    data[i] = hp * Math.exp(-(i / n) * (26 - tone * 14));
  }
  normalize(data);
  return { data: data, rate: rate, loopStart: 0, loopEnd: 0, decay: 0 };
}
function genBlip(midi, len, tone, rate){
  var n = Math.round(rate * Math.max(0.08, len)), data = new Float32Array(n);
  var f = midiFreq(midi), ratio = 1 + Math.round(tone * 6), ph = 0, mph = 0;
  for (var i = 0; i < n; i++){
    var t = i / n;
    var idx = (2 + tone * 6) * Math.exp(-t * 4);
    mph += 2 * Math.PI * f * ratio / rate;
    ph  += 2 * Math.PI * f / rate;
    data[i] = Math.sin(ph + idx * Math.sin(mph)) * Math.exp(-t * 4.5);
  }
  normalize(data);
  return { data: data, rate: rate, loopStart: 0, loopEnd: 0, decay: 0 };
}
var GENERATORS = [
  ["sine","sine"], ["triangle","triangle"], ["saw","saw"], ["square","square"],
  ["glass","glass"], ["reed","reed"],
  ["pluck","pluck"], ["kick","kick"], ["snare","snare"], ["hat","hat"], ["blip","blip"]
];
function generate(kind, midi, len, tone, rate){
  if (WAVES[kind]) return genWave(kind, midi, len, tone, rate);
  if (kind === "pluck") return genPluck(midi, len, tone, rate);
  if (kind === "kick")  return genKick(midi, len, tone, rate);
  if (kind === "snare") return genSnare(midi, len, tone, rate);
  if (kind === "hat")   return genHat(midi, len, tone, rate);
  return genBlip(midi, len, tone, rate);
}

/* ================= the cut =================
   Truncate, downsample, loop. Destructive on purpose: an undo would invite
   the player to keep everything, and keeping everything is the failure. */
function truncate(data, from, to){
  from = Math.max(0, Math.min(data.length, from | 0));
  to   = Math.max(from + 1, Math.min(data.length, to | 0));
  return data.slice(from, to);
}
/* linear resampling, which is what the hardware did and what makes the grain.
   A cleaner filter here would be a worse instrument. */
function resample(data, from, to){
  if (!from || !to || from === to) return data;
  var n = Math.max(1, Math.round(data.length * to / from));
  var out = new Float32Array(n);
  for (var i = 0; i < n; i++){
    var x = i * from / to, i0 = Math.floor(x), f = x - i0;
    var a = data[i0] || 0, b = data[i0 + 1] === undefined ? a : data[i0 + 1];
    out[i] = a + (b - a) * f;
  }
  return out;
}
/* a loop over the late sustain: whole cycles of the root, ending at a rising
   zero crossing, so the splice does not click. Where the material has died
   away by then it is the player's job to have truncated first. */
function autoLoop(data, rate, midi){
  var cyc = Math.max(2, Math.round(rate / midiFreq(midi)));
  var end = Math.min(data.length - 1, Math.round(data.length * 0.92));
  while (end > cyc * 4 && !(data[end - 1] <= 0 && data[end] > 0)) end--;
  var cycles = Math.max(2, Math.round(rate * 0.06 / cyc));
  var start = end - cycles * cyc;
  if (start < 0){ start = 0; end = Math.min(data.length, cyc * 2); }
  return { loopStart: start, loopEnd: end };
}

/* ================= the shelf =================
   Kits live on the server, because a kit is files and files want a disk.
   Over file:// there is no shelf: the foundry works, the save does not. */
var shelf = [];                    /* [{name, bytes, files, manifest}] */
var kitName = "";                  /* the active kit */
var kitSamples = [];               /* the active kit's samples, decoded */
var kitWorn = false;               /* does the lead voice wear it */
var kitBusy = false;

function served(){ return typeof httpOrigin === "function" && httpOrigin(); }
function kitOf(name){
  for (var i = 0; i < shelf.length; i++) if (shelf[i].name === name) return shelf[i];
  return null;
}
function kitBytes(k){ return k ? k.bytes : 0; }
function fetchShelf(then){
  if (!served() || typeof fetch !== "function"){ if (then) then(false); return; }
  fetch(KIT_API, { headers: { "accept": "application/json" } }).then(function(r){
    return r.ok ? r.json() : null;
  }).then(function(o){
    shelf = (o && o.folio === "kits" && Array.isArray(o.kits)) ? o.kits : [];
    if (o && o.budget) KIT_BUDGET = o.budget;
    if (!kitOf(kitName)) kitName = shelf.length ? shelf[0].name : "";
    if (then) then(true);
  }, function(){ shelf = []; if (then) then(false); });
}
/* every sample of the active kit, fetched and decoded once. A kit is 64KB;
   there is nothing here worth being lazy about. */
/* No splice point in a piano is clean: a string's partials are inharmonic,
   so the wave never comes back exactly in phase and a bare loop seam clicks
   on every pass — at a 60 ms loop that is a ~16 Hz buzz riding the whole
   hold. So the seam is crossfaded once, at load: the last stretch of the
   loop is blended, equal-power, into the material just before the loop's
   start, and the wrap lands mid-blend on the very thing it plays next. */
function crossfadeLoop(data, l0, l1){
  var F = Math.min((l1 - l0) >> 1, l0, 256);
  if (F < 8 || l1 > data.length) return;
  for (var i = 0; i < F; i++){
    var t = (i + 1) / F * Math.PI / 2;
    data[l1 - F + i] = data[l1 - F + i] * Math.cos(t) +
                       data[l0 - F + i] * Math.sin(t);
  }
}
function loadKit(name, then){
  kitSamples = [];
  var k = kitOf(name);
  if (!k || !served() || typeof fetch !== "function"){ if (then) then(); return; }
  var meta = parseManifest(k.manifest), left = k.files.length;
  if (!left){ if (then) then(); return; }
  k.files.forEach(function(f){
    fetch(KIT_API + "/" + encodeURIComponent(name) + "/" + encodeURIComponent(f.name))
      .then(function(r){ return r.ok ? r.arrayBuffer() : null; })
      .then(function(ab){
        var w = ab && decodeWAV(new Uint8Array(ab));
        if (w){
          var m = meta[f.name] || {};
          if (m.loopEnd > m.loopStart) crossfadeLoop(w.data, m.loopStart, m.loopEnd);
          kitSamples.push({
            file: f.name, bytes: f.bytes, rate: w.rate, data: w.data,
            frames: w.data.length, root: m.root || 60,
            loopStart: m.loopStart || 0, loopEnd: m.loopEnd || 0,
            decay: m.decay || 0, source: m.source || "", buf: null
          });
          kitSamples.sort(function(a, b){ return a.root - b.root; });
        }
        if (--left === 0 && then) then();
      }, function(){ if (--left === 0 && then) then(); });
  });
}

/* ================= the sampled voice =================
   One buffer per note, pitched by playbackRate off the nearest root. Called
   from playNote in audio.js, which falls back to its own oscillator whenever
   this says no — over file://, with no kit worn, on the bass, or before a
   sample has finished decoding. */
function nearestSample(freq){
  if (!kitWorn || !kitSamples.length) return null;
  var midi = 69 + 12 * Math.log(freq / 440) / Math.LN2, best = null, bd = 1e9;
  for (var i = 0; i < kitSamples.length; i++){
    var d = Math.abs(kitSamples[i].root - midi);
    if (d < bd){ bd = d; best = kitSamples[i]; }
  }
  return best;
}
function bufferOf(s){
  if (s.buf) return s.buf;
  if (!ctx || !ctx.createBuffer) return null;
  try {
    var b = ctx.createBuffer(1, s.data.length, s.rate);
    if (b.copyToChannel) b.copyToChannel(s.data, 0);
    else b.getChannelData(0).set(s.data);
    s.buf = b;
  } catch (e){ s.buf = null; }
  return s.buf;
}
/* The piano problem, and the era's answer to it: a sampled note decays, so a
   looped sustain slice on its own turns a piano into an organ the moment it
   is held. The loop keeps the note alive; an imposed exponential decay over
   the top is what keeps it a piano. It is one envelope segment, and it is the
   difference between a kit being usable under Lesson 3 and being a toy. */
function samplePlay(freq, at, dur, v, held){
  if (v !== 0 || !ctx || !ctx.createBufferSource) return false;
  var s = nearestSample(freq);
  if (!s) return false;
  var buf = bufferOf(s);
  if (!buf) return false;

  var rate = freq / midiFreq(s.root);
  var src = ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.setValueAtTime(rate, at);

  var natural = (s.frames / s.rate) / rate;
  var looped = s.loopEnd > s.loopStart;
  if (looped){
    src.loop = true;
    src.loopStart = s.loopStart / s.rate;
    src.loopEnd   = s.loopEnd / s.rate;
  }
  var g = ctx.createGain();
  var end = at + dur - TAIL;
  var attack = 0.004;
  var rel = held ? 0.05 : 0.03;
  var relStart = Math.max(at + attack + 0.001, end - rel);
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(KIT_LEVEL, at + attack);
  if (s.decay > 0){
    /* one exponential segment down to wherever the release finds it: a note
       that is let go early is still at its own height when it is let go */
    var tau = s.decay / 3;
    var atRel = Math.max(0.0002, KIT_LEVEL * Math.exp(-(relStart - at) / tau));
    g.gain.exponentialRampToValueAtTime(atRel, relStart);
  } else {
    g.gain.setValueAtTime(KIT_LEVEL, relStart);
  }
  g.gain.linearRampToValueAtTime(0, end);

  src.connect(g); g.connect(master);
  src.start(at);
  src.stop(looped ? end + 0.01 : Math.min(end, at + natural) + 0.01);
  live.push(src);
  src.onended = function(){
    var k = live.indexOf(src);
    if (k >= 0) live.splice(k, 1);
    try { src.disconnect(); g.disconnect(); } catch (e){}
  };
  return true;
}

/* ================= the bench =================
   One sample under the hands at a time. */
var bench = null;                  /* {name, data, rate, root, loopStart, loopEnd, decay, source} */
var gen = { kind: "glass", midi: 60, len: 0.5, tone: 0.6 };
/* the trim handles, which live outside the render so that redrawing the page
   does not move them; zero means "the whole of it" */
var cut0 = 0, cut1 = 0;

function benchNew(o, name, source){
  bench = { name: name, data: o.data, rate: o.rate, root: gen.midi,
            loopStart: o.loopStart || 0, loopEnd: o.loopEnd || 0,
            decay: o.decay || 0, source: source || "" };
  renderScript();
}
function benchBytes(){ return bench ? 44 + bench.data.length * 2 : 0; }
function benchStrike(){
  benchNew(generate(gen.kind, gen.midi, gen.len, gen.tone, FOUNDRY_RATE),
           gen.kind + "-" + nameOfMidi(gen.midi).toLowerCase().replace("#", "s"),
           "the foundry · " + gen.kind);
  say("struck · " + gen.kind + " at " + nameOfMidi(gen.midi));
}
/* auditioning the bench goes through the same path a written note does, so
   what is heard here is what the folio will play */
function benchAudition(){
  if (!bench) return;
  audio();
  if (ctx.state !== "running"){ say("press any key or click once to enable sound"); return; }
  var keep = [kitWorn, kitSamples];
  kitWorn = true;
  kitSamples = [{ file: bench.name, rate: bench.rate, data: bench.data,
                  frames: bench.data.length, root: bench.root,
                  loopStart: bench.loopStart, loopEnd: bench.loopEnd,
                  decay: bench.decay, buf: null }];
  samplePlay(midiFreq(bench.root), ctx.currentTime + 0.02, 1.4, 0, true);
  kitWorn = keep[0]; kitSamples = keep[1];
}

/* ---- the hand: a file the player already owns ---- */
function importSound(file){
  if (!file) return;
  audio();
  var fr = new FileReader();
  fr.onload = function(){
    var done = function(data, rate){
      benchNew({ data: normalize(data), rate: rate, loopStart: 0, loopEnd: 0 },
               String(file.name).replace(/\.[^.]*$/, "").toLowerCase()
                 .replace(/[^a-z0-9_-]+/g, "-").slice(0, 24) || "import",
               "local file · " + file.name);
      say("brought in · " + (data.length / rate).toFixed(2) + " s at " + rate + " Hz");
    };
    var own = decodeWAV(new Uint8Array(fr.result));
    if (own){ done(own.data, own.rate); return; }
    if (!ctx || !ctx.decodeAudioData){ say("that file is not a WAV this page can read"); return; }
    ctx.decodeAudioData(fr.result, function(ab){
      var d = ab.getChannelData(0), out = new Float32Array(d.length);
      out.set(d);
      done(out, Math.round(ab.sampleRate));
    }, function(){ say("that file would not decode"); });
  };
  fr.onerror = function(){ say("that file would not open"); };
  fr.readAsArrayBuffer(file);
}

/* ---- the hand: the microphone ----
   Localhost is a secure context, so this is available where the served folio
   is. Where it is not — file://, a denied permission, no device — it says so
   once and the rest of the foundry is untouched. */
var micStop = null;
function micToggle(){
  if (micStop){ micStop(); return; }
  var md = navigator.mediaDevices;
  if (!md || !md.getUserMedia){ say("no microphone here"); return; }
  audio();
  md.getUserMedia({ audio: true }).then(function(stream){
    var src = ctx.createMediaStreamSource(stream);
    var node = ctx.createScriptProcessor ? ctx.createScriptProcessor(4096, 1, 1) : null;
    if (!node){ say("this browser will not hand over the microphone"); return; }
    var chunks = [], frames = 0;
    node.onaudioprocess = function(e){
      var d = e.inputBuffer.getChannelData(0), c = new Float32Array(d.length);
      c.set(d); chunks.push(c); frames += c.length;
      if (frames > ctx.sampleRate * 8) micStop();      /* eight seconds is plenty */
    };
    src.connect(node); node.connect(ctx.destination);
    say("recording · press again to stop");
    micStop = function(){
      micStop = null;
      try { node.disconnect(); src.disconnect(); } catch (e){}
      stream.getTracks().forEach(function(t){ t.stop(); });
      var out = new Float32Array(frames), at = 0;
      chunks.forEach(function(c){ out.set(c, at); at += c.length; });
      if (!out.length){ say("nothing was recorded"); return; }
      benchNew({ data: normalize(out), rate: Math.round(ctx.sampleRate),
                 loopStart: 0, loopEnd: 0 }, "mic", "microphone");
      say("recorded · " + (out.length / ctx.sampleRate).toFixed(2) + " s");
    };
    renderScript();
  }, function(){ say("the microphone was not given"); });
}

/* ---- saving into the kit ---- */
function kitPut(name, leaf, body, type, then){
  fetch(KIT_API + "/" + encodeURIComponent(name) + "/" + encodeURIComponent(leaf), {
    method: "PUT", headers: { "content-type": type }, body: body
  }).then(function(r){ then(r && r.ok); }, function(){ then(false); });
}
function saveBench(){
  if (!bench) return;
  if (!served() || typeof fetch !== "function"){ say("nothing to save to — open the served folio"); return; }
  if (!kitName){ say("name a kit first"); return; }
  if (kitBusy) return;
  kitBusy = true;
  var leaf = bench.name.replace(/[^a-z0-9._-]+/gi, "-").replace(/\.wav$/i, "") + ".wav";
  var wav = encodeWAV(bench.data, bench.rate);
  var rec = { file: leaf, root: bench.root, rate: bench.rate,
              frames: bench.data.length, bytes: wav.length,
              loopStart: bench.loopStart, loopEnd: bench.loopEnd,
              decay: bench.decay, source: bench.source };
  kitPut(kitName, leaf, wav, "audio/wav", function(okay){
    if (!okay){ kitBusy = false; say("the sample would not save"); renderScript(); return; }
    /* the manifest is rewritten whole from what is on the shelf plus this */
    var k = kitOf(kitName) || { files: [], manifest: "" };
    var meta = parseManifest(k.manifest), rows = [rec];
    k.files.forEach(function(f){
      if (f.name === leaf) return;
      var m = meta[f.name] || {};
      rows.push({ file: f.name, root: m.root || 60, rate: m.rate || 0,
                  frames: Math.round(((f.bytes - 44) / 2)), bytes: f.bytes,
                  loopStart: m.loopStart || 0, loopEnd: m.loopEnd || 0,
                  decay: m.decay || 0, source: m.source || "" });
    });
    rows.sort(function(a, b){ return a.root - b.root; });
    kitPut(kitName, "manifest.md", manifestText(kitName, rows), "text/markdown",
      function(okay2){
        kitBusy = false;
        say(okay2 ? "kept · " + leaf + " · " + rec.bytes + " B"
                  : "the sample saved, the manifest did not");
        refreshShelf();
      });
  });
}
function removeSample(leaf){
  if (!served() || typeof fetch !== "function") return;
  fetch(KIT_API + "/" + encodeURIComponent(kitName) + "/" + encodeURIComponent(leaf),
        { method: "DELETE" }).then(function(){
    say("struck out · " + leaf);
    refreshShelf();
  }, function(){ say("it would not go"); });
}
function refreshShelf(){
  fetchShelf(function(){
    loadKit(kitName, function(){ renderScript(); });
    renderScript();
  });
}
function editSample(leaf){
  for (var i = 0; i < kitSamples.length; i++){
    if (kitSamples[i].file !== leaf) continue;
    var s = kitSamples[i], d = new Float32Array(s.data.length);
    d.set(s.data);
    bench = { name: s.file.replace(/\.wav$/i, ""), data: d, rate: s.rate,
              root: s.root, loopStart: s.loopStart, loopEnd: s.loopEnd,
              decay: s.decay, source: s.source };
    renderScript();
    say("on the bench · " + s.file);
    return;
  }
  say("that one has not finished loading");
}

/* ---- what the lead voice wears ---- */
function setWear(on){
  kitWorn = !!on && !!kitSamples.length;
  try { localStorage.setItem(WEAR_KEY, kitWorn ? "on" : "off"); } catch (e){}
  renderScript();
}
function toggleWear(){
  if (!kitSamples.length && !kitWorn){
    say(served() ? "no kit is loaded to wear" : "kits need the served folio — the lead keeps its own tone");
    return;
  }
  setWear(!kitWorn);
  say(kitWorn ? "the lead wears · " + kitName : "the lead has its own tone again");
}
function setKit(name){
  kitName = name;
  try { localStorage.setItem(KIT_KEY, name); } catch (e){}
  loadKit(name, function(){
    if (kitWorn && !kitSamples.length) setWear(false);
    renderScript();
  });
  renderScript();
}

/* ================= the page =================
   Built here rather than in folio.html: the markup is one empty section, and
   everything in it is drawn from the state above, so there is one place a
   control can be wrong. */
var scriptEl = document.getElementById("scriptorium");
var wavPicker = document.getElementById("wavpicker");
function scriptOn(){ return !!scriptEl && scriptEl.classList.contains("on"); }
function scriptTyping(e){
  var t = e && e.target, n = t && t.tagName;
  return n === "INPUT" || n === "TEXTAREA" || n === "SELECT";
}
function smk(tag, cls, text){
  var el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text !== undefined) el.textContent = text;
  return el;
}
function sbtn(label, fn, cls){
  var b = smk("button", "sbtn" + (cls ? " " + cls : ""), label);
  b.type = "button";
  b.addEventListener("click", fn);
  return b;
}
function sdial(min, max, step, value, fn){
  var s = document.createElement("input");
  s.type = "range"; s.min = min; s.max = max; s.step = step; s.value = value;
  s.className = "sdial";
  s.addEventListener("input", function(){ fn(parseFloat(s.value)); });
  return s;
}
function srow(cls){ return smk("div", "srow" + (cls ? " " + cls : "")); }
/* a knob is three things that belong together — what it is, where it is, and
   the slider itself — so they wrap as one and never leave a stray number on a
   line of its own */
function sgroup(label, value, dial){
  var g = smk("span", "sgroup");
  g.appendChild(smk("span", "slabel", label));
  g.appendChild(smk("span", "sval", value));
  g.appendChild(dial);
  return g;
}
function bytesSay(n){ return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " "); }

/* the waveform, and the two marks on it that matter: where the loop is and
   where the sound has been cut to */
function drawWave(cv){
  if (!cv || !cv.getContext) return;
  var w = cv.width, h = cv.height, g = cv.getContext("2d");
  if (!g) return;
  g.clearRect(0, 0, w, h);
  if (!bench) return;
  var d = bench.data, n = d.length;
  if (bench.loopEnd > bench.loopStart){
    g.fillStyle = "rgba(156,122,40,0.16)";
    var x0 = bench.loopStart / n * w, x1 = bench.loopEnd / n * w;
    g.fillRect(x0, 0, Math.max(1, x1 - x0), h);
  }
  g.strokeStyle = "rgba(59,47,30,0.62)";
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(0, h / 2);
  for (var x = 0; x < w; x++){
    var a = Math.floor(x / w * n), b = Math.floor((x + 1) / w * n), peak = 0;
    for (var i = a; i < b && i < n; i++){ var v = Math.abs(d[i]); if (v > peak) peak = v; }
    g.moveTo(x + 0.5, h / 2 - peak * h * 0.46);
    g.lineTo(x + 0.5, h / 2 + peak * h * 0.46);
  }
  g.stroke();
}

var sbody = null, waveCv = null;
function renderScript(){
  if (!scriptEl || !scriptOn()) return;
  if (!sbody){
    sbody = smk("div", "sbody");
    scriptEl.appendChild(smk("h2", null, "The Scriptorium"));
    scriptEl.appendChild(sbody);
  }
  while (sbody.firstChild) sbody.removeChild(sbody.firstChild);

  /* ---- the shelf ---- */
  var shelfRow = srow("skits");
  shelfRow.appendChild(smk("span", "slabel", "kits"));
  if (!served()){
    shelfRow.appendChild(smk("span", "sdim",
      "no shelf over file:// — the foundry works, nothing can be kept"));
  } else if (!shelf.length){
    shelfRow.appendChild(smk("span", "sdim", "the shelf is empty"));
  } else {
    shelf.forEach(function(k){
      shelfRow.appendChild(sbtn(k.name, function(){ setKit(k.name); },
                               k.name === kitName ? "on" : ""));
    });
  }
  var namer = document.createElement("input");
  namer.type = "text"; namer.className = "sname"; namer.placeholder = "a new kit";
  namer.value = "";
  shelfRow.appendChild(namer);
  shelfRow.appendChild(sbtn("open it", function(){
    var n = (namer.value || "").trim().toLowerCase().replace(/[^a-z0-9 _-]+/g, "-");
    if (!n){ say("a kit needs a name"); return; }
    kitName = n;
    try { localStorage.setItem(KIT_KEY, n); } catch (e){}
    kitSamples = [];
    say("the kit · " + n + " · nothing in it yet");
    renderScript();
  }));
  sbody.appendChild(shelfRow);

  /* ---- the budget, plainly ---- */
  var k = kitOf(kitName);
  var used = kitBytes(k);
  var budget = srow("sbudget");
  budget.appendChild(smk("span", "skit", kitName || "—"));
  budget.appendChild(smk("span", used > KIT_BUDGET ? "sover" : "",
    bytesSay(used) + " of " + bytesSay(KIT_BUDGET) + " B" +
    "  ·  " + (k ? k.files.length : 0) + " sample" +
    ((k && k.files.length === 1) ? "" : "s")));
  if (used > KIT_BUDGET) budget.appendChild(smk("span", "sover", "· over the budget"));
  sbody.appendChild(budget);

  /* ---- the samples in it ---- */
  if (k && k.files.length){
    var meta = parseManifest(k.manifest);
    k.files.forEach(function(f){
      var m = meta[f.name] || {};
      var r = srow("ssample");
      r.appendChild(smk("span", "sfile", f.name));
      r.appendChild(smk("span", "sdim",
        (m.root ? nameOfMidi(m.root) + " · " : "") +
        (m.rate ? m.rate + " Hz · " : "") +
        bytesSay(f.bytes) + " B" +
        (m.loopEnd > m.loopStart ? " · looped" : "") +
        (m.decay ? " · decay " + m.decay.toFixed(1) + " s" : "")));
      r.appendChild(sbtn("bench", function(){ editSample(f.name); }));
      r.appendChild(sbtn("strike out", function(){ removeSample(f.name); }));
      sbody.appendChild(r);
    });
  }

  /* ---- the foundry ---- */
  var f1 = srow("sfoundry");
  f1.appendChild(smk("span", "slabel", "foundry"));
  GENERATORS.forEach(function(g){
    f1.appendChild(sbtn(g[1], function(){ gen.kind = g[0]; benchStrike(); },
                       gen.kind === g[0] ? "on" : ""));
  });
  sbody.appendChild(f1);

  var f2 = srow("sdials");
  f2.appendChild(sgroup("pitch", nameOfMidi(gen.midi),
    sdial(MIDI_LO, MIDI_HI, 1, gen.midi, function(v){ gen.midi = v; renderScript(); })));
  f2.appendChild(sgroup("length", gen.len.toFixed(2) + " s",
    sdial(0.05, 2, 0.05, gen.len, function(v){ gen.len = v; renderScript(); })));
  f2.appendChild(sgroup("tone", Math.round(gen.tone * 100) + "",
    sdial(0, 1, 0.02, gen.tone, function(v){ gen.tone = v; renderScript(); })));
  sbody.appendChild(f2);

  var f3 = srow("shand");
  f3.appendChild(smk("span", "slabel", "the hand"));
  f3.appendChild(sbtn("strike again", benchStrike));
  f3.appendChild(sbtn("a file of your own", function(){
    if (wavPicker){ wavPicker.value = ""; wavPicker.click(); }
  }));
  f3.appendChild(sbtn(micStop ? "stop recording" : "the microphone", micToggle,
                     micStop ? "on" : ""));
  f3.appendChild(smk("span", "sdim", "or drop a sound here"));
  sbody.appendChild(f3);

  /* ---- the bench ---- */
  if (!bench){
    sbody.appendChild(smk("div", "sdim sempty",
      "Nothing on the bench. Strike something, bring a file, or take one off the kit."));
  } else {
    waveCv = document.createElement("canvas");
    waveCv.className = "swave";
    waveCv.width = 620; waveCv.height = 78;
    sbody.appendChild(waveCv);
    drawWave(waveCv);

    var b0 = srow("sbench");
    var nm = document.createElement("input");
    nm.type = "text"; nm.className = "sname"; nm.value = bench.name;
    nm.addEventListener("input", function(){ bench.name = nm.value; });
    b0.appendChild(smk("span", "slabel", "name"));
    b0.appendChild(nm);
    b0.appendChild(smk("span", "sdim",
      bench.rate + " Hz · " + (bench.data.length / bench.rate).toFixed(2) + " s · " +
      bytesSay(benchBytes()) + " B" +
      (used ? " · would make " + bytesSay(used + benchBytes()) : "")));
    sbody.appendChild(b0);

    var b1 = srow("sdials");
    b1.appendChild(sgroup("root", nameOfMidi(bench.root),
      sdial(MIDI_LO, MIDI_HI, 1, bench.root, function(v){ bench.root = v; renderScript(); })));
    b1.appendChild(sgroup("decay", bench.decay ? bench.decay.toFixed(1) + " s" : "none",
      sdial(0, 12, 0.2, bench.decay, function(v){ bench.decay = v; renderScript(); })));
    sbody.appendChild(b1);

    /* trim: two handles over the whole sample, then the cut is made */
    var n = bench.data.length;
    var t0 = Math.min(cut0, n - 1), t1 = Math.min(cut1 <= 0 ? n : cut1, n);
    var b2 = srow("scut");
    b2.appendChild(smk("span", "slabel", "trim"));
    b2.appendChild(sdial(0, n - 1, 1, t0, function(v){ cut0 = v; renderScript(); }));
    b2.appendChild(sdial(1, n, 1, t1, function(v){ cut1 = v; renderScript(); }));
    b2.appendChild(smk("span", "sval",
      (t0 / bench.rate).toFixed(2) + "–" + (t1 / bench.rate).toFixed(2) + " s"));
    b2.appendChild(sbtn("truncate", function(){
      bench.data = truncate(bench.data, t0, t1);
      bench.loopStart = Math.max(0, bench.loopStart - t0);
      bench.loopEnd = Math.min(bench.data.length, Math.max(0, bench.loopEnd - t0));
      cut0 = 0; cut1 = 0;
      say("cut to " + (bench.data.length / bench.rate).toFixed(2) + " s · " +
          bytesSay(benchBytes()) + " B");
      renderScript();
    }));
    sbody.appendChild(b2);

    var b3 = srow("srate");
    b3.appendChild(smk("span", "slabel", "rate"));
    [8000, 11025, 16000, 22050].forEach(function(r){
      b3.appendChild(sbtn(r + " Hz", function(){
        var was = bench.rate;
        bench.data = resample(bench.data, was, r);
        bench.loopStart = Math.round(bench.loopStart * r / was);
        bench.loopEnd   = Math.round(bench.loopEnd * r / was);
        bench.rate = r;
        cut0 = 0; cut1 = 0;
        say("down to " + r + " Hz · " + bytesSay(benchBytes()) + " B");
        renderScript();
      }, bench.rate === r ? "on" : ""));
    });
    sbody.appendChild(b3);

    var b4 = srow("sloop");
    b4.appendChild(smk("span", "slabel", "loop"));
    b4.appendChild(smk("span", "sval", bench.loopEnd > bench.loopStart
      ? bench.loopStart + "–" + bench.loopEnd +
        " (" + ((bench.loopEnd - bench.loopStart) / bench.rate * 1000).toFixed(0) + " ms)"
      : "none"));
    b4.appendChild(sbtn("splice a loop", function(){
      var l = autoLoop(bench.data, bench.rate, bench.root);
      bench.loopStart = l.loopStart; bench.loopEnd = l.loopEnd;
      say("looped " + l.loopStart + "–" + l.loopEnd +
          (bench.decay ? "" : " · give it a decay or it will read as an organ"));
      renderScript();
    }));
    b4.appendChild(sbtn("from the trim", function(){
      bench.loopStart = t0; bench.loopEnd = t1;
      say("looped " + t0 + "–" + t1);
      renderScript();
    }));
    b4.appendChild(sbtn("no loop", function(){
      bench.loopStart = bench.loopEnd = 0; renderScript(); say("the loop is off");
    }));
    sbody.appendChild(b4);

    var b5 = srow("skeep");
    b5.appendChild(sbtn("hear it", benchAudition));
    b5.appendChild(sbtn("keep it in " + (kitName || "the kit"), saveBench,
                       served() ? "keep" : "off"));
    b5.appendChild(smk("span", "sdim", served() ? "" : "saving needs the served folio"));
    sbody.appendChild(b5);
  }

  /* ---- what the lead wears ---- */
  var w = srow("swear");
  w.appendChild(smk("span", "slabel", "the lead"));
  w.appendChild(smk("span", kitWorn ? "swearing" : "sdim",
    kitWorn ? "wears " + kitName + " — W takes it off"
            : "has its own tone — W puts the kit on"));
  sbody.appendChild(w);
}

function toggleScriptorium(){
  if (!scriptEl) return;
  var on = !scriptOn();
  scriptEl.classList.toggle("on", on);
  if (on){
    questsEl.classList.remove("on");
    settingsEl.classList.remove("on");
    markSettings(false);
    if (typeof closeKeys === "function") closeKeys();
  }
  applyViz();
  if (on){
    renderScript();
    refreshShelf();
    say("the scriptorium · W wears the kit · esc back to the folio");
  } else {
    say("‸ cursor row");
  }
}

/* a sound dropped on the page while the scriptorium is up is material, not a
   folio: the panel takes it before the window's own handler sees it */
if (scriptEl){
  scriptEl.addEventListener("drop", function(e){
    e.preventDefault(); e.stopPropagation();
    var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) importSound(f);
  });
  scriptEl.addEventListener("dragover", function(e){ e.preventDefault(); e.stopPropagation(); });
}
if (wavPicker){
  wavPicker.addEventListener("change", function(){
    if (wavPicker.files && wavPicker.files[0]) importSound(wavPicker.files[0]);
  });
}

/* ---- boot: what was worn last time, if the shelf still has it ---- */
function scriptBoot(){
  try {
    kitName = localStorage.getItem(KIT_KEY) || "";
    kitWorn = localStorage.getItem(WEAR_KEY) === "on";
  } catch (e){}
  if (!served()){ kitWorn = false; return; }   /* file:// keeps the folio's own tone */
  fetchShelf(function(){
    if (!kitName && shelf.length) kitName = shelf[0].name;
    loadKit(kitName, function(){
      if (kitWorn && !kitSamples.length) kitWorn = false;
      renderScript();
    });
  });
}
