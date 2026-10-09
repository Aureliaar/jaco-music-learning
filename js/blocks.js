/* Folio — js/blocks.js : the blocks — one loop, played several times over,
   each time with something done to it.

   The page's loop is written once, in the roll, as it always has been. A
   block is one pass of that loop, and the blocks in a row are the piece: the
   loop played as many times as there are blocks, in order, and round again.
   Each block can carry modifiers, per voice, and a modifier never rewrites a
   note: what is heard is worked out from the loop at the moment it is
   played, exactly as a chord's pitches are worked out from its cell. Take a
   modifier away and the loop is back as written.

     blocks: [ { lanes:[ {oct:1}, null, {off:true} ] },
               { lanes:[ {oct:1, seat:2} ] },
               {} ]

   One entry a lane — 0 the lead, 1 the bass, 2 the chord lane — and null (or
   nothing) for a lane played as written:

     oct    whole octaves up or down, −3 to 3
     seat   which of the rack's instruments that voice plays in this block;
            absent is whatever the voice is playing anyway
     off    the voice is tacet for this block — it sits the pass out

   Read permissively, like the tones: junk in a lane is that lane played as
   written, and nothing a block says can cost the page a note, because the
   blocks never touch the notes. Written only where there are blocks.

   The strip under the drawing is the editor. Every block draws its own
   computed music, on one pitch scale shared by the whole strip, so a block
   an octave up stands visibly higher than its neighbours without anyone
   having to read a label. The roll above it is the loop as written. While
   the strip is up, play runs the blocks, from the one the caret is on.

   It is a keyboard editor first (player's call, 2026-10-09), WASD under the
   left hand; the pad gets a home when its layout has been agreed. */
"use strict";

var BLOCK_FIELD = "blocks";
var BLOCK_MAX = 64;
var BLOCK_OCT = 3;
var BLOCK_START = 4;                 /* how many plain blocks a fresh strip opens with */

var blocksEl = document.getElementById("blocks");
var browEl   = document.getElementById("brow");
var blegendEl = document.getElementById("blegend");

var blocksUp = false;    /* is the strip the thing in the hands */
var bsel = 0;            /* the block the caret is on */
var blane = 0;           /* and the voice within it */
var schedBlock = 0;      /* the block the scheduler is playing */
var shownBlock = -1;     /* and the one the strip shows as playing */
var bwin = 0;            /* the first block the row has room to show */

/* ================= reading and writing ================= */
function readBlockLane(m){
  var o = {}, n;
  if (!m || typeof m !== "object" || Array.isArray(m)) return null;
  n = m.oct;
  if (typeof n === "number" && isFinite(n) && n === Math.round(n) && n &&
      Math.abs(n) <= BLOCK_OCT) o.oct = n;
  n = m.seat;
  if (typeof n === "number" && isFinite(n) && n === Math.round(n) &&
      n >= 0 && n < 16) o.seat = n;
  if (m.off === true) o.off = true;
  for (n in o) return o;
  return null;
}
function readBlocks(a){
  var out = [], i, b, lanes, v;
  if (!Array.isArray(a)) return out;
  for (i = 0; i < a.length && out.length < BLOCK_MAX; i++){
    b = a[i];
    lanes = (b && typeof b === "object" && Array.isArray(b.lanes)) ? b.lanes : [];
    var blk = { lanes: [] };
    for (v = 0; v < LANES; v++) blk.lanes.push(readBlockLane(lanes[v]));
    out.push(blk);
  }
  return out;
}
/* out to the file: a plain block is {}, and a block's lanes stop at the last
   one that carries anything */
