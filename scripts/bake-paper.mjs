/* bake-paper.mjs — bakes folio-paper.png, the torn sheet the folio lies on
   when a scenery is chosen.

   The sheet is one image: a flat parchment ground, very slightly toned, with a
   deckled boundary torn out of it by two Theory of Magic noises —

     T_Noise_Smoke_MottledCloud_023   the slow wander of the tear
     T_Noise_Smoke_FibrousSheet_A10   the fray itself, its raggedness
                                      spatially modulated by a second,
                                      decorrelated pass of the cloud, so that
                                      cut and torn stretches alternate

   The interior is smooth on purpose: baked grain was invisible at display
   scale and quintupled the file.

   Zero dependencies: the compositing runs in headless Chrome (canvas), driven
   by tests/cdp.mjs, because Node alone cannot decode a PNG.

   Run:  node scripts/bake-paper.mjs
         node scripts/bake-paper.mjs --ground #E3D7C0 --out folio-paper.png
         node scripts/bake-paper.mjs --noises D:/somewhere/Noises

   The measured profile of the sheet this bakes (and of the one before it):
   tear depth 30–60 px out of 1280, median ~48, the alpha crossing ~8 px wide. */

import { launch, newPage, close } from "../tests/cdp.mjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");

/* ---- the dials ---- */
const DEFAULTS = {
  /* the parchment ground. One dab darker than the first bake's #EAE0CC:
     the sheet had to sit down a step against the sceneries. */
  ground: "#E3D7C0",
  size: 1280,
  /* the tear band, in pixels of the baked image: t = 0 at the image edge,
     t = 1 this far in. Everything below happens inside it. */
  band: 78,
  base: 0.60,        /* where the tear sits in the band, on average */
  wander: 0.36,      /* how far the cloud walks it (±0.18 → ±14 px) */
  fray: 0.30,        /* how far the fibres tear it, at full raggedness */
  raggedFloor: 0.30, /* raggedness never falls below this: a cut stretch */
  soft: 0.05,        /* half-width of the alpha crossing (→ ~8 px) */
  tone: 0.016        /* the worn toning, as a fraction of the ground */
};

const NOISES = process.env.FOLIO_NOISES ||
  "E:/experiments/theoryofmagic/sourceimgs/Textures/Noises";

/* ---- arguments ---- */
const opt = { ...DEFAULTS, out: path.join(REPO, "folio-paper.png"), noises: NOISES };
for (let i = 2; i < process.argv.length; i += 2){
  const k = process.argv[i].replace(/^--/, "");
  const v = process.argv[i + 1];
  if (!(k in opt)) throw new Error("unknown option --" + k);
  opt[k] = typeof DEFAULTS[k] === "number" ? Number(v) : v;
}

const CLOUD = path.join(opt.noises, "T_Noise_Smoke_MottledCloud_023.PNG");
const FIBRE = path.join(opt.noises, "T_Noise_Smoke_FibrousSheet_A10.PNG");
for (const f of [CLOUD, FIBRE])
  if (!fs.existsSync(f))
    throw new Error("noise not found: " + f + "\n  set FOLIO_NOISES or pass --noises");

const dataURL = f => "data:image/png;base64," + fs.readFileSync(f).toString("base64");

const browser = await launch(9391);
try {
  const page = await newPage(browser);
  await page.eval(`window.__cloud=${JSON.stringify(dataURL(CLOUD))};
                   window.__fibre=${JSON.stringify(dataURL(FIBRE))};1`);

  const png = await page.eval(`(async function(){
    const O = ${JSON.stringify(opt)};
    const N = O.size;

    /* a noise, stretched over the whole sheet and read as luminance 0..1 */
    async function grey(src){
      const img = new Image(); img.src = src; await img.decode();
      const c = document.createElement("canvas"); c.width = N; c.height = N;
      const g = c.getContext("2d", { willReadFrequently:true });
      g.drawImage(img, 0, 0, N, N);
      const d = g.getImageData(0, 0, N, N).data;
      const out = new Float32Array(N * N);
      for (let i = 0, p = 0; i < out.length; i++, p += 4)
        out[i] = (0.2126*d[p] + 0.7152*d[p+1] + 0.0722*d[p+2]) / 255;
      return out;
    }
    const cloud = await grey(window.__cloud);
    const fibre = await grey(window.__fibre);

    /* the same cloud read from three orientations: one field, three
       decorrelated passes — the wander, the raggedness, and the toning */
    const at   = (f, x, y) => f[y * N + x];
    const rot  = (f, x, y) => f[x * N + (N - 1 - y)];
    const flip = (f, x, y) => f[(N - 1 - y) * N + (N - 1 - x)];

    const smooth = (a, b, t) => {
      if (t <= a) return 0; if (t >= b) return 1;
      const u = (t - a) / (b - a);
      return u * u * (3 - 2 * u);
    };

    const hex = O.ground.replace("#", "");
    const G = [parseInt(hex.slice(0,2),16), parseInt(hex.slice(2,4),16), parseInt(hex.slice(4,6),16)];

    const c = document.createElement("canvas"); c.width = N; c.height = N;
    const g = c.getContext("2d");
    const im = g.createImageData(N, N);
    const d = im.data;

    for (let y = 0; y < N; y++){
      const dy = Math.min(y, N - 1 - y) / O.band;
      for (let x = 0; x < N; x++){
        const dx = Math.min(x, N - 1 - x) / O.band;
        const t = Math.min(dx, dy);
        const i = (y * N + x) * 4;

        /* the boundary: base, walked by the cloud, torn by the fibres, the
           tearing itself let up and pressed on by a second cloud pass */
        const ragged = O.raggedFloor + (1 - O.raggedFloor) * rot(cloud, x, y);
        let th = O.base
               + O.wander * (at(cloud, x, y) - 0.5)
               + O.fray * ragged * (at(fibre, x, y) - 0.5);
        if (th < 0.05) th = 0.05; if (th > 0.95) th = 0.95;

        const a = smooth(th - O.soft, th + O.soft, t);
        if (a <= 0){ d[i+3] = 0; continue; }

        /* the worn toning, breathing on the third pass */
        const k = 1 + O.tone * (flip(cloud, x, y) - 0.5) * 2;
        d[i]   = Math.max(0, Math.min(255, Math.round(G[0] * k)));
        d[i+1] = Math.max(0, Math.min(255, Math.round(G[1] * k)));
        d[i+2] = Math.max(0, Math.min(255, Math.round(G[2] * k)));
        d[i+3] = Math.round(a * 255);
      }
    }
    g.putImageData(im, 0, 0);
    return c.toDataURL("image/png");
  })()`);

  const buf = Buffer.from(png.split(",")[1], "base64");
  fs.writeFileSync(opt.out, buf);
  console.log("baked " + opt.out + "  ground " + opt.ground +
              "  " + opt.size + "x" + opt.size + "  " + Math.round(buf.length/1024) + " KB");
} finally {
  await close(browser);
}
