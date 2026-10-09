/* Folio — js/screens.js : what start opens.

   Start used to raise a crossbar: eight slots under the thumb, an action bar
   in the FFXIV idiom. That idiom belongs on the *page*, where the triggers,
   the bumpers and the face buttons write notes every few seconds — and an
   action bar away from the page turned out to be a shape with eight holes in
   it, which is how the folio grew a second hidden drawing, a slot that
   answered "nothing on that slot yet", and a standing pressure to give every
   new thing a seat. So start is a list of *places* now, exactly as it is in
   the game the crossbar came from:

     the folio · the voices · the quests · the settings · the mirrors

   L1 and R1 turn the strip. Each screen draws its own controls in its own
   shape and says what they do in the footer, so nothing anywhere has to
   explain the pad in the abstract — which is the ruling that deleted the key
   overlay on the same day this was written.

   One rule decides what closes and what does not, and it is mechanical
   enough that no row has to be remembered:

     ← →  turns a value, and you stay        (an instrument, a background,
                                              a drawing, the lesson listed)
     ✕    finishes an act, and you are on    (into this quest, write in this
          the page                            voice, save the folio)
     ○    back one step — out of a sub-state if there is one, otherwise out
     start  puts it all down, from any screen, any depth

   The page behind is never taken away: it dims to a watermark so that what
   the ear is being asked to judge is still under the eye, and the transport
   keeps running underneath — select still plays. */
"use strict";

var screensEl = document.getElementById("screens");   /* the views */
var sstripEl  = document.getElementById("sstrip");
var swhereEl  = document.getElementById("swhere");
var svoicesEl = document.getElementById("sv-voices");
var ssetEl    = document.getElementById("sv-settings");
var smirrEl   = document.getElementById("sv-mirrors");

/* the five places, in the order the strip reads them. `folio` is the page
   itself: turning onto it lifts the watermark so the page is whole again
   while the strip is still up, and ✕ (or ○, or start) puts the strip down
   and leaves the hands writing. `mirrors` is named before it exists — the
   shape of the menu should not change when it lands. */
var SCREENS = [
  { id:"folio",    name:"folio" },
  { id:"voices",   name:"voices" },
  { id:"quests",   name:"quests" },
  { id:"settings", name:"settings" },
  { id:"mirrors",  name:"mirrors", soon:true }
];
var scr = -1;                 /* which screen is up; -1 is none, the page */
var scrLast = 1;              /* the one start comes back to: voices, first */
var srow = 0;                 /* the row the caret is on, within this screen */

function screenOpen(){ return scr >= 0; }
function screenIs(id){ return scr >= 0 && SCREENS[scr].id === id; }
function screenId(){ return scr >= 0 ? SCREENS[scr].id : null; }
/* the folio screen shows the page whole: the watermark lifts, and the only
   thing standing over the folio is the strip itself */
function screenVeiled(){ return scr >= 0 && SCREENS[scr].id !== "folio"; }

/* ---- how many rows each screen has, and what walking one means ---- */
function srows(){
  if (screenIs("voices"))   return LANES;
  if (screenIs("settings")) return SETTING_ROWS.length;
  return 0;
}

/* ================= the strip ================= */
var schips = [];
(function buildStrip(){
  if (!sstripEl) return;
  for (var i = 0; i < SCREENS.length; i++){
    var c = document.createElement("span");
    c.className = "schip" + (SCREENS[i].soon ? " soon" : "");
    c.textContent = SCREENS[i].name;
    c.setAttribute("role", "tab");
    c.addEventListener("click", (function(n){
      return function(){ goScreen(n); };
    })(i));
    sstripEl.appendChild(c);
    schips.push(c);
  }
})();
function renderStrip(){
  for (var i = 0; i < schips.length; i++){
    schips[i].classList.toggle("on", i === scr);
    schips[i].setAttribute("aria-selected", i === scr ? "true" : "false");
  }
}

/* ================= the voices ================= */
/* One row a voice: its name, the rail of instruments it can wear, and
   whether it is heard. Walking the rows *is* choosing the voice — there is
   nothing to confirm, exactly as walking the workspace rail always was — so
   ← → and □ and △ all speak to the row the caret is on and the hands are
   already in that line when the strip goes down. */
