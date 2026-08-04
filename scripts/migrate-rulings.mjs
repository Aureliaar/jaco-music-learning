/* Folio — the rulings, moved out of the quest log. Once.

   The verdicts used to ride in quests/quest-log.json as a `done` flag beside
   each quest, in the same file the open tab rewrites whole every few seconds
   — so a ruling written from a terminal was saved away again by the next
   autosave. They live in quests/rulings.json now, which the folio only ever
   reads. This walks the flags across, and takes them out of the log.

   Run it with the tab CLOSED (the tab wins any race it is in):

     node scripts/migrate-rulings.mjs
     node scripts/migrate-rulings.mjs <log.json> <rulings.json>

   It is safe to run twice: an existing rulings file is merged into, never
   replaced, and a log with no flags left in it is not rewritten at all.
   Nothing is deleted but the flags, and every other byte of the log is left
   exactly as it was, field order and all.
*/
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const LOG  = process.argv[2] || path.join(ROOT, "quests", "quest-log.json");
const RULE = process.argv[3] || path.join(path.dirname(LOG), "rulings.json");

const log = JSON.parse(await fs.readFile(LOG, "utf8"));
if (!log || typeof log !== "object" || Array.isArray(log))
  throw new Error(LOG + " is not a quest log");

let rulings = { folio:"rulings", version:1, complete:{} };
try {
  const had = JSON.parse(await fs.readFile(RULE, "utf8"));
  if (had && had.complete && typeof had.complete === "object" && !Array.isArray(had.complete))
    rulings.complete = had.complete;
} catch {}

const moved = [];
for (const id of Object.keys(log.quests || {})){
  const q = log.quests[id];
  if (!q || typeof q !== "object" || !("done" in q)) continue;
  if (q.done) { rulings.complete[id] = true; moved.push(id); }
  delete q.done;
}

await fs.writeFile(RULE, JSON.stringify(rulings, null, 2) + "\n", "utf8");
await fs.writeFile(LOG, JSON.stringify(log, null, 2) + "\n", "utf8");
console.log("  " + moved.length + " ruling(s) moved: " + (moved.join(", ") || "none"));
console.log("  " + Object.keys(rulings.complete).length + " complete in " + RULE);
console.log("  the flags are out of " + LOG);
