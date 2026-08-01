/* Folio — js/views.js : the page, drawn.

   Every element the app holds by id; the scenery behind the sheet and the
   dissolve from one scene to the next; the written column; the roll and
   everything laid on it — the home rules, the bars, the intervals, the guide;
   the renderers; the standing hint under the footer; and say(), which is the
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
var vnames = [document.getElementById("vname0"), document.getElementById("vname1")];
var vmarks = [document.getElementById("vmark0"), document.getElementById("vmark1")];
var qlist  = document.getElementById("qlist");
var qtabs  = document.getElementById("qtabs");
var hintsEl = document.getElementById("hints");
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

var rows = [];
for (var i = 0; i < STEPS; i++){
  var row = document.createElement("div");
  row.className = "row" + (i % 4 === 0 ? " beat" : "");
  var fl = document.createElement("span"); fl.className = "fleuron";
  var ca = document.createElement("span"); ca.className = "caret";
  var nu = document.createElement("span"); nu.className = "num"; nu.textContent = String(i + 1);
  /* one column per voice, side by side, in the order they are named above */
  var no = document.createElement("span"); no.className = "note empty"; no.textContent = "·";
  var no2 = document.createElement("span"); no2.className = "note empty dim"; no2.textContent = "·";
  row.appendChild(fl); row.appendChild(ca); row.appendChild(nu);
  row.appendChild(no); row.appendChild(no2);
  column.appendChild(row);
  rows.push({ el: row, fleuron: fl, caret: ca, note: no, note2: no2, notes: [no, no2] });
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

