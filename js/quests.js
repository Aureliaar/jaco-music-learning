/* Folio — js/quests.js : the workspaces, the board and the log on disk.

   The settings crossbar the pad raises; quests as workspaces, each holding a
   whole page of its own, and the drills delivered into the log from outside;
   the state's shape in storage and in quests/quest-log.json, and the sync
   layer that keeps the two level — the debounced push, the conditional poll,
   the narrow drill merge, and the read-only mode a static host gets; the
   board read one lesson at a time, with its tabs, its favourites and the
   player's own order; and the two side rails. */
"use strict";

/* ================= the settings crossbar =================
   Start raises it, as start raises the system menu in the game. While it is
   up the eight crossbar slots are items rather than pitches, read in the
   same order the crossbar always reads — left, up, right, down, then □ △ ○ ✕
   — so the hand that knows the crossbar already knows this.

   What the mode is for is the left margin, and now it is the whole margin.
   ↑ and ↓ walk the workspaces there, and walking is arriving — the
   highlight moves and you are already in that workspace. ← and → turn the
   lesson the margin is showing, because the margin shows one lesson at a
   time, exactly as the log does and on the same tab. There is no list to
   open first and nothing to confirm, so no slot opens a page of any kind:
   the four directions are the margin, entire, and that is the mode.

   The base octave is not here and is not a command: the pad writes
   contours, counted from the note before, and the octave has nothing to say
   to that. It lives on the keyboard's page up and page down, which is which
   pair of octaves the two rows of note keys are.

   The quest log is not here either: it is F3, and the margin has already
   replaced what one would have come here to do. ✕ is the scene behind the
   sheet — Shift+B on the keyboard, and otherwise nowhere on the pad. */
var SETTINGS = [
  { glyph:"←", label:"the lesson",
    value:function(){ return tabLabel(currentTab()); },
    run:function(){ railTab(-1); }, head:true },
  { glyph:"↑", label:"the workspace",
    value:function(){ return workspaceName(); },
    run:function(){ railStep(-1); }, head:true },
  { glyph:"→", label:"the lesson",
    value:function(){ return tabLabel(currentTab()); },
    run:function(){ railTab(1); }, head:true },
  { glyph:"↓", label:"the workspace",
    value:function(){ return workspaceName(); },
    run:function(){ railStep(1); }, head:true },
  { glyph:"□", label:"solo",
    value:function(){ return flag("solo", voice) ? "on" : "off"; },
    run:function(){ toggleSolo(); renderSettings(); } },
  { glyph:"△", label:"mute",
    value:function(){ return flag("mute", voice) ? "on" : "off"; },
    run:function(){ toggleMute(); renderSettings(); } },
  { glyph:"○", label:"close",
    value:function(){ return "back to the page"; },
    run:function(){ closeSettings(); } },
  { glyph:"✕", label:"the background",
    value:function(){ return scenePref; },
    run:function(){ cycleScenery(); renderSettings(); } }
];
/* the diamond each cluster is drawn as: left, up, right, down. The points
   sit further out than the sides do, because the sides are wide and the
   points are not: a diamond of four boxes only reads as a diamond while no
   two of them touch. */
var XPOS = [["26%","50%"],["50%","12%"],["74%","50%"],["50%","88%"]];
var xslots = [];
function buildSettings(){
  var i, host, p, el, g, l, v;
  for (i = 0; i < 8; i++){
    host = (i < 4) ? xbarPad : xbarFace;
    p = XPOS[i % 4];
    el = document.createElement("div");
    el.className = "xslot";
    el.style.left = p[0];
    el.style.top = p[1];
    el.style.transform = "translateY(-50%)";
    g = document.createElement("span"); g.className = "xg";
    l = document.createElement("span"); l.className = "xl";
    v = document.createElement("span"); v.className = "xv";
    el.appendChild(g); el.appendChild(l); el.appendChild(v);
    el.addEventListener("click", (function(n){
      return function(){ runSetting(n); };
    })(i));
    host.appendChild(el);
    xslots.push({ el: el, glyph: g, label: l, value: v });
  }
}
buildSettings();
/* the strip answers the mouse too: a name chooses that voice, its mark
   under it takes it away and gives it back */
for (var i = 0; i < VOICES; i++){
  vnames[i].addEventListener("click", (function(n){
    return function(){ setVoice(n); };
  })(i));
  vmarks[i].addEventListener("click", (function(n){
    return function(){ toggleMute(n); };
  })(i));
}
function renderSettings(){
  for (var i = 0; i < 8; i++){
    var s = SETTINGS[i], r = xslots[i];
    r.glyph.textContent = s.glyph;
    r.label.textContent = s.label || "—";
    r.value.textContent = s.run ? s.value() : "";
    r.el.className = "xslot" + (s.run ? "" : " none") + (s.head ? " head" : "");
  }
}
function runSetting(i){
  var s = SETTINGS[i];
  if (!s || !s.run){ say("nothing on that slot yet"); return; }
  s.run();
}
function anyPage(){
  return questsEl.classList.contains("on") || settingsEl.classList.contains("on") ||
         (typeof scriptOn === "function" && scriptOn());
}
/* the body carries the mode so that the title can step back behind the
   crossbar standing over it; the folio itself is never touched */
function markSettings(on){
  if (on) document.body.setAttribute("data-settings", "on");
  else document.body.removeAttribute("data-settings");
}
function closeSettings(){
  if (!settingsEl.classList.contains("on")) return;
  settingsEl.classList.remove("on");
  markSettings(false);
  applyViz();
  renderRails();                   /* the margin stops being the pad's */
  say("‸ cursor row");
}
function toggleSettings(){
  var on = !settingsEl.classList.contains("on");
  settingsEl.classList.toggle("on", on);
  markSettings(on);
  if (on) questsEl.classList.remove("on");
  applyViz();
  if (on) renderSettings();
  renderRails();
  say(on ? "settings · ↑↓ the workspace, ←→ the lesson · the margin, in the thumb"
         : "‸ cursor row");
}

/* ================= quests as workspaces =================
   Side content from QUESTS.md, Lesson 1: constraint études. Every quest is
   a *workspace* — a whole page of its own: steps, title, tempo, loop and
   key. One more workspace, free play, belongs to no quest. The workspace
   you are in is the page in front of you, and it autosaves where it lives,
   on every modification, exactly as the single page always did.

   There is therefore nothing to bind and nothing to load. Choosing a quest
   switches workspaces; choosing the one you are already in returns to free
   play. Both directions are instant and lossless, because nothing is ever
   copied from one workspace to another — each is its own document, and no
   document is ever written over by another.

   The pattern file format is untouched by any of this. */
