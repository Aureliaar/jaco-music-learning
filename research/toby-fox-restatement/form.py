"""Statement-level restatement analysis.

The song (one pass of its loop) is cut into L-bar chunks on the phase that
finds the most matches.  Every voice's top line in every chunk is a window;
windows that match under some transposition are unioned into a *family*
(one phrase), each window carrying its pitch offset from the family root.
A family's *statement* at chunk c is the set of carriers (voice, program,
offset) playing it there.  A restatement event compares a statement with the
family's previous one: literal, octave, timbre, octave+timbre, transposed.
"""
import sys, json
from collections import defaultdict, Counter
import restate as R

L = R.L


def chunk_windows(bars, starts, cut, phase):
    win = {}
    voices = sorted({v for b in bars for v in bars[b]})
    for v in voices:
        for c, b in enumerate(range(phase, cut - L + 1, L)):
            pts, progs, off = [], Counter(), 0
            for k in range(L):
                for (o, p, pr, d) in bars.get(b + k, {}).get(v, []):
                    pts.append((off + o, p)); progs[pr] += 1
                off += round((starts[b + k + 1] - starts[b + k]) * R.Q)
            if not pts: continue
            top = {}
            for o, p in pts:
                if o not in top or p > top[o]: top[o] = p
            line = sorted(top.items())
            if len(line) < R.MIN_NOTES or len({p % 12 for _, p in line}) < R.MIN_PCS: continue
            mask = 0
            for o, _ in line: mask |= 1 << o
            win[(v, c)] = dict(line=line, prog=progs.most_common(1)[0][0], bar=b,
                               mean=sum(p for _, p in line) / len(line), mask=mask)
    return win


def all_matches(win):
    keys = sorted(win, key=lambda k: (k[1], k[0]))
    out = []
    for i, ka in enumerate(keys):
        a = win[ka]; da = R.dilate(a['mask']); na = len(a['line'])
        for kb in keys[i + 1:]:
            b = win[kb]; nb_ = len(b['line'])
            if min(na, nb_) / max(na, nb_) < R.SIM - 0.1: continue
            if bin(da & b['mask']).count('1') < (R.SIM - 0.1) * max(na, nb_): continue
            s, T = R.match(a, b)
            if s >= R.SIM: out.append((ka, kb, T, s))
    return out


def families(win, matches):
    adj = defaultdict(list)
    for ka, kb, T, s in matches:
        adj[ka].append((kb, T)); adj[kb].append((ka, -T))
    seen, fams = {}, []
    for k in sorted(win, key=lambda k: (k[1], -win[k]['mean'])):
        if k in seen or k not in adj: continue
        off = {k: 0}; stack = [k]
        while stack:
            x = stack.pop()
            for y, T in adj[x]:
                if y not in off: off[y] = off[x] + T; stack.append(y)
        for y in off: seen[y] = len(fams)
        fams.append(off)
    return fams, seen


