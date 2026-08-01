/* Folio — js/tones.js : what the two voices sound like.

   A *tone* is one of two things: the voice's own synth sound, which is what
   the folio has always had and what audio.js draws, or a named kit off the
   shelf — a folder of WAV files and a manifest.md saying what each of them
   is. Nothing else. There is no room to make kits in any more: they are
   baked by `kits/bake.mjs`, checked in, and chosen from a short rail on the
   crossbar. The choice belongs to the workspace, not to the browser, so it
   rides in the page (`doc.tones`) and switches when the workspace does.

   What is in this file:

     the WAV, encoded and decoded — PCM16 mono, the format the kits are in
     the manifest, read — one line per sample: root, rate, loop, decay
     the shelf — the kits over /api/kits, or off plain files where a host
       serves no API at all, each fetched and decoded the first time a page
       asks for it and kept from then on
     the sampled voice — one buffer per note, pitched by playbackRate off
       the nearest root, with the loop and the imposed decay a struck sound
       needs to go on ringing while it is held

   Over file:// there is no shelf and nothing to fetch: every voice plays its
   own tone, and the rails on the crossbar say so. A page that names a kit
   this folio has never heard of is not an error either — that voice simply
   plays its own tone, and the name is kept, so the page still means what it
   meant when it travels back somewhere the kit exists. */
"use strict";

var KIT_API  = "api/kits";
var KIT_DIR  = "kits";                /* where a plain file host keeps them */
var KIT_LEVEL = 0.34;                 /* samples are peak-normalised, so one level does */

/* ---- the rails ----
   What each voice may be, in the order the crossbar walks it. null is the
   voice's own tone and is always first, so a rail is never empty and the
   folio is never further than one step from the sound it was born with.
   These are the kits that are checked in; the shelf may hold others, made
   by hand, and they are simply not on the rail. */
var TONE_RAIL = [
  [null, "piano", "music-box", "pluck"],      /* the lead */
  [null, "pluck-bass", "sub"]                 /* the bass */
];
/* a kit's folder name is hyphenated because it is a path; what is said out
   loud is not */
function toneLabel(t){ return t ? String(t).replace(/-/g, " ") : "own tone"; }

/* ================= the WAV, both ways =================
   PCM16 mono and nothing else is ever read or written: it is what the era
   wrote, it is trivially correct, and the size of a kit is then simply two
   bytes a frame.

   The encoder is here for the decoder's sake. Nothing in the page writes a
   WAV any more — kits/bake.mjs does, and has its own copy, because a page
   cannot load a build script — but a format you can only read is a format
   you cannot check, and this pair is what the round-trip is checked with. */
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
   Ours is always the simple case; it is read permissively anyway. */
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

/* ================= the manifest, read =================
   One line per sample, prose first and a record second — and the only place
   the root, the loop points and the imposed decay are written down. The
   writer of these lines is kits/bake.mjs; this only ever reads them. */
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
function midiFreq(m){ return 440 * Math.pow(2, (m - 69) / 12); }

/* ================= the shelf =================
   Two ways in, decided by what answers. The little local server has an API
   that lists what is on the shelf and what each kit weighs. A dumb static
   host has no API at all and only files — so the fallback asks a kit for its
   manifest.md by name and believes what it says. Either way a kit is fetched
   once, decoded once, and kept, and no kit is fetched until a page names it:
   they are not all small any more. */
var shelf = [];                    /* [{name, bytes, files, manifest}] — API only */
var kitBank = {};                  /* name -> [samples], decoded */
var kitTried = {};                 /* name -> true once it has been asked for */
var shelfAsked = false;            /* has the listing come back yet */

