/* Folio — js/entry.js : the hands themselves.

   The keyboard, read by physical position (KeyboardEvent.code) and never by
   what a key prints, so the layout is the same on any board; the file picker
   and the dropped file; and the gamepad — the contour on the face buttons,
   the leaps and the note's two edges on the triggers, the voice on the
   bumpers, and the settings crossbar under start.

   It calls into edit.js and quests.js and decides nothing of its own. */
"use strict";

/* ================= keyboard, by physical code only ================= */
document.addEventListener("keydown", function(e){
  if (e.repeat && e.code.indexOf("Arrow") !== 0) return;
  var code = e.code;
  /* anything but the key that is growing a note ends the growing */
  if (grow && grow.code !== code) growStop();

  if (e.ctrlKey || e.metaKey){
    /* on the quest page these two act on the quest log instead */
    if (code === "KeyS"){
      e.preventDefault();
      if (questsEl.classList.contains("on")) exportQuests(); else exportFile();
      return;
    }
    if (code === "KeyO"){ e.preventDefault(); picker.value = ""; picker.click(); say("choose a folio to open"); return; }
    return;
  }
  if (e.altKey) return;

  /* F1 was the page of the key, and then the strip under the footer; it is
     the key overlay now — the crossbar's drawing of the controls, raised
     over the folio and put down again by the same press. The press goes on
     being swallowed whatever it does: left to the browser, F1 opens its own
     help window and takes the folio out of focus, which stops the animation
     frame and the playhead and the pad poll with it. */
  if (code === "F1"){ e.preventDefault(); toggleKeys(); return; }
  /* while it is up it is a page like the others: nothing written on the
     board reaches the pattern, and the way out is escape or F1 again */
  if (keysOpen()){
    e.preventDefault();
    if (code === "Escape") closeKeys();
    return;
  }
  if (code === "F3"){ e.preventDefault(); toggleQuests(); return; }
  /* F4 was the room the kits were made in. There is no room: the kits are
     baked and checked in, and what a voice sounds like is a rail on the
     crossbar, under start, where every other setting of the page already is.
     W is a note again, as it was before the room existed. */
  if (e.shiftKey && code === "KeyB"){
    e.preventDefault(); cycleScenery(); return;
  }

  /* tab is the other voice — the one key that changes which line the hands
     are in, and with shift the one before instead of the one after, so the
     ring is walked both ways and a third voice is still one press from
     either of its neighbours. It is swallowed either way, so focus never
     wanders off the page, and it is inert while a page (the quest log, the
     crossbar) is up, exactly as note entry is. */
  if (code === "Tab"){
    e.preventDefault();
    if (!anyPage()){ if (e.shiftKey) prevVoice(); else nextVoice(); }
    return;
  }

  /* the settings crossbar is a page as well; it belongs to the pad, so the
     keyboard only needs the way out of it */
  if (settingsEl.classList.contains("on")){
    e.preventDefault();
    if (code === "Escape") closeSettings();
    return;
  }

  /* the quest log is a page too: nothing here reaches the pattern */
  if (questsEl.classList.contains("on")){
    e.preventDefault();
    switch (code){
      case "Escape":    toggleQuests();  return;
      /* the list runs down the page and the lessons run across the top of
         it, so the arrows do the same: up and down walk the tab you are in,
         left and right change tabs. Held with shift the vertical pair is
         not a step but a move — the caret carries the quest with it. */
      case "ArrowUp":    if (e.shiftKey) moveInOrder(-1); else moveQuest(-1); return;
      case "ArrowDown":  if (e.shiftKey) moveInOrder(1);  else moveQuest(1);  return;
      case "ArrowLeft":  moveTab(-1); return;
      case "ArrowRight": moveTab(1);  return;
      /* enter is the whole interaction: it puts you in that quest's page,
         or back in free play if you are in it already */
      case "Enter": case "NumpadEnter": chooseWorkspace(); return;
      case "KeyC":      toggleComplete();return;
      /* F keeps a quest to hand: at the head of its tab, and at the head of
         the left margin, which is in view the whole time you are writing */
      case "KeyF":      toggleFavourite(); return;
    }
    return;
  }

  if (Object.prototype.hasOwnProperty.call(NOTE_KEYS, code)){
    e.preventDefault();
    var wrote = cursor;                 /* where the note lands, before the advance */
    enterNote(NOTE_KEYS[code]);
    growStart(voice, wrote, code, undefined);
    return;
  }

  switch (code){
    /* the two keys left of backspace: the note sounding at the cursor,
       shorter or longer by a step — free on this page and adjacent by
       position on any layout. Shift takes it the whole way: as long as it
       will go, or back to a plain sixteenth. */
    case "Minus": case "NumpadSubtract":
      e.preventDefault(); stretch(-1, e.shiftKey); return;
    case "Equal": case "NumpadAdd":
      e.preventDefault(); stretch(1, e.shiftKey); return;
    case "Period": case "NumpadDecimal": case "Delete": case "Backspace":
      e.preventDefault(); clearStep(); return;
    /* both arrow pairs walk the cursor: up/left back, down/right forward —
       the column reads down, the roll reads right, the hands need not care */
    /* and with shift, a window at a time: page up and page down are the
       octave and have been for as long as there have been notes, so the
       stride down a long page lives on the arrows it is a bigger version of */
    case "ArrowUp": case "ArrowLeft":
      e.preventDefault();
      if (e.shiftKey) moveSection(-1); else moveCursor(-1);
      return;
    case "ArrowDown": case "ArrowRight":
      e.preventDefault();
      if (e.shiftKey) moveSection(1); else moveCursor(1);
      return;
    case "Home":       e.preventDefault(); jump(0); return;
    case "End":        e.preventDefault(); jump(pageLen() - 1); return;
    case "PageUp":     e.preventDefault(); shiftOctave(1); return;
    case "PageDown":   e.preventDefault(); shiftOctave(-1); return;
    /* the loop — how much of the page repeats. How long the page IS comes
       with the workspace and has no key: it is seeded, like the tempo. */
    case "KeyL":
      e.preventDefault(); cycleLoop(); return;
    /* beside it by position: the names on the drawing, away and back */
    case "KeyK":
      e.preventDefault(); toggleNames(); return;
    /* the two keys past the end of the upper row: solo, then mute, both on
       the voice in hand. The solo test wants one key, not a menu. */
    case "KeyO":
      e.preventDefault(); toggleSolo(); return;
    case "KeyP":
      e.preventDefault(); toggleMute(); return;
    case "F2":
      e.preventDefault(); toggleViz(); return;
    case "Space":
      e.preventDefault();
      if (playing) stop(); else play();
      return;
  }
});

