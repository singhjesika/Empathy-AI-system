// ═══════════════════════════════════════════════════════════════
// PANEL ROUTER
// ═══════════════════════════════════════════════════════════════

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
  };
  const btn = document.getElementById(navMap[name]);
  if (btn) btn.classList.add("active");

  document.getElementById("inputWrap").style.display = name === "messages" ? "" : "none";

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

// ─── CHARTS ───────────────────────────────────────────────────────
async function loadCharts() {
  if (!currentUser) return;
  try {
    const res  = await fetch("/api/mood-data/" + encodeURIComponent(currentUser));
    const data = await res.json();
    const summary = data.summary || [];

    if (doughnutChartInst) doughnutChartInst.destroy();
    if (summary.length > 0) {
      const ctx = document.getElementById("doughnutChart").getContext("2d");
      doughnutChartInst = new Chart(ctx, {
        type: "doughnut",
        data: {
          labels:   summary.map(s => s.emotion),
          datasets: [{
            data:            summary.map(s => s.count),
            backgroundColor: summary.map(s => EMOTION_COLORS[s.emotion] || "#7c6aff"),
            borderWidth: 0,
          }],
        },
        options: {plugins:{legend:{labels:{color:"#e8e8f0",font:{size:11}}}}, cutout:"65%"},
      });
    }

    const timeline = data.timeline || [];
    if (lineChartInst) lineChartInst.destroy();
    if (timeline.length > 0) {
      const ctx2 = document.getElementById("lineChart").getContext("2d");
      lineChartInst = new Chart(ctx2, {
        type: "line",
        data: {
          labels:   timeline.map(t => t.date || ""),
          datasets: [{
            label: "Mood",
            data:  timeline.map(() => Math.random() * 80 + 20),
            borderColor: "#7c6aff",
            backgroundColor: "rgba(124,106,255,0.1)",
            tension: 0.4,
            fill: true,
          }],
        },
        options: {
          plugins: {legend:{display:false}},
          scales:  {x:{ticks:{color:"#6b6b85"}}, y:{ticks:{color:"#6b6b85"}}},
        },
      });
    }
  } catch(e) {}
}

// ─── HISTORY ──────────────────────────────────────────────────────
async function loadHistory() {
  if (!currentUser) return;
  const el = document.getElementById("historyContent");
  el.innerHTML = '<div class="no-data">Loading…</div>';
  try {
    const res  = await fetch("/api/history/" + encodeURIComponent(currentUser));
    const data = await res.json();
    const rows = data.history || [];
    el.innerHTML = rows.length === 0
      ? '<div class="no-data">No history yet — start chatting! 💬</div>'
      : rows.map(r =>
          '<div class="history-item">'
          + '<div class="history-ts">' + new Date(r.timestamp).toLocaleString() + '</div>'
          + '<div class="history-you">You: ' + r.user_message + '</div>'
          + '<div class="history-ai">AI: '  + r.ai_response  + '</div>'
          + '</div>'
        ).join("");
  } catch(e) {
    el.innerHTML = '<div class="no-data">Failed to load history.</div>';
  }
}

// ─── CALENDAR ─────────────────────────────────────────────────────
async function loadCalendar() {
  if (!currentUser) return;
  const grid = document.getElementById("calendarGrid");
  grid.innerHTML = '<div class="no-data">Loading…</div>';
  try {
    const res  = await fetch("/api/mood-calendar/" + encodeURIComponent(currentUser));
    const data = await res.json();
    const cal  = data.calendar || {};

    const now   = new Date();
    const year  = now.getFullYear();
    const month = now.getMonth();
    const days  = new Date(year, month + 1, 0).getDate();
    const startDay = new Date(year, month, 1).getDay();

    document.getElementById("calendarLegend").innerHTML =
      Object.entries(EMOTION_COLORS).slice(0, 6).map(([k, v]) =>
        '<div class="legend-item"><div class="legend-dot" style="background:' + v + '"></div>' + k + '</div>'
      ).join("");

    const dayLabels = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    grid.innerHTML =
      dayLabels.map(d => '<div class="calendar-day-label">' + d + '</div>').join("")
      + Array(startDay).fill('<div class="calendar-day empty"></div>').join("")
      + Array.from({length: days}, (_, i) => {
          const day     = i + 1;
          const dateStr = year + "-" + String(month + 1).padStart(2, "0") + "-" + String(day).padStart(2, "0");
          const emotion = cal[dateStr];
          const color   = emotion ? (EMOTION_COLORS[emotion] || "#7c6aff") : "rgba(255,255,255,0.04)";
          const isToday = day === now.getDate() ? " today" : "";
          return '<div class="calendar-day' + isToday + '" style="background:' + color + '22;border-color:' + color + '44;"'
            + ' onmouseenter="showCalTooltip(event,\'' + dateStr + '\',\'' + (emotion || "") + '\')"'
            + ' onmouseleave="hideCalTooltip()">' + day + '</div>';
        }).join("");
  } catch(e) {
    grid.innerHTML = '<div class="no-data">Failed to load calendar.</div>';
  }
}

