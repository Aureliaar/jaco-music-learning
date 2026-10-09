# Folio Native

The folio's own page in a native window, with the instruments in the same
process. It replaced the REAPER rack (2026-10-09), whose MIDI cable failed
most of the times it was used: the browser lost the port, the cable or REAPER
weren't up, and recovery meant restarting the browser through the Hub. Here
there is no port and no second program. The REAPER machinery is deleted; it
is in git history before the `reaper-teardown` merge if it's ever needed.

Folio is still the instrument. The window loads the page the local server
serves (default `http://localhost:4173/`, or a URL given as the argument) in
WebView2. `js/audio.js` sees `window.__JUCE__`, treats the rack as promised
(never own tone), and hands its Web MIDI bytes and timestamps to the host. The
host (JUCE 8) maps the page's wall-clock timestamps onto its audio sample
counter and plays each event on its sample in the VST3 instrument for that
channel.

A browser tab opened on this machine gets the same promise from the server and
can't keep it, so it shows a panel saying Folio plays in its own window and
plays nothing (the never-own-tone ruling). The deployed copy, `file://`, and
the test suite are ordinary Folio with its own tones.

## Running

    folio.cmd                 the one button

It opens the window; `folio.cmd "http://localhost:4173/?quest=<id>"` opens
it on a quest, or moves an open window there. If the folio's server isn't answering, the window starts
it through pm2 (`folio-dev`, from `ecosystem.config.cjs`), which outlives the
window, then loads the page. `node server.mjs` is still the way to run the
server alone.

The **Rack** menu: audio settings, open any instrument's own editor, save
instrument states, reload the page (which also restarts the server if it has
gone).

## Building

`folio-native\build.cmd` (folio.cmd runs it if there's no build yet). It checks
out JUCE 8.0.10 (a submodule) and unzips the WebView2 SDK (gitignored) on
first run, then builds with VS 2022's CMake. The SINE libraries themselves are
in the private `soundbanks/` submodule (`node bank.mjs pull` there).

## The rack

`rack/rack.json` lists one instrument per MIDI channel (channel = voice +
seat × 3, 1-based in the file). The page reads the catalogue from the host
through the `folioRack` native function.

The SINE states are **lifted, never built**: SINE keeps an instrument's
internals in encrypted sample metadata, so a state put together by hand loads
nothing and renders silence. The nine `NN.component` files are the IComponent
states SINE itself wrote into the old REAPER rack project, unwrapped from
REAPER's chunk. The host wraps them the way JUCE's VST3 host stores state. To
add or change an instrument, open it from the Rack menu, set it up in SINE's
own editor, then *Save instrument states*: that writes `NN.state` (JUCE's
format) and points `rack.json` at it.

Gains are the old REAPER faders (linear) and velocities are still Folio's
level-matched values, so only seat 0 is balanced.

## Seeing inside

The page is open to CDP on `127.0.0.1:9334` (`FOLIO_NATIVE_DEVTOOLS` moves
the port): `curl http://127.0.0.1:9334/json` lists it.
`nativeCall('folioRack')` in the page returns state, device, sample rate,
block size, `bridgeMs` (page→host delivery time including clock
disagreement), `late` (events that arrived after their time), and `peak` (the
loudest output sample since the last ask).
