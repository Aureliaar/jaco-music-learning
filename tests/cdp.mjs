/* tiny CDP driver: launch headless chrome, drive one page */
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

export async function launch(port = 9333){
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "audit-"));
  const proc = spawn(CHROME, [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--mute-audio",
    "--autoplay-policy=no-user-gesture-required",
    "--user-data-dir=" + dir,
    "--remote-debugging-port=" + port,
    "about:blank"
  ], { stdio: "ignore" });
  let info = null;
  for (let i = 0; i < 100; i++){
    try { info = await (await fetch("http://127.0.0.1:" + port + "/json/version")).json(); break; }
    catch { await new Promise(r => setTimeout(r, 200)); }
  }
  if (!info) throw new Error("chrome did not start");
  return { proc, port, dir };
}

export async function newPage(browser){
  const t = await (await fetch("http://127.0.0.1:" + browser.port + "/json/new?about:blank", { method: "PUT" })).json();
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const pending = new Map();
  const events = [];
  const listeners = [];
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)){
      const { res, rej } = pending.get(msg.id); pending.delete(msg.id);
      if (msg.error) rej(new Error(JSON.stringify(msg.error))); else res(msg.result);
    } else if (msg.method){
      events.push(msg);
      listeners.forEach(f => f(msg));
    }
  };
  const send = (method, params = {}) => new Promise((res, rej) => {
    const i = ++id;
    pending.set(i, { res, rej });
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  const page = { send, events, ws, target: t.id, on: (f) => listeners.push(f) };

  page.eval = async (expr) => {
    const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error("eval: " + JSON.stringify(r.exceptionDetails.exception?.description || r.exceptionDetails.text));
    return r.result.value;
  };
  page.goto = async (url) => {
    await send("Page.navigate", { url });
    for (let i = 0; i < 200; i++){
      const st = await page.eval("document.readyState");
      if (st === "complete") return;
      await new Promise(r => setTimeout(r, 100));
    }
  };
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Log.enable");
  return page;
}

export async function close(browser){
  try { browser.proc.kill(); } catch {}
}