for (i = 0; i < STEPS; i += 4){
  var bl = document.createElement("div");
  bl.className = "beatline";
  bl.style.left = (i * 6.25) + "%";
  rollfield.appendChild(bl);
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
/* one per step: the interval between the voices, written where both sound —
   the label itself, and the tie that hangs it between the two bars */
var ivls = [], ivlTies = [];
function mkBar(store){
  var b = document.createElement("div");
  b.className = "bar";
  b.style.display = "none";
  rollfield.appendChild(b);
  store.push(b);
}
for (i = 0; i < STEPS; i++){
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

function midiOf(s){ var p = parseNote(s); return p ? (p.oct + 1) * 12 + p.pc : null; }

function rollLayout(){
  /* fit the pitch window to the notes on the page, never tighter than two
     octaves, recomputed only on edits — user-initiated, never while idle.
     Both voices are inside the window: a bass that fell off the bottom of
     the drawing would be a bass you could not see. */
  var lo = Infinity, hi = -Infinity, i, m, v, s;
  for (v = 0; v < VOICES; v++){
    s = vsteps(v);
    for (i = 0; i < STEPS; i++){
      m = s[i] ? midiOf(s[i]) : null;
      if (m !== null){ if (m < lo) lo = m; if (m > hi) hi = m; }
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

  for (v = 0; v < VOICES; v++){
    s = vsteps(v);
    seamBars[v].style.display = "none";
    for (i = 0; i < STEPS; i++){
      var n = s[i], b = vbars[v][i];
      if (!n){ b.style.display = "none"; continue; }
      m = midiOf(n);
      /* one bar per note, as wide as the note is long: a held note is one
         long stadium of colour, never a row of repeated dabs. The gap
         between neighbours is the gap it always was, so a run of plain
         sixteenths is drawn exactly as it was drawn before. */
      var len = spanOf(doc, v, i), loop = doc.loop;
      var head = (i < loop) ? Math.min(len, loop - i) : len;
      b.style.display = "block";
      b.style.left = (i * 6.25 + 0.7) + "%";
      b.style.width = (head * 6.25 - 1.4) + "%";
      b.style.top = ((hi - m) / span * 100) + "%";
      b.style.height = (100 / span) + "%";
      b.style.backgroundColor = PC_COLOR[parseNote(n).pc];
      b.classList.toggle("back", v !== voice);
      /* and the rest of it, come round again at the head of the page */
      if (len > head){
        var sb = seamBars[v];
        sb.style.display = "block";
        sb.style.left = "0.7%";
        sb.style.width = ((len - head) * 6.25 - 1.4) + "%";
        sb.style.top = b.style.top;
        sb.style.height = b.style.height;
        sb.style.backgroundColor = b.style.backgroundColor;
        sb.classList.toggle("back", v !== voice);
        sb.classList.remove("outside");
      }
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
  var lead = vsteps(0), bass = vsteps(1), i, ma, mz, el, top, d;
  var sl = sounding(doc, 0), sz = sounding(doc, 1), hl, hz;
  for (i = 0; i < STEPS; i++){
    el = ivls[i];
    hl = sl[i]; hz = sz[i];
    ma = (hl >= 0) ? midiOf(lead[hl]) : null;
    mz = (hz >= 0) ? midiOf(bass[hz]) : null;
    /* only where both voices sound, and only where one of them moved */
    if (ma === null || mz === null || (hl !== i && hz !== i)){
      el.classList.remove("on"); continue;
    }
    el.firstChild.textContent = intervalName(ma - mz);
    el.classList.add("on");
    el.style.left = (i * 6.25) + "%";
    el.style.width = "6.25%";
    /* a bar's centre is half a semitone below its top edge */
    top = (ma > mz) ? ma : mz;
    d = Math.abs(ma - mz);
    el.style.top = ((hi - top + 0.5) / span * 100) + "%";
    el.style.height = (d / span * 100) + "%";
    /* the two voices on one pitch have no distance to tie across */
    ivlTies[i].style.display = d ? "block" : "none";
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
  rollCur.style.left = (cursor * 6.25) + "%";
  rollCur.style.width = "6.25%";
  for (var i = 0; i < STEPS; i++){
    var on = (i === cursor);
    /* the ring marks the step under the cursor in the voice in hand only */
    bars[i].classList.toggle("cur", on && voice === 0);
    bars2[i].classList.toggle("cur", on && voice === 1);
    baseCells[i].classList.toggle("cur", on);
    baseCells[i].textContent = on ? "‸" : (i % 4 === 0 ? String(i + 1) : "");
  }
}
function rollLoop(){
  for (var i = 0; i < STEPS; i++){
    bars[i].classList.toggle("outside", i >= doc.loop);
    bars2[i].classList.toggle("outside", i >= doc.loop);
    ivls[i].classList.toggle("outside", i >= doc.loop);
  }
}

/* the quest log is a page: while it is open, both views of the pattern
   stand down. The settings crossbar is not one of them: it is raised *over*
   the page rather than in place of it, so the folio, the voice strip and
   everything else stay exactly where they were while the thumb turns a
   setting. */
function applyViz(){
  var page = questsEl.classList.contains("on") ||
             (typeof scriptOn === "function" && scriptOn());
  column.style.display = (!page && viz === "column") ? "flex" : "none";
  roll.classList.toggle("on", !page && viz === "roll");
  voicesEl.classList.toggle("off", page);   /* the strip belongs to the page */
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
  say(viz === "roll" ? "the roll · height is pitch, colour is the note" : "the column");
}

var shownPlayhead = -1;

function renderNotes(){
  for (var v = 0; v < VOICES; v++){
    var s = vsteps(v), back = (v === voice) ? "" : " dim";
    /* which note is ringing where, so that a step covered by a hold is
       neither a note (it was not struck) nor a rest (it is sounding) */
    var snd = sounding(doc, v), ends = ringEnds(doc, v);
    for (var i = 0; i < STEPS; i++){
      var n = s[i], el = rows[i].notes[v];
      if (n){ el.textContent = display(n); el.className = "note" + back; }
      else if (snd[i] >= 0){
        /* the tail of a held note: no writing at all, only the stroke,
           with its foot on the last step the note is still sounding */
        el.textContent = "";
        el.className = "note hold" + (ends[i] ? " last" : "") + back;
      }
      else  { el.textContent = "·";        el.className = "note empty" + back; }
    }
  }
  rollLayout();
  renderVoices();
}
/* the strip above the page: which line is in hand, and what each is doing */
function renderVoices(){
  for (var v = 0; v < VOICES; v++){
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
  for (var i = 0; i < STEPS; i++){
    var on = (i === cursor);
    rows[i].el.classList.toggle("cursor", on);
    rows[i].caret.textContent = on ? "‸" : "";
  }
  rollCursor();
}
function renderPlayhead(step){
  if (step === shownPlayhead) return;
  if (shownPlayhead >= 0){
    rows[shownPlayhead].el.classList.remove("play");
    rows[shownPlayhead].fleuron.textContent = "";
  }
  if (step >= 0){
    rows[step].el.classList.add("play");
    rows[step].fleuron.textContent = "❧";
    rollWash.style.left = (step * 6.25) + "%";
    rollWash.style.width = "6.25%";
    rollWash.style.display = "block";
  } else {
    rollWash.style.display = "none";
  }
  shownPlayhead = step;
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
   for. */
function renderMeta(){
  meta.textContent = doc.tempo + " · " + doc.key;
}
function renderLoop(){
  for (var i = 0; i < STEPS; i++){
    rows[i].el.classList.toggle("outside", i >= doc.loop);
  }
  rollLoop();
}
/* ================= the standing hint =================
   There was a page of the key once, a destination, and nobody walks to a
   destination to remember which key steps back a sixteenth; it went stale
   faster than the bindings it described, and it is gone. This strip is the
   key help now: the keys that matter where the hands actually are, under
   the footer, always — a handful at most,
   the same handful for the same situation, changing only when the situation
   does. It holds its height whatever it says, so the page never moves
   because of it; it is quieter than the footer above it; and it announces
   nothing. Everything in it is named by position, as everything in this app
   is: the letters are places on the board, not what a keyboard prints. */
function hintsNow(){
  if (settingsEl.classList.contains("on"))
    return [["↑ ↓","workspace"],["← →","lesson"],["□","solo"],["△","mute"],
            ["✕","the background"],["start","close"]];
  if (questsEl.classList.contains("on"))
    return [["↑ ↓","quest"],["← →","lesson"],["enter","work here"],
            ["F","keep to hand"],["shift + ↑ ↓","move it"],["C","complete"],["F3","close"]];
  /* both hands are named, because there is only one story to tell now: the
     keyboard names pitches by position, the pad names moves. The shoulders
     are named too — the four buttons nothing on the page ever said out
     loud, which is exactly how they came to be a puzzle rather than a
     control: the bumpers change hands, the triggers widen a move. And the
     length is named, because Lesson 3 is the whole reason a note is not
     always a sixteenth any more; the rest of the strip stays on its diet. */
  return [["z…m q…i","notes"],["△ ✕ ○ □","the shape"],
          ["L2 R2","third, fifth"],
          ["← →","step"],["− +","shorter, longer"],
          ["period","clear"],["space","play"],
          ["tab · L1 R1","voice"],["L","loop"],
          ["F2", viz === "roll" ? "the column" : "the roll"],
          ["F3","quests"]];
}
function renderHints(){
  if (!hintsEl) return;
  var h = hintsNow(), i, k, v, s;
  while (hintsEl.firstChild) hintsEl.removeChild(hintsEl.firstChild);
  for (i = 0; i < h.length; i++){
    if (i){
      s = document.createElement("span");
      s.textContent = " · ";
      hintsEl.appendChild(s);
    }
    /* a key and what it does are one thing and wrap as one: the strip runs
       to a second line now, and "F2" ending a line with "the column"
       beginning the next is two hints where there is one */
    s = document.createElement("span");
    s.className = "hint";
    k = document.createElement("b"); k.textContent = h[i][0];
    v = document.createElement("span"); v.textContent = " " + h[i][1];
    s.appendChild(k); s.appendChild(v);
    hintsEl.appendChild(s);
  }
}

var lastSaid = "‸ cursor row";
function say(msg){
  lastSaid = msg;
  renderHints();
  footer.textContent = msg + (
    questsEl.classList.contains("on")   ? " · F3 to close" + syncNote() :
    settingsEl.classList.contains("on") ? " · start, or ○, to close" : "");
}
function renderAll(){ renderNotes(); renderCursor(); renderMeta(); renderLoop(); }