var QUEST_KEY    = "folio.quests.v2";
var QUEST_KEY_V1 = "folio.quests.v1";   /* read once, migrated forward, never written */
var QUESTS = [
  { id:"ladder", name:"⚔ The Ladder", short:"the ladder",
    text:"All seven notes of one major or minor scale appear at least once — hidden. If a listener would say “that’s a scale going up,” you failed. Coverage disguised as melody.",
    teaches:"using the whole tonal space instead of the three-note corridor." },
  { id:"whitespace", name:"⚔ White Space", short:"white space",
    text:"Exactly five silent steps, and no two of them adjacent. Breath must be distributed, not parked in one hole.",
    teaches:"the pause as a placed note, not leftover space." },
  { id:"summit", name:"⚔ The Summit", short:"the summit",
    text:"The loop’s highest note occurs exactly once, and not on step 1. Everything before it climbs or coils; everything after it descends or settles.",
    teaches:"contour — a melody is a shape with one peak." },
  { id:"stones", name:"⚔ Three Stones", short:"three stones",
    text:"Exactly three distinct pitches for the whole loop. Rhythm and silence do all remaining work.",
    teaches:"what rhythm alone can carry (most of it, embarrassingly)." },
  { id:"ouroboros", name:"⚔ Ouroboros", short:"ouroboros",
    text:"The last sounding note is different from the first, yet the loop seam pulls — stopping playback on step 16 must feel like an interruption.",
    teaches:"the cycle test, three lessons early." },
  { id:"callanswer", name:"⚔ Call and Answer", short:"call and answer",
    text:"Steps 1–8 ask a question (end unresolved — off the home note); steps 9–16 answer it (end resolved). A listener with no vocabulary for this should still hear “…?” then “…!”.",
    teaches:"the sentence structure you already stumbled into, on purpose." },
  { id:"stray", name:"⚔ Keep the Stray", short:"keep the stray",
    text:"One note deliberately outside the key, placed so it sounds intended — approached and left so smoothly a listener thinks it belongs. You already did this once by accident (the F♮). Now do it on purpose.",
    teaches:"accidents → style, chromaticism as seasoning." },
  { id:"hand", name:"⚔ The Apprentice’s Hand", short:"the apprentice’s hand",
    text:"Transcribe 16 steps of any Uematsu melody, then change exactly four steps until it is yours. Keep both files; play them back to back.",
    teaches:"the distance between imitation and voice is about four decisions." }
];

/* ---- the seeds: every quest's page arrives already tuned ----
   A key and a tempo chosen to suit the constraint, so that nothing has to
   be decided before the first note and the ear meets a different colour in
   each quest without ever being asked to pick one. The seed is applied once
   — when a quest's workspace is made, which is the first time it is entered
   — and is an ordinary starting value from that moment on: changing either
   on the key page overrides it, and the override is what is saved. A page
   that already exists is never re-seeded, and free play is never seeded at
   all: it is C major at 112, as it always was. */
var SEEDS = {
  ladder:     { key:"G major", tempo:120 },   /* bright, neutral — a scale is easy to hide in it */
  whitespace: { key:"A minor", tempo:88  },   /* slow enough that the silences breathe */
  summit:     { key:"D major", tempo:112 },   /* open, climbing */
  stones:     { key:"A minor", tempo:100 },   /* sparse and steady */
  ouroboros:  { key:"D minor", tempo:100 },   /* circular, brooding — the seam quest */
  callanswer: { key:"F major", tempo:104 },   /* conversational warmth */
  stray:      { key:"E minor", tempo:96  },   /* E minor and a stray F♮: the phrygian colour */
  hand:       { key:"C major", tempo:128 }    /* neutral and brisk, for transcription */
};
/* ---- drills: quests written into the log from outside ----
   The eight above are the standing curriculum and live in this file. A
   *drill* is a short étude delivered into `quests/quest-log.json` — by a
   collaborator, or by the assistant working in the repository — and it
   behaves in every way like a quest: its own workspace, its own page, its
   own done flag, its own line in both rails.

   A drill definition is
     { id, name, summary, teaches, pattern }
   where `pattern` is an ordinary page (the same shape a .folio.json has)
   and is the workspace's *seed*: it is what the workspace arrives holding
   the first time the drill is entered, exactly as the built-in seeds are.
   After that the workspace is the user's, saved where it lives, and the
   definition is never allowed near it again.

   Definitions are held apart from workspaces on purpose: `DRILLS` is the
   list of definitions, `wsDoc` holds the pages, keyed by id as always. A
   workspace whose definition has gone missing keeps a *ghost* definition
   so that it still renders (by id, with no text) and is never lost; a
   ghost is not written back out, and is replaced the moment a real
   definition for that id arrives. */
var DRILLS = [];
var ALL = QUESTS.slice();        /* the whole list, built-ins then drills */

function drillById(id){
  for (var i = 0; i < DRILLS.length; i++) if (DRILLS[i].id === id) return DRILLS[i];
  return null;
}
function builtinById(id){
  for (var i = 0; i < QUESTS.length; i++) if (QUESTS[i].id === id) return QUESTS[i];
  return null;
}
/* validate() reports rhythm marks through a shared flag that belongs to the
   pattern autosave; reading a drill definition must not disturb it */
function safeValidate(p){
  var was = droppedMarks, v = null;
  try { v = validate(p); } catch (e){ v = null; }
  droppedMarks = was;
  return v;
}
function drillText(s){ return (typeof s === "string") ? s.trim().slice(0, 240) : ""; }
function normDrill(o){
  if (!o || typeof o !== "object" || Array.isArray(o)) return null;
  if (typeof o.id !== "string" || !o.id.trim()) return null;
  var id = o.id.trim().slice(0, 60);
  if (builtinById(id)) return null;            /* a drill never shadows a quest */
  return {
    id: id,
    name: (typeof o.name === "string" && o.name.trim()) ? o.name.trim().slice(0, 60) : id,
    summary: drillText(o.summary),
    teaches: drillText(o.teaches),
    /* optional: which lesson's tab this belongs on. 0 — absent, or out of
       range — means "work it out", which is what every definition written
       before there were tabs says by saying nothing. */
    lesson: (typeof o.lesson === "number" && isFinite(o.lesson) &&
             o.lesson >= 1 && o.lesson <= 9) ? Math.round(o.lesson) : 0,
    pattern: o.pattern ? safeValidate(o.pattern) : null
  };
}
function ghostDrill(id){
  return { id:id, name:id, summary:"", teaches:"", lesson:0, pattern:null, ghost:true };
}
/* a definition, read as the quest log reads a quest */
function drillQuest(d){
  /* the sword means one thing — the workspace you are in — so the flavour
     sword a delivered quest carries in its name is not repeated in its
     short name either, or the meta line and the margin read ⚔ ⚔ */
  return { id:d.id, name:d.name, short:plainName(d), text:d.summary,
           teaches:d.teaches, drill:true };
}
function rebuildList(){
  var i;
  ALL.length = 0;
  for (i = 0; i < QUESTS.length; i++) ALL.push(QUESTS[i]);
  for (i = 0; i < DRILLS.length; i++) ALL.push(drillQuest(DRILLS[i]));
  if (qsel >= ALL.length) qsel = ALL.length - 1;
  if (qsel < 0) qsel = 0;
  if (qrows) buildQuestRows();      /* the rows exist only after the page is built */
  if (rrows) buildRailRows();
}
function allQuests(){ return ALL; }
function selQuest(){ return ALL[qsel] || ALL[0]; }