var vrows = [];
function buildVoices(){
  if (!svoicesEl || vrows.length) return;
  for (var v = 0; v < LANES; v++){
    var el = document.createElement("div"); el.className = "vrow";
    var n = document.createElement("span"); n.className = "vrn";
    var rail = document.createElement("div"); rail.className = "vseats";
    var st = document.createElement("span"); st.className = "vrst";
    n.textContent = LANE_NAMES[v];
    el.appendChild(n); el.appendChild(rail); el.appendChild(st);
    el.addEventListener("click", (function(k){
      return function(){ srow = k; setVoice(k); renderScreen(); };
    })(v));
    svoicesEl.appendChild(el);
    vrows.push({ el: el, rail: rail, state: st });
  }
}
/* what a voice can be made to sound like. The chord lane has no rail of its
   own yet — it is played by the lead's own tone, which is a gap worth
   naming rather than four empty seats worth drawing. */
function voiceRail(v){
  return (typeof TONE_RAIL !== "undefined" && TONE_RAIL[v]) ? TONE_RAIL[v] : null;
}
/* ---- and the other rail, when something else is playing ----
   While the rack has the sound, the kits are not what is heard, and a rail
   that lies about what will be heard is worse than no rail — so the row shows
   the rack's own instruments instead, and walking it moves that voice to
   another of the rack's seats. It is the same gesture in the same place; only
   what is behind it has changed.

   The rail is whatever the rack SAYS it has and never a list kept here, so
   there is still no such thing as an empty seat: a voice the rack has one
   instrument for shows one, and a lane it has none for falls back to the kit
   rail exactly as before. This is also the chord lane's first rail of its
   own — the rack has always had a track for it. */
function rackOn(){
  return (typeof midiConnected === "function") && midiConnected();
}
function rackRail(v){
  var s = (typeof midiSeats === "function") ? midiSeats(v) : [];
  return (rackOn() && s.length) ? s : null;
}
/* how many steps along its rail a voice is from the tone that was clicked:
   toneStep is the one way a tone is ever changed, so the mouse asks it for a
   distance rather than setting the page behind its back */
function railStepTo(v, t){
  var rail = voiceRail(v), at = rail.indexOf(toneNow(v)), to = rail.indexOf(t);
  if (at < 0) at = 0;
  return to - at;
}
function renderVoicesScreen(){
  buildVoices();
  var rack = rackOn();
  for (var v = 0; v < LANES; v++){
    var r = vrows[v], seats = rackRail(v), rail = seats ? null : voiceRail(v), i, s;
    r.el.classList.toggle("on", v === srow);
    while (r.rail.firstChild) r.rail.removeChild(r.rail.firstChild);
    if (seats){
      for (i = 0; i < seats.length; i++){
        s = document.createElement("span");
        s.className = "vseat" + (seats[i].seat === MIDI_SLOTS[v] ? " on" : "");
        s.textContent = seats[i].name;
        s.addEventListener("click", (function(k, seat){
          return function(e){
            e.stopPropagation();
            srow = k; setVoice(k);
            midiSelectInstrument(k, seat);
            renderScreen();
          };
        })(v, seats[i].seat));
        r.rail.appendChild(s);
      }
    } else if (rail){
      for (i = 0; i < rail.length; i++){
        s = document.createElement("span");
        s.className = "vseat" + (rail[i] === toneNow(v) ? " on" : "");
        s.textContent = toneLabel(rail[i]);
        if (!toneHere(rail[i])) s.className += " away";
        /* the mouse steps onto a seat directly; the thumb walks to it. Both
           are the same arrival — wearing it, with nothing to confirm. */
        s.addEventListener("click", (function(k, t){
          return function(e){
            e.stopPropagation();
            srow = k; setVoice(k);
            toneStep(k, railStepTo(k, t));
            renderScreen();
          };
        })(v, rail[i]));
        r.rail.appendChild(s);
      }
    } else {
      s = document.createElement("span");
      s.className = "vseat none";
      s.textContent = "the lead’s own tone — no rail of its own yet";
      r.rail.appendChild(s);
    }
    r.state.textContent = flag("mute", v) ? "muted" : "heard";
    r.state.className = "vrst" + (flag("mute", v) ? "" : " heard");
    /* while the folio is asking, the two face buttons are the asking and
       neither of them is this row's — so no row claims them */
    r.el.classList.toggle("lent", echoNow());
  }
  /* what is actually making the sound is said once, at the top, because it
     is true of every row at once and a rail that lies about what will be
     heard is worse than no rail */
  swhereEl.textContent = workspaceName() + " · " +
    (rack ? "the rack is playing every voice — these are its instruments"
          : "the folio’s own voices");
}

