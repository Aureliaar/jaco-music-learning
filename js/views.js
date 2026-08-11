/* Folio — js/views.js : the page, drawn.

   Every element the app holds by id; the scenery behind the sheet and the
   dissolve from one scene to the next; how much of the page each view has
   room for, measured off the screen; the written column; the roll and
   everything laid on it — the home rules, the bars, the intervals, the guide;
   the renderers; the key overlay F1 raises; and say(), which is the
   one way anything speaks.

   It reads the document and writes the page, and never the other way round. */
"use strict";

/* ================= view ================= */
var column = document.getElementById("column");
var footer = document.getElementById("footer");
var meta   = document.getElementById("metatext");
var questsEl = document.getElementById("quests");
var settingsEl = document.getElementById("settings");
var xbarPad = document.getElementById("xbarpad");
var xbarFace = document.getElementById("xbarface");
var voicesEl = document.getElementById("voices");
var vnames = [document.getElementById("vname0"), document.getElementById("vname1"),
              document.getElementById("vname2")];
var vmarks = [document.getElementById("vmark0"), document.getElementById("vmark1"),
              document.getElementById("vmark2")];
var qlist  = document.getElementById("qlist");
var qtabs  = document.getElementById("qtabs");
var keyhelpEl = document.getElementById("keyhelp");
var keymarkEl = document.getElementById("keymark");
var qfree  = document.getElementById("qfree");
var qfreesigil = document.getElementById("qfreesigil");
var qdname = document.getElementById("qdname");
var qdtext = document.getElementById("qdtext");
var qdteach = document.getElementById("qdteach");
var qdstate = document.getElementById("qdstate");
var qpreview = document.getElementById("qpreview");
var railquests = document.getElementById("railquests");
var rtabs = document.getElementById("rtabs");
var railtitle = document.getElementById("railtitle");
var railtext  = document.getElementById("railtext");
var railteach = document.getElementById("railteach");
var railstate = document.getElementById("railstate");
var sceneryEl = document.getElementById("scenery");
var sceneryButtons = sceneryEl.querySelectorAll("button[data-scene]");
var picker = document.getElementById("picker");

/* The landscape is a preference, not part of a musical document: changing
   workspace, importing a folio, or sharing a quest never changes it. */
var SCENERIES = ["paper", "forest", "sea", "quest"];
/* ---- the fourth scene: the workspace's own picture ----
   `quest` is not a photograph but a rule — whichever illustration belongs
   to the workspace you are in, at quest-backgrounds/<id>.png. Nothing here
   holds a list of names: an id either has a file or it has not, and the
   only way to find out on a static host as well as a served one is to ask
   for the picture. So each id is probed once, the answer is remembered for
   the session, and until it comes back (or if it never does) the body is on
   plain paper — which is the graceful fall in every direction: free play,
   a quest with no picture of its own, an offline reload, a folio opened
   from a file. Nothing waits on the network and nothing changes size when
   the answer arrives; the ground under the sheet simply becomes a scene. */
var QUEST_BG_DIR = "quest-backgrounds/";
var scenePref = "paper";
var bgKnown = {};                  /* id -> true | false | null (asked) */
var sceneFade = document.getElementById("scenefade");
/* url -> "ok" | "bad": a picture is only ever "ok" once it has been both
   fetched and *decoded*, which is the whole point. An image that has merely
   loaded still has to be turned into pixels, and the browser does that on
   the frame it is first painted — which is the frame the ground changes on.
   That one frame is what the parchment was showing through. */
var picState = {};
/* what the ground is wearing right now, named by scene *and* picture, so
   that walking from one quest's workspace to another's — both of them the
   "quest" scene, with different pictures — is seen for the change it is */
var sceneKey = "paper|";

function questBgUrl(id){ return QUEST_BG_DIR + encodeURIComponent(id) + ".png"; }
/* the picture each scene stands on, or nothing where the scene is paper */
function sceneUrl(s){
  if (s === "forest") return "folio-forest.png";
  if (s === "sea") return "folio-sea.png";
  if (s === "quest") return qActive ? questBgUrl(qActive) : null;
  return null;
}
/* fetch it, decode it, and only then say it is ready. decode() is asked for
   where it exists; where it does not, the load event is the best answer
   there is and is taken. Either way nothing visual has happened yet. */
function readyPic(url, cb){
  var known = picState[url];
  if (known === "ok" || known === "bad"){ cb(known === "ok"); return; }
  if (typeof Image !== "function"){ picState[url] = "bad"; cb(false); return; }
  var im = new Image();
  function settle(okay){ picState[url] = okay ? "ok" : "bad"; cb(okay); }
  im.onerror = function(){ settle(false); };
  im.onload = function(){
    if (im.decode) im.decode().then(function(){ settle(true); }, function(){ settle(true); });
    else settle(true);
  };
  im.src = url;
}
function probeBg(id){
  if (!id) return;
  if (Object.prototype.hasOwnProperty.call(bgKnown, id)) return;
  bgKnown[id] = null;
  readyPic(questBgUrl(id), function(okay){
    bgKnown[id] = okay;
    applyScenery(); scenerySettled();
  });
}
/* ---- what the body should be wearing ----
   The preference, except where the preference has nothing to show. The
   fourth scene has a third answer as well as yes and no: *not yet*. Falling
   to paper while the question was still out was the whole of the flash —
   walking from one quest's workspace to another's put the parchment up for
   the few hundred milliseconds it took to find out whether the next quest
   had a picture, and then put the picture up over it. So a question still
   out holds the ground exactly where it is: null means "keep what is up",
   and paper is only ever worn when it is the actual answer. */
function sceneNow(){
  if (scenePref !== "quest") return scenePref;
  if (!qActive) return "paper";              /* free play has none, and will not */
  if (bgKnown[qActive] === true) return "quest";
  if (bgKnown[qActive] === false) return "paper";
  probeBg(qActive);
  return null;
}
/* the swap itself, once there is certainly something to swap to. Between two
   pictures the one being left is lifted onto the fade layer and dissolved
   over the one arriving; to or from paper there is only one picture in the
   movement, and a single step is cleaner than washing a photograph over the
   page. Nothing here can show an undrawn image: readyPic has already been
   waited on. */
function swapScene(eff, url, key){
  var bar = sceneKey.indexOf("|"), leaving = sceneKey.slice(bar + 1);
  var cross = !!(leaving && url && sceneFade && window.getComputedStyle);
  var s = document.body.style;
  if (cross){
    sceneFade.style.transition = "none";
    sceneFade.style.backgroundImage =
      window.getComputedStyle(document.body).backgroundImage;
    sceneFade.style.opacity = "1";
  }
  if (eff === "quest" && s && s.setProperty)
    s.setProperty("--questbg", 'url("' + url + '")');
  document.body.setAttribute("data-scenery", eff);
  sceneKey = key;
  /* the scene changes how much room the working field has — on scenery the
     title and the foot take 3.2rem of breath apiece and the two rules go
     away — and the fit is keyed on the window alone, which has not moved. So
     it is told the measurement is stale, and the rows are counted again. */
  refit();
  if (cross && typeof requestAnimationFrame === "function"){
    /* two frames: the arriving ground is painted under the leaving one
       before the dissolve is asked for, or the transition has nothing to
       start from and the swap is a cut after all */
    requestAnimationFrame(function(){
      requestAnimationFrame(function(){
        sceneFade.style.transition = "";
        sceneFade.style.opacity = "0";
      });
    });
  }
}
function applyScenery(){
  var eff = sceneNow(), url, key;
  if (eff === null) return;                  /* still asking: hold the ground */
  url = sceneUrl(eff); key = eff + "|" + (url || "");
  if (key === sceneKey) return;
  if (url && !picState[url]){
    /* nothing is known about that picture yet: the ground stays exactly as
       it is until there is an answer, and this is asked again with it in
       hand. A picture that cannot be had is an answer too — the scene is
       then worn for its veil alone, exactly as it always was. */
    readyPic(url, function(){ applyScenery(); });
    return;
  }
  swapScene(eff, url, key);
}
if (sceneFade && sceneFade.addEventListener)
  sceneFade.addEventListener("transitionend", function(){
    /* the scene it was holding has gone: let go of the bitmap too */
    if (sceneFade.style.opacity === "0") sceneFade.style.backgroundImage = "none";
  });
