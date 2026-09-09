/* The Folio renderer status service.

   It owns the launcher process and reports one structured state throughout,
   from the first moment of startup rather than only after readiness: a page
   that promised the REAPER rack has to be able to tell "still starting" from
   "the cable is missing" while it waits.

   The launcher speaks a single machine line, `FOLIO-STATE <state>|<detail>`.
   The detail is short and stable, for diagnosis; the browser owns every word
   the player reads. Arbitrary launcher output never reaches the page. */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptsDir, '..');
const launcher = resolve(scriptsDir, 'folio-reaper.ps1');
const port = Number(process.env.FOLIO_REAPER_STATUS_PORT || 4174);

/* ---- what the rack actually holds ----
   The rack project is the only honest catalogue of the renderer's
   instruments: a track exists or it does not, and Folio must never draw a
   seat with nothing behind it. So the project file is read here and the
   tracks are reported as they stand.

   A track says which voice and which seat it is by the channel in its name —
   `LEAD — Ratio piano — MIDI 1` — because that channel is already the whole
   of the routing: voice `(ch - 1) % 3`, seat `(ch - 1) / 3`. Nothing new has
   to be written into the project to make it describable, and adding an
   instrument stays exactly what the README says it is: duplicate a monitored
   track, set its input channel, name it. The catalogue follows.

   Read on demand and cached against the file's own timestamp, so a track
   added while the rack is open is reported the next time Folio asks. */
const RACK_FILE = resolve(projectRoot, 'rack', 'Folio Sound Rack.rpp');
const RACK_LANES = 3;
let rackCache = { at: 0, voices: null };

function parseRackVoices(text) {
  const voices = [];
  for (let i = 0; i < RACK_LANES; i++) voices.push([]);
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const named = /^\s*NAME\s+"(.+)"\s*$/.exec(line);
    if (!named) continue;
    /* the dashes a track name is written with, and never the hyphen
       inside a name: "Crux J-bass" is one instrument, not "Crux J" */
    const parts = named[1].split(/\s+[—–]\s+/).filter(Boolean);
    const channel = /MIDI\s+(\d+)\s*$/.exec(named[1]);
    if (!channel) continue;
    const ch = Number(channel[1]);
    if (!Number.isInteger(ch) || ch < 1 || ch > 15) continue;
    const voice = (ch - 1) % RACK_LANES;
    const seat = Math.floor((ch - 1) / RACK_LANES);
    const name = (parts.length >= 3 ? parts[1] : parts[0]).trim();
    if (!name) continue;
    if (voices[voice].some((x) => x.seat === seat)) continue;
    voices[voice].push({ seat, name });
  }
  for (const list of voices) list.sort((a, b) => a.seat - b.seat);
  return voices;
}

function rackVoices() {
  try {
    const at = statSync(RACK_FILE).mtimeMs;
    if (at !== rackCache.at || !rackCache.voices)
      rackCache = { at, voices: parseRackVoices(readFileSync(RACK_FILE, 'utf8')) };
    return rackCache.voices;
  } catch {
    return null;
  }
}

const STATES = new Set([
  'not-requested', 'starting', 'port-missing', 'reaper-missing', 'rack-missing',
  'reaper-failed', 'ready', 'renderer-lost',
]);
/* Once one of these has been reported the launch is over; a later line cannot
   turn a named failure back into a hopeful one. */
const TERMINAL = new Set([
  'not-requested', 'port-missing', 'reaper-missing', 'rack-missing',
  'reaper-failed', 'renderer-lost',
]);

let state = 'starting';
let detail = 'the renderer launcher is starting';
let exiting = false;
let stopping = false;

function setState(next, nextDetail) {
  if (!STATES.has(next) || TERMINAL.has(state)) return;
  state = next;
  detail = nextDetail || '';
  console.log(`Folio renderer state: ${state}${detail ? ` — ${detail}` : ''}`);
}

const rack = spawn('powershell.exe', [
  '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', launcher,
], {
  cwd: projectRoot,
  windowsHide: true,
  stdio: ['ignore', 'pipe', 'pipe'],
});

const server = createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/shutdown') {
    res.writeHead(202, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
    });
    res.end(JSON.stringify({ ok: true, state: 'stopping' }));
    if (!stopping) {
      stopping = true;
      console.log('Experiments Hub requested a graceful rack stop.');
      const signal = spawn('powershell.exe', [
        '-NoProfile', '-Command',
        "$e=[Threading.EventWaitHandle]::OpenExisting('Local\\FolioReaperLauncherStop');$e.Set()|Out-Null;$e.Dispose()",
      ], { windowsHide: true, stdio: 'ignore' });
      signal.unref();
    }
    return;
  }
  const ready = state === 'ready';
  res.writeHead(ready ? 200 : 503, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
  });
  res.end(JSON.stringify({
    ok: ready,
    ready,
    state,
    detail,
    renderer: ready ? 'reaper' : state,
    /* the catalogue, only while there is something playing it: a list of
       instruments from a rack that is not up is a promise nobody can keep */
    voices: ready ? rackVoices() : null,
    launcherPid: rack.pid || null,
  }));
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Folio REAPER status ready on http://127.0.0.1:${port}/`);
});
server.on('error', (error) => {
  console.error(`Could not open the Folio renderer status port: ${error.message}`);
  finish(1);
});

function relay(stream, target) {
  let pending = '';
  stream.on('data', (chunk) => {
    const text = chunk.toString();
    target.write(text);
    pending += text;
    let cut = pending.indexOf('\n');
    while (cut >= 0) {
      const line = pending.slice(0, cut).trim();
      const marked = /^FOLIO-STATE\s+([a-z-]+)\|(.*)$/.exec(line);
      if (marked) setState(marked[1], marked[2].trim());
      pending = pending.slice(cut + 1);
      cut = pending.indexOf('\n');
    }
    if (pending.length > 4096) pending = pending.slice(-2048);
  });
}

relay(rack.stdout, process.stdout);
relay(rack.stderr, process.stderr);

/* Keep answering for a moment after the launcher ends, so a page polling once
   a second reads why the renderer went away instead of only a refused
   connection. The service still exits: Hub must see the renderer as stopped. */
const LINGER_MS = 3000;

function finish(code) {
  if (exiting) return;
  exiting = true;
  const close = () => {
    if (server.listening) server.close(() => process.exit(code));
    else process.exit(code);
  };
  if (server.listening) setTimeout(close, LINGER_MS).unref?.();
  else close();
}

rack.on('error', (error) => {
  console.error(`Could not start the Folio REAPER launcher: ${error.message}`);
  setState('reaper-failed', 'the renderer launcher could not start');
  finish(1);
});
rack.on('exit', (code, signal) => {
  if (signal) console.error(`Folio REAPER launcher exited via ${signal}.`);
  /* A launcher that ends without naming a state still ends the renderer. */
  setState(code === 0 ? 'renderer-lost' : 'reaper-failed',
    code === 0 ? 'the renderer launcher ended' : `the renderer launcher exited with code ${code}`);
  finish(code == null ? 1 : code);
});
