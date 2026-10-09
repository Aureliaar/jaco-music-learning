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

  /* F1 is swallowed and does nothing. It was the page of the key, then the
     strip under the footer, then the key overlay; all three are deleted
     (2026-09-07 ruling). A screen that has to explain the controls is an
     admission the controls failed — what a control does is said on the
     screen the control lives on. The press is still taken, because left to
     the browser F1 opens its own help window and takes the folio out of
     focus, which stops the animation frame and the playhead and the pad
     poll with it. */
  if (code === "F1"){ e.preventDefault(); return; }
  if (code === "F3"){ e.preventDefault(); toggleQuests(); return; }
  /* F4 was the room the kits were made in. There is no room: the kits are
     baked and checked in, and what a voice sounds like is a rail on the
     crossbar, under start, where every other setting of the page already is.
     W is a note again, as it was before the room existed. */
  if (e.shiftKey && code === "KeyB"){
    e.preventDefault(); cycleScenery(); return;
  }

  /* ---- the blocks (js/blocks.js) ----
     F4 puts the strip up under the drawing and takes it down again. While it
     is up the left hand is on WASD and nothing writes notes: A and D walk the
     blocks, W and S the voices, and the keys around them change what this
     block does to this voice — Q and E the octave, R and F the instrument, X
     tacet, Z back to as written, C a copy. Shift widens a change to every
     voice of the block, and makes A and D carry the block instead of walking.
     The strip says all of this itself, under the blocks. */
  if (code === "F4"){
    e.preventDefault();
    if (!anyPage()) toggleBlocks();
    return;
  }
  if (blocksOpen() && !anyPage()){
    e.preventDefault();
    var sh = e.shiftKey;
    switch (code){
      case "Escape":     toggleBlocks(); return;
      case "KeyA": case "ArrowLeft":  if (sh) blockMove(-1); else blockWalk(-1); return;
      case "KeyD": case "ArrowRight": if (sh) blockMove(1);  else blockWalk(1);  return;
      case "KeyW": case "ArrowUp":    laneWalk(-1); return;
      case "KeyS": case "ArrowDown":  laneWalk(1);  return;
      case "KeyQ":       blockOct(-1, sh); return;
      case "KeyE":       blockOct(1, sh);  return;
      case "KeyR":       blockSeat(1);  return;
      case "KeyF":       blockSeat(-1); return;
      case "KeyX":       blockTacet();  return;
      case "KeyZ":       blockPlain(sh); return;
      case "KeyC":       blockCopy();   return;
      case "Delete": case "Backspace": blockRemove(); return;
      case "Space":      if (playing) stop(); else play(); return;
    }
    return;
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

  /* the screens are pages: nothing written on the board reaches the pattern
     while one is up. The quests screen has always had keys of its own — the
     board is read as much as it is walked — and they are below; every other
     screen belongs to the pad, so the keyboard needs only the arrows, the
     way in and the way out. */
  if (screenOpen() && !screenIs("quests")){
    e.preventDefault();
    switch (code){
      case "Escape":     closeScreens(); return;
      case "ArrowUp":    screenWalk(-1);  return;
      case "ArrowDown":  screenWalk(1);   return;
      case "ArrowLeft":  screenTurn(-1);  return;
      case "ArrowRight": screenTurn(1);   return;
      case "Enter": case "NumpadEnter": screenAct(); return;
      /* the two seats the voices screen lends, in the places the page
         already lends them: O is solo and P is mute, exactly as they are
         while writing */
      case "KeyO":       screenTriangle(); return;
      case "KeyP":       screenSquare();   return;
    }
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

  /* ---- up or down: while a run is on, the board is the answer ----
     The pad is where this lives — △ up, ✕ down, ○ again, □ the question
     played back — and the board is derived from it. There is no contour on
     the keyboard to borrow from, so it is borrowed from the drawing instead:
     in the roll, time runs right and height is pitch, so the note that went
     up is ↑, the one that went down is ↓, and the same note again is → —
     level, one step on. O plays it again, which is the seat the echo already
     lends its call. Nothing else reaches anything: there is no page here to
     write on, so every other key is swallowed rather than allowed to scrawl
     on a sheet that is about to be thrown away. F1, F3 and the crossbar are
     above this and still answer, which is how the run is left. */
  if (quizOn()){
    e.preventDefault();
    switch (code){
      case "ArrowUp":    quizAnswer(1);  return;
      case "ArrowDown":  quizAnswer(-1); return;
      case "ArrowRight": quizAnswer(0);  return;
      case "KeyO":       quizPlay();     return;
    }
    return;
  }

  /* ---- the chord lane, on the board ----
     The pad shapes and the board names; a chord root has no pitch name here,
     so the two note rows name the degrees of the key instead — by physical
     position, the same two rows, an octave each — and A is the shape the pad
     holds a trigger for. Everything else falls through to the switch below
     and is what it always was: the arrows walk, − and + are the length,
     period is a rest, tab is the next lane. js/chords.js says why. */
  if (onChords()){
    if (Object.prototype.hasOwnProperty.call(CHORD_KEYS, code)){
      e.preventDefault();
      var wroteC = cursor;
      chordDegree(CHORD_KEYS[code]);
      growStart(voice, wroteC, code, undefined);
      return;
    }
    if (code === "KeyA"){
      e.preventDefault();
      if (e.shiftKey) chordFlip(); else chordShape(1);
      return;
    }
  }
  else if (Object.prototype.hasOwnProperty.call(NOTE_KEYS, code)){
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
       the voice in hand. The solo test wants one key, not a menu.

       In an echo workspace these two seats are lent: the folio is asking a
       question there rather than playing a page, so O plays the call again
       and P asks for the judgement. They are derived from the pad — □ and △
       on the settings crossbar, which is where solo and mute already sit —
       and they are themselves again the moment the page is not an echo's. */
    case "KeyO":
      e.preventDefault();
      if (echoNow()) echoPlay(); else toggleSolo();
      return;
    case "KeyP":
      e.preventDefault();
      if (echoNow()) echoJudge(); else toggleMute();
      return;
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
   again, rest — and everything else is navigation. Start opens the screens
   (js/screens.js), which are a list of places rather than an action bar.

   The four shoulders are sorted by the hand. A trigger is an analogue thing
   made to be leaned on, so the two triggers are the *modifiers*, held: L2
   widens a move to a third, R2 to a fifth, both together take it out of the
   key. A bumper is made to be tapped, so the two bumpers are the *voice*:
   L1 back a line, R1 on a line. Neither pair does two jobs, so nothing here
   has to arbitrate between a tap and a hold. */
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

/* ---- and the same pair, in the chord lane ----
   Bare, the pitch pair still moves the root. Both triggers still flip the
   voicing on that pair. A single trigger's edit lives on the literal d-pad
   ↑ and ↓ instead and is routed below: L2 changes root, R2 changes shape. */
function padNudge(n){
  if (onChords()){
    if (l2Down && r2Down) chordVoice(n);
    else chordNudge(n);
    return;
  }
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

  /* ---- the triggers: read first, because everything reads them ----
     Held, they widen a move on the face buttons and the d-pad; on an echo
     page they also say which of the paired seats below is meant. They are
     read once, here, at the top of the frame, so that the transport, the
     bumpers, the sticks, the face buttons and the d-pad are all told the
     same story about the hand.

     A trigger counts as held if it is down now or was down on the frame
     before: rolling off it as the thumb lands is one movement, and the poll
     must not read the two halves of it as a move that lost its modifier. */
  l2Down = !!cur[GP_L2] || !!gpPrev[GP_L2];
  r2Down = !!cur[GP_R2] || !!gpPrev[GP_R2];
  /* on an echo page the triggers are a modifier for four seats that are
     otherwise the transport, the voice, the loop and the view */
  var ech = !!echoNow();

  /* select is the transport, everywhere and always: play or stop, whatever
     page is up. It is the one button that does not care where you are —
     except on an echo page, where a trigger held over it asks the folio for
     the call, or for its verdict on the answer. Those are the same two acts
     the board keeps on O and P, in the one place on the pad that is reachable
     without letting go of the writing hand. */
  if (gpEdge(cur, GP_SELECT)){
    if (ech && l2Down) echoPlay();
    else if (ech && r2Down) echoJudge();
    else if (playing) stop();
    else play();
  }

  /* ---- start: the screens ----
     Start opens the place it was last left in and puts everything down again
     from wherever it has got to. While a screen is up nothing on the pad
     reaches the pattern.

     L1 and R1 turn the strip, and turning never enters anything. ↑ and ↓
     walk the screen's rows and hold to repeat as every other list on this pad
     does, so they are driven by gpNav rather than by the edge loop. ← and →
     turn the value under the caret and leave the screen standing; ✕ finishes
     whatever the row is for and lands the hands back on the page; ○ is back,
     except on the board, where it is still the mark of a finished quest.

     select is above all of this and still plays: turning an instrument and
     hearing what it did to the music are one movement. */
  if (screenOpen()){
    if (gpEdge(cur, GP_START)){ closeScreens(); navReset(); gpPrev = cur; return; }
    if (gpEdge(cur, GP_L1)) turnScreen(-1);
    if (gpEdge(cur, GP_R1)) turnScreen(1);
    if (gpEdge(cur, GP_CROSS))    screenAct();
    if (gpEdge(cur, GP_CIRCLE))   screenBack();
    if (gpEdge(cur, GP_SQUARE))   screenSquare();
    if (gpEdge(cur, GP_TRIANGLE)) screenTriangle();
    if (screenOpen()){
      var sy = (gp.axes && gp.axes.length > 1) ? gp.axes[1] : 0;
      gpNav(cur[GP_DU] || sy <= -STICK_DEAD, "up",   -1, now, screenWalk);
      gpNav(cur[GP_DD] || sy >=  STICK_DEAD, "down",  1, now, screenWalk);
      gpNav(cur[GP_DL], "left",  -1, now, screenTurn);
      gpNav(cur[GP_DR], "right",  1, now, screenTurn);
    } else navReset();                          /* ✕ or ○ put it down */
    gpPrev = cur; return;
  }
  /* raising one hands the d-pad to that screen, so whatever hold the page had
     is forgotten first — the first step in a list should be a step */
  if (gpEdge(cur, GP_START)){ openScreens(); navReset(); gpPrev = cur; return; }

  /* ---- up or down: the face buttons are the answer ----
     Exactly what they already mean when a contour is being written — △ up,
     ✕ down, ○ the same again — so there is nothing new in the hand; □ plays
     the question again and costs nothing, which is why it is not the rest it
     is everywhere else. Nothing else on the pad does anything here, because
     there is no page under it to do anything to. Start is above this and
     still raises the margin, which is how the run is left. */
  if (quizOn()){
    if (gpEdge(cur, GP_TRIANGLE)) quizAnswer(1);
    if (gpEdge(cur, GP_CROSS))    quizAnswer(-1);
    if (gpEdge(cur, GP_CIRCLE))   quizAnswer(0);
    if (gpEdge(cur, GP_SQUARE))   quizPlay();
    navReset();
    gpPrev = cur; return;
  }

  /* L3 is the loop length, the pad's answer to L; R3 the roll, its F2.

     Under a trigger on an echo page the left stick sets the two edges of a
     window instead — L2 where it starts, R2 where it ends, both at the
     cursor — and L2 over the right stick shows where the call's notes fall.
     R2 over the right stick is not spoken for. */
  if (gpEdge(cur, GP_L3)){
    if (ech && l2Down) echoLoopFrom();
    else if (ech && r2Down) echoLoopTo();
    else cycleLoop();
  }
  if (gpEdge(cur, GP_R3)){
    if (ech && l2Down) echoHintToggle();
    else if (!(ech && r2Down)) toggleViz();
  }

  /* ---- the bumpers: the voice ----
     L1 the line before, R1 the line after, round the ring the strip above
     the page names. One tap, from anywhere on the page, into either
     neighbour — which was written before there was a third stop and is
     still true now that there is one: the chord lane is the third name in
     that strip and is one tap from the bass either way round. They
     have no second job, so a tap is simply a tap: nothing here waits for a
     release to find out what the hand meant. */
  /* and on an echo page, under L2, the same pair is the pace instead: L1
     slower, R1 faster, three values and no more. It is the same idea the
     bare pair already carries — one tap, one step along a short ring — and
     the voice is one released trigger away. Under R2 the bumpers are not
     spoken for. */
  if (ech && l2Down){
    if (gpEdge(cur, GP_L1)) echoSlower();
    if (gpEdge(cur, GP_R1)) echoFaster();
  } else if (!(ech && r2Down)){
    if (gpEdge(cur, GP_L1)) prevVoice();
    if (gpEdge(cur, GP_R1)) nextVoice();
  }

  /* the face buttons are motion rather than pitch; ○ and □ ignore the
     triggers. These right-hand symbols always add or overwrite: on the
     chord lane the triggers choose the shape of the chord being written. */
  var ax, ay, rx, ry;
  var lead = (l2Down ? 1 : 0) + (r2Down ? 2 : 0);
  var wide = (lead === 1) ? 2 : (lead === 2) ? 4 : 1;      /* third, fifth, step */
  if (gpEdge(cur, GP_TRIANGLE) || gpEdge(cur, GP_CROSS)){
    var dir = gpEdge(cur, GP_TRIANGLE) ? 1 : -1;
    var moveAt = cursor;                  /* where it lands, before the advance */
    if (onChords()) chordEnter(dir, lead);
    else if (lead === 3) relStep(dir, true);               /* a semitone out of key */
    else relStep(dir * wide, false);
    /* the shape is given, and the length with it: keep the button down and
       the note just written goes on ringing, exactly as keeping the key
       down does on the board */
    growStart(voice, moveAt, undefined, dir > 0 ? GP_TRIANGLE : GP_CROSS);
  }
  if (gpEdge(cur, GP_CIRCLE)){
    var againAt = cursor;
    if (onChords()) chordRepeat(); else relRepeat();
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
  if (onChords() && lead === 0){
    /* A chord's unmodified vertical pair has one dependable meaning in both
       drawings: move only its root. Horizontal is time. Changing the view
       must never make bare ↑ or ↓ alter anything else. */
    gpNav(cur[GP_DU], "up",     1, now, chordNudge);
    gpNav(cur[GP_DD], "down",  -1, now, chordNudge);
    gpNav(cur[GP_DL], "left",  -1, now);
    gpNav(cur[GP_DR], "right",  1, now);
  } else if (onChords() && (lead === 1 || lead === 2)){
    /* The principal distinction: symbols on the right write; d-pad gestures
       change. The vertical pair is stable across both drawings. L2 changes
       this chord's root, R2 its complete shape ring. The horizontal pair
       keeps the written edge belonging to that trigger. */
    var chordEdit = (lead === 1) ? chordNudge : chordShape;
    gpNav(cur[GP_DU], "up",     1, now, chordEdit);
    gpNav(cur[GP_DD], "down",  -1, now, chordEdit);
    gpNav(cur[GP_DL], "left",  -1, now, edge);
    gpNav(cur[GP_DR], "right",  1, now, edge);
  } else if (edge){
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
