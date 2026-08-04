/* Folio — the local server.

   A tiny, dependency-free Node server so that the quest log can live in a
   real file that agents, collaborators and backups can see. It serves the
   root folio, its quiet scenery images and torn paper sheet, and the
   quest log.

   Run it:   folio.cmd            (or)   node server.mjs
   Then go:  http://localhost:4173
   Family:   node server.mjs --lan       (binds every interface)

   `file://` keeps working exactly as before, without the sync. */

import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";                 /* core module, only for the LAN URL */
import crypto from "node:crypto";         /* core module, only for the ETag */
import { fileURLToPath } from "node:url";

const ROOT     = path.dirname(fileURLToPath(import.meta.url));
/* The log lives beside the folio, in quests/. FOLIO_LOG moves it and nothing
   else — the pages, the scenery and the stills are still served from the repo
   root. It exists so that a test run can drive a real server against a real
   log in a temp directory instead of writing over the player's own; the file
   in quests/ is their work, and a harness must never touch it. */
const LOG_FILE = process.env.FOLIO_LOG || path.join(ROOT, "quests", "quest-log.json");
/* The rulings: which quests are closed. They are not the tab's to own — a
   quest is closed by evaluation, written here from a terminal — so they live
   apart from the log the tab rewrites wholesale every few seconds, and the
   tab can never take one back by saving its music over it. FOLIO_RULINGS
   moves the file exactly as FOLIO_LOG moves the log, and for the same
   reason: a harness writes its own and never the player's. */
const RULE_FILE = process.env.FOLIO_RULINGS || path.join(ROOT, "quests", "rulings.json");
const MAX_ID = 60;                        /* an id is a name, never prose */
/* The kits the scriptorium curates: one folder per kit, the samples in it and
   a manifest.md beside them. FOLIO_KITS moves the shelf the same way FOLIO_LOG
   moves the log, and for the same reason — a harness writes its own kits in a
   temp directory and never the player's. */
const KITS_DIR = process.env.FOLIO_KITS || path.join(ROOT, "kits");

const args = process.argv.slice(2);
const LAN  = args.includes("--lan");
const PORT = Number(process.env.PORT) || 4173;
const HOST = LAN ? "0.0.0.0" : "127.0.0.1";

const INDEX = "folio.html";
const MAX_BODY = 4 * 1024 * 1024;         /* a quest log is kilobytes; this is generous */
/* A whole kit is meant to fit in 64KB. One file is capped four times higher —
   generous enough that a sample can be saved before it has been cut down, mean
   enough that nothing ruinous can be pushed through the endpoint by accident. */
const MAX_KIT_FILE = 256 * 1024;
const KIT_BUDGET   = 64 * 1024;           /* the honour-system budget, stated plainly */
const KIT_NAME = /^[a-z0-9][a-z0-9 _-]{0,31}$/i;
const KIT_LEAF = /^[a-z0-9][a-z0-9 ._-]{0,47}\.(wav|md)$/i;

/* Only these are served, and only from the repo root or from one of the
   named folders below it: js/, which is the app itself since folio.html was
   split, and quest-backgrounds/, which is the workspaces' stills. Everything
   else — the markdown, the git directory, the tests, the quest log as a file
   — is not web content and is not offered as such. */
const STATIC_DIRS = ["js", "quest-backgrounds"];
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js":   "text/javascript; charset=utf-8",
  ".mjs":  "text/javascript; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg":  "image/svg+xml",
  ".png":  "image/png",
  ".ico":  "image/x-icon"
};

function log(req, status){
  console.log(req.method + " " + req.url + " " + status);
}
function send(req, res, status, body, type, extra){
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(body ?? "");
  res.writeHead(status, Object.assign({
    "content-type": type || "text/plain; charset=utf-8",
    "content-length": buf.length,
    "cache-control": "no-store"
  }, extra || {}));
  res.end(req.method === "HEAD" ? undefined : buf);
  log(req, status);
}

/* ---- the quest log ---- */

