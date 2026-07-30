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

const sharedLogPath = path.join(DIST, "quests", "quest-log.json");
const sharedLog = JSON.parse(await fs.readFile(sharedLogPath, "utf8"));
for (const id of COMPLETED_QUESTS){
  if (sharedLog.quests?.[id]) sharedLog.quests[id].done = true;
}
await fs.writeFile(sharedLogPath, JSON.stringify(sharedLog, null, 2) + "\n", "utf8");
console.log("  marked " + COMPLETED_QUESTS.length + " completed quests in the shared snapshot");
console.log("dist/ is ready");
