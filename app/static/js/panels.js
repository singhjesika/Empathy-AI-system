// ================================================================
//  panels.js  —  with heart-background.css integration
// ================================================================

function showPanel(name) {
  document.querySelectorAll(".panel").forEach(p => p.classList.remove("visible"));
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));

  const target = document.getElementById(name + "Panel");
  if (target) target.classList.add("visible");

  const navMap = {
    messages:"navChat", history:"navHistory", chart:"navChart",
    calendar:"navCalendar", journal:"navJournal", weekly:"navWeekly",
    quote:"navQuote", forecast:"navForecast", dna:"navDna",
    memory:"navMemory", avatar:"navAvatar",
    relationship:"navRelationship", burnout:"navBurnout", career:"navCareer",
    timemachine:"navTimeMachine", digitaltwin:"navDigitalTwin"
  };

  const btn = document.getElementById(navMap[name]);
  if (btn) btn.classList.add("active");

  const inputWrap = document.getElementById("inputWrap");
  if (inputWrap) inputWrap.style.display = name === "messages" ? "" : "none";

  // ── Heart: redraw animation every time chat panel is opened ────
  if (name === "messages") {
    heartRedraw();
    // re-apply last known emotion colour after redraw
    // (applyHeartEmotion & heartRedraw are defined in app.js)
    const lastEmotion = typeof currentAura !== "undefined" ? currentAura : "general";
    // small delay so the cloned nodes are in the DOM before styling
    setTimeout(() => applyHeartEmotion(lastEmotion), 50);
  }

  if (name === "chart")    loadCharts();
  if (name === "history")  loadHistory();
  if (name === "calendar") loadCalendar();
  if (name === "weekly")   loadWeekly();
  if (name === "quote")    loadQuote();
  if (name === "forecast") loadForecast();
  if (name === "dna")      loadDna();
  if (name === "memory")   loadMemory();
  if (name === "avatar")   initAvatarPanel();
}