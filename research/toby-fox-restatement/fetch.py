"""Download the corpora from VGMusic (fan-sequenced MIDIs) into midi/<corpus>/, with an index.json
recording each file's title and sequencer.

    python3 fetch.py              # every corpus
    python3 fetch.py undertale    # one

Files already on disk are skipped.  Nothing fetched here is committed: the MIDIs are the
sequencers' work (and Toby Fox's music), so they stay a local cache.
"""
import html, json, os, re, sys, time, urllib.request

BASE = 'https://www.vgmusic.com/music/'
CORPORA = {
    'undertale':  ('computer/microsoft/windows', 'Undertale'),
    'cavestory':  ('computer/microsoft/windows', 'Cave Story'),
    'earthbound': ('console/nintendo/snes', 'EarthBound'),
    'ff6':        ('console/nintendo/snes', 'Final Fantasy III'),    # the US title of Final Fantasy VI
    'chrono':     ('console/nintendo/snes', 'Chrono Trigger'),
}
HEADERS = {'User-Agent': 'Mozilla/5.0 (restatement study)'}
_pages = {}


def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=60) as r:
        return r.read()


def index(section, game):
    """Rows under one game's header on a VGMusic system page: file, title, sequencer."""
    if section not in _pages:
        _pages[section] = get(BASE + section + '/').decode('latin-1')
    cur, out = None, []
    for chunk in re.split(r'<tr', _pages[section]):
        m = re.search(r'class="header"[^>]*>(.*?)</t[dr]', chunk, re.S)
        if m:
            cur = re.sub(r'<[^>]+>', '', m.group(1)).strip()
            continue
        m = re.search(r'<a href="([^"]+\.mid)">([^<]+)</a>', chunk)
        if not m or cur != game: continue
        cells = [html.unescape(re.sub(r'<[^>]+>', '', '<td' + t)).strip() for t in re.split(r'<td', chunk)[1:]]
        out.append(dict(file=m.group(1), title=html.unescape(m.group(2)), sequencer=cells[2] if len(cells) > 2 else ''))
    return out


def fetch(corpus):
    section, game = CORPORA[corpus]
    rows = index(section, game)
    d = os.path.join('midi', corpus)
    os.makedirs(d, exist_ok=True)
    json.dump(rows, open(os.path.join(d, 'index.json'), 'w'), indent=1)
    got = 0
    for row in rows:
        path = os.path.join(d, row['file'])
        if os.path.exists(path): continue
        open(path, 'wb').write(get(BASE + section + '/' + row['file']))
        got += 1
        time.sleep(0.25)          # be gentle with a volunteer-run site
    print(f"{corpus}: {len(rows)} files listed, {got} downloaded")


if __name__ == '__main__':
    for c in sys.argv[1:] or CORPORA:
        fetch(c)