/* ================= the settings ================= */
/* What is not the music. The key and the tempo are not here and are not
   coming: they arrive with the workspace and no control edits them, by
   standing ruling. Neither is a page of controls — that was deleted the day
   this file was written, and the legend under each screen is what replaced
   it. */
var SETTING_ROWS = [
  { name:"the background",
    value:function(){ return scenePref; },
    turn:function(d){ setScenery(SCENERIES[(SCENERIES.indexOf(scenePref) + d +
                        SCENERIES.length) % SCENERIES.length]); },
    options:function(){ return SCENERIES; },
    at:function(){ return SCENERIES.indexOf(scenePref); } },
  { name:"the drawing",
    value:function(){ return viz; },
    turn:function(){ toggleViz(); },
    options:function(){ return ["column", "roll"]; },
    at:function(){ return viz === "roll" ? 1 : 0; } },
  { name:"the names on the drawing",
    value:function(){ return showNames ? "shown" : "hidden"; },
    turn:function(){ toggleNames(); },
    options:function(){ return ["shown", "hidden"]; },
    at:function(){ return showNames ? 0 : 1; } },
  { name:"the folio",
    act:function(){ exportFile(); },
    actName:"save it to a file",
    alt:function(){ picker.value = ""; picker.click(); },
    altName:"□ open one" }
];
var srowsEls = [];
function buildSettingsRows(){
  if (!ssetEl || srowsEls.length) return;
  for (var i = 0; i < SETTING_ROWS.length; i++){
    var el = document.createElement("div"); el.className = "srow";
    var k = document.createElement("span"); k.className = "srk";
    var o = document.createElement("div"); o.className = "sropts";
    k.textContent = SETTING_ROWS[i].name;
    el.appendChild(k); el.appendChild(o);
    el.addEventListener("click", (function(n){
      return function(){ srow = n; renderScreen(); };
    })(i));
    ssetEl.appendChild(el);
    srowsEls.push({ el: el, opts: o });
  }
}
function renderSettingsScreen(){
  buildSettingsRows();
  for (var i = 0; i < SETTING_ROWS.length; i++){
    var s = SETTING_ROWS[i], r = srowsEls[i], o = r.opts, j, e;
    r.el.classList.toggle("on", i === srow);
    while (o.firstChild) o.removeChild(o.firstChild);
    if (s.options){
      var list = s.options(), now = s.at();
      for (j = 0; j < list.length; j++){
        e = document.createElement("span");
        e.className = "sropt" + (j === now ? " on" : "");
        e.textContent = list[j];
        e.addEventListener("click", (function(n, k){
          return function(ev){
            ev.stopPropagation();
            srow = n;
            var s2 = SETTING_ROWS[n], d = k - s2.at();
            /* a rail takes the distance; a two-way row ignores it and flips.
               Either way, clicking the one already on does nothing. */
            if (d) s2.turn(d);
            renderScreen();
          };
        })(i, j));
        o.appendChild(e);
      }
    } else {
      e = document.createElement("span");
      e.className = "sract";
      e.textContent = "✕ " + s.actName + (s.altName ? " · " + s.altName : "");
      o.appendChild(e);
    }
  }
  swhereEl.textContent = "the few things that are not the music";
}

/* ================= the legend, in the footer =================
   Every screen says what its own controls do, here, where the folio already
   speaks. Nothing else in the app explains the pad. */
