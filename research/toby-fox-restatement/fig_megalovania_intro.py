"""Megalovania, 0:00-0:32, annotated for repetition (Jay Reichard's transcription; the other two agree on the skeleton).

Top: bars 1-4 up close - what changes inside the riff (the two-note head) and what never does (the tail).
Bottom: bars 1-16 - the same bar sixteen times while a layer arrives every 8 seconds.
"""
import mido
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle
import restate as R
from figures import SURFACE, INK, INK2, MUTED, GRID, ROLE, CONTEXT

PATH = 'midi/undertale/Undertale_-_Megalovania_v1_2.mid'
BAR = 4.0                                     # beats per bar (4/4 throughout)
SPB = 0.5                                     # seconds per beat at 120 BPM
HEADS = ['D', 'C', 'B', 'B♭']
plt.rcParams.update({'font.family': 'DejaVu Sans', 'font.size': 10.5, 'axes.edgecolor': '#c3c2b7',
                     'xtick.color': MUTED, 'ytick.color': MUTED})

song = R.load(PATH)
notes = [n for n in song['notes'] if n['s'] < 16 * BAR]
role = {'Saw Lead': 0, 'String Ensemble 1': 1, 'Pick Bass': 2, 'Distortion Guitar': 2, 'Rock Organ': None}
Z = {0: 3, 1: 4, 2: 2, None: 1}
mid = mido.MidiFile(PATH, clip=True)
drums = []
for tr in mid.tracks:
    t = 0
    for m in tr:
        t += m.time
        if m.type == 'note_on' and m.velocity > 0 and m.channel == 9 and t / mid.ticks_per_beat < 16 * BAR:
            drums.append(t / mid.ticks_per_beat)


