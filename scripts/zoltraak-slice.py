# -*- coding: utf-8 -*-
"""Zoltraak 0:18-0:34 -> one folio page of 256 steps (Lesson 4.2).

Reads the piano MIDI, takes the top of the right hand as the lead and the
bottom of the left as the bass, quantises to sixteenths at 142 bpm, and
writes one drill whose hidden call is the whole slice in both voices, on a
page long enough that the line is never broken.  Nothing here prints a
pitch."""
import midread as mid, collections, json, io

SRC  = r"C:\Users\sinijaco\Downloads\Zoltraak.mid"
BPM  = 142.0
KEY  = "G minor"
N    = 256                     # one page, no break
LEAD_SHIFT = -12               # the melody's peak is above the folio's reach
NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"]
LO, HI = 36, 84                # what the pad can write

div, trks = mid.rd(SRC); G = div // 4; spb = 60.0 / BPM
def window(i):
    return [n for n in mid.notes(trks[i]) if 18.0 <= n[0]/div*spb <= 34.0]
rh, lh = window(2), window(3)
t0 = min(rh[0][0], lh[0][0])

def reduce(ns, pick):
    by = collections.defaultdict(list)
    for (t, p, v, d) in ns: by[round((t - t0) / G)].append((p, d))
    out = {}
    for s, g in by.items():
        g.sort()
        p, d = g[-1] if pick == "top" else g[0]
        out[s] = [p, max(1, int(round(d / float(G))))]
    return out

lead = reduce(rh, "top"); bass = reduce(lh, "bot")
for s in lead: lead[s][0] += LEAD_SHIFT
for s in bass:
    while bass[s][0] < LO: bass[s][0] += 12     # the pedal notes, into reach
assert all(LO <= p <= HI for p, _ in list(lead.values()) + list(bass.values()))

def name(m): return NAMES[m % 12] + str(m // 12 - 1)

# the phrase heads: where the same rhythm starts over, and where it stops
PHRASE = [0, 32, 64, 96, 128]
LEAD_HINT = PHRASE              # a foothold at the top of every phrase
BASS_HINT = [0, 64, 128]        # and under three of them

def first_at(m, s0):
    later = [s for s in m if s >= s0]
    return min(later) if later else None

call = []
for v, m in ((0, lead), (1, bass)):
    st = sorted(m)
    for k, s in enumerate(st):
        pitch, ln = m[s]
        gap = (st[k+1] - s) if k + 1 < len(st) else (N - s)
        call.append({"step": s, "note": name(pitch),
                     "len": max(1, min(ln, gap, N - s)), "voice": v})
call.sort(key=lambda e: (e["step"], e["voice"]))

steps = [None]*N; bst = [None]*N
hold  = [1]*N;    bhd = [1]*N
lock  = [None]*N; blk = [None]*N
hints = 0
for v, m, want, sarr, harr, larr in ((0, lead, LEAD_HINT, steps, hold, lock),
                                     (1, bass, BASS_HINT, bst, bhd, blk)):
    for s0 in want:
        s = first_at(m, s0)
        if s is None: continue
        ev = [e for e in call if e["voice"] == v and e["step"] == s][0]
        sarr[s] = ev["note"]; harr[s] = ev["len"]; larr[s] = "prl"; hints += 1

# the seam: where the material ends, rounded out to the eighth the left hand
# walks on, so the repeat comes round a pulse after the last note stops
END  = max(e["step"] + e["len"] for e in call)
LOOP = END + (END % 2)

pattern = {"version": 1, "title": "sixteen seconds", "tempo": int(BPM),
           "loop": LOOP, "key": KEY, "len": N,
           "steps": steps, "bass": bst, "mute": [False, False],
           "tones": ["piano", "piano"], "hold": hold, "basshold": bhd,
           "lock": lock, "basslock": blk,
           "echo": {"stage": "degrees+rhythm", "voice": 0, "at": 0, "call": call}}

drill = {
  "id": "zoltraak", "name": "sixteen seconds", "lesson": 4,
  "summary": "- the call is a recording, both hands, played hidden\n"
             "- write the melody in the lead; the ground is only played\n"
             "- the notes already there cannot be unwritten",
  "teaches": "reading a real line off the air, and holding it for longer than a phrase.",
  "pattern": pattern}

print("lead %d  bass %d  call %d  hints %d (%.1f%%)  loop %d of %d"
      % (len(lead), len(bass), len(call), hints,
         100.0 * hints / (len(lead) + len(bass)), LOOP, N))
io.open("quests/zoltraak-slice.json", "w", encoding="utf-8").write(
    json.dumps({"folio": "drills", "source": "Zoltraak (Evan Call) 0:18-0:34, "
                "piano arrangement, right hand top / left hand bottom, "
                "sixteenths at 142; the lead sounds an octave below the "
                "record so that its peak is inside the folio's range",
                "drills": [drill]}, ensure_ascii=False, indent=1))
print("wrote quests/zoltraak-slice.json")
