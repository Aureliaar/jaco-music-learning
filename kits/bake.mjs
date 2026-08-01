/* Folio — kits/bake.mjs : where the shelf's kits come from.

   The kits are checked in, which means somebody has to be able to say where
   they came from. This is that answer, and it is the whole answer: every
   sample on the shelf but `piano/` is arithmetic, written by this file, with
   no material from anywhere else and no dependency but Node itself.

     node kits/bake.mjs            bake them all, over the top
     node kits/bake.mjs pluck sub  bake only those

   What it bakes:

     music-box   a struck bell — a sine and three quiet inharmonic partials,
                 the high ones dying first, looped on the tail it settles to
     pluck       Karplus-Strong: noise round a delay line that averages
                 itself quieter, which is a plucked string for the price of
                 an array
     pluck-bass  the same string, long and dark, at bass roots
     sub         a sine with a little of the octave and the twelfth in it,
                 rendered on whole cycles so its loop is seamless by
                 construction, and left to sustain

   The arithmetic is the deleted js/scriptorium.js's, from the days when the
   kits were made in a room with dials in it: the same generators, the same
   one-pole lowpass, the same linear resample, the same loop-splice at a
   rising zero crossing. It was ported here rather than shared because the
   page has no business carrying a foundry it never opens, and a bake script
   has no business being loaded by a page. What survived into the page is
   js/tones.js: the WAV read, the shelf, and the sampled voice.

   Every kit is PCM16 mono at 11025 Hz — what the era wrote, and what makes
   the budget arithmetic trivial: two bytes a frame. The honour budget is
   64KB of samples a kit, and the script says what it spent. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RATE = 11025;                  /* what is written */
const WORK = 44100;                  /* what is rendered, before the cut */
const BUDGET = 65536;

/* ================= the WAV, written =================
   PCM16 mono and nothing else, the same forty-four byte header the app
   reads back. */
function encodeWAV(data, rate){
  const n = data.length, bytes = n * 2, out = new Uint8Array(44 + bytes);
  const dv = new DataView(out.buffer);
  const tag = (at, s) => { for (let i = 0; i < s.length; i++) out[at + i] = s.charCodeAt(i); };
  tag(0, "RIFF");  dv.setUint32(4, 36 + bytes, true);
  tag(8, "WAVEfmt ");
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true);
  dv.setUint16(22, 1, true);
  dv.setUint32(24, rate, true);
  dv.setUint32(28, rate * 2, true);
  dv.setUint16(32, 2, true);
  dv.setUint16(34, 16, true);
  tag(36, "data"); dv.setUint32(40, bytes, true);
  for (let i = 0; i < n; i++){
    const s = Math.max(-1, Math.min(1, data[i]));
    dv.setInt16(44 + i * 2, Math.round(s * 32767), true);
  }
  return out;
}

/* ================= the arithmetic ================= */
const NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const midiFreq = m => 440 * Math.pow(2, (m - 69) / 12);
function nameOfMidi(m){
  const o = Math.floor(m / 12) - 1;
  return NAMES[m - (o + 1) * 12] + o;
}
function normalize(data, peakTo = 0.92){
  let peak = 0;
  for (let i = 0; i < data.length; i++){ const a = Math.abs(data[i]); if (a > peak) peak = a; }
  if (peak > 0.0001){ const g = peakTo / peak; for (let i = 0; i < data.length; i++) data[i] *= g; }
  return data;
}
/* a one-pole lowpass, the only filter here, used to take the edge off and to
   keep the downsample from folding what it cannot carry */
function lowpass(data, rate, cut){
  const a = Math.exp(-2 * Math.PI * cut / rate);
  let y = 0;
  for (let i = 0; i < data.length; i++){ y = (1 - a) * data[i] + a * y; data[i] = y; }
  return data;
}
/* linear resampling, which is what the hardware did and what makes the grain */
function resample(data, from, to){
  if (!from || !to || from === to) return data;
  const n = Math.max(1, Math.round(data.length * to / from));
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++){
    const x = i * from / to, i0 = Math.floor(x), f = x - i0;
    const a = data[i0] || 0, b = data[i0 + 1] === undefined ? a : data[i0 + 1];
    out[i] = a + (b - a) * f;
  }
  return out;
}
/* a loop over the late sustain: whole cycles of the root, ending at a rising
   zero crossing, so the splice does not click.

   The end is found the way the old room's op found it. The start is not: a
   period rounded to whole frames drifts, so "a whole number of cycles back"
   lands beside the matching phase rather than on it, and on a low root that
   near-miss is the click. So the start is searched for instead — a window of
   one period around where the arithmetic put it, taking whichever frame
   makes the smallest step, in level and in slope, against the end — which
   keeps the loop a whole number of cycles to within the frame the rounding
   costs. It is not the guarantee, though: the page crossfades every loop
   seam once at load, because no splice in an inharmonic sound is ever
   clean. This only makes that crossfade's job small. */
