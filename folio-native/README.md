# Folio Native

The folio's own page in a native window, with the instruments in the same
process. It replaces the REAPER rack's MIDI cable, which failed most of the
times it was used: the browser lost the port, the cable or REAPER weren't up,
and recovery meant restarting the browser through the Hub. Here there is no
port and no second program.

Folio is still the instrument. The window loads the page the local server
serves (default `http://localhost:4173/`, or a URL given as the argument) in
WebView2. `js/audio.js` sees `window.__JUCE__`, treats the rack as promised
(never own tone), and hands its Web MIDI bytes and timestamps to the host
instead of a MIDI port. The host (JUCE 8) maps the page's wall-clock timestamps
onto its audio sample counter and plays each event on its sample in the VST3
instrument for that channel.

## Running

    folio.cmd                 (the server; the window never starts it)
    folio-native.cmd          (the window)

The **Rack** menu: audio settings, open any instrument's own editor, save
instrument states, reload the page.

## Building

`folio-native\build.cmd`: it checks out JUCE 8.0.10 (a submodule) and unzips
the WebView2 SDK (gitignored) on first run, then builds with VS 2022's CMake.
The SINE libraries themselves are in the private `soundbanks/` submodule.

## The rack

`rack/rack.json` lists one instrument per MIDI channel, using the same seat
scheme as before (channel = voice + seat × 3, 1-based in the file). The page
reads the catalogue from the host through the `folioRack` native function in
place of `/api/renderer`.

The SINE states are **lifted, never built** (see `../rack/README.md`).
`lift-rack.py` unwraps the IComponent states SINE wrote into the REAPER
project and writes them as `NN.component`. The host wraps those the way
JUCE's VST3 host stores state. After an instrument has been set up in its own
editor, *Save instrument states* writes `NN.state` (JUCE's format) and points
`rack.json` at it.

Gains are the REAPER faders (linear) and velocities are still Folio's
level-matched values, so only seat 0 is balanced.

## Seeing inside

`FOLIO_NATIVE_DEVTOOLS=9333` opens the page to CDP on that port.
`nativeCall('folioRack')` in the page returns state, device, sample rate,
block size, `bridgeMs` (page→host delivery time including clock
disagreement), `late` (events that arrived after their time), and `peak` (the
loudest output sample since the last ask).