function showCalTooltip(e, date, emotion) {
  const t  = document.getElementById("calendarTooltip");
  const em = EMOTION_MAP[emotion] || {emoji:"📅", label:"No data"};
  t.innerHTML = "<strong>" + date + "</strong><br>" + em.emoji + " " + em.label;
  t.style.left = e.clientX + 12 + "px";
  t.style.top  = e.clientY + 12 + "px";
  t.classList.add("visible");
}

function hideCalTooltip() {
  document.getElementById("calendarTooltip").classList.remove("visible");
}

// ─── WEEKLY REPORT ────────────────────────────────────────────────
async function loadWeekly() {
  if (!currentUser) return;
  const el = document.getElementById("weeklyContent");
  el.innerHTML = '<div class="no-data">Loading…</div>';
  try {
    const res  = await fetch("/api/weekly-report/" + encodeURIComponent(currentUser));
    const data = await res.json();
    el.innerHTML =
      '<div class="weekly-grid">'
      + '<div class="weekly-card"><div class="weekly-card-title">Wellness Score</div>'
      + '<div class="wellness-score">' + (data.wellness_score || 0) + '</div>'
      + '<div class="wellness-label">out of 100</div></div>'
      + '<div class="weekly-card"><div class="weekly-card-title">This Week</div>'
      + '<div class="stat-row"><span>Total chats</span><span class="stat-val">' + data.total_chats + '</span></div>'
      + '<div class="stat-row"><span>Best day</span><span class="stat-val">'  + (data.best_day  || "—") + '</span></div>'
      + '<div class="stat-row"><span>Tough day</span><span class="stat-val">' + (data.worst_day || "—") + '</span></div>'
      + '</div></div>';
  } catch(e) {
    el.innerHTML = '<div class="no-data">Failed to load.</div>';
  }
}

// ─── DAILY QUOTE ──────────────────────────────────────────────────
async function loadQuote() {
  try {
    const res  = await fetch("/api/quote");
    const data = await res.json();
    document.getElementById("quoteText").textContent = data.quote || "Believe in yourself!";
  } catch(e) {}
}

// ─── EMOTIONAL FORECAST ───────────────────────────────────────────
async function loadForecast() {
  if (!currentUser) return;
  const el = document.getElementById("forecastContent");
  el.innerHTML = '<div class="no-data">Loading your forecast…</div>';
  try {
    const res  = await fetch("/api/forecast/" + encodeURIComponent(currentUser));
    const data = await res.json();
    el.innerHTML =
      '<div class="forecast-grid">'
      + '<div class="forecast-card"><div class="forecast-card-title">Current Risk</div>'
      + '<div style="font-size:22px;font-weight:700;color:var(--accent);">' + (data.current_risk && data.current_risk.level || "LOW") + '</div>'
      + '<div style="font-size:11px;color:var(--muted);">' + (data.current_risk && data.current_risk.message || "Looking stable") + '</div></div>'
      + '<div class="forecast-card"><div class="forecast-card-title">Dominant Emotion</div>'
      + '<div style="font-size:28px;">' + (EMOTION_MAP[data.top_emotion] && EMOTION_MAP[data.top_emotion].emoji || "💬") + '</div>'
      + '<div style="font-size:11px;color:var(--muted);">' + (data.top_emotion || "general") + '</div></div>'
      + '<div class="forecast-card full"><div class="forecast-card-title">AI Insight</div>'
      + '<div style="font-size:13px;color:var(--text);line-height:1.65;">' + (data.proactive_message || "Chat more to unlock your forecast!") + '</div></div>'
      + '</div>';
  } catch(e) {
    el.innerHTML = '<div class="no-data">Forecast unavailable.</div>';
  }
}

