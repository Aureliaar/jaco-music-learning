# Folio

A keyboard-native, single-page step sequencer styled as an illuminated
manuscript page: one voice, sixteen steps, no mouse. It is the Lesson 0
instrument of the curriculum in `CURRICULUM.md`; the contract it answers to
is `SPEC-LESSON-0.md`.

The whole app is `folio.html` — inline CSS and JS, no dependencies, no build
step.

## Running it

**With the local server (recommended).** Double-click **`folio.cmd`**, or:

```
node server.mjs
```

then open **http://localhost:4173**. Requires Node (any recent version; v22
is what it was built on) and installs nothing.

Served this way, the quest log is kept in a real file —
`quests/quest-log.json` — written a couple of seconds after every change and
read back when the page opens. That file is the authority at boot, so the
work follows the repository rather than one browser profile, and anyone (or
any agent) reading the repo can see the whole picture. The footer says
`· synced` while the quest log is open.

Options:

- `PORT=4174 node server.mjs` — a different port.
- `node server.mjs --lan` — bind every interface and print the LAN address,
  for playing from another machine on the same network. The default binds
  `127.0.0.1` only.

**Without it.** Open `folio.html` directly (double-click, `file://`) and
everything works exactly as before — the browser's `localStorage` keeps the
pattern and the quest log, there is simply no file on disk and no sync.
`Ctrl+S` / `Ctrl+O` (or dropping a file on the page) export and import by
hand in either mode.

If the server stops mid-session the page carries on in `localStorage`, says
so quietly in the footer, and picks the sync back up on the next change.

## Sharing it

There is a third way to open it: a copy on the web, for people who should be
able to hear the pieces and play with the instrument without installing
anything.

That copy is a Cloudflare Worker serving static assets — the same shape as
`magic-proximity-proto`. `scripts/build.mjs` puts exactly three files in
`dist/`:

```
folio.html            -> dist/index.html
auditor.html          -> dist/auditor.html
quests/quest-log.json -> dist/quests/quest-log.json
```

Nothing else leaves the repository: `CURRICULUM.md`, `QUESTS.md`,
`BUDGET.md`, `SPEC-LESSON-0.md` and `server.mjs` are not published.

```
npm run build      # node scripts/build.mjs
npm run deploy     # build, then npx wrangler deploy   (needs `wrangler login` once)
```

Pushing to `main` does the same by itself, through
`.github/workflows/deploy.yml`, once the repository has a remote and the
`CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` secrets.

**What the shared copy does.** There is no server behind it, so the page
notices at boot — `/api/quest-log` is not there — and goes read-only: it
never writes anything back. On a browser that has nothing of its own yet it
reads the committed `quests/quest-log.json` once, as a seed, so the pieces
are there to hear on the first visit. Everything the visitor then writes
lives in their own `localStorage` and goes nowhere. The footer says
`· read-only copy` while the quest log is open.

The local server is unaffected: it answers a missing log with a JSON `404`,
which is precisely how the page tells a real server apart from a static
host.

## The audit

`auditor.html` is a blind-listening page to hand to somebody else: it plays a
lineup of patterns from the quest log as **I, II, III…** — no names, no ids,
shuffled fresh on every load — and asks three questions afterwards. Every word
on it is **in Italian**, because the auditors are; the code, the ids and the
query parameter stay English. Open it at
**http://localhost:4173/auditor.html** locally or **/auditor.html** on the
shared copy; `?ids=stray,lineup-a,lineup-b` chooses the lineup (that is also
the default). A press-and-hold control at the bottom reveals which numeral was
which, for after the verdict.

## What is where

| | |
|---|---|
| `folio.html` | the whole app |
| `auditor.html` | the blind lineup, for family verdicts |
| `server.mjs` | the local server: static files + `GET`/`PUT /api/quest-log` |
| `folio.cmd` | one-click start for the above |
| `quests/quest-log.json` | the quest log on disk |
| `quests/*.folio.json` | finished pieces, one per quest |
| `scripts/build.mjs`, `wrangler.jsonc` | the shared copy on the web |
| `SPEC-LESSON-0.md` | the contract |
| `CURRICULUM.md`, `QUESTS.md`, `BUDGET.md` | the course, the études, the ledger |

Press `F1` in the app for the keys, `F3` for the quest log.