/* what the scenery control is saying, which for the fourth scene depends on
   an answer that may still be coming back over the wire */
function sceneryLine(){
  if (scenePref !== "quest") return "scenery · " + scenePref;
  if (document.body.getAttribute("data-scenery") === "quest")
    return "scenery · quest · " + workspaceName();
  if (!qActive) return "scenery · quest · paper, until you are in one";
  if (bgKnown[qActive] === false)
    return "scenery · quest · nothing to show here — paper";
  return "scenery · quest";
}
/* the answer arrived after the line was written: write it again, and only
   if the line is still the one the control put there */
function scenerySettled(){
  if (scenePref !== "quest") return;
  if (String(lastSaid).indexOf("scenery · quest") !== 0) return;
  say(sceneryLine());
}
function setScenery(scene, quiet){
  if (SCENERIES.indexOf(scene) < 0) scene = "paper";
  scenePref = scene;
  applyScenery();
  for (var si = 0; si < sceneryButtons.length; si++)
    sceneryButtons[si].setAttribute("aria-pressed",
      sceneryButtons[si].getAttribute("data-scene") === scene ? "true" : "false");
  try { localStorage.setItem(SCENERY_KEY, scene); } catch (e){}
  if (!quiet) say(sceneryLine());
}
function cycleScenery(){
  setScenery(SCENERIES[(SCENERIES.indexOf(scenePref) + 1) % SCENERIES.length]);
}
for (var si = 0; si < sceneryButtons.length; si++){
  sceneryButtons[si].addEventListener("click", function(){
    setScenery(this.getAttribute("data-scene"));
  });
}

/* ---- the seal, as it is drawn ----
   One small gilt ring at the shoulder of a sealed note, with up to three
   short spokes standing off it: the left spoke is the pitch, the upright one
   the step, the right one the length. It is the same mark in the column and
   in the drawing, so it is learnt once; and it is deliberately quiet — at
   arm's length it says "sealed" and nothing more, and which three it wears
   is a thing you lean in for. There is no legend, and nothing to press. */
function mkSeal(){
  var s = document.createElement("i");
  s.className = "seal";
  for (var k = 0; k < LOCK_KINDS.length; k++){
    var t = document.createElement("b");
    t.className = "t" + LOCK_KINDS.charAt(k);
    s.appendChild(t);
  }
  return s;
}
function setSeal(el, lk){
  el.className = "seal" + (lk ? " on" : "") +
    (lk && lk.indexOf("p") >= 0 ? " sp" : "") +
    (lk && lk.indexOf("r") >= 0 ? " sr" : "") +
    (lk && lk.indexOf("l") >= 0 ? " sl" : "");
}

/* ---- the page is drawn a window at a time ----
   Everything below is built the longest a page can be — sixty-four rows,
   sixty-four columns — and shows as many of them as the screen has room
   for: `rows[k]`, `bars[k]`, `baseCells[k]` are screen slots, and the step
   each is showing is that view's first step plus k. The two views are sized
   apart (fitViews, below) because they are bound by different edges, so
   each has its own pair of these. A slot past the end of its view is not
   drawn at all.

   Nothing here decides how many that is; it only asks. */
function colStep(k){ return startCol + k; }
function colSlot(i){ var k = i - startCol; return (k >= 0 && k < winCol) ? k : -1; }
function rollStep(k){ return startRoll + k; }
function rollSlot(i){ var k = i - startRoll; return (k >= 0 && k < winRoll) ? k : -1; }

var rows = [];
for (var i = 0; i < MAX_STEPS; i++){
  var row = document.createElement("div");
  row.className = "row";
  var fl = document.createElement("span"); fl.className = "fleuron";
  var ca = document.createElement("span"); ca.className = "caret";
  var nu = document.createElement("span"); nu.className = "num"; nu.textContent = String(i + 1);
  /* one column per voice, side by side, in the order they are named above.
     The written name is a text node of its own rather than the cell's whole
     content, so that the seal can sit in the same cell and survive being
     redrawn sixteen times a keystroke. */
  var no = document.createElement("span"), no2 = document.createElement("span");
  var tx = document.createTextNode("·"), tx2 = document.createTextNode("·");
  var sl = mkSeal(), sl2 = mkSeal();
  no.className = "note empty"; no.appendChild(tx); no.appendChild(sl);
  no2.className = "note empty dim"; no2.appendChild(tx2); no2.appendChild(sl2);
  /* and the chord lane's own column beside the two voices: one cell, one
     mark. It wears no seal — nothing seals a chord — so it is a text node
     and nothing else, which is also why a chord can never be drawn here as
     a stack of note heads: there is one place for one glyph. */
  var no3 = document.createElement("span");
  var tx3 = document.createTextNode("·");
  no3.className = "note chord empty dim"; no3.appendChild(tx3);
  row.appendChild(fl); row.appendChild(ca); row.appendChild(nu);
  row.appendChild(no); row.appendChild(no2); row.appendChild(no3);
  column.appendChild(row);
  rows.push({ el: row, fleuron: fl, caret: ca, num: nu, note: no, note2: no2,
              notes: [no, no2, no3], texts: [tx, tx2, tx3], seals: [sl, sl2, null] });
}

/* ---- the roll, built once; bars and home rules are laid out on edit ----
   Same document, drawn instead of written: sixteen columns left to right,
   pitch as height, no note names anywhere. Colour is the pitch class, and
   neighbours on the circle of fifths sit next to each other in hue, so
   notes that belong together look related. Octave-equivalents share a
   colour; height tells them apart. */
var roll      = document.getElementById("roll");
var rollfield = document.getElementById("rollfield");
var rollbase  = document.getElementById("rollbase");
var viz = "roll";
var VIZ_KEY = "folio.viz";           /* a preference, not part of the document */

var PC_COLOR = [];
for (i = 0; i < 12; i++){
  PC_COLOR[i] = "hsl(" + ((((i * 7) % 12) * 30 + 45) % 360) + ",42%,40%)";
}

/* the beat rules: one every fourth step of the page, wherever that falls in
   the window. They are laid out with the bars rather than built in place,
   because which slots are beats depends on where the window opens. */
var beatlines = [];
for (i = 0; i * 4 <= MAX_STEPS; i++){
  var bl = document.createElement("div");
  bl.className = "beatline";
  bl.style.display = "none";
  rollfield.appendChild(bl);
  beatlines.push(bl);
}
/* ---- the chord lane, in the drawing ----
   One object a chord, and never three note heads at three heights: a soft
   slab of the root's own colour from the lowest tone it is sounding to the
   highest, as long as the chord rings, with a quiet line inside it at each
   pitch it actually holds. The lines are what makes voice leading visible —
   a tone that did not move draws at exactly the same height in the chord
   after it, which is the whole of the lesson, seen. They are inside the one
   element, so what the eye picks up first is the slab and what it reads
   second is where the tones are; and there are never more than four of
   them, in one object, so nothing here can stack up into a stripe.

   They are built before the note bars and so lie under them: the chords are
   the ground the two voices stand on, in the drawing as in the ear. */
