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

## What is where

| | |
|---|---|
| `folio.html` | the whole app |
| `server.mjs` | the local server: static files + `GET`/`PUT /api/quest-log` |
| `folio.cmd` | one-click start for the above |
| `quests/quest-log.json` | the quest log on disk |
| `quests/*.folio.json` | finished pieces, one per quest |
| `SPEC-LESSON-0.md` | the contract |
| `CURRICULUM.md`, `QUESTS.md`, `BUDGET.md` | the course, the études, the ledger |

Press `F1` in the app for the keys, `F3` for the quest log.