/* The log carries an ETag so that the page can poll it for changes — a drill
   delivered into the file arrives in an open tab that way — without paying
   for the file every ten seconds. The tag is the content, hashed: identical
   bytes are identical tags, whatever the mtime says. */
function etagOf(text){
  return '"' + crypto.createHash("sha1").update(text).digest("hex").slice(0, 32) + '"';
}

async function getLog(req, res){
  let text;
  try { text = await fs.readFile(LOG_FILE, "utf8"); }
  catch {
    /* 404, but in JSON on purpose: this is how the page tells a real server
       with no log yet (keep syncing — ours becomes the log) apart from a
       static host with no /api at all (read-only copy). */
    send(req, res, 404, '{"folio":"quest-log","absent":true}\n', MIME[".json"]);
    return;
  }
  const tag = etagOf(text);
  if (req.headers["if-none-match"] === tag){
    res.writeHead(304, { "etag": tag, "cache-control": "no-store" }).end();
    log(req, 304);
    return;
  }
  send(req, res, 200, text, MIME[".json"], { "etag": tag });
}

/* write beside it, then rename: a reader never sees half a file */
async function writeAtomic(file, text){
  const tmp = file + "." + process.pid + "." + Date.now() + ".tmp";
  try {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(tmp, text, "utf8");
    await fs.rename(tmp, file);
  } catch (e){
    try { await fs.unlink(tmp); } catch {}
    return e;
  }
  return null;
}

/* ---- the rulings, read and merged one id at a time ----
   The shape is deliberately the smallest thing that can carry a verdict:

     { "folio":"rulings", "version":1, "complete": { "<quest id>": true } }

   A PUT names only the ids it has something to say about, and every other id
   on disk is left exactly as it was. That is the whole guard: a tab that has
   never heard of a ruling written a second ago cannot un-say it, because it
   never mentions it. Saying `false` is a retraction, and only something that
   knows the id can send one. */
async function getRulings(req, res){
  let text;
  try { text = await fs.readFile(RULE_FILE, "utf8"); }
  catch {
    /* JSON again, and for the same reason the log's 404 is: it tells a real
       server with nothing ruled yet from a static host with no /api at all */
    send(req, res, 404, '{"folio":"rulings","absent":true}\n', MIME[".json"]);
    return;
  }
  const tag = etagOf(text);
  if (req.headers["if-none-match"] === tag){
    res.writeHead(304, { "etag": tag, "cache-control": "no-store" }).end();
    log(req, 304);
    return;
  }
  send(req, res, 200, text, MIME[".json"], { "etag": tag });
}

function completeMap(o){
  return (o && typeof o.complete === "object" && o.complete &&
          !Array.isArray(o.complete)) ? o.complete : null;
}

async function putRulings(req, res){
  let text, obj;
  try { text = await readBody(req); }
  catch { send(req, res, 413, "too large"); return; }
  try { obj = JSON.parse(text); }
  catch { send(req, res, 400, "not JSON"); return; }
  if (!obj || typeof obj !== "object" || Array.isArray(obj) || obj.folio !== "rulings"){
    send(req, res, 400, 'not a rulings file (expects "folio": "rulings")');
    return;
  }
  const inc = completeMap(obj);
  if (!inc){ send(req, res, 400, 'not a rulings file (expects "complete")'); return; }
  let disk = null;
  try { disk = JSON.parse(await fs.readFile(RULE_FILE, "utf8")); } catch { disk = null; }
  const out = {};
  const had = completeMap(disk);
  if (had) for (const id of Object.keys(had)) out[id] = !!had[id];
  for (const id of Object.keys(inc)){
    if (!id || id.length > MAX_ID) continue;
    out[id] = !!inc[id];
  }
  const text2 = JSON.stringify({ folio:"rulings", version:1, complete: out }, null, 2) + "\n";
  const err = await writeAtomic(RULE_FILE, text2);
  if (err){ send(req, res, 500, "could not write the rulings: " + err.message); return; }
  res.writeHead(204, { "etag": etagOf(text2) }).end();
  log(req, 204);
}

