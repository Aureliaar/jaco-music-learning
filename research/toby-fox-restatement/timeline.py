"""Every transcription of a song, its octave/timbre events on a shared clock (seconds)."""
import json, sys, re
from collections import defaultdict
import restate as R, form as F, stats as S

def sec_of_beat(song, beat):
    tm = sorted(song['tempos']) or [(0.0, 120.0)]
    if tm[0][0] > 0: tm.insert(0, (0.0, tm[0][1]))
    t, prev_b, prev_bpm = 0.0, 0.0, tm[0][1]
    for b, bpm in tm[1:]:
        if b >= beat: break
        t += (b - prev_b) * 60 / prev_bpm; prev_b, prev_bpm = b, bpm
    return t + (beat - prev_b) * 60 / prev_bpm

def events_with_time(path):
    song = R.load(path)
    r = F.analyse(path, song)
    fm, label = F.form_map(r)
    starts = R.bar_starts(song['ts'], max(n['e'] for n in song['notes']))
    out = []
    for x in r['events']:
        if not (x['melodic'] and x['fam'] in label): continue
        if not ((x['reg'] or x['timbre']) and not x['kind'].startswith('transposed')): continue
        t1 = sec_of_beat(song, starts[x['bar1'] - 1]); t2 = sec_of_beat(song, starts[x['bar2'] - 1])
        out.append(dict(t1=t1, t2=t2, **{k: x[k] for k in ('kind', 'dtop', 'bar1', 'bar2', 's1', 's2')}))
    return r, out

if __name__ == '__main__':
    idx = json.load(open('midi/undertale/index.json'))
    groups = defaultdict(list)
    for e in idx:
        if S.SKIP.search(e['title']) or 'GS' in e['title']: continue
        groups[S.base(e['title'])].append(e)
    for name, entries in groups.items():
        if len(entries) < 2: continue
        print(f"######## {name}")
        for e in entries:
            r, ev = events_with_time('midi/undertale/' + e['file'])
            print(f"  [{e['sequencer']}] gridfit={r['gridfit']} tempo={r['tempo']} loop-pass bars={r['cut']}  changes={len(ev)}")
            for x in sorted(ev, key=lambda x: x['t2']):
                print(f"     {x['t1']:6.1f}s -> {x['t2']:6.1f}s  {x['kind']:13s} dtop={x['dtop']:+3d}  {'+'.join(a for a,_ in x['s1'])}@{x['s1'][0][1]} => {'+'.join(a for a,_ in x['s2'])}@{x['s2'][0][1]}")