var chordBars = [], chordWashes = [], chordTones = [];
for (i = 0; i < MAX_STEPS; i++){
  var cbar = document.createElement("div");
  cbar.className = "chordbar";
  cbar.style.display = "none";
  /* the slab's colour is worn by a layer of its own rather than by the
     element, so that the tones inside it keep their own weight instead of
     being faded along with the ground they are drawn on */
  var cwash = document.createElement("b");
  cbar.appendChild(cwash);
  var ctones = [];
  for (var ct = 0; ct < 4; ct++){
    var cline = document.createElement("i");
    cbar.appendChild(cline);
    ctones.push(cline);
  }
  rollfield.appendChild(cbar);
  chordBars.push(cbar); chordWashes.push(cwash); chordTones.push(ctones);
}
var rollWash = document.createElement("div");
rollWash.className = "rollwash";
rollfield.appendChild(rollWash);
var rollCur = document.createElement("div");
rollCur.className = "rollcur";
rollfield.appendChild(rollCur);
/* the guide: one line, laid at the pitch of whatever note is in hand. It
   goes in before the bars so that the bars are drawn over it. */
var rollGuide = document.createElement("div");
rollGuide.className = "rollguide";
var guideName = document.createElement("span");
guideName.className = "gname";
rollGuide.appendChild(guideName);
rollfield.appendChild(rollGuide);
var octlines = [];
var bars = [], bars2 = [], baseCells = [];
var vbars = [bars, bars2];
/* ---- the seam bar ----
   A note held past the last step of the loop comes back in at the first,
   and the drawing has to show both halves of it or the one thing Lesson 3
   is for — a note that rings across the seam — would be drawn as a bar
   running off the edge of the page into nothing. Only one note per voice
   can cross the seam, so one spare bar each is all it can ever need. */
var seamBars = [];
/* ---- and the bar that came in from the left ----
   The window's other edge has the same problem the seam has: a note struck
   before the first step on screen may still be ringing across it, and a
   drawing that began every bar at its head would simply not draw it. One
   spare each again — only one note per voice can be sounding at the moment
   the window opens — laid from the left edge to wherever it stops. */
var edgeBars = [];
/* one per step: the interval between the voices, written where both sound —
   the label itself, and the tie that hangs it between the two bars */
var ivls = [], ivlTies = [];
function mkBar(store){
  var b = document.createElement("div");
  b.className = "bar";
  b.style.display = "none";
  /* the same seal the column draws, sitting on the head of the bar — the end
     the note is struck at — like a seal on the end of a ribbon */
  b.appendChild(mkSeal());
  rollfield.appendChild(b);
  store.push(b);
}
for (i = 0; i < MAX_STEPS; i++){
  mkBar(bars);
  /* the second voice's bars, drawn in the same field: pitch already keeps
     them apart, and the voice not in hand is drawn a shade back */
  mkBar(bars2);
  var ivl = document.createElement("div");
  ivl.className = "ivl";
  /* the name first, so that the label is the slot's first child as it has
     always been; the tie is lifted over by the stacking order, not by the
     document order */
  ivl.appendChild(document.createElement("span"));
  var tie = document.createElement("i");
  ivl.appendChild(tie);
  rollfield.appendChild(ivl);
  ivls.push(ivl); ivlTies.push(tie);
  var cell = document.createElement("span");
  cell.textContent = (i % 4 === 0) ? String(i + 1) : "";
  rollbase.appendChild(cell);
  baseCells.push(cell);
}
for (i = 0; i < VOICES; i++) mkBar(seamBars);
for (i = 0; i < VOICES; i++) mkBar(edgeBars);

/* ================= each view takes the room it has =================
   The window used to be sixteen steps in both views because sixteen steps
   was all a page ever was. It is not a number any more: it is however much
   of the page the screen can hold, and the two views are not bound by the
   same edge of it.

   The roll reads left to right, so it is bound by the width: as many steps
   as fit across, up to the whole page — on a wide screen a thirty-two-step
   page is simply all there, with no window and nothing said about one. The
   column reads downwards, so it is bound by the height: as many rows as fit
   at the row height it has always had. The two numbers have no reason to
   agree and mostly do not, which is why each view keeps its own.

   None of it is guessed. The cell keeps the size it has always had — the
   measure of the page divided by the sixteen it was drawn for — and what is
   measured is the room: the viewport, the margins the rails hold, the
   chrome above and below the folio. Then it is a division and a floor.
   Nothing is squeezed to fit and nothing is stretched to fill; a screen
   with room for eleven rows shows eleven, and the window mechanics that
   already existed carry the rest of the page.

   The sheet grows with the drawing rather than the drawing spilling off it,
   so the folio is one page at whatever width the drawing needs; the written
   column keeps the measure it always had, and so does everything made of
   words. */
var pageEl  = document.getElementById("page");
var fieldEl = document.getElementById("field");
var railEl  = document.getElementById("raill");
var PAGE_W = "--pagew";
var MIN_SLOTS = 4;             /* below this a view is not a view */
var GUTTER = 1.5;              /* rem of air between the drawing and the rails */
var ROLL_PAD = 2.7;            /* rem the drawing keeps for the rules' names */
var ROW_H = 2.35;              /* em of a written row: folio.css says so too */
var fitted = { w:0, h:0, len:0 };
var fitW = { base:0, roll:0 };

function boxOf(el){
  return (el && el.getBoundingClientRect) ? el.getBoundingClientRect() : null;
}
function boxW(el){ var r = boxOf(el); return r ? r.width : 0; }
function boxH(el){ var r = boxOf(el); return r ? r.height : 0; }
/* the root's own font size, which is where every measure in the stylesheet
   is counted from — and it is itself a clamp on the viewport's height, so
   it is read rather than assumed */
function remPx(){
  var n;
  if (!window.getComputedStyle || !document.documentElement) return 0;
  n = parseFloat(window.getComputedStyle(document.documentElement).fontSize);
  return (n > 0) ? n : 0;
}
function styleNum(el, prop){
  var s;
  if (!el || !window.getComputedStyle) return 0;
  s = parseFloat(window.getComputedStyle(el)[prop]);
  return (s > 0) ? s : 0;
}
function clampSlots(n, page){
  return Math.max(MIN_SLOTS, Math.min(page, Math.floor(n)));
}
/* how wide the folio is asked to be: the drawing's width where the drawing
   is what is up and wants more than the page's own measure, and the measure
   itself everywhere else — the quest log, the column, a folio being read */
function applyWidth(){
  var root = document.documentElement, wide;
  if (!root || !root.style || !root.style.setProperty) return;
  wide = (viz === "roll" && !questsEl.classList.contains("on")) ? fitW.roll : 0;
  if (wide > fitW.base) root.style.setProperty(PAGE_W, Math.round(wide) + "px");
  else root.style.removeProperty(PAGE_W);
}
/* how many slots each view is showing, and the shape of the boxes they sit
   in. Returns true when a view's size actually changed — the caller draws;
   nothing here draws anything. */
function fitViews(){
  var vw = window.innerWidth || 0, vh = window.innerHeight || 0, n = pageLen();
  var root = document.documentElement, em, base, chrome, availH, availW;
  var pad, cell, wasC = winCol, wasR = winRoll, rollW;
  if (!pageEl || !fieldEl || !boxOf(pageEl) || !vw || !vh) return false;
  if (vw === fitted.w && vh === fitted.h && n === fitted.len) return false;
  fitted = { w:vw, h:vh, len:n };
  em = remPx() || 16;

  /* measured from the page at its own measure, so the widening never feeds
     itself: everything below is arithmetic on this one reading */
  if (root && root.style && root.style.removeProperty) root.style.removeProperty(PAGE_W);
  fieldEl.style.minHeight = "";
  roll.style.width = "";
  base = boxW(pageEl) || 46 * em;
  fitW.base = base;
  /* everything of the folio that is not the working field: the title, the
     rules, the footer. It does not change with the number of rows, which is
     the whole reason it can be measured once and divided by. */
  chrome = Math.max(0, boxH(pageEl) - boxH(fieldEl));
  availH = Math.max(em * 8, vh - chrome - em);
  fieldEl.style.minHeight = Math.round(availH) + "px";

  /* the column: rows of the height they have always been, as many as stand
     under the voice strip. The row is measured rather than counted off the
     stylesheet — its rule is a pixel the arithmetic would not know about,
     and twenty-six of those is a row over the edge of the screen. It is
     measured even when the drawing is what is up, by standing the column up
     for the reading and sitting it down again inside the one frame: a
     window that is only right in the view you happen to be in is not right. */
  var shown = column.style.display, rowH;
  if (shown === "none") column.style.display = "flex";
  rowH = boxH(rows[0].el) || ROW_H * em;
  if (shown === "none") column.style.display = shown;
  winCol = clampSlots((availH - boxH(voicesEl)) / rowH, n);

  /* the roll: cells of the width they have always been — the page's measure
     less the margin the names live in, over the sixteen it was drawn for —
     as many as stand between the rails */
  pad = styleNum(roll, "paddingLeft") || ROLL_PAD * em;
  cell = (base - pad) / STEPS;
  availW = vw - 2 * boxW(railEl) - 2 * GUTTER * em;
  winRoll = clampSlots((availW - pad) / cell, n);
  rollW = pad + winRoll * cell;
  fitW.roll = rollW;
  roll.style.width = Math.round(rollW) + "px";
  applyWidth();

  applySlots();
  return winCol !== wasC || winRoll !== wasR;
}
/* the slots past the end of a view are not drawn at all: the column's rows
   go away, and the drawing's base strip counts only as far as it reaches */
