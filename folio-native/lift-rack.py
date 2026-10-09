"""Lift the REAPER rack's instruments into the native host's rack.

Reads `rack/Folio Sound Rack.rpp` and writes `folio-native/rack/`:
one `<channel>.component` per instrument (the VST3 IComponent state SINE
itself wrote, unwrapped from REAPER's chunk) and `rack.json`, the list the
host loads: channel, voice, seat, name, plugin, state file, fader gain.

States are lifted, never built (see rack/README.md): a SINE state assembled
by hand loads nothing. This only moves bytes SINE wrote.

REAPER's VST3 chunk is three base64 blocks — a header (pin mappings, ending
in the data block's size), the data, and a short trailer. The data block is
  int32 component size, int32 1, component bytes, int32 controller size, ...
"""
import base64, json, os, re, struct, sys

HERE = os.path.dirname(os.path.abspath(__file__))
RPP = os.path.join(HERE, "..", "rack", "Folio Sound Rack.rpp")
OUT = os.path.join(HERE, "rack")
VOICES = {"LEAD": 0, "BASS": 1, "CHORDS": 2}
LANES = 3


def blocks(lines):
    parts, cur = [], ""
    for line in lines:
        cur += line
        if len(line) < 128 or line.endswith("="):
            parts.append(cur)
            cur = ""
    if cur:
        parts.append(cur)
    return [base64.b64decode(p) for p in parts]


def main():
    lines = open(RPP, encoding="utf-8").read().splitlines()
    os.makedirs(OUT, exist_ok=True)
    rack, track = [], None
    i = 0
    while i < len(lines):
        s = lines[i].strip()
        if s.startswith("<TRACK"):
            track = {}
        elif track is not None and s.startswith("NAME "):
            track["name"] = s[5:].strip('"')
        elif track is not None and s.startswith("VOLPAN "):
            track["gain"] = float(s.split()[1])
        elif track is not None and s.startswith('<VST "VST3i:'):
            plugin = re.search(r'"VST3i: ([^"]+?)(?: \(.*\))?"', s).group(1)
            body = []
            i += 1
            while lines[i].strip() != ">":
                body.append(lines[i].strip())
                i += 1
            data = blocks(body)[1]
            size = struct.unpack("<I", data[:4])[0]
            component = data[8:8 + size]
            m = re.match(r"(\w+) — (.+) — MIDI (\d+)$", track["name"])
            if not m or m.group(1) not in VOICES:
                print("skipped", track["name"], file=sys.stderr)
            else:
                channel = int(m.group(3))            # 1-based, as the rack names it
                voice = VOICES[m.group(1)]
                fname = "%02d.component" % channel
                with open(os.path.join(OUT, fname), "wb") as f:
                    f.write(component)
                rack.append({
                    "channel": channel, "voice": voice,
                    "seat": (channel - 1 - voice) // LANES,
                    "name": m.group(2), "plugin": plugin + ".vst3",
                    "state": fname, "gain": track.get("gain", 1.0),
                })
            track = None
        i += 1
    rack.sort(key=lambda e: e["channel"])
    with open(os.path.join(OUT, "rack.json"), "w", encoding="utf-8") as f:
        json.dump({"folio": "native-rack", "version": 1, "instruments": rack},
                  f, indent=2, ensure_ascii=False)
    for e in rack:
        print("MIDI %(channel)d  voice %(voice)d seat %(seat)d  %(name)s" % e)


if __name__ == "__main__":
    main()