function seededDoc(id){
  var dr = drillById(id);
  if (dr) return dr.pattern ? safeValidate(dr.pattern) || defaultDoc() : defaultDoc();
  var d = defaultDoc(), s = SEEDS[id];
  if (!s) return d;
  d.key = normalizeKey(s.key);
  d.tempo = Math.max(TEMPO_MIN, Math.min(TEMPO_MAX, s.tempo));
  return d;
}

var qsel = 0;                /* the selection cursor on the quest page */
var qActive = null;          /* the active workspace: a quest id, or null for free play */
var qState = {};             /* id -> { done:bool } */
var wsFree = null;           /* the free-play page */
var wsDoc = {};              /* id -> page, made the first time a quest is entered */

function questSlot(id){
  if (!qState[id]) qState[id] = { done:false, fav:false, order:null };
  return qState[id];
}
function questById(id){
  for (var i = 0; i < ALL.length; i++) if (ALL[i].id === id) return ALL[i];
  return null;
}
function activeQuest(){ return qActive ? questById(qActive) : null; }

/* the page in front of you belongs to the active workspace: put it back
   there before anything is written out or switched away from */
function stash(){ if (qActive) wsDoc[qActive] = doc; else wsFree = doc; }
function workspaceDoc(id){
  if (!id) return wsFree || (wsFree = defaultDoc());
  return wsDoc[id] || (wsDoc[id] = seededDoc(id));
}
function docHasNotes(d){
  if (!d) return false;
  for (var v = 0; v < VOICES; v++){
    var s = docSteps(d, v);
    if (!s) continue;
    for (var i = 0; i < STEPS; i++) if (s[i]) return true;
  }
  return false;
}
function questPage(id){ return (id === qActive) ? doc : (wsDoc[id] || null); }
function questHasContent(id){ return docHasNotes(questPage(id)); }

/* the whole of the switch: put the page back, pick up another one */
function switchWorkspace(id){
  stash();
  qActive = id || null;
  /* the caret follows the workspace, by whichever road it was reached —
     the log, the margin, the pad's rail — so that opening the log always
     shows you where you actually are, in the lesson you are actually in */
  if (qActive)
    for (var wi = 0; wi < ALL.length; wi++) if (ALL[wi].id === qActive){ qsel = wi; break; }
  /* and the lesson comes forward with it, so that opening the log — or
     glancing at the margin — always shows the lesson you are actually
     working in. Free play belongs to no lesson and turns no page: the
     margin stays on whatever tab you left it on, which is where you were
     about to go back to. */
  if (qActive) activeTab = questGroup(questById(qActive));
  doc = workspaceDoc(qActive);
  cursor = 0;
  if (playing) stop();
  save();
  renderAll(); renderQuests();
}
/* every way into a workspace ends the same way: put the caret on it, and
   say where you have arrived. Enter, a click on a row or a margin line, and
   the pad walking the margin all come through here, so they cannot drift
   apart in what they select or in what the footer reads. */
function selectById(id){
  for (var i = 0; i < ALL.length; i++) if (ALL[i].id === id){ qsel = i; return; }
}
function sayWorkspace(id){
  if (!id){ say("free play · no constraint"); return; }
  var q = questById(id);
  say(q.short + " · its own page" + (questHasContent(id) ? "" : ", empty"));
}
function chooseWorkspace(){
  var q = selQuest();
  if (!q) return;
  var id = (qActive === q.id) ? null : q.id;
  switchWorkspace(id);
  sayWorkspace(id);
}
/* the same switch, reached by mouse: a quest row or a rail line. Clicking
   the workspace you are in returns to free play, as enter does. */
function clickWorkspace(id){
  if (id !== null) selectById(id);
  if (qActive === id){
    if (id === null) return;       /* free play, clicked from free play */
    switchWorkspace(null); sayWorkspace(null); return;
  }
  switchWorkspace(id);
  sayWorkspace(id);
}
/* ---- the left margin, walked by the pad ----
   Start gives the d-pad the workspace rail, in the order the rail draws it:
   free play first, then every quest and every drill. There is no separate
   selection to keep — the line the highlight is on *is* the workspace you
   are in, so a step up or down is a switch, and the switch is the whole
   interaction. Nothing is confirmed and no page is opened on the way. */
/* ---- how the margin is arranged ----
   One lesson, the lesson the log is on: free play at the head, then that
   tab's quests in the order the tab reads them — the ones kept to hand
   first, as they are on the board — one lesson, not the whole board printed
   down the side of the page while you are trying to write. The pad walks
   exactly this list, so what the thumb does and what the eye reads are the
   same thing, and ← and → turn the page of it. */
function railSequence(){ return viewOf(currentTab()); }
function railOrder(){
  var seq = railSequence(), out = [null], i;
  for (i = 0; i < seq.length; i++) out.push(ALL[seq[i]].id);
  return out;
}
function workspaceName(){
  var q = activeQuest();
  return q ? q.short : "free play";
}
function railStep(d){
  var order = railOrder(), n = order.length;
  var at = order.indexOf(qActive);
  if (at < 0) at = 0;
  var id = order[((at + d) % n + n) % n];
  selectById(id);
  switchWorkspace(id);
  if (settingsEl.classList.contains("on")) renderSettings();
  sayWorkspace(id);
}
/* ← and → under the crossbar: the margin turns to another lesson, and the
   board turns with it — one tab, read in two places. Nothing is entered by
   turning a page; the workspace you are in is the workspace you are in
   until ↑ or ↓ walks you into another. */
function railTab(d){
  moveTab(d);
  if (settingsEl.classList.contains("on")) renderSettings();
}
function toggleComplete(){
  var q = selQuest(), s = questSlot(q.id);
  s.done = !s.done;
  save(); renderQuests();
  say(q.short + (s.done ? " · complete" : " · set aside"));
}