// ─── JOURNAL ──────────────────────────────────────────────────────
async function generateJournal() {
  if (!currentUser) return;
  const btn = document.getElementById("journalGenBtn");
  const el  = document.getElementById("journalContent");
  btn.disabled = true;
  btn.textContent = "Generating… ✍️";
  try {
    const res  = await fetch("/api/journal/generate/" + encodeURIComponent(currentUser), {method: "POST"});
    const data = await res.json();
    el.innerHTML = data.success
      ? '<div class="journal-entry"><div class="journal-date">' + data.date + '</div><div class="journal-text">' + data.summary + '</div></div>' + el.innerHTML
      : '<div class="no-data">' + data.message + '</div>';
  } catch(e) {
    el.innerHTML = '<div class="no-data">Failed to generate.</div>';
  }
  btn.disabled = false;
  btn.textContent = "✍️ Generate Today's Entry";
}

// ─── EMOTIONAL DNA ────────────────────────────────────────────────
async function loadDna() {
  if (!currentUser) return;
  const el = document.getElementById("dnaContent");
  el.innerHTML = '<div class="no-data">Decoding your emotional fingerprint…</div>';
  try {
    const res = await fetch("/api/emotional-dna/" + encodeURIComponent(currentUser));
    const d   = await res.json();

    const score      = d.growth_score || 0;
    const circ       = 2 * Math.PI * 36;
    const dash       = (score / 100) * circ;
    const scoreColor = score >= 70 ? "#4ade80" : score >= 40 ? "#fbbf24" : "#f87171";

    const milestones = (d.milestones || []).map(m =>
      '<div class="milestone-chip">' + m.icon + '<span>' + m.label + '</span><small>' + m.desc + '</small></div>'
    ).join("") || '<span style="font-size:11px;color:var(--muted)">Chat more to unlock milestones!</span>';

    const letter = d.letter
      ? '<div class="letter-card"><div class="letter-tag">✉️ Letter from your past self</div>"' + d.letter + '"</div>'
      : '<div class="letter-card"><div class="letter-tag">✉️ Letter from your past self</div>"Chat for a few more days and I\'ll write you a personal letter. 💙"</div>';

    const em = EMOTION_MAP[d.dominant_emotion] || EMOTION_MAP.general;

    el.innerHTML =
      '<div class="dna-grid">'
      + '<div class="dna-card" style="flex-direction:row;align-items:center;gap:16px;">'
      + '<div class="growth-ring"><svg width="90" height="90" viewBox="0 0 90 90">'
      + '<circle cx="45" cy="45" r="36" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="7"/>'
      + '<circle cx="45" cy="45" r="36" fill="none" stroke="' + scoreColor + '" stroke-width="7" stroke-dasharray="' + dash + ' ' + circ + '" stroke-linecap="round" style="transform:rotate(-90deg);transform-origin:45px 45px"/>'
      + '</svg><div class="growth-ring-label"><div class="growth-ring-num" style="color:' + scoreColor + '">' + score + '</div><div class="growth-ring-sub">growth</div></div></div>'
      + '<div style="flex:1"><div class="dna-card-title">Your Archetype</div>'
      + '<div class="archetype-name">' + (d.archetype || "The Explorer") + '</div>'
      + '<div class="archetype-desc">' + (d.archetype_desc || "") + '</div></div></div>'
      + '<div class="dna-card"><div class="dna-card-title">Your Stats</div>'
      + '<div class="dna-stat"><span>Total Messages</span><span class="dna-stat-val">' + d.total_messages + '</span></div>'
      + '<div class="dna-stat"><span>Active Days</span><span class="dna-stat-val">'    + d.active_days    + '</span></div>'
      + '<div class="dna-stat"><span>Dominant Emotion</span><span class="dna-stat-val">' + em.emoji + " " + d.dominant_emotion + '</span></div>'
      + '<div class="dna-stat"><span>Journey Since</span><span class="dna-stat-val">'  + (d.first_chat_date || "Today") + '</span></div></div>'
      + '<div class="dna-card dna-card full"><div class="dna-card-title">Milestones Unlocked</div>'
      + '<div class="milestone-row">' + milestones + '</div></div>'
      + letter
      + '</div>';
  } catch(e) {
    el.innerHTML = '<div class="no-data">Failed to load Emotional DNA.</div>';
  }
}