function blocksOut(a){
  var out = [], i, v, lanes, last;
  for (i = 0; i < a.length; i++){
    lanes = []; last = -1;
    for (v = 0; v < LANES; v++){
      var m = readBlockLane(a[i] && a[i].lanes ? a[i].lanes[v] : null);
      lanes.push(m);
      if (m) last = v;
    }
    out.push(last < 0 ? {} : { lanes: lanes.slice(0, last + 1) });
  }
  return out;
}
function docBlocks(d){
  var a = d && d[BLOCK_FIELD];
  return Array.isArray(a) ? a : [];
}
var PLAIN_LANE = {};
/* what a block does to one voice: always an object, {} where it does nothing */
function blockMod(b, v){
  var a = docBlocks(doc)[b];
  return (a && a.lanes && a.lanes[v]) || PLAIN_LANE;
}
/* the blocks are what play when the strip is up and there are some */
function arrOn(){
  return blocksUp && docBlocks(doc).length > 0 && !echoNow();
}
/* a note name moved by whole octaves, kept inside what MIDI can say */
function shiftNote(name, oct){
  if (!oct) return name;
  var m = midiOf(name);
  if (m === null) return name;
  m += 12 * oct;
  while (m > 127) m -= 12;
  while (m < 0) m += 12;
  return nameOfMidi(m);
}

/* ================= the music a block makes ================= */
/* every note one pass of the loop sounds, with this block's modifiers on it:
   {v, at, len, midi}. The ring is cut at the seam for the drawing — what
   runs over into the next pass is that pass's business. */
function blockNotes(b){
  var out = [], loop = doc.loop || pageLen(), v, i, s, m, len, mod, ps, k;
  for (v = 0; v < VOICES; v++){
    mod = blockMod(b, v);
    if (mod.off) continue;
    s = docSteps(doc, v);
    if (!s) continue;
    for (i = 0; i < loop; i++){
      if (!s[i]) continue;
      m = midiOf(shiftNote(s[i], mod.oct || 0));
      if (m === null) continue;
      len = Math.min(spanOf(doc, v, i), loop - i);
      out.push({ v: v, at: i, len: len, midi: m });
    }
  }
  mod = blockMod(b, CHORD_LANE);
  if (!mod.off && docSteps(doc, CHORD_LANE)){
    ps = chordVoicings(doc);
    for (i = 0; i < loop; i++){
      if (!chordAt(doc, i) || !ps[i]) continue;
      len = Math.min(spanOf(doc, CHORD_LANE, i), loop - i);
      for (k = 0; k < ps[i].length; k++)
        out.push({ v: CHORD_LANE, at: i, len: len, midi: ps[i][k] + 12 * (mod.oct || 0) });
    }
  }
  return out;
}

/* ================= the words a modifier is said in ================= */
function seatName(v, seat){
  var s = (typeof midiSeats === "function") ? midiSeats(v) : [], i;
  for (i = 0; i < s.length; i++) if (s[i].seat === seat) return s[i].name;
  return "instrument " + (seat + 1);
}
function modWords(v, m){
  var w = [];
  if (m.off) return "tacet";
  if (m.oct) w.push("octave " + (m.oct > 0 ? "+" : "−") + Math.abs(m.oct));
  if (typeof m.seat === "number") w.push(seatName(v, m.seat));
  return w.length ? w.join(" · ") : "as written";
}

/* ================= drawing ================= */
var SVGNS = "http://www.w3.org/2000/svg";
var BLOCK_LEGEND =
  "A D the block · W S the voice · Q E octave (shift: every voice) · " +
  "R F instrument · X tacet · Z as written (shift: the block) · " +
  "C copy · shift A D move it · ⌫ remove · space play from here · F4 or esc back";