/* letting go of the key stops the note growing; so does the window losing
   the hands altogether, which is the one way a key-up can go missing */
document.addEventListener("keyup", function(e){
  if (grow && grow.code === e.code) growStop();
});
window.addEventListener("blur", function(){ growStop(); });

picker.addEventListener("change", function(){
  if (picker.files && picker.files[0]) importFile(picker.files[0]);
});

/* drag and drop a .json onto the page */
window.addEventListener("dragover", function(e){ e.preventDefault(); }, false);
window.addEventListener("drop", function(e){
  e.preventDefault();
  var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
  if (f) importFile(f); else say("nothing to open there");
}, false);

/* ==== gamepad:begin ==== additive layer; the keyboard above is untouched ====
   Standard mapping, and a DualSense reports the same indices as an Xbox pad:
     0 ✕/A      1 ○/B       2 □/X       3 △/Y
     4 L1/LB    5 R1/RB     6 L2/LT     7 R2/RT
     8 select   9 start    10 L3       11 R3
    12 d-up    13 d-down   14 d-left   15 d-right

   The pad writes contours: the bare face buttons are the move — up, down,
   again, rest — and everything else is navigation. Start raises the
   settings crossbar, whose eight slots are read left, up, right, down, the
   d-pad cluster then the face cluster.

   The four shoulders are sorted by the hand. A trigger is an analogue thing
   made to be leaned on, so the two triggers are the *modifiers*, held: L2
   widens a move to a third, R2 to a fifth, both together take it out of the
   key. A bumper is made to be tapped, so the two bumpers are the *voice*:
   L1 back a line, R1 on a line. Neither pair does two jobs, so nothing here
   has to arbitrate between a tap and a hold. */
