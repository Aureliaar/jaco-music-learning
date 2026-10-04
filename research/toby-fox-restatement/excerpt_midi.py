"""Megalovania bars 1-16 (0:00-0:32) from Jay Reichard's transcription, as a MIDI file to open in a DAW:
tracks renamed by their role in the repetition, the three sections as markers, each bar's head as a text event.
The original credits stay in.  Written to midi/ (git-ignored): the notes are the transcriber's work.
"""
import mido
from collections import Counter
from restate import GM

SRC = 'midi/undertale/Undertale_-_Megalovania_v1_2.mid'
OUT = 'midi/megalovania_bars1-16_annotated.mid'
ROLE = {'Saw Lead': 'riff (all 16 bars)', 'String Ensemble 1': 'riff two octaves up (strings, from bar 9)',
        'Pick Bass': 'bass (from bar 5)', 'Distortion Guitar': 'power chords (from bar 9)',
        'Rock Organ': 'organ chords (from bar 9)', 'Square Lead': 'square lead (pickup, bar 16)'}
KIT = {35: 'kick', 36: 'kick', 38: 'snare', 40: 'snare', 42: 'hi-hat', 44: 'hi-hat', 46: 'open hi-hat', 49: 'crash', 57: 'crash'}
SECTIONS = [(0, 'bars 1-4: riff alone'), (4, 'bars 5-8: same riff + bass'),
            (8, 'bars 9-16: same riff + strings 2 oct up, + guitar, organ, drums')]
HEADS = ['D', 'C', 'B', 'Bb']

mid = mido.MidiFile(SRC)
tpb = mid.ticks_per_beat
END = 16 * 4 * tpb
out = mido.MidiFile(type=1, ticks_per_beat=tpb)
for ti, tr in enumerate(mid.tracks):
    events, t = [], 0
    for m in tr:
        t += m.time
        events.append((t, m))
    prog = next((GM[m.program] for _, m in events if m.type == 'program_change' and m.channel != 9), None)
    hits = Counter(m.note for _, m in events if m.type == 'note_on' and m.velocity > 0 and m.channel == 9)
    pieces = list(dict.fromkeys(KIT.get(n, 'percussion') for n, _ in hits.most_common()))
    drums = f"drums: {' + '.join(pieces)} (fill at bar 8, full kit from bar 9)" if hits else None
    keep, sounding = [], set()
    for t, m in events:
        if m.type == 'end_of_track' or t >= END: continue
        if m.type == 'track_name' and (prog in ROLE or drums):
            m = m.copy(name=drums or ROLE[prog])
        keep.append((t, m))
        if m.type == 'note_on' and m.velocity > 0: sounding.add((m.channel, m.note))
        elif m.type in ('note_on', 'note_off'): sounding.discard((m.channel, m.note))
    for ch, note in sounding:                     # close whatever is still ringing at the cut
        keep.append((END, mido.Message('note_off', channel=ch, note=note, velocity=0)))
    if ti == 0:
        keep += [(bar * 4 * tpb, mido.MetaMessage('marker', text=text)) for bar, text in SECTIONS]
        keep += [(bar * 4 * tpb, mido.MetaMessage('text', text=f'bar {bar + 1}: head {HEADS[bar % 4]}, tail = bar 1'))
                 for bar in range(16)]
    keep.sort(key=lambda e: e[0])
    trk, last = mido.MidiTrack(), 0
    for t, m in keep:
        trk.append(m.copy(time=t - last)); last = t
    trk.append(mido.MetaMessage('end_of_track', time=max(END - last, 0)))
    out.tracks.append(trk)
out.save(OUT)

chk = mido.MidiFile(OUT)
print(f'wrote {OUT}: {chk.length:.1f} s, {len(chk.tracks)} tracks')
for tr in chk.tracks:
    name = next((m.name for m in tr if m.type == 'track_name'), '')
    notes = sum(1 for m in tr if m.type == 'note_on' and m.velocity > 0)
    if notes: print(f'   {name!r:52s} {notes} notes')
print('   markers:', [m.text for m in chk.tracks[0] if m.type == 'marker'])