function autoLoop(data, rate, midi){
  const cyc = Math.max(2, Math.round(rate / midiFreq(midi)));
  let end = Math.min(data.length - 2, Math.round(data.length * 0.94));
  while (end > cyc * 4 && !(data[end - 1] <= 0 && data[end] > 0)) end--;
  const cycles = Math.max(2, Math.round(rate * 0.06 / cyc));
  const want = end - cycles * cyc;
  if (want < 1) return { loopStart: 0, loopEnd: Math.min(data.length, cyc * 2) };
  let start = want, best = Infinity;
  for (let i = Math.max(1, want - cyc); i <= want + cyc && i < end - cyc; i++){
    const cost = Math.abs(data[i] - data[end]) +
                 Math.abs((data[i + 1] - data[i]) - (data[end + 1] - data[end]));
    if (cost < best){ best = cost; start = i; }
  }
  return { loopStart: start, loopEnd: end };
}

/* ---- a struck bell: the music box ----
   Four partials, slightly out of tune with each other as a struck bar is,
   the high ones giving up first. The envelope is deliberately gentle: the
   player's hold imposes its own decay over the top of this one, so a sample
   that had already died by its loop point would be inaudible when held. */
function genBell(midi, len, rate){
  const f = midiFreq(midi), n = Math.round(rate * len);
  const parts = [[1, 1, 1.1], [2.01, 0.42, 2.6], [3.02, 0.22, 4.4], [4.96, 0.09, 7.0]];
  const data = new Float32Array(n);
  for (const [ratio, amp, fall] of parts){
    const w = 2 * Math.PI * f * ratio / rate;
    for (let i = 0; i < n; i++)
      data[i] += amp * Math.sin(w * i) * Math.exp(-(i / rate) * fall);
  }
  return normalize(data);
}
/* ---- Karplus-Strong ----
   A burst of noise round a delay line that averages itself quieter. `damp`
   is how much of it survives each trip: below a half it dies, and the closer
   to a half the longer the string rings. */
function genPluck(midi, len, rate, bright, damp, seed){
  const f = midiFreq(midi);
  const N = Math.max(2, Math.round(rate / f));
  const n = Math.round(rate * len);
  const data = new Float32Array(n), buf = new Float32Array(N);
  let s = seed >>> 0;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 * 2 - 1; };
  for (let i = 0; i < N; i++) buf[i] = rnd();
  lowpass(buf, rate, bright);
  let p = 0;
  for (let i = 0; i < n; i++){
    const cur = buf[p];
    data[i] = cur;
    buf[p] = (cur + buf[(p + 1) % N]) * damp;
    p = (p + 1) % N;
  }
  return normalize(data);
}
/* ---- a periodic wave, on whole cycles ----
   Rendered so that the number of frames is an exact multiple of the period:
   the loop it comes with is then seamless by construction rather than by
   search, and the whole sample costs a few kilobytes. */
function genPeriodic(midi, cycles, rate, partials){
  const f = midiFreq(midi);
  const cyc = Math.max(2, Math.round(rate / f));
  const n = cyc * cycles;
  const data = new Float32Array(n);
  for (let i = 0; i < n; i++){
    const p = 2 * Math.PI * (i % cyc) / cyc;
    let v = 0;
    for (let k = 0; k < partials.length; k++) v += partials[k] * Math.sin((k + 1) * p);
    data[i] = v;
  }
  normalize(data);
  /* the loop is the whole sample. It is whole cycles, so the wrap is exact,
     and a loop that starts at frame nought is also the one case the page's
     load-time seam crossfade steps back from — which is right, because there
     is no seam here to soften and softening it would only put a swell in a
     tone that is meant to sit perfectly still. */
  return { data, cyc, loopStart: 0, loopEnd: n };
}

/* ---- the cut every sample goes through ----
   Rendered at 44100, filtered so the downsample has nothing to fold, then
   resampled to the rate that is written. */
function down(data){
  lowpass(data, WORK, RATE * 0.42);
  return normalize(resample(data, WORK, RATE), 0.92);
}

/* ================= the kits =================
   Each entry says what the kit is for and what is in it. `decay` is the
   imposed decay the app puts over a held note — the piano trick — and is
   written into the manifest, not into the samples. */
