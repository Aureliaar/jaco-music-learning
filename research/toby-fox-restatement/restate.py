"""MIDI reading and phrase matching for the restatement study.

load() turns a fan MIDI into notes (drums and sequencer echo channels removed),
per_bar() puts them on the bar grid, loop_cut() finds the second pass of the
game loop that fan MIDIs often append, and match() says whether two windows
of top-line notes are the same phrase under some transposition T.
"""
import mido
from collections import defaultdict, Counter

Q = 24            # onset grid: 1/24 beat
L = 2             # window length in bars
SIM = 0.80        # Dice similarity to call two windows the same phrase
MIN_NOTES = 5
MIN_PCS = 3       # distinct pitch classes in a window

GM = ("Acoustic Grand Piano,Bright Acoustic Piano,Electric Grand Piano,Honky-tonk Piano,Electric Piano 1,"
"Electric Piano 2,Harpsichord,Clavinet,Celesta,Glockenspiel,Music Box,Vibraphone,Marimba,Xylophone,"
"Tubular Bells,Dulcimer,Drawbar Organ,Percussive Organ,Rock Organ,Church Organ,Reed Organ,Accordion,"
"Harmonica,Tango Accordion,Nylon Guitar,Steel Guitar,Jazz Guitar,Clean Guitar,Muted Guitar,"
"Overdriven Guitar,Distortion Guitar,Guitar Harmonics,Acoustic Bass,Finger Bass,Pick Bass,Fretless Bass,"
"Slap Bass 1,Slap Bass 2,Synth Bass 1,Synth Bass 2,Violin,Viola,Cello,Contrabass,Tremolo Strings,"
"Pizzicato Strings,Orchestral Harp,Timpani,String Ensemble 1,String Ensemble 2,Synth Strings 1,"
"Synth Strings 2,Choir Aahs,Voice Oohs,Synth Voice,Orchestra Hit,Trumpet,Trombone,Tuba,Muted Trumpet,"
"French Horn,Brass Section,Synth Brass 1,Synth Brass 2,Soprano Sax,Alto Sax,Tenor Sax,Baritone Sax,Oboe,"
"English Horn,Bassoon,Clarinet,Piccolo,Flute,Recorder,Pan Flute,Blown Bottle,Shakuhachi,Whistle,Ocarina,"
"Square Lead,Saw Lead,Calliope Lead,Chiff Lead,Charang Lead,Voice Lead,Fifths Lead,Bass+Lead,"
"New Age Pad,Warm Pad,Polysynth Pad,Choir Pad,Bowed Pad,Metallic Pad,Halo Pad,Sweep Pad,Rain FX,"
"Soundtrack FX,Crystal FX,Atmosphere FX,Brightness FX,Goblins FX,Echoes FX,Sci-fi FX,Sitar,Banjo,"
"Shamisen,Koto,Kalimba,Bagpipe,Fiddle,Shanai,Tinkle Bell,Agogo,Steel Drums,Woodblock,Taiko Drum,"
"Melodic Tom,Synth Drum,Reverse Cymbal,Guitar Fret Noise,Breath Noise,Seashore,Bird Tweet,"
"Telephone Ring,Helicopter,Applause,Gunshot").split(",")
assert len(GM) == 128
NAMES = "C C# D D# E F F# G G# A A# B".split()
def pname(p): return f"{NAMES[p % 12]}{p // 12 - 1}"


def gs_drum_channels(mid):
    """Channels a GS sysex turns into rhythm parts (besides channel 10)."""
    drums = {9}
    for tr in mid.tracks:
        for m in tr:
            if m.type == 'sysex':
                d = list(m.data)
                # 41 dev 42 12 40 1p 15 vv cs
                if len(d) >= 8 and d[0] == 0x41 and d[2] == 0x42 and d[3] == 0x12 and d[4] == 0x40 \
                        and (d[5] & 0xF0) == 0x10 and d[6] == 0x15:
                    p = d[5] & 0x0F
                    ch = 9 if p == 0 else (p - 1 if p <= 9 else p)
                    if d[7]: drums.add(ch)
                    else: drums.discard(ch)
    return drums


def load(path):
    mid = mido.MidiFile(path, clip=True)
    tpb = mid.ticks_per_beat
    drums = gs_drum_channels(mid)
    ev = []
    for ti, tr in enumerate(mid.tracks):
        t = 0
        for k, m in enumerate(tr):
            t += m.time
            ev.append((t, 0 if m.type == 'program_change' else 1, ti, k, m))
    ev.sort(key=lambda e: e[:4])
    prog = [0] * 16
    active, notes, ts, tempos = {}, [], [], []
    for t, _, ti, _, m in ev:
        if m.type == 'time_signature':
            ts.append((t / tpb, m.numerator, m.denominator))
        elif m.type == 'set_tempo':
            tempos.append((t / tpb, mido.tempo2bpm(m.tempo)))
        elif m.type == 'program_change':
            prog[m.channel] = m.program
        elif m.type in ('note_on', 'note_off'):
            key = (ti, m.channel, m.note)
            if key in active:   # an off, or a retrigger that ends the sounding note
                s, v, p = active.pop(key)
                notes.append(dict(s=s / tpb, e=t / tpb, p=m.note, v=v, voice=(ti, m.channel), prog=p))
            if m.type == 'note_on' and m.velocity > 0:
                active[key] = (t, m.velocity, prog[m.channel])
    notes = [n for n in notes if n['voice'][1] not in drums and n['prog'] < 115]
    notes, echoes = drop_echoes(notes)
    return dict(echoes=echoes, notes=notes, ts=ts, tempos=tempos, tpb=tpb, drums=sorted(drums))