/* ---- the shape of the whole state, in storage and on disk alike ---- */
function stateToJSON(){
  stash();
  var out = { folio:"quest-log", version:2, active:qActive,
              free:wsFree ? docOut(wsFree) : wsFree, quests:{} };
  var i, id, s, d;
  for (i = 0; i < ALL.length; i++){
    id = ALL[i].id; s = qState[id]; d = wsDoc[id];
    var fav = !!(s && s.fav), ord = (s && typeof s.order === "number") ? s.order : null;
    if (!d && !(s && s.done) && !fav && ord === null) continue;
    out.quests[id] = { done: !!(s && s.done), pattern: d ? docOut(d) : null };
    /* the two marks are written only where they were made, so a log from a
       board nobody has arranged is byte for byte the log it always was */
    if (fav) out.quests[id].fav = true;
    if (ord !== null) out.quests[id].order = ord;
  }
  /* every drill definition this session knows travels back out with the
     state, so that a PUT can never be the thing that loses one; ghosts are
     not definitions and are not written */
  var ds = [];
  for (i = 0; i < DRILLS.length; i++){
    d = DRILLS[i];
    if (d.ghost) continue;
    var def = { id:d.id, name:d.name, summary:d.summary, teaches:d.teaches, pattern:d.pattern };
    if (d.lesson) def.lesson = d.lesson;      /* only where it was declared */
    ds.push(def);
  }
  if (ds.length) out.drills = ds;
  return out;
}
function isQuestLog(o){
  return !!o && typeof o === "object" && !Array.isArray(o) && !o.steps &&
         (o.folio === "quest-log" || (o.quests && typeof o.quests === "object"));
}
/* Reading the state back, at both versions. A version-1 log carried a
   *motif* per quest — the snapshot the old bind button took. That motif is
   exactly what the quest's workspace should contain, so it is read straight
   into it and nothing is lost. */
function applyState(o){
  if (!isQuestLog(o)) return false;
  var id, q, p, i;
  wsDoc = {}; qState = {}; DRILLS = [];
  /* the drill definitions the log carries, in the order it carries them */
  if (Array.isArray(o.drills)){
    for (i = 0; i < o.drills.length; i++){
      var nd = normDrill(o.drills[i]);
      if (nd && !drillById(nd.id)) DRILLS.push(nd);
    }
  }
  rebuildList();
  if (o.free){ p = validate(o.free); if (p) wsFree = p; }
  if (o.quests && typeof o.quests === "object"){
    for (id in o.quests){
      if (!Object.prototype.hasOwnProperty.call(o.quests, id)) continue;
      q = o.quests[id];
      if (!q || typeof q !== "object") continue;
      /* a workspace whose definition is not here: kept, and given a ghost
         so that it still has a line, a page and a name (its id) */
      if (!questById(id)){ DRILLS.push(ghostDrill(id)); rebuildList(); }
      questSlot(id).done = !!q.done;
      /* both optional, and both simply absent in a log written before they
         existed — an unarranged board reads as the natural order */
      questSlot(id).fav = !!q.fav;
      questSlot(id).order = (typeof q.order === "number" && isFinite(q.order))
                              ? Math.round(q.order) : null;
      /* a workspace page is an ordinary pattern, read by the same validator
         as a file; version 1's "motif" is the same thing under its old name */
      p = q.pattern || q.motif;
      p = p ? validate(p) : null;
      if (p) wsDoc[id] = p;
    }
  }
  qActive = (typeof o.active === "string" && questById(o.active)) ? o.active : null;
  /* the caret starts where the work is, as it goes where the work goes */
  qsel = 0;
  if (qActive)
    for (i = 0; i < ALL.length; i++) if (ALL[i].id === qActive){ qsel = i; break; }
  /* the board and the margin open on the lesson the work is in */
  if (qActive) activeTab = questGroup(questById(qActive));
  doc = workspaceDoc(qActive);
  droppedMarks = false;      /* the pattern autosave owns that message */
  return true;
}
/* Boot: version 2 if it is there. Otherwise migrate — the version-1 log
   supplies the quest workspaces (from its motifs) and whatever `load()`
   already put on the page becomes the free-play workspace. */
function loadState(){
  var raw = null, o;
  try { raw = localStorage.getItem(QUEST_KEY); } catch (e){ return false; }
  if (raw){
    try { if (applyState(JSON.parse(raw))) return true; } catch (e){}
  }
  try { raw = localStorage.getItem(QUEST_KEY_V1); } catch (e){ raw = null; }
  if (!raw) return false;
  try { o = JSON.parse(raw); } catch (e){ return false; }
  if (!applyState(o)) return false;
  save();                    /* written forward as version 2, once */
  return true;
}
function saveQuests(){ save(); }
function loadQuests(){ return loadState(); }

/* ---- the log on disk, over the little local server ----
   localStorage is invisible from outside the browser, so the state also
   goes to a real file — but only a server can put it there. Start
   `folio.cmd` (or `node server.mjs`) and open http://localhost:4173, and
   the quest log becomes `quests/quest-log.json` on disk, kept current
   automatically.

   Two modes, decided once at boot by the protocol:

   - over **http(s)** the server is the authority at boot (GET) and every
     autosave pushes the whole v2 state back (PUT), coalesced so a burst of
     note entry writes once. localStorage keeps its copy underneath as
     cache and offline layer.
   - from **file://** there is no server and nothing changes: localStorage
     alone, exactly as before.

   Failure is quiet and never blocking. If a push fails the footer says so
   while the quest log is open, work continues in localStorage, and the
   next change tries again. */
var SYNC_URL = "api/quest-log";
var SEED_URL = "quests/quest-log.json";
var SYNC_DEBOUNCE = 2000;
var POLL_MS = 10000;               /* how often the file is looked at again */
var pollTimer = null;
var logETag = null;                /* what the server last said the file was */
var putInFlight = false;           /* a push is on the wire right now */
var syncOn = false;                /* set at boot: are we served over http? */
var staticMode = false;            /* served over http, but by a dumb host */
var syncState = "idle";            /* idle | ok | failed */
var syncTimer = null;
var syncMute = false;              /* true while applying the server's own state */

function httpOrigin(){
  try {
    return typeof location !== "undefined" &&
           (location.protocol === "http:" || location.protocol === "https:");
  } catch (e){ return false; }
}
function syncNote(){
  if (staticMode) return " · read-only copy";
  if (!syncOn) return "";
  if (syncState === "failed") return " · sync failed — working locally";
  return " · synced";
}
/* the server's copy wins at boot when there is one: it is the file a
   collaborator or an agent can actually read, and it is what the last
   session pushed. Anything missing or unreadable falls back to whatever
   localStorage already loaded — never to an empty page. */