def roll(ax, lo, hi, x0, x1, only=None):
    ax.set_facecolor(SURFACE)
    for c in range(0, 128, 12):
        if lo <= c <= hi: ax.axhline(c, color=GRID, lw=0.6, zorder=0)
    cs = [c for c in range(0, 128, 12) if lo <= c <= hi]
    ax.set_yticks(cs, [R.pname(c) for c in cs], fontsize=9)
    for b in range(int(x0 // BAR), int(x1 // BAR) + 1):
        ax.axvline(b * BAR, color=GRID if b % 4 else '#c3c2b7', lw=0.6 if b % 4 else 1.0, zorder=0)
    for n in notes:
        g = R.GM[n['prog']]
        if g not in role or (only and g not in only) or n['e'] < x0 or n['s'] > x1: continue
        # a hairline gap at the end of every note, so a repeated note reads as two
        ax.add_patch(Rectangle((n['s'], n['p'] - 0.42), max(n['e'] - n['s'] - 0.05, 0.08), 0.84,
                               color=CONTEXT if role[g] is None else ROLE[role[g]], lw=0, zorder=Z[role[g]]))
    ax.set_xlim(x0, x1); ax.set_ylim(lo, hi)
    for sp in ('top', 'right', 'left'): ax.spines[sp].set_visible(False)
    ax.tick_params(axis='y', length=0)


fig = plt.figure(figsize=(12, 10.6), facecolor=SURFACE)
fig.text(0.012, 0.985, 'Megalovania, 0:00–0:32: one bar of melody, sixteen times', fontsize=14, fontweight='bold', color=INK, va='top')
fig.text(0.012, 0.958, "Jay Reichard's fan transcription (VGMusic). fakt13's and Zumi's independent transcriptions have the same skeleton: "
         'the same riff and head walk,\na new low layer at bar 5, the riff doubled up high in strings with the full kit at bar 9.',
         fontsize=9.5, color=INK2, va='top', linespacing=1.4)
hs = [Rectangle((0, 0), 1, 1, color=c) for c in ROLE[:3] + [CONTEXT]]
fig.legend(hs, ['the riff (Saw Lead)', 'the same riff, two octaves up (strings)', 'new layers underneath (bass, power-chord guitar)',
                'organ chords'],
           loc='upper left', bbox_to_anchor=(0.006, 0.918), ncol=4, frameon=False, fontsize=9.5, labelcolor=INK2, handlelength=1.2)

# --- top: bars 1-4 up close ------------------------------------------------------------------
axA = fig.add_axes([0.06, 0.585, 0.925, 0.255])
roll(axA, 41.5, 66, 0, 4 * BAR, only={'Saw Lead'})
axA.set_title('Bars 1–4 (0:00–0:08) up close: only the first two notes of each bar change', loc='left', fontsize=11, color=INK, pad=26)
heads = sorted([n for n in notes if R.GM[n['prog']] == 'Saw Lead' and n['s'] < 4 * BAR and (n['s'] % BAR) < 0.3],
               key=lambda n: n['s'])
firsts = [n for n in heads if n['s'] % BAR < 0.01]
axA.plot([n['s'] + 0.12 for n in firsts], [n['p'] for n in firsts], color=INK, lw=1.1, zorder=3, marker='o', ms=3.5)
for b, n in enumerate(firsts):
    axA.text(n['s'] + 0.05, n['p'] - 2.2, f"{HEADS[b]} {HEADS[b]}", fontsize=10, color=INK, fontweight='bold', ha='left', va='top')
axA.text(3 * BAR + 0.7, 47.3, 'the head walks down\nD → C → B → B♭', fontsize=9.5, color=INK, va='center')
for b in range(4):   # the tail: identical in every bar
    x0, x1 = b * BAR + 0.5, b * BAR + 3.98
    axA.plot([x0, x0, x1, x1], [64.2, 64.8, 64.8, 64.2], color=INK2, lw=0.9)
    axA.text((x0 + x1) / 2, 65.1, 'tail: D A G♯ G F D F G' if b == 0 else '= the same tail', ha='center', va='bottom',
             fontsize=9, color=INK2)
axA.set_xticks([b * BAR for b in range(5)], ['0:00', '0:02', '0:04', '0:06', '0:08'])
for b in range(4):
    axA.text(b * BAR + 0.05, 66.1 + 1.4, f'bar {b + 1}', fontsize=8.5, color=MUTED, ha='left', va='bottom', clip_on=False)

# --- bottom: bars 1-16 -----------------------------------------------------------------------
axB = fig.add_axes([0.06, 0.125, 0.925, 0.34])
roll(axB, 24, 88, 0, 16 * BAR)
axB.set_title('Bars 1–16 (0:00–0:32): the same bar throughout, with layers arriving at 0:08 and 0:16', loc='left', fontsize=11, color=INK, pad=52)
for b in range(16):
    axB.text(b * BAR + BAR / 2, 88.6, HEADS[b % 4], ha='center', va='bottom', fontsize=8.5, color=INK2, clip_on=False)
sections = [(0, 4, 'riff alone'), (4, 8, 'same riff + bass'), (8, 16, 'same riff + strings two octaves up, + guitar, organ chords and drums')]
for a, b, label in sections:
    x0, x1 = a * BAR + 0.15, b * BAR - 0.15
    axB.plot([x0, x0, x1, x1], [91.2, 91.9, 91.9, 91.2], color=INK, lw=1.0, clip_on=False)
    axB.text((x0 + x1) / 2, 92.3, label, ha='center', va='bottom', fontsize=9.5, color=INK, clip_on=False)
# drum lane under the roll
for t in drums:
    axB.plot([t, t], [25.2, 27.4], color='#9a9993', lw=0.8, zorder=2)
axB.text(0.15, 27.9, 'drums', fontsize=8.5, color=MUTED, va='bottom')
axB.set_xticks([b * BAR for b in range(0, 17, 2)], [f"0:{b * 2:02d}" for b in range(0, 17, 2)])
axB.set_xlabel('time (120 BPM, 4/4; one bar = 2 s)', color=MUTED, fontsize=9)

fig.text(0.012, 0.045, 'Repetition at three scales: the tail repeats every bar (16×), the head walk every 4 bars (4×),\nand the '
         '8-bar block twice, the second time with the riff doubled in a new octave and colour.', fontsize=9.5, color=INK2, va='top', linespacing=1.45)
fig.savefig('fig6_megalovania_intro.png', dpi=150, facecolor=SURFACE)
print('wrote fig6_megalovania_intro.png')