function applySlots(){
  var k;
  for (k = 0; k < MAX_STEPS; k++){
    rows[k].el.style.display = (k < winCol) ? "" : "none";
    baseCells[k].style.display = (k < winRoll) ? "" : "none";
  }
  rollbase.style.gridTemplateColumns = "repeat(" + winRoll + ",1fr)";
}
applySlots();
/* A resize is a stream of events, and refitting on each of them would be
   the thrash the whole thing is supposed to avoid: the last one wins, a
   breath after the dragging stops, and the page is redrawn once. */
var fitTimer = null;
function fitSoon(){
  if (fitTimer) clearTimeout(fitTimer);
  fitTimer = setTimeout(function(){
    fitTimer = null;
    if (fitViews()) renderAll();
  }, 140);
}
if (window.addEventListener) window.addEventListener("resize", fitSoon);
/* the window has not moved but what stands around the field has: forget the
   last reading, so the next fit is a real one */
function refit(){ fitted = { w:0, h:0, len:0 }; fitSoon(); }

function midiOf(s){ var p = parseNote(s); return p ? (p.oct + 1) * 12 + p.pc : null; }

/* the part of a note that is not its head: the wrap at the seam, and the
   ring that came in over the window's left edge. Both are drawn from a slot
   to a width and carry no seal — the seal rides the step the note is struck
   on, and this is not it. */
function paintTail(b, v, k, wide, top, span, colour, bound){
  var w = 100 / winRoll;
  wide = Math.min(wide, winRoll - k);
  if (wide <= 0){ b.style.display = "none"; return; }
  b.style.display = "block";
  b.style.left = (k * w + w * 0.112) + "%";
  b.style.width = (wide * w - w * 0.224) + "%";
  b.style.top = top;
  b.style.height = (100 / span) + "%";
  b.style.backgroundColor = colour;
  b.classList.toggle("back", v !== voice);
  b.classList.toggle("mirror", !!bound);
  b.classList.remove("outside");
  b.classList.remove("rang");
  b.classList.remove("astray");
  setSeal(b.firstChild, "");
}

function rollLayout(){
  /* fit the pitch window to the notes on the page, never tighter than two
     octaves, recomputed only on edits — user-initiated, never while idle.
     Both voices are inside the window: a bass that fell off the bottom of
     the drawing would be a bass you could not see. */
  /* the pitch window is fitted to the WHOLE page, not to the sixteen steps
     on screen, so that scrolling the window never slides the drawing up and
     down under the eye: the shape a long page has is one shape */
  var lo = Infinity, hi = -Infinity, i, m, v, s, N = pageLen(), w = 100 / winRoll;
  for (v = 0; v < VOICES; v++){
    s = vsteps(v);
    for (i = 0; i < N; i++){
      m = s[i] ? midiOf(s[i]) : null;
      if (m !== null){ if (m < lo) lo = m; if (m > hi) hi = m; }
    }
  }
  /* the chord lane is inside the window too — a chord drawn off the foot of
     the page would be a chord you could not see */
  var cvo = chordVoicings(doc), cst = vsteps(CHORD_LANE), ck;
  for (i = 0; i < N; i++){
    if (!cvo[i]) continue;
    for (ck = 0; ck < cvo[i].length; ck++){
      m = cvo[i][ck];
      if (m < lo) lo = m;
      if (m > hi) hi = m;
    }
  }
  if (lo > hi){ lo = 48; hi = 71; }          /* empty page: around middle C */
  lo -= 3; hi += 3;
  while (hi - lo + 1 < 24){ lo--; hi++; }
  var span = hi - lo + 1;
  /* what the drawing currently is, kept for whatever is laid on it after
     the fact — the guide, which outlives any single edit */
  rollHi = hi; rollSpan = span;

  for (i = 0; i < octlines.length; i++) rollfield.removeChild(octlines[i]);
  octlines = [];
  /* ---- the rules sit on home ----
     The drawing's horizontal reference is the tonic of the page's key, at
     every octave in view: G major rules the Gs, A minor the As, C major the
     Cs as it always did. Home is then the line one can actually see, so the
     distance from it reads as the distance in the key — a bar touching the
     line is a landing, a bar a hair under it is the leaning seventh. The
     lines move with the key and nothing else about the drawing does. */
  var tonicPc = keyOf().pc;
  for (m = lo + (((tonicPc - lo) % 12) + 12) % 12; m <= hi; m += 12){
    var ln = document.createElement("div");
    ln.className = "octline";
    ln.style.top = ((hi - m + 0.5) / span * 100) + "%";
    /* the rule says which pitch it is, once, at the side of the line, and
       under the name what that pitch is to the piece */
    var on = document.createElement("span");
    on.className = "octname";
    var opn = document.createElement("span");
    opn.className = "opn";
    opn.textContent = pitchName(nameOfMidi(m));
    var oho = document.createElement("span");
    oho.className = "ohome";
    oho.textContent = "home";
    on.appendChild(opn); on.appendChild(oho);
    ln.appendChild(on);
    rollfield.insertBefore(ln, rollfield.firstChild);   /* under wash and bars */
    octlines.push(ln);
  }

  /* the beat rules stand on every fourth step of the PAGE, wherever the
     window happens to have opened — the window's own first step is not a
     beat unless the page says it is */
  var bi = 0;
  for (i = 0; i < winRoll; i++){
    if (rollStep(i) % 4 || bi >= beatlines.length) continue;
    beatlines[bi].style.display = "block";
    beatlines[bi].style.left = (i * w) + "%";
    bi++;
  }
  for (i = bi; i < beatlines.length; i++) beatlines[i].style.display = "none";

  for (v = 0; v < VOICES; v++){
    s = vsteps(v);
    seamBars[v].style.display = "none";
    edgeBars[v].style.display = "none";
    for (i = 0; i < MAX_STEPS; i++) vbars[v][i].style.display = "none";
    for (i = 0; i < N; i++){
      var n = s[i];
      if (!n) continue;
      m = midiOf(n);
      /* one bar per note, as wide as the note is long: a held note is one
         long stadium of colour, never a row of repeated dabs. The gap
         between neighbours is the gap it always was, so a run of plain
         sixteenths is drawn exactly as it was drawn before. */
      var len = spanOf(doc, v, i), loop = doc.loop;
      var head = (i < loop) ? Math.min(len, loop - i) : len;
      var top = ((hi - m) / span * 100) + "%";
      var colour = PC_COLOR[parseNote(n).pc];
      /* the same lighter weight the column writes a bound note in, on the
         bar and on whatever of it runs off either edge */
      var bound = mirrored(doc, v, i);
      var k = rollSlot(i);
      if (k >= 0){
        var b = vbars[v][k];
        b.style.display = "block";
        b.style.left = (k * w + w * 0.112) + "%";
        /* a note that rings out past the right edge of the window stops at
           it: the rest of it is read by walking on, as everything past the
           edge is */
        b.style.width = (Math.min(head, winRoll - k) * w - w * 0.224) + "%";
        b.style.top = top;
        b.style.height = (100 / span) + "%";
        b.style.backgroundColor = colour;
        b.classList.toggle("back", v !== voice);
        b.classList.toggle("mirror", bound);
        b.classList.toggle("outside", i >= doc.loop);
        /* the judgement's mark, the drawing's way of saying it */
        b.classList.toggle("rang", echoMark(v, i) === "rang");
        b.classList.toggle("astray", echoMark(v, i) === "astray");
        setSeal(b.firstChild, sealOf(doc, v, i));
      } else if (i < startRoll && i + head > startRoll){
        /* struck before the window opened and still ringing across its left
           edge: the tail of it, from the edge to wherever it stops */
        paintTail(edgeBars[v], v, 0, Math.min(i + head, startRoll + winRoll) - startRoll,
                  top, span, colour, bound);
      }
      /* and the rest of it, come round again at the head of the page */
      if (len > head && startRoll === 0)
        paintTail(seamBars[v], v, 0, len - head, top, span, colour, bound);
    }
  }
  /* ---- and the chord lane, one slab a chord ---- */
  for (i = 0; i < MAX_STEPS; i++) chordBars[i].style.display = "none";
  for (i = 0; i < N; i++){
    if (!cst[i] || !cvo[i]) continue;
    var kc = rollSlot(i);
    if (kc < 0) continue;
    var clen = spanOf(doc, CHORD_LANE, i);
    var chead = (i < doc.loop) ? Math.min(clen, doc.loop - i) : clen;
    var cbot = cvo[i][0], ctop = cvo[i][cvo[i].length - 1], cspan = ctop - cbot + 1;
    var cb = chordBars[kc], cj, ci;
    cb.style.display = "block";
    cb.style.left = (kc * w + w * 0.112) + "%";
    cb.style.width = (Math.min(chead, winRoll - kc) * w - w * 0.224) + "%";
    cb.style.top = ((hi - ctop) / span * 100) + "%";
    cb.style.height = (cspan / span * 100) + "%";
    chordWashes[kc].style.backgroundColor = PC_COLOR[chordRootMidi(cst[i]) % 12];
    cb.classList.toggle("back", voice !== CHORD_LANE);
    cb.classList.toggle("outside", i >= doc.loop);
    for (cj = 0; cj < chordTones[kc].length; cj++){
      ci = chordTones[kc][cj];
      if (cj >= cvo[i].length){ ci.style.display = "none"; continue; }
      ci.style.display = "block";
      /* the middle of the tone's own row, so the line is where the pitch is
         and not where the row it sits in begins */
      ci.style.top = ((ctop - cvo[i][cj] + 0.5) / cspan * 100) + "%";
    }
  }
  rollIntervals(hi, span);
  placeGuide();
}
/* the interval, on the steps where both voices sound and nowhere else.
   The slot is not a point on the page: it is drawn from the centre of the
   upper bar down to the centre of the lower one, which is the distance it
   names. The tie hangs down that length and the name rides its middle, so
   the label reads as belonging to those two notes however far apart the
   voices are. */