// ─── AI MEMORY ────────────────────────────────────────────────────
async function loadMemory() {
  if (!currentUser) return;
  const el = document.getElementById("memoryContent");
  el.innerHTML = '<div class="no-data">Loading your memories…</div>';
  try {
    const res  = await fetch("/api/memory/get/" + encodeURIComponent(currentUser));
    const data = await res.json();
    const memories = data.memories || [];

    if (memories.length === 0) {
      el.innerHTML = '<div class="no-data">No memories yet — start chatting! 🌱</div>';
      return;
    }

    const emotionGroups = {};
    memories.forEach(m => {
      const k = m.emotion || "general";
      emotionGroups[k] = (emotionGroups[k] || 0) + 1;
    });
    const topEmotion = Object.entries(emotionGroups).sort((a, b) => b[1] - a[1])[0];

    const statsHtml =
      '<div class="memory-stats-row">'
      + '<div class="memory-stat"><div class="memory-stat-val">' + data.total + '</div><div class="memory-stat-label">Memories stored</div></div>'
      + '<div class="memory-stat"><div class="memory-stat-val">' + (topEmotion ? (EMOTION_EMOJI_MAP[topEmotion[0]] || "💬") : "💬") + '</div><div class="memory-stat-label">Most felt: ' + (topEmotion ? topEmotion[0] : "—") + '</div></div>'
      + '<div class="memory-stat"><div class="memory-stat-val">✓</div><div class="memory-stat-label">Used in every chat</div></div></div>';

    const timelineHtml = memories.map(m => {
      const em    = EMOTION_MAP[EMOTION_NORMALIZE[m.emotion] || m.emotion] || EMOTION_MAP.general;
      const color = EMOTION_COLORS[EMOTION_NORMALIZE[m.emotion] || m.emotion] || "#7c6aff";
      const ts    = new Date(m.created_at).toLocaleString("en-IN", {month:"short", day:"numeric", hour:"2-digit", minute:"2-digit"});
      return '<div class="memory-item">'
        + '<div class="memory-emotion-dot" style="background:' + color + '22;border:1px solid ' + color + '44;">' + em.emoji + '</div>'
        + '<div class="memory-body">'
        + '<div class="memory-insight">'  + m.insight + '</div>'
        + '<div class="memory-meta">'     + ts + " · " + em.label + '</div>'
        + (m.source_message ? '<div class="memory-source">"' + m.source_message.substring(0, 60) + (m.source_message.length > 60 ? "…" : "") + '</div>' : "")
        + '</div></div>';
    }).join("");

    el.innerHTML =
      statsHtml
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">'
      + '<span style="font-size:12px;font-weight:600;color:var(--text);">Memory Timeline</span>'
      + '<button class="memory-clear-btn" onclick="clearMemories()">🗑 Clear all</button></div>'
      + '<div class="memory-timeline">' + timelineHtml + '</div>';
  } catch(e) {
    el.innerHTML = '<div class="no-data">Failed to load memories.</div>';
  }
}

async function clearMemories() {
  if (!currentUser || !confirm("Clear all memories? This cannot be undone.")) return;
  try {
    await fetch("/api/memory/clear/" + encodeURIComponent(currentUser), {method:"DELETE"});
    cachedMemories = [];
    loadMemory();
  } catch(e) {}
}

// ─── AVATAR PANEL ─────────────────────────────────────────────────
const AVATAR_MOUTH_SHAPES = {
  idle:  "M 90 138 Q 110 152 130 138",
  talk1: "M 90 135 Q 110 156 130 135",
  talk2: "M 90 140 Q 110 148 130 140",
  sad:   "M 90 148 Q 110 136 130 148",
};