function served(){ return typeof httpOrigin === "function" && httpOrigin(); }
function canFetch(){ return served() && typeof fetch === "function"; }
function kitOf(name){
  for (var i = 0; i < shelf.length; i++) if (shelf[i].name === name) return shelf[i];
  return null;
}
function fetchShelf(then){
  if (!canFetch()){ if (then) then(false); return; }
  fetch(KIT_API, { headers: { "accept": "application/json" } }).then(function(r){
    return r.ok ? r.json() : null;
  }).then(function(o){
    shelf = (o && o.folio === "kits" && Array.isArray(o.kits)) ? o.kits : [];
    shelfAsked = true;
    if (then) then(shelf.length > 0);
  }, function(){ shelf = []; shelfAsked = true; if (then) then(false); });
}
/* where one kit's files are asked for: through the API where there is one,
   and off the disk where the host only knows files */
function kitUrl(name, leaf){
  return kitOf(name)
    ? KIT_API + "/" + encodeURIComponent(name) + "/" + encodeURIComponent(leaf)
    : KIT_DIR + "/" + encodeURIComponent(name) + "/" + encodeURIComponent(leaf);
}
/* No splice point in a struck string is clean: its partials are inharmonic,
   so the wave never comes back exactly in phase and a bare loop seam clicks
   on every pass — at a 60 ms loop that is a ~16 Hz buzz riding the whole
   hold, which is how the player heard it. So the seam is crossfaded once, at
   load: the last stretch of the loop is blended, equal-power, into the
   material just before the loop's start, and the wrap lands mid-blend on the
   very thing it plays next. Every looped sample gets this, whatever kit it
   came from and however carefully the splice was chosen. */
function crossfadeLoop(data, l0, l1){
  var F = Math.min((l1 - l0) >> 1, l0, 256);
  if (F < 8 || l1 > data.length) return;
  for (var i = 0; i < F; i++){
    var t = (i + 1) / F * Math.PI / 2;
    data[l1 - F + i] = data[l1 - F + i] * Math.cos(t) +
                       data[l0 - F + i] * Math.sin(t);
  }
}
function readSamples(name, meta, files, then){
  var left = files.length, out = [];
  if (!left){ kitBank[name] = []; if (then) then(); return; }
  files.forEach(function(leaf){
    fetch(kitUrl(name, leaf))
      .then(function(r){ return r.ok ? r.arrayBuffer() : null; })
      .then(function(ab){
        var w = ab && decodeWAV(new Uint8Array(ab));
        if (w){
          var m = meta[leaf] || {};
          if (m.loopEnd > m.loopStart) crossfadeLoop(w.data, m.loopStart, m.loopEnd);
          out.push({ file: leaf, rate: w.rate, data: w.data,
                     frames: w.data.length, root: m.root || 60,
                     loopStart: m.loopStart || 0, loopEnd: m.loopEnd || 0,
                     decay: m.decay || 0, buf: null });
        }
        if (--left === 0){
          out.sort(function(a, b){ return a.root - b.root; });
          kitBank[name] = out;
          if (then) then();
        }
      }, function(){ if (--left === 0){ kitBank[name] = out; if (then) then(); } });
  });
}
/* every sample of one kit, fetched and decoded once. A kit is 64KB; there is
   nothing here worth being lazy about. */
/* Once, and once only. The guard is on having *asked* rather than on having
   the samples, because the ask is what is slow: voiceSamples calls in here
   from inside the scheduler, and a kit still in flight must not be fetched
   again on the next note. */
function loadKit(name, then){
  if (!name || kitTried[name] || !canFetch()){ if (then) then(); return; }
  /* the listing decides which of the two roads this kit is on, so nothing is
     asked for until it is back: a fetch begun early would take the plain-file
     road on a host that has an API, be refused, and mark the kit missing */
  if (!shelfAsked){ if (then) then(); return; }
  kitTried[name] = true;
  var k = kitOf(name);
  if (k){
    readSamples(name, parseManifest(k.manifest),
                k.files.map(function(f){ return f.name; }), then);
    return;
  }
  /* no API: the manifest is a file like any other, and it names the rest */
  fetch(kitUrl(name, "manifest.md")).then(function(r){
    return r.ok ? r.text() : null;
  }).then(function(t){
    if (!t){ kitBank[name] = []; if (then) then(); return; }
    var meta = parseManifest(t), files = [];
    for (var f in meta) if (Object.prototype.hasOwnProperty.call(meta, f)) files.push(f);
    files.sort();
    readSamples(name, meta, files, then);
  }, function(){ kitBank[name] = []; if (then) then(); });
}