function renderBlocks(){
  if (!blocksEl) return;
  blocksEl.hidden = !blocksUp;
  document.body.classList.toggle("blocking", blocksUp);
  if (!blocksUp) return;
  var bl = docBlocks(doc), loop = doc.loop || pageLen();
  if (bsel >= bl.length) bsel = Math.max(0, bl.length - 1);
  var all = [], lo = 127, hi = 0, b, k, n;
  for (b = 0; b < bl.length; b++){
    all.push(blockNotes(b));
    for (k = 0; k < all[b].length; k++){
      n = all[b][k];
      if (n.midi < lo) lo = n.midi;
      if (n.midi > hi) hi = n.midi;
    }
  }
  if (lo > hi){ lo = 54; hi = 66; }
  lo -= 2; hi += 2;
  var span = hi - lo + 1;
  /* a note keeps a readable thickness however wide the range the row spans */
  var thick = Math.max(0.8, span / 14);

  while (browEl.firstChild) browEl.removeChild(browEl.firstChild);
  /* the voices' names, once, at the head of the row */
  var head = document.createElement("div");
  head.className = "bhead";
  var pad = document.createElement("div"); pad.className = "bpic";
  head.appendChild(pad);
  for (k = 0; k < LANES; k++){
    var hn = document.createElement("div");
    hn.className = "bln" + (k === blane ? " on" : "");
    hn.textContent = LANE_NAMES[k];
    head.appendChild(hn);
  }
  browEl.appendChild(head);

  /* the row shows whole cards only, as many as it has room for, and the
     stretch follows the caret the way the roll's window does */
  var per = blocksPerRow(), first, last;
  if (bsel < bwin) bwin = bsel;
  if (bsel >= bwin + per) bwin = bsel - per + 1;
  bwin = Math.max(0, Math.min(bwin, bl.length - per));
  first = bwin; last = Math.min(bl.length, bwin + per);
  for (b = first; b < last; b++){
    var card = document.createElement("div");
    card.className = "block" + (b === bsel ? " on" : "") + (b === shownBlock ? " play" : "");
    card.setAttribute("data-b", String(b));
    var svg = document.createElementNS(SVGNS, "svg");
    svg.setAttribute("class", "bpic");
    svg.setAttribute("viewBox", "0 0 " + loop + " " + span);
    svg.setAttribute("preserveAspectRatio", "none");
    for (k = 0; k < all[b].length; k++){
      n = all[b][k];
      var r = document.createElementNS(SVGNS, "rect");
      r.setAttribute("x", n.at + 0.08);
      r.setAttribute("width", Math.max(0.3, n.len - 0.16));
      r.setAttribute("y", hi - n.midi + 0.5 - thick / 2);
      r.setAttribute("height", thick);
      r.setAttribute("class", "bn bn" + n.v +
        (b === bsel && n.v === blane ? " lit" : ""));
      svg.appendChild(r);
    }
    card.appendChild(svg);
    for (k = 0; k < LANES; k++){
      var m = bl[b].lanes ? (bl[b].lanes[k] || PLAIN_LANE) : PLAIN_LANE;
      var ln = document.createElement("div");
      ln.className = "bmod" + (b === bsel && k === blane ? " on" : "") +
        (m.off ? " off" : "") + (modWords(k, m) === "as written" ? " plain" : "");
      ln.textContent = modWords(k, m);
      card.appendChild(ln);
    }
    card.addEventListener("click", (function(i){
      return function(){ bsel = i; renderBlocks(); };
    })(b));
    browEl.appendChild(card);
  }
  blegendEl.textContent = (last - first < bl.length
    ? "blocks " + (first + 1) + "–" + last + " of " + bl.length + " · " : "") + BLOCK_LEGEND;
}
/* how many cards stand in the row beside the voices' names */
function blocksPerRow(){
  var em = remPx() || 16, w = browEl.clientWidth || 40 * em;
  return Math.max(1, Math.floor((w - 4.4 * em) / (8.6 * em)));
}
/* the playing block, off the audio clock as the playhead is */
function renderBlockPlay(b){
  if (b === shownBlock) return;
  shownBlock = b;
  if (!blocksUp || !browEl) return;
  for (var i = 1; i < browEl.children.length; i++)
    browEl.children[i].classList.toggle("play",
      browEl.children[i].getAttribute("data-b") === String(b));
}

