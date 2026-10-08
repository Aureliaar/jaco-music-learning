"""The Megalovania bar on its own: ten notes, where they fall against the beat, and the four heads."""
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch
from figures import SURFACE, INK, INK2, MUTED, GRID, ROLE

NAMES = "C C♯ D E♭ E F F♯ G G♯ A B♭ B".split()
pn = lambda m: NAMES[m % 12] + str(m // 12 - 1)
# (step of 16, midi, length in steps) - the tail, identical in every bar
TAIL = [(2, 62, 2), (4, 57, 3), (7, 56, 2), (9, 55, 2), (11, 53, 2), (13, 50, 1), (14, 53, 1), (15, 55, 1)]
HEADS = [(50, 'D'), (48, 'C'), (47, 'B'), (46, 'B♭')]
plt.rcParams.update({'font.family': 'DejaVu Sans'})

fig = plt.figure(figsize=(11, 7.4), facecolor=SURFACE)
fig.text(0.03, 0.965, 'The Megalovania bar', fontsize=17, fontweight='bold', color=INK, va='top')
fig.text(0.03, 0.915, 'Ten sixteenth-note slots used out of sixteen. Two notes change from bar to bar (the head); eight never do (the tail).',
         fontsize=10.5, color=INK2, va='top')
ax = fig.add_axes([0.08, 0.2, 0.9, 0.62]); ax.set_facecolor(SURFACE)
lo, hi = 44.5, 63.8
for st in range(0, 17, 4):    # a ruling per beat, one per C - never a grid (Folio migraine rule)
    ax.axvline(st, color='#c9c6b8', lw=1.0, zorder=0)
for m in (48, 60):
    ax.axhline(m, color=GRID, lw=0.6, zorder=0)
ax.set_yticks([46, 48, 50, 53, 55, 57, 60, 62], [pn(m) for m in (46, 48, 50, 53, 55, 57, 60, 62)], fontsize=9, color=MUTED)

def note(st, m, ln, col, label, ghost=False):
    ax.add_patch(FancyBboxPatch((st + 0.08, m - 0.38), ln - 0.16, 0.76, boxstyle='round,pad=0,rounding_size=0.25',
                 fc='none' if ghost else col, ec=col, lw=1.6, zorder=3))
    if label: ax.text(st + 0.12, m + 0.65, label, fontsize=10, color=INK, fontweight='bold', zorder=4)

for st, m, ln in TAIL: note(st, m, ln, ROLE[0], NAMES[m % 12])
for i, (m, nm) in enumerate(HEADS):   # bar 1's head solid, the other three as outlines
    for st in (0, 1): note(st, m, 1, ROLE[1], None, ghost=i > 0)
    ax.text(-0.15, m, nm, ha='right', va='center', fontsize=10, color=ROLE[1] if i == 0 else INK2, fontweight='bold')
ax.text(0.05, 51.1, 'head', fontsize=10, color=ROLE[1], fontweight='bold')
ax.annotate('', xy=(0.5, 46.3), xytext=(0.5, 49.6), arrowprops=dict(arrowstyle='->', color=ROLE[1], lw=1.2))
ax.text(2.2, 47.2, 'bar 1: D · bar 2: C · bar 3: B · bar 4: B♭\n(then round again)', fontsize=9, color=INK2, va='center')
ax.plot([2.05, 15.95], [63.3, 63.3], color=INK2, lw=1); ax.plot([2.05, 2.05], [63.0, 63.3], color=INK2, lw=1); ax.plot([15.95, 15.95], [63.0, 63.3], color=INK2, lw=1)
ax.text(9, 63.45, 'tail: the same eight notes in every bar', ha='center', fontsize=10, color=INK2)
ax.set_xlim(-1.7, 16.2); ax.set_ylim(lo, hi)
ax.set_xticks([0, 4, 8, 12], ['beat 1', 'beat 2', 'beat 3', 'beat 4'], fontsize=10, color=INK)
for sp in ('top', 'right', 'left'): ax.spines[sp].set_visible(False)
ax.tick_params(length=0)

# where each note falls: on a beat, or between
ax2 = fig.add_axes([0.08, 0.07, 0.9, 0.07]); ax2.set_xlim(-1.7, 16.2); ax2.set_ylim(0, 1); ax2.axis('off')
counts = ['1', 'e', '&', 'a', '2', 'e', '&', 'a', '3', 'e', '&', 'a', '4', 'e', '&', 'a']
used = {0, 1} | {st for st, _, _ in TAIL}
for st, c in enumerate(counts):
    on = st in used
    ax2.text(st + 0.5, 0.55, c, ha='center', va='center', fontsize=11, fontweight='bold' if on else 'normal',
             color=(ROLE[1] if st < 2 else ROLE[0]) if on else '#bdbab0')
ax2.text(-1.6, 0.55, 'count', fontsize=9, color=MUTED, va='center')
ax2.text(8.0, -0.25, 'Nothing lands on beat 3 or 4: after beat 2 every note falls between the beats, so the bar leans into the next one.',
         ha='center', fontsize=9.5, color=INK2, va='top')
fig.savefig('fig7_megalovania_bar.png', dpi=150, facecolor=SURFACE)
print('ok')
