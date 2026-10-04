"""Is Toby Fox's rate different from the baselines, and how much does it depend on whose transcription we trust?

Reads stats_<corpus>.json (written by stats.py).  Prints Fisher exact tests on track counts, a
Mann-Whitney test on per-track change rates, and the Undertale range over every transcription.
"""
import json
from collections import defaultdict
from scipy.stats import fisher_exact, mannwhitneyu
import form as F, stats as S

either = lambda x: (x['reg'] or x['timbre']) and not x['kind'].startswith('transposed')
trn = lambda x: x['kind'].startswith('transposed')
BASELINES = ['earthbound', 'ff6', 'chrono', 'cavestory']


def songs(corpus):
    return [r for r in json.load(open(f'stats_{corpus}.json'))['songs'] if r['ev']]


def count(rows, pred):
    return sum(1 for r in rows if any(pred(x) for x in r['ev'])), len(rows)


def every_transcription(corpus='undertale'):
    """Song-level rate if a song counts when ANY of its transcriptions shows a change, and when EVERY one does."""
    groups = defaultdict(list)
    for e in json.load(open(f'midi/{corpus}/index.json')):
        if S.SKIP.search(e['title']) or 'GS' in e['title']: continue
        groups[S.base(e['title'])].append(e)
    anyc = allc = n = 0
    for entries in groups.values():
        flags = []
        for e in entries:
            r = F.analyse(f"midi/{corpus}/{e['file']}")
            if r is None or r['gridfit'] < 0.75 or r['cut'] < 8: continue
            fm, label = F.form_map(r)
            ev = [x for x in r['events'] if x['melodic'] and x['fam'] in label]
            if ev: flags.append(any(either(x) for x in ev))
        if flags:
            n += 1; anyc += any(flags); allc += all(flags)
    return anyc, allc, n


if __name__ == '__main__':
    U = songs('undertale')
    for name, pred in [('new octave/instrument', either), ('new key', trn)]:
        a = count(U, pred)
        for b in BASELINES:
            c = count(songs(b), pred)
            p = fisher_exact([[a[0], a[1] - a[0]], [c[0], c[1] - c[0]]])[1]
            print(f"{name:22s} undertale {a[0]}/{a[1]} ({a[0]/a[1]:.0%})  vs {b:10s} {c[0]}/{c[1]} ({c[0]/c[1]:.0%})  Fisher p={p:.4f}")
    rate = lambda rows: [sum(1 for x in r['ev'] if either(x)) / len(r['ev']) for r in rows]
    for b in BASELINES:
        p = mannwhitneyu(rate(U), rate(songs(b)), alternative='greater').pvalue
        print(f"per-track share of returns that change octave/instrument, undertale > {b}: Mann-Whitney p={p:.4f}")
    anyc, allc, n = every_transcription()
    print(f"undertale, over every transcription: any shows a change {anyc}/{n} ({anyc/n:.0%}), every one does {allc}/{n} ({allc/n:.0%})")