def analyse(path, song=None):
    song = song or R.load(path)
    if not song['notes']: return None
    starts, bars, nb = R.per_bar(song)
    cut, loopinfo = R.loop_cut(bars, nb)
    best = None
    for phase in range(L):
        win = chunk_windows(bars, starts, cut, phase)
        m = all_matches(win)
        score = sum(1 for ka, kb, T, s in m if ka[1] != kb[1])
        if best is None or score > best[0]: best = (score, phase, win, m)
    _, phase, win, matches = best
    _win_raw = win
    fams, fam_of = families(win, matches)
    nchunks = max((c for _, c in win), default=-1) + 1
    # top line per chunk: the highest window there
    top = {}
    for (v, c), w in win.items():
        if c not in top or w['mean'] > win[top[c]]['mean']: top[c] = (v, c)
    fam_info = []
    for fi, off in enumerate(fams):
        stm = defaultdict(list)
        for (v, c), o in off.items():
            stm[c].append(dict(voice=v, prog=win[(v, c)]['prog'], off=o, mean=win[(v, c)]['mean']))
        chunks = sorted(stm)
        # ostinato: the phrase recurs in back-to-back chunks in the same voice at the same pitch, for most of its life
        backtoback = sum(1 for c in chunks if c - 1 in stm and
                         any((x['voice'], x['off']) == (y['voice'], y['off']) for x in stm[c] for y in stm[c - 1]))
        root_mean = sum(win[k]['mean'] - o for k, o in off.items()) / len(off)
        is_top = sum(1 for c in chunks if any(top.get(c) == (x['voice'], c) for x in stm[c]))
        pcs = len({p % 12 for k in off for _, p in win[k]['line']})
        fam_info.append(dict(id=fi, chunks=chunks, statements={c: stm[c] for c in chunks},
                             ostinato=backtoback >= max(2, len(chunks) // 2), top_count=is_top,
                             root_mean=root_mean, pcs=pcs))
    events = []
    for f in fam_info:
        ch = f['chunks']
        sig = lambda c: frozenset((x['prog'], x['off']) for x in f['statements'][c])
        # blocks: maximal runs of back-to-back chunks with identical carriers
        blocks = []
        for c in ch:
            if blocks and c == blocks[-1][-1] + 1 and sig(c) == sig(blocks[-1][-1]):
                blocks[-1].append(c)
            else:
                blocks.append([c])
        f['blocks'] = [(b[0], b[-1]) for b in blocks]
        f['internal_repeats'] = sum(len(b) - 1 for b in blocks)
        root = f['root_mean']
        f['role'] = 'bass' if root < 48 else ('lead' if f['top_count'] > 0 else 'inner')
        for i in range(1, len(blocks)):
            c1, c2 = blocks[i - 1][-1], blocks[i][0]
            S1, S2 = f['statements'][c1], f['statements'][c2]
            ev = compare(S1, S2)
            ev.update(fam=f['id'], c1=c1, c2=c2, gap=c2 - c1 - 1,
                      bar1=win[(S1[0]['voice'], c1)]['bar'] + 1, bar2=win[(S2[0]['voice'], c2)]['bar'] + 1,
                      role=f['role'], melodic=f['role'] != 'bass')
            events.append(ev)
        f['doubled'] = {c: sorted({x['off'] for x in f['statements'][c]}) for c in ch
                        if len({x['off'] for x in f['statements'][c]}) > 1 or len({x['prog'] for x in f['statements'][c]}) > 1}
    tempo = song['tempos'][0][1] if song['tempos'] else 120.0
    gridfit = sum(1 for n in song['notes'] if abs(n['s'] * R.Q - round(n['s'] * R.Q)) < 0.1) / len(song['notes'])
    return dict(gridfit=round(gridfit, 3), echoes=song['echoes'], file=path.split('/')[-1], bars=nb, cut=cut, loop=loopinfo, phase=phase, tempo=round(tempo, 1),
                nchunks=nchunks, families=fam_info, events=events, top=top,
                chunkbar={c: phase + c * L + 1 for c in range(nchunks)},
                win={f"{k[0]}|{k[1]}": dict(prog=w['prog'], mean=round(w['mean'], 1)) for k, w in win.items()}, _win=_win_raw)


def compare(S1, S2):
    A = {(x['prog'], x['off']) for x in S1}; B = {(x['prog'], x['off']) for x in S2}
    top1 = max(x['off'] for x in S1); top2 = max(x['off'] for x in S2)
    P1 = {x['prog'] for x in S1}; P2 = {x['prog'] for x in S2}
    O1 = {x['off'] for x in S1}; O2 = {x['off'] for x in S2}
    if A == B: kind = 'literal'
    elif {o % 12 for o in O1} != {o % 12 for o in O2}:
        kind = 'transposed' + ('+timbre' if P1 != P2 else '')
    elif A < B:
        kind = 'layer+oct' if (O2 - O1) else 'layer+timbre'   # everything kept, something added
    elif B < A:
        kind = 'thin-oct' if (O1 - O2) else 'thin-timbre'
    else:
        reg, timbre = O1 != O2, P1 != P2
        kind = 'octave+timbre' if reg and timbre else 'octave' if reg else 'timbre' if timbre else 'revoiced'
    return dict(kind=kind, reg=O1 != O2, timbre=P1 != P2, dtop=top2 - top1, n1=len(S1), n2=len(S2),
                new_oct=sorted(O2 - O1), lost_oct=sorted(O1 - O2),
                add=sorted(R.GM[p] for p in P2 - P1), drop=sorted(R.GM[p] for p in P1 - P2),
                s1=[(R.GM[x['prog']], R.pname(round(x['mean']))) for x in sorted(S1, key=lambda x: -x['mean'])],
                s2=[(R.GM[x['prog']], R.pname(round(x['mean']))) for x in sorted(S2, key=lambda x: -x['mean'])])


def form_map(r, only_melodic=True):
    """letters for melodic families in order of first appearance; one line per chunk."""
    fams = [f for f in r['families'] if (not only_melodic) or f.get('role') != 'bass']
    fams.sort(key=lambda f: f['chunks'][0])
    label = {}
    for f in fams:
        if len(f['chunks']) < 2: continue
        label[f['id']] = chr(ord('A') + len(label)) if len(label) < 26 else f"Z{len(label)}"
    lines = []
    for c in range(r['nchunks']):
        parts = []
        for f in fams:
            if f['id'] in label and c in f['statements']:
                S = sorted(f['statements'][c], key=lambda x: -x['mean'])
                parts.append(f"{label[f['id']]}[" + " + ".join(f"{R.GM[x['prog']]}@{R.pname(round(x['mean']))}" for x in S) + "]")
        lines.append(f"  bar {r['chunkbar'][c]:>3}: " + ("  ".join(parts) if parts else "·"))
    return "\n".join(lines), label


if __name__ == '__main__':
    r = analyse(sys.argv[1])
    print(r['file'], 'bars', r['bars'], 'cut', r['cut'], 'loop', r['loop'], 'phase', r['phase'], 'tempo', r['tempo'])
    fm, label = form_map(r)
    print(fm)
    print("events (melodic families):")
    for e in r['events']:
        if e['melodic'] and e['fam'] in label:
            print(f"  {label[e['fam']]} ({e['role']}) gap={e['gap']} bar {e['bar1']:>3} -> {e['bar2']:>3}  {e['kind']:16s} dtop={e['dtop']:+d}  "
                  f"{' + '.join(a+'@'+b for a,b in e['s1'])}  =>  {' + '.join(a+'@'+b for a,b in e['s2'])}")
