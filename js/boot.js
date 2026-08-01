/* Folio — js/boot.js : the order things happen in, once.

   The autosave is read first, then the workspaces over the top; the tab, the
   view, the names and the scenery are taken off the preferences; the page is
   drawn; the server is asked whether it is there; and the footer says what
   happened. Everything this file calls is declared in the files above it,
   which is why it is the last script the page loads. */
"use strict";

/* the animation frame: the playhead off the audio clock, a note still
   growing under a finger, and the pad, polled. */
requestAnimationFrame(frame);

/* ================= boot =================
   The old single autosave is read first: whatever it holds is the free-play
   page, which is what it always was. Then the workspaces are read over the
   top — version 2 if it exists, else the version-1 quest log migrated
   forward, its motifs becoming the quests' pages. Nothing is discarded. */
function bootState(){
  var restored = load();
  wsFree = doc;                        /* whatever was on the page is free play */
  var have = loadState();
  doc = workspaceDoc(qActive);
  return restored || have;
}
var restored = bootState();
/* the tab the log and the margin open on: the lesson of the workspace in
   hand, which is where the work is and what the margin is for; failing
   that the tab it was left on, and failing that the newest lesson on the
   board */
var savedTab = null;
try { savedTab = localStorage.getItem(TAB_KEY); } catch (e){}
if (activeQuest())
  activeTab = questGroup(activeQuest());
else if (savedTab !== null && savedTab !== "" && !isNaN(parseInt(savedTab, 10)))
  activeTab = parseInt(savedTab, 10);
else
  activeTab = newestLesson();
currentTab();                        /* and fall to the first if it is gone */
try { if (localStorage.getItem(VIZ_KEY) === "column") viz = "column"; } catch (e){}
try { if (localStorage.getItem(NAMES_KEY) === "off") showNames = false; } catch (e){}
var savedScenery = "paper";
try { savedScenery = localStorage.getItem(SCENERY_KEY) || "paper"; } catch (e){}
setScenery(savedScenery, true);
applyViz();
applyNames();
renderAll();
renderQuests();
syncBoot();                         /* a static host always restores its showcase */
toneBoot();                         /* the kits the two rails can name, fetched once */
if (!storageOK) say("autosave unavailable — export to keep your work");
else if (restored)
  say("restored ‸ cursor row" + (activeQuest() ? " · ⚔ " + activeQuest().short : "") +
      (droppedMarks ? " · marks from an older file were dropped" : ""));
else say("‸ cursor row");
