/* Folio — the build for the shared copy.

   There is no build step for the folio itself; there is only a choice of
   what leaves the repository. This copies that short list into ./dist:

     folio.html              -> dist/index.html
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
  ["auditor.html", "auditor.html"],
  ["folio-forest.png", "folio-forest.png"],
  ["folio-sea.png", "folio-sea.png"],
  ["folio-paper.png", "folio-paper.png"],
  ["quests/quest-log.json", "quests/quest-log.json"]
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
console.log("dist/ is ready");
