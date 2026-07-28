/* Folio — the local server.

   A tiny, dependency-free Node server so that the quest log can live in a
   real file that agents, collaborators and backups can see. It serves
   `folio.html` and exactly one resource: the quest log.

   Run it:   folio.cmd            (or)   node server.mjs
   Then go:  http://localhost:4173
   Family:   node server.mjs --lan       (binds every interface)

   `file://` keeps working exactly as before, without the sync. */

import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";                 /* core module, only for the LAN URL */
import { fileURLToPath } from "node:url";

const ROOT     = path.dirname(fileURLToPath(import.meta.url));
const LOG_DIR  = path.join(ROOT, "quests");
const LOG_FILE = path.join(LOG_DIR, "quest-log.json");

const args = process.argv.slice(2);
const LAN  = args.includes("--lan");
const PORT = Number(process.env.PORT) || 4173;
const HOST = LAN ? "0.0.0.0" : "127.0.0.1";

const INDEX = "folio.html";
const MAX_BODY = 4 * 1024 * 1024;         /* a quest log is kilobytes; this is generous */

/* Only these are served, and only from the repo root. Everything else — the
   markdown, the git directory, anything in a subdirectory — is not web
   content and is not offered as such. */
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
function send(req, res, status, body, type){
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(body ?? "");
  res.writeHead(status, {
    "content-type": type || "text/plain; charset=utf-8",
    "content-length": buf.length,
    "cache-control": "no-store"
  });
  res.end(req.method === "HEAD" ? undefined : buf);
  log(req, status);
}

/* ---- the quest log ---- */

async function getLog(req, res){
  let text;
  try { text = await fs.readFile(LOG_FILE, "utf8"); }
  catch { send(req, res, 404, "no quest log yet"); return; }
  send(req, res, 200, text, MIME[".json"]);
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
  /* write beside it, then rename: a reader never sees a half-written log */
  const tmp = LOG_FILE + "." + process.pid + "." + Date.now() + ".tmp";
  try {
    await fs.mkdir(LOG_DIR, { recursive: true });
    await fs.writeFile(tmp, JSON.stringify(obj, null, 2) + "\n", "utf8");
    await fs.rename(tmp, LOG_FILE);
  } catch (e){
    try { await fs.unlink(tmp); } catch {}
    send(req, res, 500, "could not write the log: " + e.message);
    return;
  }
  res.writeHead(204).end();
  log(req, 204);
}

/* ---- static, root only, no traversal ---- */

async function serveStatic(req, res, pathname){
  let name;
  try { name = decodeURIComponent(pathname); }
  catch { send(req, res, 400, "bad path"); return; }

  if (name === "/") name = "/" + INDEX;
  /* nothing clever is allowed: no traversal, no NUL, no subdirectories */
  if (name.indexOf("..") >= 0 || name.indexOf("\0") >= 0 || name.indexOf("\\") >= 0){
    send(req, res, 403, "no"); return;
  }
  const base = name.slice(1);
  if (!base || base.indexOf("/") >= 0){ send(req, res, 404, "not found"); return; }

  const ext  = path.extname(base).toLowerCase();
  const type = MIME[ext];
  if (!type){ send(req, res, 404, "not found"); return; }

  const file = path.join(ROOT, base);
  /* belt and braces: the resolved file must still sit directly in the root */
  if (path.dirname(path.resolve(file)) !== path.resolve(ROOT)){
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
