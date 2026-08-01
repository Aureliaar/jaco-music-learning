/* Folio — the build for the shared copy.

   There is no build step for the folio itself; there is only a choice of
   what leaves the repository. This copies that short list into ./dist:

     folio.html              -> dist/index.html
     folio.css               -> dist/folio.css               (the whole look)
     js/*.js                 -> dist/js/*.js                 (the app itself)
     kits/<kit>/             -> dist/kits/<kit>/             (the tones' samples)
     auditor.html            -> dist/auditor.html            (the blind lineup)
     quests/quest-log.json   -> dist/quests/quest-log.json   (the seed)
     folio-forest.png        -> dist/folio-forest.png        (quiet scenery)
     folio-sea.png           -> dist/folio-sea.png           (quiet scenery)
     folio-paper.png         -> dist/folio-paper.png         (the torn sheet)

   Everything else — CURRICULUM.md, QUESTS.md, BUDGET.md, SPEC-LESSON-0.md,
   server.mjs — stays here. Run it with plain Node, no dependencies:

     node scripts/build.mjs
*/
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIST = path.join(ROOT, "dist");

const FILES = [
  ["folio.html", "index.html"],
  /* the instrument is eight plain scripts and one stylesheet since the split;
     folio.html names them, and they travel with it or it does nothing */
  ["folio.css", "folio.css"],
  ["js/state.js", "js/state.js"],
  ["js/views.js", "js/views.js"],
  ["js/audio.js", "js/audio.js"],
  ["js/edit.js", "js/edit.js"],
  ["js/quests.js", "js/quests.js"],
  ["js/tones.js", "js/tones.js"],
  ["js/entry.js", "js/entry.js"],
  ["js/boot.js", "js/boot.js"],
  ["auditor.html", "auditor.html"],
  ["folio-forest.png", "folio-forest.png"],
  ["folio-sea.png", "folio-sea.png"],
  ["folio-paper.png", "folio-paper.png"],
  ["quests/quest-log.json", "quests/quest-log.json"]
];

/* The local log is an actively edited workspace file. Its `done` flags are
   allowed to reflect the open composing session, while the shared copy is a
   showcase of the completions recorded in QUESTS.md. Apply those marks only
   to dist so an open local tab cannot clobber the published archive. */
const COMPLETED_QUESTS = [
  "ladder", "whitespace", "summit", "stones", "ouroboros",
  "callanswer", "stray", "shadow", "ostinato", "drone", "oilwater"
];

await fs.rm(DIST, { recursive: true, force: true });
await fs.mkdir(DIST, { recursive: true });

for (const [from, to] of FILES){
  const src = path.join(ROOT, from);
  const dst = path.join(DIST, to);
  try { await fs.access(src); }
  catch {
    if (to === "index.html") throw new Error("missing " + from);
    console.log("  (skipped " + from + " — not present)");
    continue;
  }
  await fs.mkdir(path.dirname(dst), { recursive: true });
  await fs.copyFile(src, dst);
  console.log("  " + from + " -> dist/" + to);
}

/* The per-workspace scenery: quest-backgrounds/<id>.png, one per quest or
   drill that has one. The page never holds a list of these names — it asks
   for the file and falls back to paper if it is not there — so the whole
   folder travels, and an id with no picture is simply an id with no picture
   on the shared copy too. */
const BG = "quest-backgrounds";
try {
  const names = (await fs.readdir(path.join(ROOT, BG))).filter(n => n.endsWith(".png")).sort();
  await fs.mkdir(path.join(DIST, BG), { recursive: true });
  for (const n of names)
    await fs.copyFile(path.join(ROOT, BG, n), path.join(DIST, BG, n));
  console.log("  " + BG + "/ -> dist/" + BG + "/ (" + names.length + " stills)");
} catch {
  console.log("  (skipped " + BG + "/ — not present)");
}

/* The kits the two tone rails name. A dumb host has no /api/kits to list
   them, so the page falls back to asking each kit for its manifest.md by
   name off the disk — which is why the folders travel whole, samples and
   label together, and why nothing here needs an index. bake.mjs stays home:
   the shared copy plays kits, it does not make them. */
const KITS = "kits";
try {
  const dirs = (await fs.readdir(path.join(ROOT, KITS), { withFileTypes: true }))
                 .filter(e => e.isDirectory()).map(e => e.name).sort();
  let n = 0;
  for (const d of dirs){
    const names = (await fs.readdir(path.join(ROOT, KITS, d)))
                    .filter(f => f.endsWith(".wav") || f === "manifest.md").sort();
    if (!names.length) continue;
    await fs.mkdir(path.join(DIST, KITS, d), { recursive: true });
    for (const f of names){
      await fs.copyFile(path.join(ROOT, KITS, d, f), path.join(DIST, KITS, d, f));
      n++;
    }
  }
  console.log("  " + KITS + "/ -> dist/" + KITS + "/ (" + dirs.length + " kits, " + n + " files)");
} catch {
  console.log("  (skipped " + KITS + "/ — not present)");
}

const sharedLogPath = path.join(DIST, "quests", "quest-log.json");
const sharedLog = JSON.parse(await fs.readFile(sharedLogPath, "utf8"));
for (const id of COMPLETED_QUESTS){
  if (sharedLog.quests?.[id]) sharedLog.quests[id].done = true;
}
await fs.writeFile(sharedLogPath, JSON.stringify(sharedLog, null, 2) + "\n", "utf8");
console.log("  marked " + COMPLETED_QUESTS.length + " completed quests in the shared snapshot");
console.log("dist/ is ready");