/* ---- and what counts as sounding ----
   A held note is sounding for every step it rings, not only the one it was
   struck on: that is the whole of the suspension, where one voice holds
   still and the other moves under it and the distance between them changes
   without anything being struck twice. So the interval is read off what is
   *ringing* at that step in each voice, held notes included.

   It is written where the pair actually changes — on a step where at least
   one of the two voices strikes — and not on every step of a long ringing
   pair, which would be the same name repeated down the page for something
   that happened once. A page with nothing held is untouched by any of this:
   there, every sounding step is a struck step. */
function rollIntervals(hi, span){
  var lead = vsteps(0), bass = vsteps(1), i, k, ma, mz, el, top, d;
  var sl = sounding(doc, 0), sz = sounding(doc, 1), hl, hz, w = 100 / winRoll;
  for (k = 0; k < MAX_STEPS; k++){
    i = rollStep(k);
    el = ivls[k];
    hl = (k < winRoll) ? sl[i] : -1; hz = (k < winRoll) ? sz[i] : -1;
    ma = (hl >= 0) ? midiOf(lead[hl]) : null;
    mz = (hz >= 0) ? midiOf(bass[hz]) : null;
    /* only where both voices sound, and only where one of them moved */
    if (ma === null || mz === null || (hl !== i && hz !== i)){
      el.classList.remove("on"); continue;
    }
    el.firstChild.textContent = intervalName(ma - mz);
    el.classList.add("on");
    el.style.left = (k * w) + "%";
    el.style.width = w + "%";
    /* a bar's centre is half a semitone below its top edge */
    top = (ma > mz) ? ma : mz;
    d = Math.abs(ma - mz);
    el.style.top = ((hi - top + 0.5) / span * 100) + "%";
    el.style.height = (d / span * 100) + "%";
    /* the two voices on one pitch have no distance to tie across */
    ivlTies[k].style.display = d ? "block" : "none";
    el.classList.toggle("outside", i >= doc.loop);
  }
}
/* ---- the pitch in hand, shown while it is in hand ----
   Placing a note, or moving one, draws a line across the roll at that
   note's pitch — the home rules' own line, borrowed for a moment and
   named in the same margin — and then lets go of it: it holds for a beat
   or so and fades out over a second. It is drawn from the same numbers the
   bars are, so a relayout carries it along rather than stranding it. */
var rollHi = 71, rollSpan = 24;
var guideMidi = null, guideTimer = null;
var GUIDE_HOLD = 1300;
function placeGuide(){
  if (guideMidi === null) return;
  rollGuide.style.top = ((rollHi - guideMidi + 0.5) / rollSpan * 100) + "%";
}
function showGuide(m){
  if (m === null || m === undefined) return;
  guideMidi = m;
  guideName.textContent = pitchName(nameOfMidi(m));
  placeGuide();
  rollGuide.classList.add("on");
  if (guideTimer) clearTimeout(guideTimer);
  guideTimer = setTimeout(function(){
    guideTimer = null;
    rollGuide.classList.remove("on");     /* the long fade takes it from here */
  }, GUIDE_HOLD);
}
function rollCursor(){
  var c = rollSlot(cursor), w = 100 / winRoll;
  rollCur.style.left = ((c < 0 ? 0 : c) * w) + "%";
  rollCur.style.width = w + "%";
  rollCur.style.display = (c < 0) ? "none" : "block";
  for (var k = 0; k < winRoll; k++){
    var i = rollStep(k), on = (k === c);
    /* the ring marks the step under the cursor in the voice in hand only */
    bars[k].classList.toggle("cur", on && voice === 0);
    bars2[k].classList.toggle("cur", on && voice === 1);
    chordBars[k].classList.toggle("cur", on && voice === CHORD_LANE);
    baseCells[k].classList.toggle("cur", on);
    /* the base strip counts in the page's own numbers, so where in the page
       the window is sitting is legible off the drawing itself */
    baseCells[k].textContent = on ? "‸" : (i % 4 === 0 ? String(i + 1) : "");
  }
}
function rollLoop(){
  for (var k = 0; k < winRoll; k++){
    var out = rollStep(k) >= doc.loop;
    bars[k].classList.toggle("outside", out);
    bars2[k].classList.toggle("outside", out);
    chordBars[k].classList.toggle("outside", out);
    ivls[k].classList.toggle("outside", out);
  }
}

/* the quest log is a page: while it is open, both views of the pattern
   stand down. The settings crossbar is not one of them: it is raised *over*
   the page rather than in place of it, so the folio, the voice strip and
   everything else stay exactly where they were while the thumb turns a
   setting. */