function applyServerState(o){
  if (!isQuestLog(o)) return false;
  if (!applyState(o)) return false;
  cursor = 0;
  /* the local cache is brought level with the server, without bouncing the
     same state straight back at it */
  syncMute = true;
  try { save(); } finally { syncMute = false; }
  renderAll(); renderQuests();
  return true;
}
function etagOf(r){
  try { return (r && r.headers && r.headers.get && r.headers.get("etag")) || null; }
  catch (e){ return null; }
}
function syncFlush(){
  if (!syncOn || typeof fetch !== "function") return;
  var text = JSON.stringify(stateToJSON(), null, 2);
  putInFlight = true;
  try {
    fetch(SYNC_URL, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: text
    }).then(function(r){
      putInFlight = false;
      var was = syncState;
      syncState = (r && r.ok) ? "ok" : "failed";
      /* the server tells us what it just wrote, so the next poll is a 304 */
      var et = etagOf(r);
      if (et) logETag = et;
      if (syncState !== was) syncTouch();
    }, function(){
      putInFlight = false;
      var was = syncState;
      syncState = "failed";
      if (syncState !== was) syncTouch();
    });
  } catch (e){ putInFlight = false; syncState = "failed"; syncTouch(); }
}

/* ---- live delivery: the file is looked at again, gently ----
   The tab is open for hours; a drill written into the file in the meantime
   should arrive without a reload, and without the next autosave writing it
   straight back out of existence. So, in server mode only, the log is
   re-read about every ten seconds — conditionally, so an unchanged file
   costs one 304 — and the merge is deliberately as narrow as it can be:

     adopt a drill *definition* whose id this session has never seen
     (or has only as a ghost), and nothing else, ever.

   Not workspaces, not `free`, not done flags, not `active`, not the
   built-in quests, and nothing is ever removed. A drill that is already
   known is left exactly as it is, so an edit to a definition on disk does
   not reach into a workspace someone is working in. The poll stands aside
   while a push is pending or in flight, so the two never cross. */
function pollTick(){
  if (!syncOn || staticMode || syncMute) return;
  if (syncTimer || putInFlight) return;        /* a write is pending: not now */
  if (typeof fetch !== "function") return;
  var h = { "accept": "application/json" };
  if (logETag) h["if-none-match"] = logETag;
  try {
    fetch(SYNC_URL, { headers: h }).then(function(r){
      if (!r) return;
      if (r.status === 304) return;            /* nothing has changed: free */
      if (!r.ok) return;
      var et = etagOf(r);
      if (et) logETag = et;
      return r.json().then(function(o){ mergeDrills(o); }, function(){});
    }, function(){});
  } catch (e){}
}
function pollStart(){
  if (pollTimer || !syncOn || staticMode) return;
  if (typeof setInterval !== "function") return;
  pollTimer = setInterval(pollTick, POLL_MS);
}
function mergeDrills(o){
  if (!isQuestLog(o) || !Array.isArray(o.drills)) return 0;
  var added = [], i, d, cur;
  for (i = 0; i < o.drills.length; i++){
    d = normDrill(o.drills[i]);
    if (!d) continue;
    cur = drillById(d.id);
    if (cur && !cur.ghost) continue;           /* known: never overwritten */
    if (cur) DRILLS[DRILLS.indexOf(cur)] = d;  /* a ghost, given its name back */
    else DRILLS.push(d);
    added.push(d);
  }
  if (!added.length) return 0;
  rebuildList();
  /* the arrival is kept locally, but is not a change to push back */
  syncMute = true;
  try { save(); } finally { syncMute = false; }
  renderQuests();
  announceDrills(added);
  return added.length;
}
/* quiet, and once: the line goes back to whatever it said next time
   anything speaks */
function announceDrills(added){
  var names = [], i;
  for (i = 0; i < added.length; i++) names.push(added[i].name);
  var was = lastSaid;
  say(was + " · a drill arrived: " + names.join(", "));
  lastSaid = was;
}
/* the footer carries the note only while the quest log is open, so it is
   refreshed rather than announced */
function syncTouch(){
  if (questsEl.classList.contains("on")) say(lastSaid);
}
/* every change, coalesced: a burst of note entry pushes once */
function syncPush(){
  if (!syncOn || syncMute) return;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(function(){ syncTimer = null; syncFlush(); }, SYNC_DEBOUNCE);
}
/* ---- the third mode: a shared copy on a static host ----
   The page can also be put on an ordinary web host (the deployed copy the
   family opens). There is no server there, so there is no `/api` at all:
   the boot GET comes back as a 404 that is *not* JSON, or does not come
   back. That is the tell, and it is the one thing that separates a static
   host from `server.mjs` — which answers `/api/quest-log` with JSON even
   when the file is missing (404 `{"absent":true}`), so the empty-server
   case keeps writing as it always did.

   On a static host the folio becomes read-only towards the outside: it
   never PUTs. It reads `quests/quest-log.json` on every visit — the
   committed showcase snapshot that travels with the page — and replaces
   any older local cache with that shared copy. A visitor may still play
   with the page for the rest of the session, but a reload returns to the
   published work instead of hiding it behind stale localStorage. The
   footer says so quietly. */
function jsonish(r){
  var t = "";
  try { t = (r.headers && r.headers.get && r.headers.get("content-type")) || ""; }
  catch (e){ t = ""; }
  return t.toLowerCase().indexOf("json") >= 0;
}
/* the committed log, read once, as a seed and nothing more */
function seedBoot(){
  if (typeof fetch !== "function") return;
  try {
    fetch(SEED_URL, { headers: { "accept": "application/json" } }).then(function(r){
      if (!r || !r.ok) return;
      return r.json().then(function(o){
        if (applyServerState(o))
          say("the shared quest log ‸ cursor row" +
              (activeQuest() ? " · ⚔ " + activeQuest().short : ""));
      }, function(){});
    }, function(){});
  } catch (e){}
}
function goStatic(){
  staticMode = true;
  syncOn = false;                  /* nothing is ever pushed from here */
  syncState = "idle";
  syncTouch();
  seedBoot();                      /* the published snapshot always wins */
}
function syncBoot(){
  syncOn = httpOrigin();
  if (!syncOn) return;
  if (typeof fetch !== "function"){ syncOn = false; return; }
  try {
    fetch(SYNC_URL, { headers: { "accept": "application/json" } }).then(function(r){
      if (!r) return;
      if (r.status === 404){
        /* server.mjs says so in JSON; a static host says it in HTML or text */
        if (jsonish(r)){ syncState = "ok"; pollStart(); }   /* no log yet: ours becomes it */
        else goStatic();
        return;
      }
      if (!r.ok){ syncState = "failed"; syncTouch(); return; }
      var et0 = etagOf(r);
      if (et0) logETag = et0;
      return r.json().then(function(o){
        syncState = "ok";
        pollStart();
        if (applyServerState(o))
          say("restored from the server ‸ cursor row" +
              (activeQuest() ? " · ⚔ " + activeQuest().short : ""));
      }, function(){
        /* a 200 that is not a quest log at all — a host answering every
           path with the page itself. Not a server: a static copy. */
        goStatic();
      });
    }, function(){ goStatic(); });             /* no /api on this host */
  } catch (e){ goStatic(); }
}