/* ================= what a voice is wearing ================= */
function docTone(d, v){
  var a = d && d.tones;
  return (Array.isArray(a) && typeof a[v] === "string" && a[v]) ? a[v] : null;
}
/* the samples this voice should be playing, or null for its own tone —
   which is also the answer while the kit is still coming, and where it is
   not here at all. A named kit nobody has asked for yet is fetched from
   here, once: that is the whole of the loading policy, and it means a page
   opened onto a kit finds it without anything having to remember to ask. */
function voiceSamples(v){
  var t = docTone(doc, v || 0);
  if (!t) return null;
  var s = kitBank[t];
  if (!s){ loadKit(t); return null; }
  return s.length ? s : null;
}
/* is a name on this folio's shelf — what the rail says out loud. Only a
   thing actually disproved reads "not here": no shelf to read at all, or a
   listing that does not have it, or a fetch that came back with nothing. A
   kit still on its way is not called missing. */
function toneHere(name){
  if (!name) return true;                       /* one's own tone is always here */
  if (!canFetch()) return false;                /* file://: there is no shelf */
  var s = kitBank[name];
  if (s) return s.length > 0;
  if (shelf.length) return !!kitOf(name);
  return true;                                  /* no listing; nothing disproved */
}

/* ================= the sampled voice =================
   One buffer per note, pitched by playbackRate off the nearest root. Called
   from playNote in audio.js, which falls back to its own oscillator whenever
   this says no — over file://, on a voice playing its own tone, on a kit
   this folio has not got, and before a sample has finished decoding. */
function nearestSample(samples, freq){
  if (!samples || !samples.length) return null;
  var midi = 69 + 12 * Math.log(freq / 440) / Math.LN2, best = null, bd = 1e9;
  for (var i = 0; i < samples.length; i++){
    var d = Math.abs(samples[i].root - midi);
    if (d < bd){ bd = d; best = samples[i]; }
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
   looped sustain slice on its own turns a struck sound into an organ the
   moment it is held. The loop keeps the note alive; an imposed exponential
   decay over the top is what keeps it a piano. It is one envelope segment,
   and it is the difference between a kit being usable under Lesson 3 and
   being a toy. A kit meant to sustain — the sub — simply declares no decay,
   and then the organ is the point. */
function samplePlay(freq, at, dur, v, held){
  if (!ctx || !ctx.createBufferSource) return false;
  var s = nearestSample(voiceSamples(v || 0), freq);
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

/* ---- boot ----
   The shelf is read, so the rails can say what is on it, and then only what
   the page in hand actually wears is fetched. Loading every kit either rail
   can name was the first shape of this, and it was wrong the moment a kit
   stopped being small: the recut piano alone is two megabytes, and pulling
   it in at boot is two megabytes and a decode nobody asked for. Everything
   else arrives the first time a voice wants it — from voiceSamples, or from
   the rail as it is walked. Over file:// nothing is fetched and every rail
   reads "not here". */
function toneBoot(){
  if (!canFetch()) return;
  fetchShelf(function(){
    for (var v = 0; v < VOICES; v++) loadKit(docTone(doc, v), refreshTones);
    refreshTones();
  });
}
/* a kit arriving changes what the rails say, and nothing else on the page */
function refreshTones(){
  if (typeof settingsEl !== "undefined" && settingsEl &&
      settingsEl.classList.contains("on")) renderSettings();
}