function applyViz(){
  var page = questsEl.classList.contains("on");
  column.style.display = (!page && viz === "column") ? "flex" : "none";
  roll.classList.toggle("on", !page && viz === "roll");
  voicesEl.classList.toggle("off", page);   /* the strip belongs to the page */
  /* the sheet is as wide as what is on it: the drawing may want more than
     the page's own measure, and nothing else ever does */
  applyWidth();
}

/* ---- the names, put away and brought back ----
   They are on by default: the drawing was mute about pitch and that was the
   one thing it could not say. K is beside L by position, and takes them all
   away at once — the home rules' names, the guide's, and the intervals
   between the voices — for when the shape alone is what is wanted, which is
   most of the time. A preference, like the view and
   the entry method; it is not part of any document and nothing is written
   into the page by any of this. */
var showNames = true;
var NAMES_KEY = "folio.names";

function applyNames(){ roll.classList.toggle("nonames", !showNames); }
function setNames(on){
  showNames = !!on;
  try { localStorage.setItem(NAMES_KEY, showNames ? "on" : "off"); } catch (e){}
  applyNames();
  say(showNames ? "the names · the home rules, and the interval where both voices sound"
                : "the names, off · the shape alone");
}
function toggleNames(){ setNames(!showNames); }

function toggleViz(){
  viz = (viz === "column") ? "roll" : "column";
  try { localStorage.setItem(VIZ_KEY, viz); } catch (e){}
  applyViz();
  /* the two views hold different amounts of the page, so the one line that
     says which part is on screen belongs to whichever is up: turning the
     page over is one of the things that can put that label away, or raise
     it */
  renderMeta();
  say(viz === "roll" ? "the roll · height is pitch, colour is the note" : "the column");
}

var shownPlayhead = -1, shownRow = -1;

function renderNotes(){
  for (var v = 0; v < VOICES; v++){
    var s = vsteps(v), back = (v === voice) ? "" : " dim";
    /* which note is ringing where, so that a step covered by a hold is
       neither a note (it was not struck) nor a rest (it is sounding) */
    var snd = sounding(doc, v), ends = ringEnds(doc, v);
    for (var k = 0; k < winCol; k++){
      var i = colStep(k), n = s[i], el = rows[k].notes[v], tx = rows[k].texts[v];
      /* ---- what the page says about a bound step ----
         Music inside a mirrored cell is written a shade lighter than music
         written by hand, in both views, so the page shows what is bound
         without saying which of the sites came first — none of them did.
         It is on the writing and on the stroke, and not on the rests: an
         empty step is faint already and a fainter one would say nothing. */
      var bound = mirrored(doc, v, i) ? " mirror" : "";
      /* and what the last judgement said about it, where there was one: the
         mark is on the answer's own notes and on nothing else, so it can
         never draw the call for anybody */
      var rang = echoMark(v, i);
      if (rang) bound += " " + rang;
      if (n){ tx.nodeValue = display(n); el.className = "note" + back + bound; }
      else if (snd[i] >= 0){
        /* the tail of a held note: no writing at all, only the stroke,
           with its foot on the last step the note is still sounding */
        tx.nodeValue = "";
        el.className = "note hold" + (ends[i] ? " last" : "") + back + bound;
      }
      else  { tx.nodeValue = "·";          el.className = "note empty" + back; }
      /* the seal rides the step the note is struck on, never its tail */
      setSeal(rows[k].seals[v], sealOf(doc, v, i));
    }
  }
  /* ---- the chord lane's own column ----
     One cell, one mark: the shape's glyph and the pitch its root sits on,
     which is the same thing the drawing's home rules are named with. A held
     chord is the same single stroke a held note is — the cell is joined to
     where it stops and nothing is repeated down the page — and there is no
     seal here, because nothing seals a chord. */
  var cs = vsteps(CHORD_LANE), csnd = sounding(doc, CHORD_LANE);
  var cends = ringEnds(doc, CHORD_LANE), cback = (voice === CHORD_LANE) ? "" : " dim";
  for (var kc = 0; kc < winCol; kc++){
    var ic = colStep(kc), cc = cs[ic];
    var cel = rows[kc].notes[2], ctx2 = rows[kc].texts[2];
    if (cc){
      ctx2.nodeValue = chordGlyph(cc) + " " + pitchName(nameOfMidi(chordRootMidi(cc)));
      cel.className = "note chord" + cback;
    } else if (csnd[ic] >= 0){
      ctx2.nodeValue = "";
      cel.className = "note chord hold" + (cends[ic] ? " last" : "") + cback;
    } else {
      ctx2.nodeValue = "·";
      cel.className = "note chord empty" + cback;
    }
  }
  /* the column counts in the page's own numbers: on a long page the numbers
     down the margin are 17 … 32, which is the plainest thing on the screen
     saying where in the piece you are — and the heavier rule falls on the
     page's beats, not on the window's, so a window that opened mid-bar is
     still ruled where the music is */
  for (var k2 = 0; k2 < winCol; k2++){
    rows[k2].num.textContent = String(colStep(k2) + 1);
    rows[k2].el.classList.toggle("beat", colStep(k2) % 4 === 0);
  }
  rollLayout();
  renderVoices();
}
/* the strip above the page: which line is in hand, and what each is doing */
function renderVoices(){
  for (var v = 0; v < LANES; v++){
    vnames[v].classList.toggle("on", v === voice);
    var st = voiceState(v);
    /* the third state is a voice that is not muted but is not being heard
       either, because the other one is soloed: it says so in a word rather
       than in a dash, which said nothing to anybody */
    vmarks[v].textContent = st === "solo" ? "solo"
                          : st === "muted" ? "muted"
                          : st ? "silent" : "";
    vmarks[v].className = "vmark" + (st === "solo" ? " solo" : "");
  }
  voicesEl.classList.toggle("off", questsEl.classList.contains("on"));
}
function renderCursor(){
  /* the windows follow the cursor, and if either moved the page under it is
     a different stretch of the piece: the notes, the numbers and the loop's
     shading all have to be said again, and the header has to say where this
     is */
  if (syncWindow()){ renderNotes(); renderMeta(); renderLoop(); }
  var c = colSlot(cursor);
  for (var k = 0; k < winCol; k++){
    var on = (k === c);
    rows[k].el.classList.toggle("cursor", on);
    rows[k].caret.textContent = on ? "‸" : "";
  }
  rollCursor();
}
/* the playhead is a step of the piece; the row it lights is a slot of the
   window, and on a long page the playhead spends most of its turn off
   screen — the transport runs the whole loop whatever is being read */
function renderPlayhead(step){
  /* the two views hold different stretches of the page, so the playhead may
     well be on screen in one of them and not in the other: each is asked
     for its own slot */
  var row = (step >= 0) ? colSlot(step) : -1;
  var k = (step >= 0) ? rollSlot(step) : -1, w = 100 / winRoll;
  if (step === shownPlayhead && row === shownRow) return;
  if (shownRow >= 0){
    rows[shownRow].el.classList.remove("play");
    rows[shownRow].fleuron.textContent = "";
  }
  if (row >= 0){
    rows[row].el.classList.add("play");
    rows[row].fleuron.textContent = "❧";
  }
  if (k >= 0){
    rollWash.style.left = (k * w) + "%";
    rollWash.style.width = w + "%";
    rollWash.style.display = "block";
  } else {
    rollWash.style.display = "none";
  }
  shownPlayhead = step; shownRow = row;
}
/* ---- the meta line, pared back to what only it says ----
   It used to carry the title, the tempo, the octave, the key, the loop, the
   voice in hand and the quest — seven things, of which four were already on
   the screen somewhere better. The title was "untitled folio" and meant
   nothing. The quest is named twice over in the right margin and marked in
   the left. The voice in hand is the whole point of the strip directly
   below, and what it is doing is marked there too. The loop is drawn on the
   page itself, in the steps that fall outside it. The base octave went too
   (2026-08-01): entry is relative and the roll shows where you are, so the
   number informed nothing. What is left is the two settings of the piece
   that have no other home: how fast, and in what. That is what the line is
   for.

   A page the view in hand cannot hold all of earns the line's one addition:
   which part of it is on screen. It is the same kind of fact as the other
   two — a setting of the reading rather than a control — and it is there
   only while something is actually out of view, which depends on the view:
   a wide screen showing the whole of a thirty-two-step page in the drawing
   says tempo and key and nothing else, and turning to the column, which
   holds twenty of it, is what puts the label up. */