function readBody(req){
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", c => {
      size += c.length;
      if (size > MAX_BODY){ reject(new Error("too large")); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end",   () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

/* ---- the kits ----

   `kits/<kit>/` holds the samples of one kit and the manifest.md that says
   what each of them is. They are served and written through /api/kits rather
   than as static files: a kit folder is two levels deep, which the static
   server deliberately cannot reach, and writing needs a door of its own
   anyway. Both halves of every path are checked against a whitelist pattern
   before anything touches the disk — a name that is not plainly a kit name or
   plainly a sample name is refused, not sanitised into something else. */
function badKitPath(kit, leaf){
  if (!KIT_NAME.test(kit || "")) return true;
  if (leaf === undefined) return false;
  if (!KIT_LEAF.test(leaf || "")) return true;
  return leaf.indexOf("..") >= 0;
}
function kitFile(kit, leaf){ return path.join(KITS_DIR, kit, leaf); }

/* what is on the shelf: every kit, its samples, their sizes, its manifest.
   The manifest is not counted against the budget — the budget is sample RAM,
   and the manifest is the label on the drawer. */
async function getKits(req, res){
  const kits = [];
  let entries = [];
  try { entries = await fs.readdir(KITS_DIR, { withFileTypes: true }); } catch { entries = []; }
  for (const d of entries){
    if (!d.isDirectory() || !KIT_NAME.test(d.name)) continue;
    const dir = path.join(KITS_DIR, d.name);
    const files = [];
    let bytes = 0, manifest = "";
    let leaves = [];
    try { leaves = await fs.readdir(dir); } catch { leaves = []; }
    for (const leaf of leaves.sort()){
      if (badKitPath(d.name, leaf)) continue;
      let st;
      try { st = await fs.stat(path.join(dir, leaf)); } catch { continue; }
      if (!st.isFile()) continue;
      if (leaf.toLowerCase() === "manifest.md"){
        try { manifest = await fs.readFile(path.join(dir, leaf), "utf8"); } catch {}
        continue;
      }
      files.push({ name: leaf, bytes: st.size });
      bytes += st.size;
    }
    kits.push({ name: d.name, bytes, files, manifest });
  }
  kits.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
  send(req, res, 200,
       JSON.stringify({ folio: "kits", budget: KIT_BUDGET, kits }, null, 2) + "\n",
       MIME[".json"]);
}

async function getKitFile(req, res, kit, leaf){
  let buf;
  try { buf = await fs.readFile(kitFile(kit, leaf)); }
  catch { send(req, res, 404, "not found"); return; }
  send(req, res, 200, buf,
       leaf.toLowerCase().endsWith(".wav") ? "audio/wav" : "text/markdown; charset=utf-8");
}

/* Reading a body that is too big is answered, not hung up on: the socket is
   let run to its end (discarding everything, and giving up entirely well past
   the cap) so that the browser reads the 413 instead of a broken connection.
   `null` is the answer meaning "too large". */
function readRaw(req, cap){
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0, over = false;
    req.on("data", c => {
      size += c.length;
      if (size > cap){
        over = true;
        chunks.length = 0;
        if (size > cap * 8) req.destroy();       /* that is not a sample at all */
        return;
      }
      chunks.push(c);
    });
    req.on("end",   () => resolve(over ? null : Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function putKitFile(req, res, kit, leaf){
  let buf;
  try { buf = await readRaw(req, MAX_KIT_FILE); }
  catch { send(req, res, 413, "too large"); return; }
  if (!buf){ send(req, res, 413, "too large"); return; }
  /* a sample is a RIFF/WAVE file or it is not a sample; the scriptorium writes
     nothing else, and neither does anything else get to */
  if (leaf.toLowerCase().endsWith(".wav") &&
      (buf.length < 44 || buf.toString("latin1", 0, 4) !== "RIFF" ||
       buf.toString("latin1", 8, 12) !== "WAVE")){
    send(req, res, 400, "not a WAVE file");
    return;
  }
  const file = kitFile(kit, leaf);
  const tmp  = file + "." + process.pid + "." + Date.now() + ".tmp";
  try {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(tmp, buf);       /* beside it, then rename: never half a sample */
    await fs.rename(tmp, file);
  } catch (e){
    try { await fs.unlink(tmp); } catch {}
    send(req, res, 500, "could not write the sample: " + e.message);
    return;
  }
  res.writeHead(204, { "x-folio-bytes": String(buf.length) }).end();
  log(req, 204);
}

async function deleteKitFile(req, res, kit, leaf){
  try { await fs.unlink(kitFile(kit, leaf)); }
  catch { send(req, res, 404, "not found"); return; }
  res.writeHead(204).end();
  log(req, 204);
}

function kits(req, res, pathname){
  if (pathname === "/api/kits" || pathname === "/api/kits/"){
    if (req.method === "GET" || req.method === "HEAD"){ getKits(req, res); return; }
    res.setHeader("allow", "GET");
    send(req, res, 405, "method not allowed");
    return;
  }
  let rest;
  try { rest = decodeURIComponent(pathname.slice("/api/kits/".length)); }
  catch { send(req, res, 400, "bad path"); return; }
  const cut = rest.indexOf("/");
  const kit = cut < 0 ? rest : rest.slice(0, cut);
  const leaf = cut < 0 ? undefined : rest.slice(cut + 1);
  if (leaf === undefined || badKitPath(kit, leaf)){ send(req, res, 403, "no"); return; }
  if (req.method === "GET" || req.method === "HEAD"){ getKitFile(req, res, kit, leaf); return; }
  if (req.method === "PUT"){ putKitFile(req, res, kit, leaf); return; }
  if (req.method === "DELETE"){ deleteKitFile(req, res, kit, leaf); return; }
  res.setHeader("allow", "GET, PUT, DELETE");
  send(req, res, 405, "method not allowed");
}

async function putLog(req, res){
  let text, obj;
  try { text = await readBody(req); }
  catch { send(req, res, 413, "too large"); return; }
  try { obj = JSON.parse(text); }
  catch { send(req, res, 400, "not JSON"); return; }
  if (!obj || typeof obj !== "object" || Array.isArray(obj) || obj.folio !== "quest-log"){
    send(req, res, 400, 'not a quest log (expects "folio": "quest-log")');
    return;
  }
  /* ---- drills are never lost to a stale tab ----
     A drill delivered into the file is meant to survive whatever the browser
     happens to push next. The page re-reads the file and sends the drills it
     knows back, so ordinarily nothing is at stake — but a tab that has not
     polled since the delivery would otherwise write the drill away. So:
     before overwriting, read what is on disk, and keep any drill whose id the
     incoming body does not mention. Nothing else on disk is preserved; a
     workspace and `active` belong to the page. The rulings are not in this
     file at all any more — they have one of their own, which is why a tab
     that saves its music can no longer save a verdict away with it. */
  let disk = null;
  try { disk = JSON.parse(await fs.readFile(LOG_FILE, "utf8")); } catch { disk = null; }
  if (disk && Array.isArray(disk.drills)){
    const incoming = Array.isArray(obj.drills) ? obj.drills : [];
    const have = new Set(incoming.map(d => d && d.id).filter(id => typeof id === "string"));
    const keep = disk.drills.filter(d => d && typeof d.id === "string" && !have.has(d.id));
    if (keep.length) obj.drills = incoming.concat(keep);
  }

  const text2 = JSON.stringify(obj, null, 2) + "\n";
  const err = await writeAtomic(LOG_FILE, text2);
  if (err){ send(req, res, 500, "could not write the log: " + err.message); return; }
  /* the tag of what was just written, so the page's next poll is a 304 */
  res.writeHead(204, { "etag": etagOf(text2) }).end();
  log(req, 204);
}

/* ---- static, root only, no traversal ---- */

async function serveStatic(req, res, pathname){
  let name;
  try { name = decodeURIComponent(pathname); }
  catch { send(req, res, 400, "bad path"); return; }

  if (name === "/") name = "/" + INDEX;
  /* nothing clever is allowed: no traversal, no NUL, no backslashes */
  if (name.indexOf("..") >= 0 || name.indexOf("\0") >= 0 || name.indexOf("\\") >= 0){
    send(req, res, 403, "no"); return;
  }
  const base = name.slice(1);
  if (!base){ send(req, res, 404, "not found"); return; }

  /* The two exceptions to "the root and nothing else": js/, which is the
     instrument since folio.html was split, and quest-backgrounds/, because
     twenty-two stills loose in the root would bury everything around them.
     Both are named explicitly, both are exactly one level deep, and the
     resolved file is still checked against its directory afterwards — the
     rest of the disk is as unreachable as it always was. */
  let dir = ROOT, leaf = base;
  const cut = base.indexOf("/");
  if (cut >= 0){
    const head = base.slice(0, cut);
    leaf = base.slice(cut + 1);
    if (!STATIC_DIRS.includes(head) || !leaf || leaf.indexOf("/") >= 0){
      send(req, res, 404, "not found"); return;
    }
    dir = path.join(ROOT, head);
  }

  const ext  = path.extname(leaf).toLowerCase();
  const type = MIME[ext];
  if (!type){ send(req, res, 404, "not found"); return; }

  const file = path.join(dir, leaf);
  /* belt and braces: the resolved file must still sit directly in that one */
  if (path.dirname(path.resolve(file)) !== path.resolve(dir)){
    send(req, res, 403, "no"); return;
  }
  let buf;
  try { buf = await fs.readFile(file); }
  catch { send(req, res, 404, "not found"); return; }
  send(req, res, 200, buf, type);
}

/* ---- the server ---- */

const server = http.createServer((req, res) => {
  const pathname = (req.url || "/").split("?")[0].split("#")[0];

  if (pathname === "/api/quest-log"){
    if (req.method === "GET" || req.method === "HEAD"){ getLog(req, res); return; }
    if (req.method === "PUT"){ putLog(req, res); return; }
    res.setHeader("allow", "GET, PUT");
    send(req, res, 405, "method not allowed");
    return;
  }
  if (pathname === "/api/rulings"){
    if (req.method === "GET" || req.method === "HEAD"){ getRulings(req, res); return; }
    if (req.method === "PUT"){ putRulings(req, res); return; }
    res.setHeader("allow", "GET, PUT");
    send(req, res, 405, "method not allowed");
    return;
  }
  if (pathname === "/api/kits" || pathname.indexOf("/api/kits/") === 0){
    kits(req, res, pathname); return;
  }
  if (req.method === "GET" || req.method === "HEAD"){ serveStatic(req, res, pathname); return; }
  send(req, res, 405, "method not allowed");
});

server.on("error", (e) => {
  if (e.code === "EADDRINUSE"){
    console.error("Port " + PORT + " is already in use.");
    console.error("Folio may already be running — try http://localhost:" + PORT + " first.");
    console.error("Otherwise start it elsewhere:  set PORT=4174 && node server.mjs");
    process.exit(1);
  }
  console.error("server error: " + e.message);
  process.exit(1);
});

function lanURL(){
  const ifs = os.networkInterfaces();
  for (const key of Object.keys(ifs)){
    for (const ni of ifs[key] || []){
      if (ni.family === "IPv4" && !ni.internal) return "http://" + ni.address + ":" + PORT;
    }
  }
  return null;
}

server.listen(PORT, HOST, () => {
  console.log("Folio is served from " + ROOT);
  console.log("  http://localhost:" + PORT);
  if (LAN){
    const url = lanURL();
    console.log("  " + (url || "(no LAN address found)") + "   ← on this network");
  }
  console.log("The quest log is " + LOG_FILE);
  console.log("The rulings are " + RULE_FILE);
  console.log("The kits are in " + KITS_DIR);
  console.log("Ctrl+C to stop.");
});