function screenLegend(){
  switch (screenId()){
    case "folio":
      return "the page, whole · L1 R1 the screens · ✕ or ○ back to writing";
    case "voices":
      return "↑↓ the voice · ←→ its instrument, and you stay · " +
             (echoNow() ? "□ play the call · △ judge the answer · "
                        : "□ mute · △ solo · ") +
             "✕ write in it, and you are on the page · ○ back";
    case "quests":
      return "↑↓ walk · ←→ the lesson · ✕ into its page, and you are writing · " +
             "○ complete · □ keep to hand";
    case "settings":
      return "↑↓ walk · ←→ change, and you stay · ✕ do · ○ back";
    case "mirrors":
      return "not yet — one cell of music pointed at from several places, " +
             "when the arrangement lesson lands";
    default:
      return "‸ cursor row";
  }
}

/* ================= drawing whichever one is up ================= */
function renderScreen(){
  if (!screensEl) return;
  renderStrip();
  var id = screenId();
  if (svoicesEl) svoicesEl.classList.toggle("on", id === "voices");
  if (ssetEl)    ssetEl.classList.toggle("on", id === "settings");
  if (smirrEl)   smirrEl.classList.toggle("on", id === "mirrors");
  questsEl.classList.toggle("on", id === "quests");
  /* the two margins go up and come down together: the list and the
     quest it is on are one screen in two places */
  if (qdetailEl) qdetailEl.classList.toggle("on", id === "quests");
  if (id === "voices")   renderVoicesScreen();
  if (id === "settings") renderSettingsScreen();
  if (id === "quests"){ renderQuests(); swhereEl.textContent = "the board"; }
  if (id === "mirrors")  swhereEl.textContent = "the arrangement lesson’s, when it lands";
  if (id === "folio")    swhereEl.textContent = workspaceName() + " · " + docKeyLine();
  applyViz();
  renderRails();
}
/* the line under the strip on the folio screen: what page you are on, in the
   words the header uses when the header is in view */
function docKeyLine(){
  return String(doc.tempo) + " · " + doc.key;
}

/* ================= opening, turning, closing ================= */
function markScreens(){
  if (screenOpen()) document.body.setAttribute("data-screen", screenId());
  else document.body.removeAttribute("data-screen");
  document.body.classList.toggle("veiled", screenVeiled());
  if (screensEl){
    /* the views stand where the drawing does; the folio screen has none of
       its own, because the drawing is what it is showing */
    screensEl.classList.toggle("on", screenOpen() && !screenIs("folio") && !screenIs("quests"));
    screensEl.setAttribute("aria-hidden", screenOpen() ? "false" : "true");
  }
  if (schromeEl){
    schromeEl.classList.toggle("on", screenOpen());
    schromeEl.setAttribute("aria-hidden", screenOpen() ? "false" : "true");
  }
}
function goScreen(n){
  scr = ((n % SCREENS.length) + SCREENS.length) % SCREENS.length;
  scrLast = scr;
  srow = (screenIs("voices")) ? voice : 0;
  markScreens();
  renderScreen();
  say(SCREENS[scr].name + " · " + screenLegend());
}
/* L1 and R1: the strip turns and nothing is entered by turning it */
function turnScreen(d){
  if (!screenOpen()) return;
  goScreen(scr + d);
}
function openScreens(id){
  var n = scrLast, i;
  if (id) for (i = 0; i < SCREENS.length; i++) if (SCREENS[i].id === id) n = i;
  goScreen(n);
}
function closeScreens(){
  if (!screenOpen()) return;
  scr = -1;
  markScreens();
  questsEl.classList.remove("on");
  if (qdetailEl) qdetailEl.classList.remove("on");
  if (svoicesEl) svoicesEl.classList.remove("on");
  if (ssetEl)    ssetEl.classList.remove("on");
  if (smirrEl)   smirrEl.classList.remove("on");
  renderStrip();
  applyViz();
  renderRails();
  say("‸ cursor row");
}
/* start, from anywhere and at any depth: everything down, hands on the page */
function toggleScreens(){
  if (screenOpen()) closeScreens(); else openScreens();
}