function exportQuests(){
  var blob = new Blob([JSON.stringify(stateToJSON(), null, 2)], { type: "application/json" });
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url; a.download = "quest-log.json";
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
  say("exported quest-log.json · keep it at quests/quest-log.json");
}
function importQuests(o, label){
  if (!applyState(o)){ say("that file is not a quest log — nothing changed"); return false; }
  cursor = 0;
  if (playing) stop();
  save(); renderAll(); renderQuests();
  say("opened " + (label || "quest-log.json"));
  return true;
}

/* ================= the board, read one lesson at a time =================
   Eight quests fitted on one page. Lesson 2 brought eight more and a
   handful of drills, Lesson 3 will bring its own, and a list that only
   grows stops being a board and becomes a scroll. So the log is read a
   lesson at a time: a strip of tabs above the list, one per lesson that
   actually has something in it, and the drills — the short études — at the
   end under their own.

   Nothing here is configured. A quest's lesson is worked out from what the
   log already contains, in this order:

     the eight built-ins are Lesson 1, always;
     a drill definition may simply *say* its lesson (an optional `lesson`
       number on the definition, ignored by anything that does not know it);
     a table below names the Lesson 2 board, which was delivered before
       there was a field to put it in;
     anything else carrying the sword belongs to the newest lesson known,
       so a board delivered ahead of this file still lands together;
     and anything with no sword at all is a drill.

   Lesson 3 therefore needs no surgery: deliver its quests with `lesson: 3`
   and the tab is there. */
var TAB_KEY = "folio.qtab";           /* a preference, not part of the log */
var LESSON_OF = { shadow:2, ostinato:2, torch:2, "torch-notes":2,
                  drone:2, "drone-contour":2, "drone-relentless":2,
                  hocket:2, chordisnt:2, oilwater:2, latecomer:2 };
var DRILL_TAB = 0;                    /* the group the études sit in */
var activeTab = 1;

function lessonField(o){
  var n = o && o.lesson;
  return (typeof n === "number" && isFinite(n) && n >= 1 && n <= 9) ? Math.round(n) : 0;
}
function newestLesson(){
  var hi = 1, i, d, n;
  for (i = 0; i < DRILLS.length; i++){
    d = DRILLS[i];
    n = lessonField(d) ||
        (Object.prototype.hasOwnProperty.call(LESSON_OF, d.id) ? LESSON_OF[d.id] : 0);
    if (n > hi) hi = n;
  }
  return hi;
}
function questGroup(q){
  if (!q) return DRILL_TAB;
  if (!q.drill) return 1;
  var d = drillById(q.id), n = d ? lessonField(d) : 0;
  if (n) return n;
  if (Object.prototype.hasOwnProperty.call(LESSON_OF, q.id)) return LESSON_OF[q.id];
  if ((q.name || "").indexOf("⚔") >= 0) return newestLesson();
  return DRILL_TAB;
}
/* every group that has something in it, lessons in order and the drills last */
function tabList(){
  var seen = {}, out = [], i, g;
  for (i = 0; i < ALL.length; i++){
    g = questGroup(ALL[i]);
    if (!seen[g]){ seen[g] = true; out.push(g); }
  }
  out.sort(function(a, b){ return (a || 99) - (b || 99); });
  if (!out.length) out.push(1);
  return out;
}
function tabLabel(g){ return g ? "L" + g : "drills"; }
function currentTab(){
  var t = tabList();
  if (t.indexOf(activeTab) < 0) activeTab = t[0];
  return activeTab;
}

/* ---- favourites, and the player's own order ----
   Both are marks on a quest and neither is a copy of anything: a favourite
   is pinned to the top of its tab (and to the top of the left margin, which
   is in view the whole time you are writing), and an order is remembered
   only for the quests that have actually been moved — everything else keeps
   the order it was delivered in. Both ride out with the log as optional
   fields on the quest's entry, so a reader that knows nothing about either
   reads the log exactly as it always did. */
function favOf(id){ return !!questSlot(id).fav; }
function orderOf(id, idx){
  var o = questSlot(id).order;
  return (typeof o === "number" && isFinite(o)) ? o : idx;
}
/* the indices of ALL that belong to a group, in the order they are read */
function viewOf(g){
  var out = [], i;
  for (i = 0; i < ALL.length; i++) if (questGroup(ALL[i]) === g) out.push(i);
  out.sort(function(a, b){
    var fa = favOf(ALL[a].id) ? 0 : 1, fb = favOf(ALL[b].id) ? 0 : 1;
    if (fa !== fb) return fa - fb;
    var oa = orderOf(ALL[a].id, a), ob = orderOf(ALL[b].id, b);
    if (oa !== ob) return oa - ob;
    return a - b;
  });
  return out;
}
function view(){ return viewOf(currentTab()); }

function setTab(g, quiet){
  var t = tabList();
  if (t.indexOf(g) < 0) g = t[0];
  activeTab = g;
  try { localStorage.setItem(TAB_KEY, String(g)); } catch (e){}
  var v = view();
  if (v.length && v.indexOf(qsel) < 0) qsel = v[0];
  renderQuests();
  if (!quiet)
    say(tabLabel(g) + " · " + (v.length ? v.length + (v.length === 1 ? " quest" : " quests")
                                        : "nothing here yet"));
}
function moveTab(d){
  var t = tabList(), at = t.indexOf(currentTab());
  if (at < 0) at = 0;
  setTab(t[((at + d) % t.length + t.length) % t.length]);
}
function toggleFavourite(){
  var q = selQuest();
  if (!q) return;
  var s = questSlot(q.id);
  s.fav = !s.fav;
  save(); renderQuests();
  say(q.short + (s.fav ? " · ✦ kept to hand" : " · no longer to hand"));
}
/* ---- moving a quest ----
   A quest moves among its own kind: within the favourites at the head of
   the tab, or within the rest below them. It never crosses the hairline by
   being nudged — that is what F is for. The run it moves in is renumbered
   whole, so the arrangement is explicit from that moment on and a drill
   arriving later cannot shuffle what was put in order by hand. */
function moveInOrder(d){
  var v = view(), q = selQuest(), mine = [], i, at, to, moved;
  if (!q) return;
  for (i = 0; i < v.length; i++)
    if (favOf(ALL[v[i]].id) === favOf(q.id)) mine.push(v[i]);
  at = mine.indexOf(qsel);
  if (at < 0) return;
  to = at + d;
  if (to < 0 || to >= mine.length){
    say(q.short + " · already at the " + (d < 0 ? "head" : "foot"));
    return;
  }
  moved = mine.slice();
  moved.splice(at, 1);
  moved.splice(to, 0, qsel);
  for (i = 0; i < moved.length; i++) questSlot(ALL[moved[i]].id).order = i;
  save(); renderQuests();
  say(q.short + " · moved " + (d < 0 ? "up" : "down"));
}