def drop_echoes(notes):
    """A voice that replays another voice's pitches a fixed short delay later (a sequencer's fake delay
    effect) is an echo, not a statement: drop the quieter one."""
    by = defaultdict(list)
    for n in notes: by[n['voice']].append(n)
    vel = {v: sum(n['v'] for n in l) / len(l) for v, l in by.items()}
    idx = {v: defaultdict(list) for v in by}
    for v, l in by.items():
        for n in l: idx[v][n['p']].append(n['s'])
    echoes = {}
    for u in by:
        for v in by:
            if u == v or v in echoes or u in echoes: continue
            if len(by[v]) < 16: continue
            lags = Counter()
            for n in by[v]:
                for s0 in idx[u].get(n['p'], ()):
                    d = round(n['s'] - s0, 3)
                    if 0.05 < d <= 1.0: lags[d] += 1
            if not lags: continue
            d, cnt = lags.most_common(1)[0]
            if cnt >= 0.7 * len(by[v]) and vel[v] <= vel[u]:
                echoes[v] = dict(of=u, delay_beats=d)
    return [n for n in notes if n['voice'] not in echoes], {f"{k}": e['delay_beats'] for k, e in echoes.items()}


def bar_starts(ts, end):
    """Beat positions of every bar line up to `end` (beats), honouring meter changes."""
    sigs = sorted(ts) or [(0.0, 4, 4)]
    if sigs[0][0] > 0: sigs.insert(0, (0.0, 4, 4))
    starts, b, i = [], 0.0, 0
    while b <= end + 1e-9:
        while i + 1 < len(sigs) and sigs[i + 1][0] <= b + 1e-9: i += 1
        starts.append(b)
        num, den = sigs[i][1], sigs[i][2]
        b += num * 4.0 / den
    starts.append(b)
    return starts


def bar_of(starts, beat):
    lo, hi = 0, len(starts) - 1
    while lo < hi - 1:
        mid = (lo + hi) // 2
        if starts[mid] <= beat + 1e-9: lo = mid
        else: hi = mid
    return lo


def per_bar(song):
    """notes grouped as bars[b][voice] = list of (onset_q within bar, pitch, prog, dur)."""
    notes = song['notes']
    end = max(n['e'] for n in notes)
    starts = bar_starts(song['ts'], end)
    bars = defaultdict(lambda: defaultdict(list))
    for n in notes:
        b = bar_of(starts, n['s'])
        oq = round((n['s'] - starts[b]) * Q)
        bars[b][n['voice']].append((oq, n['p'], n['prog'], round((n['e'] - n['s']) * Q)))
    nb = max(bars) + 1 if bars else 0
    return starts, bars, nb


def loop_cut(bars, nb):
    """Detect the tail that replays an earlier stretch (the game loop played twice) and return the bar to cut at."""
    def fp(b):
        return tuple(sorted((v, o, p) for v, lst in bars.get(b, {}).items() for (o, p, _, _) in lst))
    fps = [fp(b) for b in range(nb)]
    last = nb
    while last > 0 and not fps[last - 1]: last -= 1
    best = (0, None)
    for k in range(4, last // 2 + 1):
        r = 0
        # walk back from the end but forgive a fade (last few bars may thin out): require exact equality
        b = last - 1
        # allow up to 4 trailing bars that differ (fade-out / final chord)
        skipped = 0
        while b - k >= 0:
            if fps[b] == fps[b - k] and fps[b]:
                r += 1
            elif r == 0 and skipped < 4:
                skipped += 1
            else:
                break
            b -= 1
        if r >= 8 and r > best[0]:
            best = (r, k, b + 1)
    if best[1] is None: return last, None
    r, k, first_dup = best
    return first_dup, dict(loop_len=k, dup_from=first_dup, dup_bars=r)


def match(a, b):
    """Best transposition T and Dice similarity between two windows (onset tolerance +-1 grid unit)."""
    A, B = a['line'], b['line']
    Bd = defaultdict(set)
    for o, p in B: Bd[o].add(p)
    diffs = Counter()
    for o, p in A:
        for oo in (o, o - 1, o + 1):
            for q in Bd.get(oo, ()): diffs[q - p] += 1
    best = (0.0, None)
    for T, _ in diffs.most_common(3):
        used, m = set(), 0
        for o, p in A:
            for oo in (o, o - 1, o + 1):
                if (oo, p + T) not in used and (p + T) in Bd.get(oo, ()):
                    used.add((oo, p + T)); m += 1; break
        s = 2 * m / (len(A) + len(B))
        if s > best[0]: best = (s, T)
    return best


def dilate(m): return m | (m << 1) | (m >> 1)