/* ================= what the four directions and the four symbols do =====
   Walking is arriving on every screen that has rows: the caret does not
   point at a thing waiting to be chosen, it *is* where you are. */
function screenWalk(d){
  var n = srows();
  if (screenIs("quests")){ moveQuest(d); return; }
  if (!n) return;
  srow = ((srow + d) % n + n) % n;
  if (screenIs("voices")) setVoice(srow);
  renderScreen();
  say(screenIs("voices")
        ? LANE_NAMES[srow] + " · " +
          (rackRail(srow) ? midiSeatName(srow) + " · the rack" : toneValue(srow))
        : SETTING_ROWS[srow].name + " · " + SETTING_ROWS[srow].value());
}
/* ← and → turn a value in place. Nothing here ever closes the screen: the
   next press is probably another turn of the same dial, and what it did is
   judged by ear against a page that is still playing. */
function screenTurn(d){
  if (screenIs("quests")){ moveTab(d); renderScreen(); return; }
  if (screenIs("voices")){
    /* whichever rail this row is actually showing: the rack's seats while it
       is playing, and the folio's own kits otherwise */
    if (rackRail(srow)){
      midiSeatStep(srow, d);
      renderScreen();
      say(LANE_NAMES[srow] + " · " + midiSeatName(srow) + " · the rack");
      return;
    }
    if (!voiceRail(srow)){ say(LANE_NAMES[srow] + " · no rail of its own yet"); return; }
    toneStep(srow, d);
    renderScreen();
    return;
  }
  if (screenIs("settings")){
    var s = SETTING_ROWS[srow];
    if (!s.turn){ say(s.name + " · ✕ " + s.actName); return; }
    s.turn(d);
    renderScreen();
    return;
  }
}
/* ✕ finishes. Everything it does leaves the hands on the page, so the screen
   goes down with it — there is nothing left here to want. */
function screenAct(){
  if (screenIs("folio")){ closeScreens(); return; }
  if (screenIs("quests")){ chooseWorkspace(); closeScreens(); return; }
  if (screenIs("voices")){
    setVoice(srow);
    closeScreens();
    say("the " + voiceName(srow) + (flag("mute", srow) ? " · muted" : ""));
    return;
  }
  if (screenIs("settings")){
    var s = SETTING_ROWS[srow];
    if (!s.act){ say(s.name + " · ←→ changes it"); return; }
    s.act();
    closeScreens();
    return;
  }
  if (screenIs("mirrors")) say("not yet");
}
/* □ and △: the two verbs a screen may lend its face buttons. On the voices
   they are the ear's own check and they do not close anything — muting a
   line and listening to what is left is one movement repeated. */
/* ---- two seats, lent ----
   In an echo workspace the folio is asking a question rather than playing a
   page, and these two seats are the asking: □ plays the hidden call again, △
   says how much of the answer rang true. They were the crossbar's □ and △
   before the crossbar was deleted, and they are on the voices screen now
   because that is where solo and mute went — the same two seats, the same
   loan, in their new house. Outside an echo they are solo and mute exactly
   as they have always been, and the keyboard's O and P are still derived
   from these rather than the other way round. */
function screenSquare(){
  if (screenIs("voices")){
    if (echoNow()){ echoPlay(); return; }
    toggleMute(srow); renderScreen(); return;
  }
  if (screenIs("quests")){ toggleFavourite(); return; }
  if (screenIs("settings")){
    var s = SETTING_ROWS[srow];
    if (s.alt){ s.alt(); closeScreens(); }
    return;
  }
}
function screenTriangle(){
  if (screenIs("voices")){
    if (echoNow()){ echoJudge(); return; }
    toggleSolo(srow); renderScreen(); return;
  }
}
/* ○ is back, everywhere but one place. On the quests screen it is still what
   it has always been — the mark that a quest is complete — because that mark
   is under review and moving its seat first would spend the muscle memory of
   a whole lesson's board for nothing. It is the one seam in the rule, and it
   is deliberate; start is the way out of that screen until it is settled.
   There is no sub-state on any screen yet: mirrors will be the first. */
function screenBack(){
  if (screenIs("quests")){ toggleComplete(); return; }
  closeScreens();
}
