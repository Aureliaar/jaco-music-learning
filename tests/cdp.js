/* The CommonJS CDP driver the real-browser harnesses ask for.

   e2e.js keeps this tiny driver separate so the seven journeys can read like
   journeys instead of a WebSocket implementation:

     const b = await launch({ profile, port })
     b.send(method, params)      raw CDP
     b.events                    a drained array of CDP events
     await b.goto(url)
     await b.eval(expression)    returns the value
     await b.key(code, { key, vk, ...mods })
     await b.pad(state)          a gamepad, injected into the page
     await b.shot(file)
     b.close()

   Zero dependencies: node's own WebSocket and fetch. */
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const CHROME_CANDIDATES = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  process.env.CHROME,
  "/usr/bin/google-chrome",
  "/usr/bin/chromium"
];

function chromePath(){
  for (const c of CHROME_CANDIDATES){
    if (c && fs.existsSync(c)) return c;
  }
  throw new Error("no chrome found; set CHROME to its path");
}

const wait = ms => new Promise(r => setTimeout(r, ms));

async function launch(opts){
  opts = opts || {};
  const port = opts.port || 9333;
  const dir  = opts.profile || fs.mkdtempSync(path.join(os.tmpdir(), "folio-"));
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e){}
  fs.mkdirSync(dir, { recursive: true });

  const proc = spawn(chromePath(), [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--mute-audio",
    "--autoplay-policy=no-user-gesture-required",
    "--window-size=1400,1000",
    "--user-data-dir=" + dir,
    "--remote-debugging-port=" + port,
    "about:blank"
  ], { stdio: "ignore" });

  let info = null;
  for (let i = 0; i < 150; i++){
    try { info = await (await fetch("http://127.0.0.1:" + port + "/json/version")).json(); break; }
    catch (e){ await wait(200); }
  }
  if (!info) throw new Error("chrome did not start on " + port);

  const t = await (await fetch("http://127.0.0.1:" + port + "/json/new?about:blank",
                               { method: "PUT" })).json();
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

  let id = 0;
  const pending = new Map();
  const events = [];
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)){
      const p = pending.get(msg.id); pending.delete(msg.id);
      if (msg.error) p.rej(new Error(JSON.stringify(msg.error))); else p.res(msg.result);
    } else if (msg.method){
      events.push(msg);
      if (events.length > 2000) events.splice(0, 1000);
    }
  };
  const send = (method, params) => new Promise((res, rej) => {
    const i = ++id;
    pending.set(i, { res, rej });
    ws.send(JSON.stringify({ id: i, method, params: params || {} }));
  });

  const b = { proc, ws, events, send, target: t.id, port, dir };

  b.eval = async (expr) => {
    const r = await send("Runtime.evaluate",
      { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails)
      throw new Error("eval: " + JSON.stringify(
        (r.exceptionDetails.exception && r.exceptionDetails.exception.description) ||
        r.exceptionDetails.text));
    return r.result.value;
  };
  b.goto = async (url) => {
    await send("Page.navigate", { url });
    for (let i = 0; i < 300; i++){
      let st = null;
      try { st = await b.eval("document.readyState"); } catch (e){}
      if (st === "complete") return;
      await wait(100);
    }
  };
  /* a keystroke by physical position: `code` is what the app reads */
  b.key = async (code, o) => {
    o = o || {};
    const base = {
      code: code,
      key: o.key || code,
      windowsVirtualKeyCode: o.vk || 0,
      nativeVirtualKeyCode: o.vk || 0,
      modifiers: (o.ctrl ? 2 : 0) | (o.shift ? 8 : 0) | (o.alt ? 1 : 0) | (o.meta ? 4 : 0)
    };
    const printable = o.text !== undefined ? o.text : (/^(Key|Digit)/.test(code) ? (o.key || "") : "");
    await send("Input.dispatchKeyEvent", Object.assign({
      type: printable ? "keyDown" : "rawKeyDown", text: printable || undefined }, base));
    await send("Input.dispatchKeyEvent", Object.assign({ type: "keyUp" }, base));
    await wait(30);
  };
  /* A gamepad, faked in the page. Chrome's headless build reports no pads and
     CDP has no gamepad domain, so navigator.getGamepads is replaced once and
     driven from here; the app polls it on its own rAF, exactly as it does for
     a real pad. `state` is { buttons:[indices down], axes:[x,y,rx,ry] }. */
  b.padInstall = () => b.eval(`(function(){
    if (window.__padInstalled) return true;
    window.__padInstalled = true;
    window.__pad = null;
    navigator.getGamepads = function(){ return window.__pad ? [window.__pad] : []; };
    window.__setPad = function(down, axes){
      var buttons = [];
      for (var i = 0; i < 17; i++)
        buttons.push({ pressed: down.indexOf(i) >= 0, value: down.indexOf(i) >= 0 ? 1 : 0,
                       touched: down.indexOf(i) >= 0 });
      window.__pad = { connected:true, mapping:"standard", index:0,
                       buttons: buttons, axes: axes || [0,0,0,0], id:"folio test pad",
                       timestamp: performance.now() };
      return true;
    };
    return true;
  })()`);
  /* one frame of pad state; the app's rAF poll reads it */
  b.pad = async (down, axes) => {
    await b.eval("window.__setPad(" + JSON.stringify(down || []) + "," +
                 JSON.stringify(axes || [0,0,0,0]) + ")");
    await wait(60);                              /* several rAF frames */
  };
  /* press and release: an edge the app can see */
  b.tap = async (...down) => { await b.pad(down); await b.pad([]); };
  b.holdFor = async (ms, ...down) => { await b.pad(down); await wait(ms); await b.pad([]); };

  b.shot = async (file) => {
    try {
      const r = await send("Page.captureScreenshot", { format: "png" });
      fs.writeFileSync(file, Buffer.from(r.data, "base64"));
    } catch (e){}
  };
  b.close = () => { try { ws.close(); } catch (e){} try { proc.kill(); } catch (e){} };

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Log.enable");
  return b;
}

module.exports = { launch, chromePath };