var GP_SLOTS = [14, 12, 15, 13, 2, 3, 1, 0];   /* ←↑→↓ then □△○✕ */
var GP_CROSS = 0, GP_CIRCLE = 1, GP_SQUARE = 2, GP_TRIANGLE = 3;  /* face buttons */
var GP_L1 = 4, GP_R1 = 5, GP_L2 = 6, GP_R2 = 7,
    GP_SELECT = 8, GP_START = 9, GP_L3 = 10, GP_R3 = 11,
    GP_DU = 12, GP_DD = 13, GP_DL = 14, GP_DR = 15;
var GP_BUTTONS   = 17;
var HOLD_DELAY   = 350;              /* ms before a held direction repeats */
var HOLD_PERIOD  = 125;              /* then one move every 125 ms = 8 Hz */
var STICK_DEAD   = 0.5;              /* left stick must travel half way */
var GP_THRESHOLD = 0.5;              /* how far a trigger must be pulled */

/* whether each trigger is held as a modifier, read once a frame and then
   read by everything the modifier reaches — the face buttons and the d-pad
   alike, so that neither can be told a different story */
var l2Down = false, r2Down = false;
var padIndex = null;
var gpPrev = [];                     /* previous frame's button state: edge detection */
var navHeld = { up: false, down: false, left: false, right: false, back: false, fwd: false };
var navNext = { up: 0, down: 0, left: 0, right: 0, back: 0, fwd: 0 };
var padWarned = false;

function gpEdge(cur, i){ return !!cur[i] && !gpPrev[i]; }
function navReset(){ for (var k in navHeld) navHeld[k] = false; }

/* a held direction: fire once, wait HOLD_DELAY, then fire every HOLD_PERIOD.
   `mover` is moveCursor on the page, moveQuest in the quest log */
function gpNav(active, key, d, now, mover){
  mover = mover || moveCursor;
  if (!active){ navHeld[key] = false; return; }
  if (!navHeld[key]){
    navHeld[key] = true;
    navNext[key] = now + HOLD_DELAY;
    mover(d);
    return;
  }
  if (now >= navNext[key]){
    mover(d);
    /* advance the schedule, not the clock, so the rate stays 8 Hz even
       though frames land on ~16.7 ms boundaries; if the tab stalled and
       the schedule fell behind, resync instead of firing a burst */
    navNext[key] += HOLD_PERIOD;
    if (navNext[key] < now) navNext[key] = now + HOLD_PERIOD;
  }
}

/* ---- the nudge, as the pad asks for it ----
   Moving the note under the cursor is one move with several ways in: the
   d-pad's ←→ in the column, its ↑↓ in the roll, and the left stick behind
   both. They all come through here, so the triggers say on the d-pad what
   they say on △ and ✕ — both of them held takes the move out of the key, a
   semitone at a time — instead of the hatch answering only the face
   buttons. */
/* the two edges, as the pad asks for them: one trigger says which edge and
   the d-pad's ← and → move it. They go through gpNav like every other
   direction on this pad, so holding one repeats. */
function padStart(n){ moveEdge(false, n); }
function padEnd(n){ moveEdge(true, n); }

function padNudge(n){
  if (l2Down && r2Down){ nudge(n, true); return; }
  nudge(n);
}

/* the note carried along time, as the pad asks for it: both triggers held,
   and the d-pad's *time* pair — its ↑↓ in the column, its ←→ in the roll,
   the same axis the bare pad walks the cursor along. Both triggers already
   mean "out of the ordinary" everywhere on this pad, and here the axis says
   which kind: the pitch pair under them is the semitone out of the key, the
   time pair is the note picked up and put down a step over. Neither seat
   was carrying anything but a cursor stride the bare d-pad already gives. */
