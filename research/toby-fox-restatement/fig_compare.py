"""Share of tracks where a restated phrase comes back in a new octave/colour vs in a new key, per corpus."""
import json
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from figures import SURFACE, INK, INK2, MUTED, GRID, ROLE

either = lambda x: (x['reg'] or x['timbre']) and not x['kind'].startswith('transposed')
trn = lambda x: x['kind'].startswith('transposed')
src = {k: [r for r in json.load(open(f'stats_{k}.json'))['songs'] if r['ev']]
       for k in ('undertale', 'earthbound', 'ff6', 'chrono', 'cavestory')}
names = {'undertale': 'Undertale — Toby Fox', 'ff6': 'Final Fantasy VI — Uematsu', 'cavestory': 'Cave Story — Pixel',
         'chrono': 'Chrono Trigger — Mitsuda et al.', 'earthbound': 'EarthBound — Suzuki & Tanaka'}
order = ['undertale', 'ff6', 'cavestory', 'chrono', 'earthbound']
rate = lambda k, pred: 100 * sum(any(pred(x) for x in r['ev']) for r in src[k]) / len(src[k])
fig, axes = plt.subplots(1, 2, figsize=(12, 4.4), sharey=True, facecolor=SURFACE,
                         gridspec_kw=dict(left=0.23, right=0.985, top=0.72, bottom=0.21, wspace=0.08))
fig.text(0.012, 0.97, 'When a phrase comes back, does it change colour/octave — or key?', fontsize=13, fontweight='bold', color=INK, va='top')
fig.text(0.012, 0.9, 'Share of tracks (one fan transcription per song, same detector everywhere) with at least one restatement of each kind. '
         'Undertale: 42% for the best\ntranscription of each song, 32–45% depending on whose transcription you trust (whisker).',
         fontsize=9.5, color=INK2, va='top', linespacing=1.35)
for ax, (title, pred) in zip(axes, [('…comes back in a new octave or instrument', either), ('…comes back in a new key', trn)]):
    ax.set_facecolor(SURFACE)
    ys = list(range(len(order)))[::-1]
    vals = [rate(k, pred) for k in order]
    ax.barh(ys, vals, height=0.56, color=ROLE[0], zorder=2)
    for x in (0, 20, 40, 60): ax.axvline(x, color=GRID, lw=0.6, zorder=0)
    ax.set_xlim(0, 70); ax.set_xticks([0, 20, 40, 60], ['0%', '20%', '40%', '60%'])
    ax.set_yticks(ys, [f"{names[k]}  (n={len(src[k])})" for k in order], fontsize=9, color=INK2)
    ax.tick_params(axis='y', length=0); ax.tick_params(axis='x', length=0, labelcolor=MUTED)
    for sp in ('top', 'right', 'left'): ax.spines[sp].set_visible(False)
    ax.set_title(title, loc='left', fontsize=10, color=INK, pad=6)
    if pred is either:
        ax.plot([32, 45], [ys[0], ys[0]], color=INK, lw=1.2, zorder=3)
        for x in (32, 45): ax.plot([x, x], [ys[0] - 0.12, ys[0] + 0.12], color=INK, lw=1.2, zorder=3)
    ax.text(vals[0] + (8 if pred is either else 1.5), ys[0], f"{vals[0]:.0f}%", va='center', fontsize=9.5, color=INK, fontweight='bold')
axes[0].get_yticklabels()[0].set_fontweight('bold')
fig.text(0.012, 0.085, 'Fisher exact tests on track counts. New octave/instrument: Toby vs EarthBound p=0.0008, vs Chrono Trigger p=0.0005, '
         'vs FF6 p=0.18 (n.s.), vs Cave Story p=0.32 (n.s.).\nNew key: Toby vs FF6 p=0.0007, vs Chrono Trigger p=0.11, vs EarthBound p=0.79, vs Cave Story p=1.0. '
         'Source: VGMusic fan MIDIs; detector in this folder.', fontsize=8, color=MUTED, va='top', linespacing=1.4)
fig.savefig('fig5_compare.png', dpi=150, facecolor=SURFACE)
print('wrote fig5_compare.png', [round(rate(k, either)) for k in order], [round(rate(k, trn)) for k in order])