let avatarMicActive   = false;
let avatarRecognition = null;
let avatarTalkTimer   = null;

function setAvatarMouth(shape) {
  const el = document.getElementById("avatarMouth");
  if (el) el.setAttribute("d", AVATAR_MOUTH_SHAPES[shape] || AVATAR_MOUTH_SHAPES.idle);
}

function setAvatarStatus(state, text) {
  const badge = document.getElementById("avatarStatusBadge");
  if (!badge) return;
  badge.className = "avatar-status-badge"
    + (state === "talking" ? " talking" : state === "thinking" ? " thinking" : "");
  badge.textContent = text;
}

function startAvatarTalk() {
  let toggle = false;
  avatarTalkTimer = setInterval(() => {
    setAvatarMouth(toggle ? "talk1" : "talk2");
    toggle = !toggle;
  }, 110);
  setAvatarStatus("talking", "● Speaking…");
}

function stopAvatarTalk() {
  if (avatarTalkTimer) { clearInterval(avatarTalkTimer); avatarTalkTimer = null; }
  setAvatarMouth("idle");
  setAvatarStatus("ready", "● Ready to talk");
}

function speakAvatar(text) {
  if (!window.speechSynthesis) { stopAvatarTalk(); return; }
  window.speechSynthesis.cancel();
  startAvatarTalk();
  const utt   = new SpeechSynthesisUtterance(text);
  utt.rate    = 0.92;
  utt.pitch   = 1.1;
  utt.onend   = () => stopAvatarTalk();
  utt.onerror = () => stopAvatarTalk();
  window.speechSynthesis.speak(utt);
}

function addAvatarMessage(role, text) {
  const container = document.getElementById("avatarMessages");
  const div = document.createElement("div");
  div.className  = "avatar-msg " + role;
  div.textContent = text;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

async function sendAvatarMessage() {
  const input = document.getElementById("avatarInput");
  const text  = input.value.trim();
  if (!text || !currentUser) return;
  input.value = "";
  input.style.height = "auto";
  document.getElementById("avatarSendBtn").disabled = true;
  addAvatarMessage("user", text);
  setAvatarStatus("thinking", "● Thinking…");

  const emotion = detectEmotionFromText(text);
  try {
    const res  = await fetch("/api/avatar/chat", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({user_name: currentUser, message: text, emotion})
    });
    const data = await res.json();
    addAvatarMessage("ai", data.response);
    speakAvatar(data.response);
  } catch(e) {
    addAvatarMessage("ai", "I'm here with you. 💙");
    stopAvatarTalk();
  }
  document.getElementById("avatarSendBtn").disabled = false;
}

function handleAvatarKey(e) {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendAvatarMessage(); }
}

function toggleAvatarMic() {
  const btn = document.getElementById("avatarMicBtn");
  if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) return;
  if (avatarMicActive) {
    if (avatarRecognition) avatarRecognition.stop();
    avatarMicActive = false;
    btn.classList.remove("active");
    return;
  }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  avatarRecognition = new SR();
  avatarRecognition.lang = "en-US";
  avatarRecognition.interimResults = false;
  avatarRecognition.onresult = e => {
    document.getElementById("avatarInput").value = e.results[0][0].transcript;
    avatarMicActive = false;
    btn.classList.remove("active");
    sendAvatarMessage();
  };
  avatarRecognition.onerror = () => { avatarMicActive = false; btn.classList.remove("active"); };
  avatarRecognition.onend   = () => { avatarMicActive = false; btn.classList.remove("active"); };
  avatarRecognition.start();
  avatarMicActive = true;
  btn.classList.add("active");
}

function initAvatarPanel() {
  setAvatarMouth("idle");
  const memBadge = document.getElementById("avatarMemoryBadge");
  if (memBadge) {
    memBadge.textContent = cachedMemories.length > 0
      ? "🧠 " + cachedMemories.length + " memories loaded"
      : "🌱 Start chatting to build Aria's memory";
  }
  const container = document.getElementById("avatarMessages");
  if (container && container.children.length === 0) {
    addAvatarMessage("ai", "Hi there! I'm Aria, your emotional companion. 💜 How are you feeling right now?");
  }
}