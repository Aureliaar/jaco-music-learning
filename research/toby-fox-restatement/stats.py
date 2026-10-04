import json, os, re, sys
from collections import Counter, defaultdict
import form as F

SKIP = re.compile(r'(?i)arrange|remix|medley|orchestr|techno|metal ver|\bmix\b|cover|jazz|piano ver|acoustic|rock ver|8-?bit|unused|sound ?test|jingle|fanfare$')

def base(title):
    t = re.sub(r'\s*\((\d+|v[\d.]+|\d+\)\s*\(v[\d.]+|GS)\)\s*', ' ', title)
    t = re.sub(r'\s*\(\d+\)\s*\(v[\d.]+\)', '', t)
    return re.sub(r'\s+', ' ', t).strip().lower()

def run_corpus(d, pick_one=True):
    idx = json.load(open(f'midi/{d}/index.json'))
    groups = defaultdict(list)
    for e in idx:
        if SKIP.search(e['title']): continue
        groups[base(e['title'])].append(e)
    songs = []
    for name, entries in groups.items():
        cands = []
        for e in entries:
            try: r = F.analyse(f"midi/{d}/{e['file']}")
            except Exception as ex: continue
            if r is None or r['gridfit'] < 0.75 or r['cut'] < 8: continue
            r['title'], r['sequencer'] = e['title'], e.get('sequencer', '')
            cands.append(r)
        if not cands: continue
        if pick_one:
            cands.sort(key=lambda r: (-round(r['gridfit'], 1), -r['cut']))
            cands = cands[:1]
        for r in cands:
            fm, label = F.form_map(r)
            r['ev'] = [x for x in r['events'] if x['melodic'] and x['fam'] in label]
            r['song'] = name
            del r['_win']
            songs.append(r)
    return songs

def summarize(songs, name):
    ev = [x for r in songs for x in r['ev']]
    k = Counter(x['kind'] for x in ev)
    n = len(ev)
    with_ev = [r for r in songs if r['ev']]
    def rate(pred):
        return sum(1 for x in ev if pred(x)) / n if n else 0
    def per_song(pred):
        vals = [sum(1 for x in r['ev'] if pred(x)) / len(r['ev']) for r in with_ev]
        return sum(vals) / len(vals) if vals else 0
    def presence(pred):
        return sum(1 for r in with_ev if any(pred(x) for x in r['ev'])) / len(with_ev) if with_ev else 0
    lit = lambda x: x['kind'] == 'literal'
    reg = lambda x: x['reg'] and not x['kind'].startswith('transposed')
    tim = lambda x: x['timbre'] and not x['kind'].startswith('transposed')
    either = lambda x: (x['reg'] or x['timbre']) and not x['kind'].startswith('transposed')
    trn = lambda x: x['kind'].startswith('transposed')
    row = dict(corpus=name, songs=len(songs), songs_with_restatements=len(with_ev), events=n,
               kinds=dict(k.most_common()),
               pooled=dict(literal=rate(lit), register=rate(reg), timbre=rate(tim), either=rate(either), transposed=rate(trn)),
               per_song_mean=dict(literal=per_song(lit), register=per_song(reg), timbre=per_song(tim), either=per_song(either), transposed=per_song(trn)),
               songs_with_any=dict(register=presence(reg), timbre=presence(tim), either=presence(either), transposed=presence(trn)))
    return row

if __name__ == '__main__':
    import fetch
    for d in sys.argv[1:] or list(fetch.CORPORA):
        songs = run_corpus(d)
        row = summarize(songs, d)
        json.dump(dict(summary=row, songs=songs), open(f'stats_{d}.json', 'w'), default=str)
        print(json.dumps({k: row[k] for k in ('corpus', 'songs', 'songs_with_restatements', 'events', 'songs_with_any')}, default=str))
