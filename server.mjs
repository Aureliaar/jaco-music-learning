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
const LOG_DIR  = path.dirname(LOG_FILE);

const args = process.argv.slice(2);
const LAN  = args.includes("--lan");
const PORT = Number(process.env.PORT) || 4173;
const HOST = LAN ? "0.0.0.0" : "127.0.0.1";

const INDEX = "folio.html";
const MAX_BODY = 4 * 1024 * 1024;         /* a quest log is kilobytes; this is generous */

/* Only these are served, and only from the repo root or from one named
   folder below it. Everything else — the markdown, the git directory, any
   other subdirectory — is not web content and is not offered as such. */
const STATIC_DIRS = ["quest-backgrounds"];
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
     workspace, a done flag and `active` all belong to the page. */
  let disk = null;
  try { disk = JSON.parse(await fs.readFile(LOG_FILE, "utf8")); } catch { disk = null; }
  if (disk && Array.isArray(disk.drills)){
    const incoming = Array.isArray(obj.drills) ? obj.drills : [];
    const have = new Set(incoming.map(d => d && d.id).filter(id => typeof id === "string"));
    const keep = disk.drills.filter(d => d && typeof d.id === "string" && !have.has(d.id));
    if (keep.length) obj.drills = incoming.concat(keep);
  }

  /* write beside it, then rename: a reader never sees a half-written log */
  const text2 = JSON.stringify(obj, null, 2) + "\n";
  const tmp = LOG_FILE + "." + process.pid + "." + Date.now() + ".tmp";
  try {
    await fs.mkdir(LOG_DIR, { recursive: true });
    await fs.writeFile(tmp, text2, "utf8");
    await fs.rename(tmp, LOG_FILE);
  } catch (e){
    try { await fs.unlink(tmp); } catch {}
    send(req, res, 500, "could not write the log: " + e.message);
    return;
  }
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

  /* The one exception to "the root and nothing else": the per-workspace
     scenery lives in a folder of its own, because twenty-two stills loose in
     the root would bury everything around them. Exactly one directory is
     named, exactly one level deep, and the resolved file is still checked
     against that directory afterwards — the rest of the disk is as
     unreachable as it always was. */
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
  console.log("Ctrl+C to stop.");
});
