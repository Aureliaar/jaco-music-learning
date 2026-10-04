"""Piano rolls of restated phrases, one panel per independent transcription, on a shared clock (seconds).

Colour is the note's ROLE in the restatement (same meaning in every panel), never the GM patch,
because each transcriber picked their own patch for the same original sound.  A panel's rules say
which programme carries which role in which time span; with auto=True a note is only coloured if
the detector also put it in a phrase family (so accompaniment on the same patch stays grey).
"""
import bisect
from collections import defaultdict
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle
import restate as R, form as F
from timeline import sec_of_beat

SURFACE, INK, INK2, MUTED, GRID = '#fcfcfb', '#0b0b0b', '#52514e', '#898781', '#e1e0d9'
ROLE = ['#2a78d6', '#eb6834', '#1baf7a']          # categorical slots 1-3 (validated all-pairs)
CONTEXT = '#dcdbd5'
plt.rcParams.update({'font.family': 'DejaVu Sans', 'font.size': 10, 'axes.edgecolor': '#c3c2b7',
                     'axes.labelcolor': MUTED, 'xtick.color': MUTED, 'ytick.color': MUTED})


def family_onsets(path, song):
    """{(voice, pitch): sorted onset beats} for every note the detector placed in a phrase family."""
    r = F.analyse(path, song)
    starts = R.bar_starts(song['ts'], max(n['e'] for n in song['notes']))
    win, out = r['_win'], defaultdict(list)
    for f in r['families']:
        for c in f['chunks']:
            for x in f['statements'][c]:
                w = win[(x['voice'], c)]
                for o, p in w['line']:
                    out[(x['voice'], p)].append(starts[w['bar']] + o / R.Q)
    for k in out: out[k].sort()
    return out


def in_family(fo, n, tol=0.6 / R.Q):
    lst = fo.get((n['voice'], n['p']))
    if not lst: return False
    i = bisect.bisect_left(lst, n['s'] - tol)
    return i < len(lst) and lst[i] <= n['s'] + tol


def panel_notes(path, rules, t0, t1):
    song = R.load(path)
    fo = family_onsets(path, song)
    out = []
    for n in song['notes']:
        s, e = sec_of_beat(song, n['s']), sec_of_beat(song, n['e'])
        if e < t0 or s > t1: continue
        role = None
        for prog, a, b, rl, auto in rules:
            if R.GM[n['prog']] == prog and a <= s < b and (not auto or in_family(fo, n)):
                role = rl; break
        out.append((s, e, n['p'], role))
    return out


def draw(ax, notes, t0, t1, who, marks, legend_bits):
    ax.set_facecolor(SURFACE)
    ps = [p for _, _, p, rl in notes if rl is not None] or [p for _, _, p, _ in notes]
    allp = [p for _, _, p, _ in notes]
    lo, hi = max(min(allp), min(ps) - 14) - 1, min(max(allp), max(ps) + 10) + 2
    cs = [c for c in range(0, 128, 12) if lo <= c <= hi]
    ax.set_yticks(cs, [R.pname(c) for c in cs], fontsize=8)
    for c in cs: ax.axhline(c, color=GRID, lw=0.6, zorder=0)
    for s, e, p, rl in notes:
        if rl is None and lo <= p <= hi:
            ax.add_patch(Rectangle((max(s, t0), p - 0.4), min(e, t1) - max(s, t0), 0.8, color=CONTEXT, lw=0, zorder=1))
    # coloured notes; a unison shared by several roles is split so every layer stays visible
    groups = defaultdict(list)
    for s, e, p, rl in notes:
        if rl is not None: groups[(round(s, 2), p)].append((s, e, rl))
    for (_, p), lst in groups.items():
        roles = sorted({rl for _, _, rl in lst})
        s = min(x[0] for x in lst); e = max(x[1] for x in lst)
        h = 0.84 / len(roles)
        for i, rl in enumerate(roles):
            ax.add_patch(Rectangle((max(s, t0), p - 0.42 + i * h), min(e, t1) - max(s, t0), h,
                                   color=ROLE[rl], lw=0, zorder=2))
    for t, text in marks:
        ax.axvline(t, color=INK2, lw=0.9, zorder=3)
        ax.text(t + 0.12, hi - 0.3, text, color=INK, fontsize=8.5, va='top', ha='left', zorder=4,
                bbox=dict(boxstyle='round,pad=0.25', fc=SURFACE, ec='none', alpha=0.9))
    ax.set_xlim(t0, t1); ax.set_ylim(lo, hi)
    for sp in ('top', 'right', 'left'): ax.spines[sp].set_visible(False)
    ax.tick_params(axis='y', length=0)
    ax.set_title(who, loc='left', fontsize=10, color=INK, pad=5)
    ax.set_title(legend_bits, loc='right', fontsize=8.5, color=INK2, pad=5)