const KITS = {
  "music-box": {
    voice: "lead",
    note: "a struck bell: sine and three quiet inharmonic partials, the high ones first to go",
    samples: [48, 60, 72].map(root => ({
      root, decay: 3.4, len: 0.55,
      source: "the foundry · bell partials 1 · 2.01 · 3.02 · 4.96",
      make(){ return down(genBell(root, 0.55, WORK)); }
    }))
  },
  "pluck": {
    voice: "lead",
    note: "Karplus-Strong: a noise burst round a delay line, bright and short",
    samples: [48, 60, 72].map((root, i) => ({
      root, decay: 2.2, len: 0.5,
      source: "the foundry · Karplus-Strong · damp 0.497",
      make(){ return down(genPluck(root, 0.5, WORK, 5200, 0.497, 20260802 + i)); }
    }))
  },
  "pluck-bass": {
    voice: "bass",
    note: "the same string, longer and darker, at bass roots",
    samples: [28, 36, 45].map((root, i) => ({
      root, decay: 2.8, len: 0.62,
      source: "the foundry · Karplus-Strong · damp 0.4985 · dark",
      make(){ return down(genPluck(root, 0.62, WORK, 1400, 0.4985, 8802 + i)); }
    }))
  },
  "sub": {
    voice: "bass",
    note: "a sine with a little octave and twelfth in it, on whole cycles, left to sustain",
    samples: [28, 40].map(root => ({
      root, decay: 0, periodic: true,
      source: "the foundry · sine + 0.17 octave + 0.06 twelfth",
      make(){
        /* whole cycles at the written rate, so the loop needs no search */
        return genPeriodic(root, 24, RATE, [1, 0.17, 0.06]);
      }
    }))
  }
};

/* ================= the manifest =================
   One line per sample, readable as prose and parsed by the app: the root,
   the rate, the length, the bytes, the loop, the imposed decay, and where
   the material came from. `js/tones.js` reads it back. */
function manifestLine(s){
  const bits = ["root " + nameOfMidi(s.root), s.rate + " Hz",
                (s.frames / s.rate).toFixed(2) + " s", s.bytes + " B"];
  if (s.loopEnd > s.loopStart) bits.push("loop " + s.loopStart + "–" + s.loopEnd);
  if (s.decay > 0) bits.push("decay " + s.decay.toFixed(1) + " s");
  let line = "- `" + s.file + "` — " + bits.join(" · ");
  if (s.source) line += " · source: " + s.source;
  return line;
}
function manifestText(kit, spec, rows){
  const out = ["# kit: " + kit, "",
               spec.note + ". The " + spec.voice + "'s rail offers it.", "",
               "Baked by `kits/bake.mjs` — arithmetic only, nothing sampled from",
               "anywhere. One line per sample. The budget is 64KB of samples; this",
               "file is the label on the drawer and is not counted against it.", ""];
  for (const r of rows) out.push(manifestLine(r));
  return out.join("\n") + "\n";
}

/* ================= bake ================= */
function bake(name){
  const spec = KITS[name];
  const dir = path.join(HERE, name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const rows = [];
  let used = 0;
  for (const s of spec.samples){
    const made = s.make();
    const data = made.data || made;
    const loop = made.loopStart !== undefined
      ? { loopStart: made.loopStart, loopEnd: made.loopEnd }
      : autoLoop(data, RATE, s.root);
    const wav = encodeWAV(data, RATE);
    const file = name + "-" + nameOfMidi(s.root).toLowerCase().replace("#", "s") + ".wav";
    fs.writeFileSync(path.join(dir, file), wav);
    used += wav.length;
    rows.push({ file, root: s.root, rate: RATE, frames: data.length, bytes: wav.length,
                loopStart: loop.loopStart, loopEnd: loop.loopEnd,
                decay: s.decay, source: s.source });
  }
  rows.sort((a, b) => a.root - b.root);
  fs.writeFileSync(path.join(dir, "manifest.md"), manifestText(name, spec, rows), "utf8");
  const over = used > BUDGET;
  console.log(name.padEnd(11) + " " + String(rows.length) + " samples · " +
              String(used).padStart(6) + " B of " + BUDGET +
              (over ? "  ** OVER THE BUDGET **" : ""));
  for (const r of rows)
    console.log("            " + r.file + " · root " + nameOfMidi(r.root) +
                " · " + (r.frames / r.rate).toFixed(2) + " s · " + r.bytes + " B" +
                (r.loopEnd > r.loopStart ? " · loop " + r.loopStart + "–" + r.loopEnd : "") +
                (r.decay ? " · decay " + r.decay.toFixed(1) + " s" : " · no decay"));
  return over ? 1 : 0;
}

const want = process.argv.slice(2);
const list = want.length ? want : Object.keys(KITS);
let bad = 0;
for (const n of list){
  if (!KITS[n]){ console.log("no such kit: " + n); bad = 1; continue; }
  bad |= bake(n);
}
process.exit(bad);