/* ---- the quest page ---- */
/* the rows are built once per shape of the list and kept alongside ALL, so
   that a row can always be found by the quest it belongs to; which of them
   are on the page, and in what order, is the tab's business and is settled
   again on every render */
var qrows = [];
var qempty = null;
function hairline(cls, label){
  var el = document.createElement("div");
  el.className = cls;
  var sp = document.createElement("span"); sp.textContent = label;
  var ln = document.createElement("i");
  el.appendChild(sp); el.appendChild(ln);
  return el;
}
function buildQuestRows(){
  while (qlist.firstChild) qlist.removeChild(qlist.firstChild);
  qrows.length = 0;
  for (var qi = 0; qi < ALL.length; qi++){
    var qrow = document.createElement("div");
    qrow.className = "quest";
    var qc = document.createElement("span"); qc.className = "qcaret";
    var qg = document.createElement("span"); qg.className = "qsigil";
    var qn = document.createElement("div"); qn.className = "qname"; qn.textContent = plainName(ALL[qi]);
    var qt = document.createElement("span"); qt.className = "qstat";
    var qf = document.createElement("span"); qf.className = "qfav";
    qrow.appendChild(qc); qrow.appendChild(qg); qrow.appendChild(qn);
    qrow.appendChild(qt); qrow.appendChild(qf);
    qrow.addEventListener("click", (function(id){
      return function(){ clickWorkspace(id); };
    })(ALL[qi].id));
    /* the mark answers the mouse where it is: choosing the quest first, so
       that what is kept to hand is always what the caret is on */
    qf.addEventListener("click", (function(id){
      return function(ev){
        if (ev && ev.stopPropagation) ev.stopPropagation();
        selectById(id);
        toggleFavourite();
      };
    })(ALL[qi].id));
    qrows.push({ el: qrow, caret: qc, sigil: qg, stat: qt, fav: qf });
  }
  qempty = document.createElement("div");
  qempty.className = "qempty";
  qempty.textContent = "nothing in this lesson yet";
  layoutQuestRows();
}
/* which rows are on the page, in which order, and where the hairline falls.
   A divider that divides nothing is not drawn: the label goes before every
   run except the first, so a tab with no favourites in it is a plain list
   exactly as it always was. */
function layoutQuestRows(){
  var v = view(), i, idx, run = -1, here;
  while (qlist.firstChild) qlist.removeChild(qlist.firstChild);
  for (i = 0; i < v.length; i++){
    idx = v[i];
    here = favOf(ALL[idx].id) ? 1 : 0;
    if (here !== run){
      if (run >= 0)
        qlist.appendChild(hairline("qhair", here ? "favourites" : tabLabel(currentTab())));
      run = here;
    }
    qlist.appendChild(qrows[idx].el);
  }
  if (!v.length && qempty) qlist.appendChild(qempty);
  /* the caret is never below the fold of its own list */
  var sel = qrows[qsel] && qrows[qsel].el;
  if (sel && sel.scrollIntoView) sel.scrollIntoView({ block:"nearest", inline:"nearest" });
}
/* ---- the tabs, drawn twice ----
   The board has them across the head of the list and the left margin has
   the same ones at the margin's size; they are the same strip and they turn
   together, so they are drawn by one function. The board's carry the count
   of what is under them, the margin's do not — the margin is showing that
   lesson already. */
function drawTabs(host, cls, counts){
  if (!host) return;
  var t = tabList(), cur = currentTab(), i, el, lab, n;
  while (host.firstChild) host.removeChild(host.firstChild);
  for (i = 0; i < t.length; i++){
    el = document.createElement("div");
    el.className = cls + (t[i] === cur ? " on" : "");
    el.setAttribute("role", "tab");
    el.setAttribute("aria-selected", t[i] === cur ? "true" : "false");
    lab = document.createElement("span");
    lab.textContent = tabLabel(t[i]);
    el.appendChild(lab);
    if (counts){
      n = document.createElement("span");
      n.className = "qtn";
      n.textContent = " " + viewOf(t[i]).length;
      el.appendChild(n);
    }
    el.addEventListener("click", (function(g){
      return function(){ setTab(g); };
    })(t[i]));
    host.appendChild(el);
  }
}
function renderTabs(){ drawTabs(qtabs, "qtab", true); }
buildQuestRows();
qfree.addEventListener("click", function(){ clickWorkspace(null); });
var qi;

/* the contour: the selected quest's page in the roll's language, shrunk —
   one coloured dab per sounding step, pitch as height. No rules, no grid,
   no numbers; it is there to be recognised, not read. */
var qdabs = [], qdabs2 = [], vdabs;
for (qi = 0; qi < STEPS; qi++){
  var qd = document.createElement("div");
  qd.className = "qdab";
  qd.style.display = "none";
  qpreview.appendChild(qd);
  qdabs.push(qd);
  var qd2 = document.createElement("div");
  qd2.className = "qdab";
  qd2.style.display = "none";
  qpreview.appendChild(qd2);
  qdabs2.push(qd2);
}
vdabs = [qdabs, qdabs2];
function renderContour(id){
  var d = questPage(id), lo = Infinity, hi = -Infinity, i, m, v, s, n;
  for (v = 0; v < VOICES; v++){
    s = docSteps(d, v);
    for (i = 0; s && i < STEPS; i++){
      m = s[i] ? midiOf(s[i]) : null;
      if (m !== null){ if (m < lo) lo = m; if (m > hi) hi = m; }
    }
  }
  if (lo > hi){
    for (v = 0; v < VOICES; v++)
      for (i = 0; i < STEPS; i++) vdabs[v][i].style.display = "none";
    return;
  }
  lo -= 2; hi += 2;
  while (hi - lo + 1 < 14){ lo--; hi++; }   /* a shape, neither flattened nor exaggerated */
  var span = hi - lo + 1;
  for (v = 0; v < VOICES; v++){
    s = docSteps(d, v);
    for (i = 0; i < STEPS; i++){
      var dab = vdabs[v][i];
      n = s ? s[i] : null;
      if (!n){ dab.style.display = "none"; continue; }
      m = midiOf(n);
      /* the contour speaks the roll's language, so it says length the same
         way: a held note is one longer dab, never several */
      var dl = Math.min(spanOf(d, v, i), STEPS - i);
      dab.style.display = "block";
      dab.style.left = (i * 6.25 + 1.1) + "%";
      dab.style.width = (dl * 6.25 - 2.25) + "%";
      dab.style.height = "0.34rem";
      dab.style.top = "calc(" + ((hi - m) / span * 100) + "% - 0.17rem)";
      dab.style.backgroundColor = PC_COLOR[parseNote(n).pc];
      dab.style.opacity = (i >= d.loop) ? "0.4" : (v ? "0.7" : "1");
    }
  }
}
/* the sword means one thing only — the workspace you are in — so the
   flavour sword the names carry is not printed beside it */