def figure(title, subtitle, roles, panels, t0, t1, marks, out):
    import textwrap
    sub = textwrap.wrap(subtitle, 150)
    head = 0.42 + 0.22 * len(sub) + 0.42          # title, subtitle lines, legend row (inches)
    H = 2.75 * len(panels) + head + 0.6
    fig = plt.figure(figsize=(12, H), facecolor=SURFACE)
    fig.text(0.012, 1 - 0.18 / H, title, ha='left', va='top', fontsize=13, color=INK, fontweight='bold')
    fig.text(0.012, 1 - 0.48 / H, "\n".join(sub), ha='left', va='top', fontsize=9.5, color=INK2, linespacing=1.35)
    # shared legend on its own row: role colour -> meaning (instrument names are per panel)
    hs = [Rectangle((0, 0), 1, 1, color=ROLE[i]) for i in range(len(roles))] + [Rectangle((0, 0), 1, 1, color=CONTEXT)]
    fig.legend(hs, roles + ['everything else'], loc='upper left', bbox_to_anchor=(0.006, 1 - (0.5 + 0.22 * len(sub)) / H),
               ncol=len(hs), frameon=False, fontsize=8.5, labelcolor=INK2, handlelength=1.2)
    top = 1 - (head + 0.25) / H
    axes = fig.subplots(len(panels), 1, sharex=True, gridspec_kw=dict(top=top, bottom=0.6 / H,
                                                                     left=0.045, right=0.99, hspace=0.38))
    if len(panels) == 1: axes = [axes]
    for ax, (path, who, rules, bits) in zip(axes, panels):
        draw(ax, panel_notes(path, rules, t0, t1), t0, t1, who, marks, bits)
    axes[-1].set_xlabel('seconds into the track (each transcription on its own tempo map)')
    fig.savefig(out, dpi=150, facecolor=SURFACE)
    plt.close(fig)
    print('wrote', out)


INF = 1e9
U = 'midi/undertale/'

if __name__ == '__main__':
    figure('Megalovania: at 16 s the riff gains a high string doubling',
           'Three independent fan transcriptions (VGMusic). All three add the same riff in strings at C5–C6 at the same second, over the riff that keeps going.',
           ['the riff as first heard', 'the same riff, new high layer'],
           [(U + 'megalovania_by_fakt13.mid', 'fakt13',
             [('Distortion Guitar', 0, INF, 0, True), ('String Ensemble 1', 0, INF, 1, True), ('Orchestra Hit', 0, INF, 1, True)],
             'riff: Distortion Guitar  ·  layer: String Ensemble + Orchestra Hit'),
            (U + 'Undertale_-_Megalovania_v1_2.mid', 'Jay Reichard',
             [('Saw Lead', 0, INF, 0, True), ('String Ensemble 1', 0, INF, 1, True)],
             'riff: Saw Lead  ·  layer: String Ensemble'),
            (U + 'megalovania3.mid', 'Zumi',
             [('Saw Lead', 0, INF, 0, True), ('Charang Lead', 0, INF, 0, True), ('String Ensemble 1', 0, INF, 1, True)],
             'riff: Saw Lead + Charang Lead  ·  layer: String Ensemble')],
           0, 32, [(16.0, '16.0 s')], 'fig1_megalovania.png')

    figure('Ruins: the melody is handed from piano to flute, then thickened with strings',
           'Two independent transcriptions (VGMusic) place both changes within a second of each other; they only differ on which General MIDI patch stands in for the flute.',
           ['1st colour', '2nd colour (same register)', '3rd colour, added in unison'],
           [(U + 'UT_Ruins_Lu9.mid', 'Lu9',
             [('Acoustic Grand Piano', 0, 25.5, 0, True), ('Pan Flute', 0, INF, 1, True), ('String Ensemble 1', 0, INF, 2, True)],
             'Grand Piano → Pan Flute → Pan Flute + String Ensemble'),
            (U + '05_-_Ruins.mid', 'Revle',
             [('Acoustic Grand Piano', 0, 25.5, 0, True), ('Flute', 0, INF, 1, True), ('String Ensemble 1', 0, INF, 2, True)],
             'Grand Piano → Flute → Flute + String Ensemble')],
           0, 56, [(25.9, '≈26 s: new instrument'), (46.6, '≈47 s: + strings')], 'fig2_ruins.png')

    figure('Bonetrousle: on the repeat, a bright colour joins the violin line',
           'Both transcribers add the layer at the same second. Lu9 hears it in unison (vibraphone), Jay Reichard an octave up (piccolo): they agree on the event, not the octave.',
           ['the line', 'the same line, new bright layer'],
           [(U + 'UT_Bonetrousle_Lu9.mid', 'Lu9',
             [('Violin', 0, INF, 0, True), ('Vibraphone', 0, INF, 1, True)], 'line: Violin  ·  layer: Vibraphone (unison)'),
            (U + 'Undertale_-_Bonetrousle.mid', 'Jay Reichard',
             [('Violin', 0, INF, 0, True), ('Piccolo', 0, INF, 1, True)], 'line: Violin  ·  layer: Piccolo (octave up)')],
           31, 52, [(44.8, '44.8 s')], 'fig3_bonetrousle.png')

    bar = 4 * 60 / 230           # one Mrshadowcat bar (double-time notation) in seconds
    figure('Spider Dance: the opening figure drops an octave and a new line takes the top',
           'Hand-highlighted from the notes. Both transcriptions move the figure exactly −12 at 8.3 s and add a countermelody above. Mrshadowcat sets the whole texture an octave higher than Lu9.',
           ['the opening figure', 'new countermelody above it'],
           [(U + 'UT_Spider_Dance_v2_Lu9.mid', 'Lu9',
             [('Synth Brass 1', 0, INF, 0, False), ('Clavinet', 0, INF, 1, False)],
             'figure: Synth Brass  ·  countermelody: Clavinet'),
            (U + 'Undertale_Spider_Dance.mid', 'Mrshadowcat',
             [('Xylophone', 0, 8 * bar, 0, False), ('Xylophone', 16 * bar, 24 * bar, 0, False),
              ('Marimba', 9 * bar, 12 * bar, 0, False), ('Marimba', 25 * bar, 28 * bar, 0, False),
              ('Xylophone', 8 * bar, 16 * bar, 1, False), ('Xylophone', 24 * bar, 32 * bar, 1, False)],
             'figure: Xylophone → Marimba  ·  countermelody: Xylophone')],
           0, 33.4, [(8.35, '8.3 s'), (16.7, '16.7 s'), (25.0, '25.0 s')], 'fig4_spider_intro.png')