function renderMeta(){
  meta.textContent = doc.tempo + " · " + doc.key +
    (windowed() ? " · " + windowLabel() : "");
}
function renderLoop(){
  for (var k = 0; k < winCol; k++){
    rows[k].el.classList.toggle("outside", colStep(k) >= doc.loop);
  }
  rollLoop();
}
/* ================= the key overlay =================
   There was a page of the key once, two columns of prose about every binding
   there is, and it went stale faster than the bindings did; then a strip of
   it under the footer, which could only ever be a run-on line. This is
   neither. It is the settings crossbar's own drawing, borrowed: the controls
   where the hands actually find them — the d-pad a compass, the face buttons
   a cluster, the shoulders drawn where the fingers sit — each named with
   what it does beneath it, and the board's own keys in a group of their own.

   F1 raises it and F1 puts it down; so does escape, and so does the quiet
   mark in the top-right corner for a hand on a mouse. It is laid *over* the
   folio, exactly as the crossbar is, so the page it is describing stays in
   view; and while it is up nothing reaches the pattern, which is the
   discipline the crossbar and the quest log already keep.

   It says what the mode you are in can do and nothing else, so it cannot
   grow into the page of prose it replaced. Everything in it is named by
   position, as everything in this app is: the letters are places on the
   board, not what a keyboard prints. */
/* where the four shoulders sit: the bumpers above, the triggers below, the
   left hand's pair on the left and the right hand's on the right */
var KSHOULDER = [["23%","24%"],["23%","78%"],["77%","24%"],["77%","78%"]];

function keysNow(){
  /* in an echo workspace two seats are lent — □ and △ on the crossbar, O and
     P on the board — and the overlay is the living key help: it says what
     they mean here rather than what they mean everywhere else */
  var ech = echoNow();
  /* the crossbar has more than one drawing on it now, and the overlay is the
     crossbar's drawing borrowed — so it says whichever one is up, and the
     bumpers that turn from one to the other are named in both */
  if (settingsEl.classList.contains("on")){
    if (XBAR_MODES[xbarMode].name === "scriptorium") return {
      where:"the settings · the scriptorium", clusters:[
      { kind:"pad", name:"the d-pad", pos:XPOS, items:[
        ["←","the bass's tone before"],["↑","the lead's tone before"],
        ["→","the bass's tone after"],["↓","the lead's tone after"]],
        note:"stepping onto a tone is wearing it · the page keeps its own, and so does every workspace" },
      { kind:"pad", name:"the face buttons", pos:XPOS, items:[
        ["□","—"],["△","—"],["○","put it down"],["✕","—"]] },
      { kind:"list", name:"and otherwise", items:[
        ["L1 · R1","the other drawing of the crossbar"],
        ["start","put it down"],["escape","put it down"],["select","play, stop"]] }
    ]};
    return { where:"the settings" + (ech ? " · the echo" : ""), clusters:[
      { kind:"pad", name:"the d-pad", pos:XPOS, items:[
        ["←","the lesson before"],["↑","the workspace before"],
        ["→","the lesson after"],["↓","the workspace after"]] },
      { kind:"pad", name:"the face buttons", pos:XPOS, items: ech
        ? [["□","play the call"],["△","judge the answer"],
           ["○","put it down"],["✕","the background"]]
        : [["□","solo"],["△","mute"],["○","put it down"],["✕","the background"]],
        note: ech ? "the call is never drawn — it is only ever heard" : "" },
      { kind:"list", name:"and otherwise", items:[
        ["L1 · R1","the other drawing of the crossbar"],
        ["start","put it down"],["escape","put it down"],["select","play, stop"]] }
    ]};
  }
  if (questsEl.classList.contains("on")) return { where:"the quest log", clusters:[
    { kind:"pad", name:"the d-pad · the arrows", pos:XPOS, items:[
      ["←","the lesson before"],["↑","up the list"],
      ["→","the lesson after"],["↓","down the list"]],
      note:"← and → are the board's own; the pad walks the list" },
    { kind:"pad", name:"the face buttons", pos:XPOS, items:[
      ["□","keep it to hand"],["△","—"],["○","complete"],["✕","work here"]],
      note:"R3 closes the log" },
    { kind:"list", name:"the board", items:[
      ["enter","work here, or back to free play"],
      ["C","complete"],
      ["F","keep it to hand"],
      ["shift ↑ ↓","move it up the list, or down"],
      ["F3 · escape","close the log"],
      ["ctrl+S","the log, out to a file"],
      ["space","play, stop"],
      ["F1","these keys, away"]] }
  ]};
  /* a run of up or down: the sheet is empty and the folio is asking, so the
     overlay says the four seats that mean anything and nothing else. It never
     says which way the question actually went — the overlay is help, not a
     hint. */
  if (typeof quizOn === "function" && quizOn()) return {
    where:"the folio · up or down", clusters:[
    { kind:"pad", name:"the face buttons", pos:XPOS, items:[
      ["□","play it again"],["△","it went up"],
      ["○","the same note again"],["✕","it went down"]],
      note:"answer while it is still sounding if you already know · playing it again costs nothing" },
    { kind:"list", name:"the board", items:[
      ["↑","it went up"],
      ["↓","it went down"],
      ["→","the same note again"],
      ["O","play it again"],
      ["start","the margin · leave the workspace and the run is over"],
      ["F3","the quest log"],
      ["F1 · escape","these keys, away"]] }
  ]};
  var rollv = (viz === "roll");
  /* ---- the page, with the chord lane in hand ----
     The same four face buttons and the same d-pad, saying what they say
     here. The pitch pair carries the three rungs the lane is edited by, and
     the pair that is "pitch" trades with the view exactly as it does for a
     note, so the overlay says whichever one is under the thumb now. Not a
     chord is named anywhere in it: every line is how this one sits against
     the one before it. */
  if (onChords()) return {
    where: (rollv ? "the folio · the roll" : "the folio · the column") + " · the chords",
    clusters:[
    { kind:"pad", name:"the d-pad", pos:XPOS, items: rollv
      ? [["←","a step back"],["↑","its root up a step"],
         ["→","a step on"],["↓","its root down a step"]]
      : [["←","its root down a step"],["↑","a step back"],
         ["→","its root up a step"],["↓","a step on"]],
      /* the two pairs trade with the view, and so does what the triggers
         make of them: in the drawing the pitch pair is ↑ ↓ and the whole
         ladder is under the thumb, and in the column ← → is the pitch pair
         but one trigger there is already the note's two edges — as it is on
         a voice — so the middle rung is reached in the drawing, or on the
         board. Said here rather than tidied away, because this is the page
         that has to be true. */
      note: rollv
        ? "↑ ↓ with one trigger · thicker, thinner — two voices, three, four · " +
          "with both · nearest, or plainly rooted"
        : "← → with both · nearest, or plainly rooted · with one trigger · " +
          "the chord's start, or its end · thicker and thinner are ↑ ↓ in the " +
          "drawing, and A on the board" },
    { kind:"pad", name:"the face buttons", pos:XPOS, items:[
      ["□","a rest"],["△","the root up a step"],
      ["○","the same chord again"],["✕","the root down a step"]],
      note:"held, the chord goes on ringing" },
    { kind:"pad", name:"the shoulders", pos:KSHOULDER, items:[
      ["L1","the voice before"],["L2","and a seventh"],
      ["R1","the voice after"],["R2","no third"]],
      note:"both triggers, writing · borrowed, out of the key · " +
           (rollv ? "← →" : "↑ ↓") + " with both · carry the chord, its length with it" +
           (rollv ? " · either trigger alone under ← → moves its start, or its end" : "") },
    { kind:"list", name:"the board", items:[
      ["z … ,  ·  q … i","home, and the degrees above it — two rows, an octave each"],
      ["A","its shape, round the ring · shift, nearest or rooted"],
      ["← ↑","a step back"],
      ["→ ↓","a step on"],
      ["− +","shorter, longer · shift, all the way"],
      ["period","clear the step"],
      ["space","play, stop"],
      ["tab","the next lane · shift, the one before"],
      ["L","the loop"],
      ["K","the names, away and back"],
      ["O · P","solo, mute"],
      ["F2", rollv ? "the column instead" : "the roll instead"],
      ["F3","the quest log"],
      ["F1 · escape","these keys, away"]],
      note:"what a chord sounds is worked out from the one before it — nothing here spells one out" },
    { kind:"list", name:"and on the pad", items:[
      ["select","play, stop"],["start","the settings"],
      ["L3","the loop"],["R3","the roll or the column"]] }
  ]};
  /* the page itself. The d-pad's two pairs trade places between the two
     views — the column reads down, the drawing reads right — and this is
     the one place that difference has ever been written down. The board's
     arrows do not trade: they are the cursor either way. */
  return { where: (rollv ? "the folio · the roll" : "the folio · the column") +
                  (ech ? " · the echo" : ""), clusters:[
    { kind:"pad", name:"the d-pad", pos:XPOS, items: rollv
      ? [["←","a step back"],["↑","nudge it up"],["→","a step on"],["↓","nudge it down"]]
      : [["←","nudge it down"],["↑","a step back"],["→","nudge it up"],["↓","a step on"]],
      note:"nudge · the note under the cursor, a scale step, staying where it is" },
    { kind:"pad", name:"the face buttons", pos:XPOS, items:[
      ["□","a rest"],["△","up a step"],["○","the same note again"],["✕","down a step"]],
      note:"held, the note goes on ringing" },
    { kind:"pad", name:"the shoulders", pos:KSHOULDER, items:[
      ["L1","the voice before"],["L2","widen it to a third"],
      ["R1","the voice after"],["R2","widen it to a fifth"]],
      note: rollv
        ? "both triggers · ↑ ↓ out of the key, a semitone · ← → carry the note, its length with it · either trigger alone under ← → moves the note's start, or its end"
        : "both triggers · ← → out of the key, a semitone · ↑ ↓ carry the note, its length with it · either trigger alone under ← → moves the note's start, or its end" },
    { kind:"list", name:"the board", items:[
      ["z … ,  ·  q … i","the notes, two rows, an octave each"],
      ["s d g h j  ·  2 3 5 6 7","the notes between"],
      ["← ↑","a step back"],
      ["→ ↓","a step on"],
      ["home · end","the first step of the page, the last"],
      ["shift ← ↑","a window back"],
      ["shift → ↓","a window on"],
      ["− +","shorter, longer · shift, all the way"],
      ["period","clear the step"],
      ["space","play, stop"],
      ["tab","the next voice · shift, the one before"],
      ["page ↑ ↓","which octave the note keys are"],
      ["L","the loop"],
      ["K","the names, away and back"],
      ["O · P", ech ? "play the call, judge the answer" : "solo, mute"],
      ["F2", rollv ? "the column instead" : "the roll instead"],
      ["F3","the quest log"],
      ["shift+B","the background"],
      ["ctrl+S · ctrl+O","out to a file, in from one"],
      ["F1 · escape","these keys, away"]] },
    { kind:"list", name:"and on the pad", items: ech
      ? [["select","play, stop"],["start","the settings"],
         ["start then □","play the call"],["start then △","judge the answer"],
         ["L3","the loop"],["R3","the roll or the column"]]
      : [["select","play, stop"],["start","the settings"],
         ["L3","the loop"],["R3","the roll or the column"]],
      note: ech ? "the call is hidden: it is heard, never drawn" : "" }
  ]};
}
/* one control, drawn as the crossbar draws its slots: the glyph, and under
   it what it does. Where the cluster is a shape, it is placed in it. */
