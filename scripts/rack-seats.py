# -*- coding: utf-8 -*-
"""Fill the rack's seats.

   The rack was built with one instrument a voice, on MIDI channels 1-3 —
   seat 0. The renderer seats after it (voice + seat*3, so channels 4-6 are
   seat 1 and 7-9 seat 2) had no tracks, which is why Folio's voices screen
   drew one instrument a voice and walking it did nothing.

   This adds those tracks. A track is a clone of the voice's own seat-0 track
   with four things changed: its GUIDs, its name, the MIDI channel it listens
   on, and the SINE state in its FX chain.

   The states are LIFTED, never built. SINE's saved plugin state carries
   something the library database does not — the instrument's own internals
   come out of encrypted `.otmeta` sample metadata — so a state assembled by
   hand loads nothing and renders silence, however correct its instrument,
   articulation and mic ids are. A state SINE itself wrote can be moved to any
   track and any channel and plays exactly as it did. So every instrument here
   comes out of a project that once held it:

     rack/Folio Sound Rack.rpp            Ratio piano, Crux J-bass, Roads Rhodes
     tmp/reaper-audition/03-wide-field-sine-lineup.rpp
                                          + Clutch Tonewheel Organ,
                                            Spindle Felt Piano,
                                            Helix Whole String Ensemble

   To put an instrument here that no project has held yet, load it once in
   SINE's own UI, save that project, and add it to SOURCES below.

   Run with the rack closed:  python scripts/rack-seats.py
"""
import base64, json, os, re, shutil, sys, uuid

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RACK = os.path.join(ROOT, 'rack', 'Folio Sound Rack.rpp')
SOURCES = [RACK, os.path.join(ROOT, 'tmp', 'reaper-audition',
                              '03-wide-field-sine-lineup.rpp')]
LANES = 3
REC_BASE = 5088          # REAPER's MIDI recinput: 4096 + (device << 5) + channel

# voice, seat, the instrument's title in the state SINE wrote, and the name the
# rail will read. Seat 0 is what the rack already has and is never rebuilt.
SEATS = [
    (0, 1, 'Whole String Ensemble', 'Helix strings'),
    (0, 2, 'Felt Piano',            'Spindle felt piano'),
    (1, 1, 'Piano',                 'Ratio piano'),
    (1, 2, 'Tonewheel Organ',       'Clutch organ'),
    (2, 1, 'Felt Piano',            'Spindle felt piano'),
    (2, 2, 'Whole String Ensemble', 'Helix strings'),
]
VOICE_NAME = ['LEAD', 'BASS', 'CHORDS']


# ---------------------------------------------------------------- reading

def read(path):
    return open(path, encoding='utf-8', errors='replace').read().split('\n')


def track_blocks(lines):
    """[(start, end)] for every top-level <TRACK>, end exclusive."""
    out = []
    for i, l in enumerate(lines):
        if not l.startswith('  <TRACK'):
            continue
        depth = 0
        for j in range(i, len(lines)):
            s = lines[j].strip()
            if s.startswith('<'):
                depth += 1
            elif s == '>':
                depth -= 1
                if depth == 0:
                    out.append((i, j + 1))
                    break
    return out


def vst_span(lines, a, b):
    """the <VST …> … > span inside one track block, end exclusive"""
    v = next(i for i in range(a, b) if lines[i].strip().startswith('<VST "VST3i: SINE'))
    e = next(i for i in range(v + 1, b) if lines[i].strip() == '>')
    return v, e + 1


def segments(body):
    """REAPER wraps each base64 segment of a plugin chunk separately; a segment
       ends on its run of '=' padding. Re-wrapping the concatenation makes SINE
       load nothing, silently, so the parts are kept apart."""
    b, out, i = ''.join(x.strip() for x in body), [], 0
    while i < len(b):
        j = b.find('=', i)
        if j < 0:
            out.append(b[i:]); break
        k = j
        while k < len(b) and b[k] == '=':
            k += 1
        out.append(b[i:k]); i = k
    return out


def state_of(segs):
    raw = base64.b64decode(segs[1])
    return json.loads(re.search(rb'\{.*\}', raw, re.S).group(0).decode('utf8'))


def harvest():
    """every SINE state any of the source projects holds, by instrument title"""
    pool = {}
    for path in SOURCES:
        if not os.path.exists(path):
            continue
        lines = read(path)
        for a, b in track_blocks(lines):
            try:
                v, e = vst_span(lines, a, b)
            except StopIteration:
                continue
            segs = segments(lines[v + 1:e - 1])
            try:
                st = state_of(segs)
            except Exception:
                continue
            title = st['instruments'][0].get('title')
            if title and title not in pool:
                pool[title] = segs
    return pool


# ---------------------------------------------------------------- writing

def guid():
    return '{' + str(uuid.uuid4()).upper() + '}'


def rechan(channel):
    return REC_BASE + channel


def clone(lines, a, b, segs, name, channel):
    """one seat-0 track block, made into another seat's"""
    out = lines[a:b]
    v, e = vst_span(out, 0, len(out))
    chunk = []
    for part in segs:
        chunk += ['        ' + part[i:i + 128] for i in range(0, len(part), 128)]
    out[v + 1:e - 1] = chunk

    g = guid()
    done = {'name': False, 'rec': False}
    for i, l in enumerate(out):
        s = l.strip()
        if s.startswith('<TRACK '):
            out[i] = '  <TRACK ' + g
        elif s.startswith('TRACKID '):
            out[i] = '    TRACKID ' + g
        elif s.startswith('FXID '):
            out[i] = '      FXID ' + guid()
        elif s.startswith('NAME ') and not done['name']:
            out[i] = '    NAME "%s"' % name
            done['name'] = True
        elif s.startswith('REC ') and not done['rec']:
            f = s.split()
            f[2] = str(rechan(channel))
            out[i] = '    ' + ' '.join(f)
            done['rec'] = True
        elif s.startswith('SEL '):
            out[i] = '    SEL 0'
    assert done['name'] and done['rec'], 'track %s: nothing to rename or rewire' % name
    return out


def main():
    pool = harvest()
    print('states available:', ', '.join(sorted(pool)))

    lines = read(RACK)
    blocks = track_blocks(lines)
    assert len(blocks) >= LANES, 'the rack has fewer tracks than it has voices'
    base = {v: blocks[v] for v in range(LANES)}

    # every seat this run would add, in one pass, so the existing block
    # boundaries stay valid while they are being read
    made, missing = [], []
    for voice, seat, title, label in SEATS:
        if title not in pool:
            missing.append(title); continue
        a, b = base[voice]
        channel = voice + 1 + seat * LANES
        name = '%s — %s — MIDI %d' % (VOICE_NAME[voice], label, channel)
        if any(('NAME "%s"' % name) == l.strip() for l in lines):
            print('already there:', name); continue
        made.append((name, clone(lines, a, b, pool[title], name, channel)))
    if missing:
        print('NOT IN ANY PROJECT (load once in SINE and add the project to '
              'SOURCES): ' + ', '.join(sorted(set(missing))))
    if not made:
        print('nothing to add'); return

    end = blocks[-1][1]
    out = lines[:end]
    for name, block in made:
        out += block
        print('added', name)
    out += lines[end:]

    shutil.copyfile(RACK, RACK + '.bak')
    open(RACK, 'w', encoding='utf-8', newline='').write('\n'.join(out))
    print('wrote', RACK, '(previous kept as .bak)')


if __name__ == '__main__':
    main()