function padMove(n){ moveNote(n); }

function gpPick(){
  var pads = (navigator.getGamepads && navigator.getGamepads()) || [];
  if (padIndex !== null && pads[padIndex] && pads[padIndex].connected) return pads[padIndex];
  for (var i = 0; i < pads.length; i++){
    if (pads[i] && pads[i].connected){ padIndex = i; return pads[i]; }
  }
  padIndex = null;
  return null;
}

function pollPads(){
  var gp = gpPick();
  if (!gp){
    if (gpPrev.length){ gpPrev = []; navReset(); }
    return;
  }
  if (gp.mapping !== "standard" && !padWarned){
    padWarned = true;
    say("that pad does not report the standard layout — positions may differ");
  }

  var now = (window.performance && performance.now) ? performance.now() : Date.now();
  var cur = [], i, b;
  for (i = 0; i < GP_BUTTONS; i++){
    b = gp.buttons[i];
    /* analog triggers report pressed on the lightest touch, so ask for half
       a pull; digital pads report value 0 and are taken at their word */
    cur[i] = !!b && (b.value > GP_THRESHOLD || (b.pressed && !b.value));
  }

  /* a note grows while the button that wrote it is held down; letting go of
     that button is what stops it, wherever the rest of the pad has got to */
  if (grow && grow.btn !== undefined && !cur[grow.btn]) growStop();

  /* select is the transport, everywhere and always: play or stop, whatever
     page is up. It is the one button that does not care where you are. */
  if (gpEdge(cur, GP_SELECT)){ if (playing) stop(); else play(); }

  /* the key overlay is a page as well, and the pad honours it: nothing here
     reaches the pattern while it is up, and ○ or start puts it down exactly
     as either puts the crossbar down. No new chord was invented for it —
     raising it is F1, on the board. */
  if (keysOpen()){
    if (gpEdge(cur, GP_CIRCLE) || gpEdge(cur, GP_START)) closeKeys();
    navReset();
    gpPrev = cur; return;
  }

  /* start raises the settings crossbar, and puts it down again. While it is
     up the eight slots are items, read in the crossbar's own order, and
     nothing else on the pad reaches the pattern.

     ↑ and ↓ are the workspace rail in the left margin, and they hold to
     repeat as every other list on the pad does — so they are driven by
     gpNav rather than by the edge loop, which skips them. */
  if (settingsEl.classList.contains("on")){
    if (gpEdge(cur, GP_START)){ closeSettings(); navReset(); gpPrev = cur; return; }
    /* the bumpers turn the crossbar itself: which drawing the slots are */
    if (gpEdge(cur, GP_L1)) stepXbarMode(-1);
    if (gpEdge(cur, GP_R1)) stepXbarMode(1);
    for (i = 0; i < 8; i++){
      if (i === 1 || i === 3) continue;         /* the rail, held below */
      if (gpEdge(cur, GP_SLOTS[i])){ runSetting(i); break; }
    }
    if (settingsEl.classList.contains("on")){
      var sy = (gp.axes && gp.axes.length > 1) ? gp.axes[1] : 0;
      gpNav(cur[GP_DU] || sy <= -STICK_DEAD, "up",   -1, now, xbarStep);
      gpNav(cur[GP_DD] || sy >=  STICK_DEAD, "down",  1, now, xbarStep);
    } else navReset();                          /* ○ put it down */
    gpPrev = cur; return;
  }
  /* raising it hands the d-pad to the margin, so whatever hold the page had
     is forgotten first — the first step of the rail should be a step */
  if (gpEdge(cur, GP_START)){ toggleSettings(); navReset(); gpPrev = cur; return; }

  if (questsEl.classList.contains("on")){
    /* The log is a keyboard page that the pad can read over your shoulder:
       d-pad up and down walk the caret, ✕ enters the quest's page (or comes
       back to free play), ○ marks it complete, R3 closes it as escape does.
       □ keeps the quest to hand, as F does on the keyboard. Nothing more:
       the pad's way round the board is the left margin under start, where
       turning a lesson and walking into a workspace are two directions of
       one stick; moving a quest up the list is still shift on the board. */
    if (gpEdge(cur, GP_CROSS))    chooseWorkspace();
    if (gpEdge(cur, GP_CIRCLE))   toggleComplete();
    if (gpEdge(cur, GP_SQUARE))   toggleFavourite();
    if (gpEdge(cur, GP_R3))       toggleQuests();
    var qy = (gp.axes && gp.axes.length > 1) ? gp.axes[1] : 0;
    gpNav(cur[GP_DU] || qy <= -STICK_DEAD, "up",   -1, now, moveQuest);
    gpNav(cur[GP_DD] || qy >=  STICK_DEAD, "down",  1, now, moveQuest);
    gpPrev = cur;
    return;
  }

  /* L3 is the loop length, the pad's answer to L; R3 the roll, its F2 */
  if (gpEdge(cur, GP_L3)) cycleLoop();
  if (gpEdge(cur, GP_R3)) toggleViz();

  /* ---- the bumpers: the voice ----
     L1 the line before, R1 the line after, round the ring the strip above
     the page names. One tap, from anywhere on the page, into either
     neighbour — which is still true of a third voice when one arrives. They
     have no second job, so a tap is simply a tap: nothing here waits for a
     release to find out what the hand meant. */
  if (gpEdge(cur, GP_L1)) prevVoice();
  if (gpEdge(cur, GP_R1)) nextVoice();

  /* ---- the triggers: the modifiers ----
     Held, they widen the move: L2 a third, R2 a fifth, both together a
     semitone, out of the key. They do nothing else at all.

     A trigger counts as held if it is down now or was down on the frame
     before: rolling off it as the thumb lands is one movement, and the poll
     must not read the two halves of it as a move that lost its modifier.
     Read here, once, so that the face buttons and the d-pad both read the
     same hand. */
  l2Down = !!cur[GP_L2] || !!gpPrev[GP_L2];
  r2Down = !!cur[GP_R2] || !!gpPrev[GP_R2];

  /* the face buttons are motion rather than pitch; ○ and □ ignore the
     triggers */
  var ax, ay, rx, ry;
  var lead = (l2Down ? 1 : 0) + (r2Down ? 2 : 0);
  var wide = (lead === 1) ? 2 : (lead === 2) ? 4 : 1;      /* third, fifth, step */
  if (gpEdge(cur, GP_TRIANGLE) || gpEdge(cur, GP_CROSS)){
    var dir = gpEdge(cur, GP_TRIANGLE) ? 1 : -1;
    var moveAt = cursor;                  /* where it lands, before the advance */
    if (lead === 3) relStep(dir, true);                    /* a semitone out of key */
    else relStep(dir * wide, false);
    /* the shape is given, and the length with it: keep the button down and
       the note just written goes on ringing, exactly as keeping the key
       down does on the board */
    growStart(voice, moveAt, undefined, dir > 0 ? GP_TRIANGLE : GP_CROSS);
  }
  if (gpEdge(cur, GP_CIRCLE)){
    var againAt = cursor;
    relRepeat();
    growStart(voice, againAt, undefined, GP_CIRCLE);
  }
  if (gpEdge(cur, GP_SQUARE)) clearStep();                 /* a rest, and on */

  /* ---- the d-pad, and what the triggers make of it ----
     Bare, up and down are time and left and right nudge the note under the
     cursor a scale step without advancing; in the roll the page is drawn —
     time runs right, height is pitch — so the pairs trade places, and the
     left stick follows the d-pad on both axes.

     One trigger held, ← and → are the note's two *edges* instead: L2 holds
     its start, R2 holds its end, and the pair moves whichever is held, one
     step at a time, holding to repeat as every other direction here does.
     The two ends of a note are two decisions — the attack against an ending
     already made, the release against a beginning already made — and this is
     one modifier each.

     Both triggers held, the d-pad's two pairs split by what their axis
     already means. The *pitch* pair is the nudge again and out of the key, a
     semitone at a time, which is what the pair has always meant together, on
     the d-pad exactly as on △ and ✕. The *time* pair carries the whole note
     one step along, its length with it — the note in the wrong place, put in
     the right one. Which pair is which trades with the view, exactly as the
     bare d-pad's do, because it is the same axis underneath: time is ↑↓ in
     the column and ←→ in the roll.

     So the same two triggers say four things and never have to ask which:
     one of them under the d-pad is an edge, both of them are the hatch out
     of the key on the pitch axis and the carry on the time axis, either of
     them under a face button is a leap. The leap reads button edges and
     everything else reads the d-pad, so neither can swallow the other; and a
     trigger is never spent by being held, because nothing on this pad waits
     on a trigger's release to find out what the hand meant. */
  var edge = (lead === 1) ? padStart : (lead === 2) ? padEnd : null;
  /* both of them: the time pair carries the note, the pitch pair is the
     hatch out of the key. `carry` is null the rest of the time, which
     leaves the time pair the plain cursor stride it has always been. */
  var carry = (lead === 3) ? padMove : null;
  ax = (gp.axes && gp.axes.length > 0) ? gp.axes[0] : 0;
  ay = (gp.axes && gp.axes.length > 1) ? gp.axes[1] : 0;    /* left stick Y, +1 = down */
  if (edge){
    /* the edge is the whole of the gesture on this pair: the stick is not a
       second copy of it, and up and down keep whatever the view gives them */
    gpNav(cur[GP_DL], "left",  -1, now, edge);
    gpNav(cur[GP_DR], "right",  1, now, edge);
    if (viz === "roll"){
      gpNav(cur[GP_DU] || ay <= -STICK_DEAD, "up",    1, now, padNudge);
      gpNav(cur[GP_DD] || ay >=  STICK_DEAD, "down", -1, now, padNudge);
    } else {
      gpNav(cur[GP_DU] || ay <= -STICK_DEAD, "up",   -1, now);
      gpNav(cur[GP_DD] || ay >=  STICK_DEAD, "down",  1, now);
    }
  } else if (viz === "roll"){
    gpNav(cur[GP_DL] || ax <= -STICK_DEAD, "left",  -1, now, carry);
    gpNav(cur[GP_DR] || ax >=  STICK_DEAD, "right",  1, now, carry);
    gpNav(cur[GP_DU] || ay <= -STICK_DEAD, "up",    1, now, padNudge);
    gpNav(cur[GP_DD] || ay >=  STICK_DEAD, "down", -1, now, padNudge);
  } else {
    gpNav(cur[GP_DU] || ay <= -STICK_DEAD, "up",   -1, now, carry);
    gpNav(cur[GP_DD] || ay >=  STICK_DEAD, "down",  1, now, carry);
    gpNav(cur[GP_DL], "left",  -1, now, padNudge);
    gpNav(cur[GP_DR], "right",  1, now, padNudge);
  }
  /* the right stick strides by fours, beat to beat, either axis */
  rx = (gp.axes && gp.axes.length > 2) ? gp.axes[2] : 0;
  ry = (gp.axes && gp.axes.length > 3) ? gp.axes[3] : 0;
  gpNav(rx <= -STICK_DEAD || ry <= -STICK_DEAD, "back", -4, now);
  gpNav(rx >=  STICK_DEAD || ry >=  STICK_DEAD, "fwd",   4, now);

  gpPrev = cur;
}

window.addEventListener("gamepadconnected", function(e){
  if (padIndex === null) padIndex = e.gamepad.index;
  gpPrev = [];
  navReset();
  say("gamepad ready · △ up, ✕ down, ○ again, □ rest · L1 R1 the voice");
});
window.addEventListener("gamepaddisconnected", function(e){
  if (e.gamepad.index === padIndex){
    padIndex = null; gpPrev = [];
    navReset();
  }
  say("gamepad disconnected");
});
/* ==== gamepad:end ==== */