function keySlot(item, p){
  var el = document.createElement("div"), g, v;
  el.className = "xslot";
  if (p){
    el.style.left = p[0]; el.style.top = p[1];
    el.style.transform = "translateY(-50%)";
  }
  g = document.createElement("span"); g.className = "xg"; g.textContent = item[0];
  v = document.createElement("span"); v.className = "xv"; v.textContent = item[1];
  el.appendChild(g); el.appendChild(v);
  return el;
}
function renderKeys(){
  if (!keyhelpEl) return;
  while (keyhelpEl.firstChild) keyhelpEl.removeChild(keyhelpEl.firstChild);
  var k = keysNow(), i, j, c, box, bars, bar, hub, list, line, b, s, el;
  el = document.createElement("h2");
  el.textContent = "the keys · " + k.where;
  keyhelpEl.appendChild(el);
  bars = document.createElement("div");
  bars.className = "kbars";
  keyhelpEl.appendChild(bars);
  for (i = 0; i < k.clusters.length; i++){
    c = k.clusters[i];
    box = document.createElement("div");
    box.className = "kgroup " + c.kind;
    el = document.createElement("h3"); el.textContent = c.name;
    box.appendChild(el);
    if (c.kind === "list"){
      list = document.createElement("div"); list.className = "klist";
      for (j = 0; j < c.items.length; j++){
        line = document.createElement("div"); line.className = "kline";
        b = document.createElement("b"); b.textContent = c.items[j][0];
        s = document.createElement("span"); s.textContent = c.items[j][1];
        line.appendChild(b); line.appendChild(s);
        list.appendChild(line);
      }
      box.appendChild(list);
    } else {
      bar = document.createElement("div"); bar.className = "xbar";
      hub = document.createElement("div"); hub.className = "xhub";
      bar.appendChild(hub);
      for (j = 0; j < c.items.length; j++)
        bar.appendChild(keySlot(c.items[j], c.pos[j]));
      box.appendChild(bar);
    }
    if (c.note){
      el = document.createElement("p"); el.className = "knote";
      el.textContent = c.note;
      box.appendChild(el);
    }
    bars.appendChild(box);
  }
}
function keysOpen(){ return !!keyhelpEl && keyhelpEl.classList.contains("on"); }
function setKeys(on){
  if (!keyhelpEl) return;
  keyhelpEl.classList.toggle("on", on);
  keyhelpEl.setAttribute("aria-hidden", on ? "false" : "true");
  if (keymarkEl) keymarkEl.setAttribute("aria-expanded", on ? "true" : "false");
  if (on) renderKeys();
  else while (keyhelpEl.firstChild) keyhelpEl.removeChild(keyhelpEl.firstChild);
}
function toggleKeys(){ setKeys(!keysOpen()); }
function closeKeys(){ if (keysOpen()) setKeys(false); }
if (keymarkEl && keymarkEl.addEventListener)
  keymarkEl.addEventListener("click", function(){
    toggleKeys();
    /* the mark keeps no focus: with it, space and enter would be the button's
       before they were the transport's */
    if (keymarkEl.blur) keymarkEl.blur();
  });

var lastSaid = "‸ cursor row";
function say(msg){
  lastSaid = msg;
  /* the overlay describes the mode, and the mode can change under it */
  if (keysOpen()) renderKeys();
  footer.textContent = msg + (
    questsEl.classList.contains("on")   ? " · F3 to close" + syncNote() :
    settingsEl.classList.contains("on") ? " · start, or ○, to close" : "");
}
function renderAll(){
  /* a page of a different length has a different amount of itself in view —
     a thirty-two-step page may be whole in the drawing where a sixty-four
     is not. Nothing else here needs measuring, and fitViews does none when
     nothing has changed. */
  fitViews();
  syncWindow();
  renderNotes(); renderCursor(); renderMeta(); renderLoop();
}