function plainName(q){ return q.name.replace(/^⚔\s*/, ""); }
/* what the margin's first column says about a workspace: where you are, or
   that there is something written in it. Complete is not here but at the
   other end of the line, beside the favourite's mark, so that a quest can
   be finished, written-in, kept to hand and under your feet all at once and
   say so — three states in one slot lost the two that matter while
   writing. */
function questGlyph(id){
  if (id === qActive) return "⚔";
  return questHasContent(id) ? "•" : "";
}
function renderQuests(){
  for (var i = 0; i < ALL.length && i < qrows.length; i++){
    var q = ALL[i], s = questSlot(q.id), r = qrows[i];
    r.el.classList.toggle("sel", i === qsel);
    r.caret.textContent = (i === qsel) ? "‸" : "";
    r.sigil.textContent = (q.id === qActive) ? "⚔" : "";
    if (s.done){ r.stat.textContent = "❧"; r.stat.className = "qstat done"; }
    else if (questHasContent(q.id)){ r.stat.textContent = "•"; r.stat.className = "qstat bound"; }
    else { r.stat.textContent = ""; r.stat.className = "qstat"; }
    if (r.fav) r.fav.textContent = s.fav ? "✦" : "";
  }
  renderTabs();
  layoutQuestRows();
  qfree.classList.toggle("act", !qActive);
  qfreesigil.textContent = qActive ? "" : "⚔";
  renderQuestDetail();
  renderRails();
  /* the ground under the sheet, where the ground is the workspace's own:
     every route into another workspace comes through here */
  applyScenery();
}
function renderQuestDetail(){
  var q = selQuest(), s, bits = [];
  if (!q) return;
  s = questSlot(q.id);
  qdname.textContent = plainName(q);
  qdtext.textContent = q.text || "";
  qdteach.textContent = q.teaches ? "Teaches: " + q.teaches : "";
  bits.push(q.id === qActive ? "⚔ you are working here"
                             : "enter to work here — its page is kept apart");
  if (s.done) bits.push("❧ complete");
  if (s.fav) bits.push("✦ kept to hand");
  if (!questHasContent(q.id)) bits.push("nothing written yet");
  qdstate.textContent = bits.join(" · ");
  renderContour(q.id);
}
/* the caret walks the tab it is in, and wraps inside it: the list on the
   page is the list the arrows walk, which is the whole point of the tabs */
function moveQuest(d){
  var v = view(), at;
  if (!v.length) return;
  at = v.indexOf(qsel);
  qsel = (at < 0) ? v[0] : v[((at + d) % v.length + v.length) % v.length];
  renderQuests();
  say(selQuest().short);
}

/* ---- the side rails ----
   The page has always had wide margins. The left one says where every
   workspace is and which one you are in; the right one keeps the standing
   constraint in view while you noodle, which is the whole point of it. The
   left one's lines switch workspaces on click; both are quiet, and gone
   entirely on a narrow window. */
var rrows = [];
function buildRailRows(){
  function line(name){
    var el = document.createElement("div");
    el.className = "rline";
    var g = document.createElement("span"); g.className = "rg";
    var n = document.createElement("span"); n.className = "rn"; n.textContent = name;
    /* two marks at the end of the line, and they mean different things:
       the work is finished, and the quest is kept to hand. A quest can be
       both, so neither may stand in for the other. */
    var dn = document.createElement("span"); dn.className = "rd";
    var f = document.createElement("span"); f.className = "rf";
    el.appendChild(g); el.appendChild(n); el.appendChild(dn); el.appendChild(f);
    return { el: el, glyph: g, name: n, done: dn, fav: f };
  }
  while (railquests.firstChild) railquests.removeChild(railquests.firstChild);
  rrows.length = 0;
  rrows.push(line("free play"));
  rrows[0].el.addEventListener("click", function(){ clickWorkspace(null); });
  for (var i = 0; i < ALL.length; i++){
    var rr = line(ALL[i].short);
    rr.el.addEventListener("click", (function(id){
      return function(){ clickWorkspace(id); };
    })(ALL[i].id));
    rrows.push(rr);
  }
  railShape = "";
  layoutRailRows();
}
/* the margin is redrawn only when its arrangement actually changes — it is
   touched on every autosave, which is on every note */
var railShape = "";
function layoutRailRows(){
  var seq = railSequence(), sig = currentTab() + ":" + seq.join(","), i;
  if (sig === railShape) return;
  railShape = sig;
  while (railquests.firstChild) railquests.removeChild(railquests.firstChild);
  railquests.appendChild(rrows[0].el);
  for (i = 0; i < seq.length; i++) railquests.appendChild(rrows[seq[i] + 1].el);
}
/* the same tags the board wears, in the margin, at the margin's size: what
   the crossbar's ← and → are turning, said where it is being turned */
function renderRailTabs(){ drawTabs(rtabs, "rtab", false); }
buildRailRows();
function renderRails(){
  /* while start is up the d-pad is walking this list, so the line it is on
     is washed as well as marked — the pad's own highlight, and calm */
  var nav = settingsEl.classList.contains("on");
  renderRailTabs();
  layoutRailRows();
  rrows[0].el.classList.toggle("act", !qActive);
  rrows[0].el.classList.toggle("nav", nav && !qActive);
  rrows[0].glyph.textContent = qActive ? "" : "⚔";
  for (var i = 0; i < ALL.length && i + 1 < rrows.length; i++){
    var id = ALL[i].id, r = rrows[i + 1];
    r.el.classList.toggle("act", id === qActive);
    r.el.classList.toggle("nav", nav && id === qActive);
    r.glyph.textContent = questGlyph(id);
    /* finished, and kept to hand: two marks, because they are two things */
    if (r.done) r.done.textContent = questSlot(id).done ? "❧" : "";
    if (r.fav) r.fav.textContent = favOf(id) ? "✦" : "";
  }
  var q = activeQuest();
  railtitle.textContent = q ? plainName(q) : "Free play";
  railtext.textContent  = q ? (q.text || "") : "No constraint. Whatever you write here stays here.";
  railteach.textContent = (q && q.teaches) ? "Teaches: " + q.teaches : "";
  railstate.textContent = q ? (questSlot(q.id).done ? "❧ complete" : "not yet complete")
                            : "F3 for the quest log";
}