/* ================= what the hands do ================= */
function blocksOpen(){ return blocksUp; }
function toggleBlocks(){
  if (!blocksUp && echoNow()){ say("the blocks are not for an echo’s page"); return; }
  if (playing) stop();
  blocksUp = !blocksUp;
  if (blocksUp && !docBlocks(doc).length){
    doc[BLOCK_FIELD] = [];
    for (var i = 0; i < BLOCK_START; i++) doc[BLOCK_FIELD].push({ lanes: [null, null, null] });
    save();
  }
  shownBlock = -1;
  renderBlocks();
  refit();
  say(blocksUp ? "the blocks · " + docBlocks(doc).length + " passes of the loop"
               : "‸ cursor row");
}
function blockLane(b, v){
  var bl = docBlocks(doc)[b];
  if (!bl.lanes) bl.lanes = [null, null, null];
  var m = bl.lanes[v];
  if (!m){ m = {}; bl.lanes[v] = m; }
  return m;
}
/* a lane that has been changed back to doing nothing is nothing again */
function tidyLane(b, v){
  var bl = docBlocks(doc)[b], m = bl.lanes[v], k;
  for (k in m) return;
  bl.lanes[v] = null;
}
/* save draws the strip again, as it does the rails */
function blockChanged(msg){
  save();
  if (!storageOK) renderBlocks();
  say(msg);
}
function blockWalk(d){
  var n = docBlocks(doc).length;
  if (!n) return;
  bsel = Math.max(0, Math.min(n - 1, bsel + d));
  renderBlocks();
  say("block " + (bsel + 1) + " of " + n + " · " + LANE_NAMES[blane] + " · " +
      modWords(blane, blockMod(bsel, blane)));
}
function laneWalk(d){
  blane = (blane + d + LANES) % LANES;
  renderBlocks();
  say(LANE_NAMES[blane] + " · " + modWords(blane, blockMod(bsel, blane)));
}
function blockOct(d, every){
  var v, m, from = every ? 0 : blane, to = every ? LANES : blane + 1;
  for (v = from; v < to; v++){
    m = blockLane(bsel, v);
    var o = Math.max(-BLOCK_OCT, Math.min(BLOCK_OCT, (m.oct || 0) + d));
    if (o) m.oct = o; else delete m.oct;
    tidyLane(bsel, v);
  }
  blockChanged("block " + (bsel + 1) + " · " +
    (every ? "every voice" : LANE_NAMES[blane]) + " · " +
    modWords(blane, blockMod(bsel, blane)));
}
/* along the rack's instruments for this voice, and back round to "whatever
   the voice is playing anyway", which is the one that is not written down */
function blockSeat(d){
  var seats = (typeof midiSeats === "function") ? midiSeats(blane) : [];
  if (!seats.length){ say("instruments come from the rack, and it has none for the " + LANE_NAMES[blane]); return; }
  var m = blockLane(bsel, blane), ring = [null], i, at = 0;
  for (i = 0; i < seats.length; i++) ring.push(seats[i].seat);
  for (i = 0; i < ring.length; i++) if (ring[i] === (typeof m.seat === "number" ? m.seat : null)) at = i;
  var next = ring[(at + d + ring.length) % ring.length];
  if (next === null) delete m.seat; else m.seat = next;
  tidyLane(bsel, blane);
  blockChanged("block " + (bsel + 1) + " · " + LANE_NAMES[blane] + " · " +
    (next === null ? "its own instrument" : seatName(blane, next)));
}
function blockTacet(){
  var m = blockLane(bsel, blane);
  if (m.off) delete m.off; else m.off = true;
  tidyLane(bsel, blane);
  blockChanged("block " + (bsel + 1) + " · " + LANE_NAMES[blane] + " · " +
    (m.off ? "tacet" : "back in"));
}
function blockPlain(every){
  var bl = docBlocks(doc)[bsel], v;
  if (!bl) return;
  if (every) bl.lanes = [null, null, null];
  else { blockLane(bsel, blane); bl.lanes[blane] = null; }
  blockChanged("block " + (bsel + 1) + " · " +
    (every ? "every voice" : LANE_NAMES[blane]) + " · as written");
}
function blockCopy(){
  var bl = docBlocks(doc);
  if (bl.length >= BLOCK_MAX){ say("that is as many blocks as a page holds"); return; }
  bl.splice(bsel + 1, 0, readBlocks([bl[bsel]])[0]);
  bsel++;
  blockChanged("block " + (bsel + 1) + " · a copy of the one before it");
}
function blockRemove(){
  var bl = docBlocks(doc);
  if (bl.length <= 1){ say("the last block stays: it is the loop itself"); return; }
  bl.splice(bsel, 1);
  if (bsel >= bl.length) bsel = bl.length - 1;
  blockChanged("removed · " + bl.length + " blocks");
}
function blockMove(d){
  var bl = docBlocks(doc), to = bsel + d;
  if (to < 0 || to >= bl.length) return;
  var t = bl[bsel]; bl[bsel] = bl[to]; bl[to] = t;
  bsel = to;
  blockChanged("block moved to " + (bsel + 1));
}
