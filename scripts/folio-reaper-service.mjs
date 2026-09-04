import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptsDir, '..');
const launcher = resolve(scriptsDir, 'folio-reaper.ps1');
const port = Number(process.env.FOLIO_REAPER_STATUS_PORT || 4174);

let ready = false;
let exiting = false;
let stopping = false;
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
  res.writeHead(ready ? 200 : 503, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
  });
  res.end(JSON.stringify({
    ok: ready,
    renderer: ready ? 'reaper' : 'starting',
    launcherPid: rack.pid || null,
  }));
});

function relay(stream, target) {
  let pending = '';
  stream.on('data', (chunk) => {
    const text = chunk.toString();
    target.write(text);
    pending += text;
    if (!ready && pending.includes('Folio sound is ready:')) {
      ready = true;
      server.listen(port, '127.0.0.1', () => {
        console.log(`Folio REAPER health ready on http://127.0.0.1:${port}/`);
      });
    }
    if (pending.length > 4096) pending = pending.slice(-2048);
  });
}

relay(rack.stdout, process.stdout);
relay(rack.stderr, process.stderr);

function finish(code) {
  if (exiting) return;
  exiting = true;
  ready = false;
  if (server.listening) server.close(() => process.exit(code));
  else process.exit(code);
}

rack.on('error', (error) => {
  console.error(`Could not start the Folio REAPER launcher: ${error.message}`);
  finish(1);
});
rack.on('exit', (code, signal) => {
  if (signal) console.error(`Folio REAPER launcher exited via ${signal}.`);
  finish(code == null ? 1 : code);
});
