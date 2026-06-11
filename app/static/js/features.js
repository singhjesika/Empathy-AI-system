const ENVIRONMENTS = {
  anxious: { label: "Anxious", emoji: "🌧️", bg: "linear-gradient(135deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%)", accent: "#4fc3f7", particle: "💧", particleCount: 28, ambience: "Calm Rain", message: "Breathe… you are safe here.", musicEmoji: "🎵", musicLabel: "Rain Sounds", overlay: "rgba(15,52,96,0.55)", glowColor: "#4fc3f7", bgAnimation: "rain" },
  lonely: { label: "Lonely", emoji: "🌅", bg: "linear-gradient(160deg, #2d1b69 0%, #11998e 60%, #f7971e 100%)", accent: "#ffcc80", particle: "✨", particleCount: 18, ambience: "Warm Sunset Room", message: "You are never truly alone. I'm here.", musicEmoji: "🎶", musicLabel: "Gentle Piano", overlay: "rgba(45,27,105,0.4)", glowColor: "#ffcc80", bgAnimation: "float" },
  stressed: { label: "Stressed", emoji: "🌿", bg: "linear-gradient(135deg, #0a2e0a 0%, #1b5e20 50%, #2e7d32 100%)", accent: "#a5d6a7", particle: "🍃", particleCount: 22, ambience: "Breathing Forest", message: "Let the forest hold your tension.", musicEmoji: "🌲", musicLabel: "Forest Breeze", overlay: "rgba(10,46,10,0.5)", glowColor: "#a5d6a7", bgAnimation: "sway" },
  motivated: { label: "Motivated", emoji: "⚡", bg: "linear-gradient(135deg, #0a0a0a 0%, #1a0533 50%, #0d0d2b 100%)", accent: "#e040fb", particle: "⚡", particleCount: 30, ambience: "Neon Productivity World", message: "You're unstoppable. Build something great.", musicEmoji: "🎧", musicLabel: "Lo-fi Beats", overlay: "rgba(10,10,10,0.4)", glowColor: "#e040fb", bgAnimation: "neon" },
  depressed: { label: "Depressed", emoji: "🌙", bg: "linear-gradient(160deg, #0d0d1a 0%, #1a1a2e 50%, #2d2d44 100%)", accent: "#ce93d8", particle: "🌸", particleCount: 14, ambience: "Soft Healing Atmosphere", message: "This feeling is temporary. You matter.", musicEmoji: "💜", musicLabel: "Healing Tones", overlay: "rgba(13,13,26,0.5)", glowColor: "#ce93d8", bgAnimation: "pulse" },
  happy: { label: "Happy", emoji: "☀️", bg: "linear-gradient(135deg, #f8b500 0%, #ff6b6b 40%, #ee0979 100%)", accent: "#fff176", particle: "🌟", particleCount: 25, ambience: "Golden Joy Field", message: "This joy is real. Savour every second.", musicEmoji: "🎉", musicLabel: "Upbeat Acoustic", overlay: "rgba(248,181,0,0.15)", glowColor: "#fff176", bgAnimation: "sparkle" },
  calm: { label: "Calm", emoji: "🌊", bg: "linear-gradient(160deg, #004d7a 0%, #008793 50%, #00bf72 100%)", accent: "#b2dfdb", particle: "〰️", particleCount: 16, ambience: "Ocean Stillness", message: "Peace lives in this moment.", musicEmoji: "🌊", musicLabel: "Ocean Waves", overlay: "rgba(0,77,122,0.4)", glowColor: "#b2dfdb", bgAnimation: "wave" },
};

const FUTURE_SELVES = [
  { id: "6months", label: "6 Months Later", emoji: "🌱", color: "#4ade80", desc: "Growth & healing" },
  { id: "burnout_recovery", label: "After Burnout Recovery", emoji: "🔥→✨", color: "#fb923c", desc: "Rebuilt stronger" },
  { id: "successful", label: "Future Successful You", emoji: "🏆", color: "#fbbf24", desc: "Thriving & fulfilled" },
  { id: "depressed_warning", label: "Warning: Dark Path", emoji: "⚠️", color: "#f87171", desc: "If you ignore yourself" },
  { id: "confident", label: "Future Confident You", emoji: "💎", color: "#a78bfa", desc: "Fully self-realized" },
];

let detectedEmotion = "calm";
let envActive = false;
let selectedSelf = null;
let futureProfile = null;
let futureMessages = [];
let profileStep = "context";
let userContext = "";
let avatarMicActive = false;
let avatarRecognition = null;

function getEnv() { return ENVIRONMENTS[detectedEmotion]; }

function parseJSON(raw) {
  try {
    const cleaned = raw.replace(/```json|```/g, "").trim();
    return JSON.parse(cleaned);
  } catch (e) {
    console.error("JSON parse failed:", raw);
    return null;
  }
}

async function callGroq(systemPrompt, userPrompt, maxTokens = 1000) {
  const key = GROQ_API_KEY;
  if (!key) { console.error("Groq API key not found."); return null; }
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + key },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: maxTokens,
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.choices[0].message.content;
}

async function callGroqWithHistory(systemPrompt, messages, maxTokens = 400) {
  const key = GROQ_API_KEY;
  if (!key) { console.error("Groq API key not found."); return null; }
  const history = [{ role: "system", content: systemPrompt }, ...messages];
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + key },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: history,
      temperature: 0.7,
      max_tokens: maxTokens,
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.choices[0].message.content;
}

async function detectEmotion(text) {
  const raw = await callGroq(
    "You are an emotion detection AI. Always respond with only one single word.",
    "Analyze the emotional state in this text and return ONLY one word from this list: anxious, lonely, stressed, motivated, depressed, happy, calm.\n\nText: \"" + text + "\"\n\nReturn only the single word, nothing else.",
    20
  );
  if (!raw) return;
  const emotion = raw.toLowerCase().match(/anxious|lonely|stressed|motivated|depressed|happy|calm/)?.[0];
  if (!emotion) return;
  if (ENVIRONMENTS[emotion]) { detectedEmotion = emotion; envActive = true; }
}

async function loadHistory() {
  const el = document.getElementById("historyContent");
  if (!el) return;
  if (!currentUser) { el.innerHTML = '<div class="no-data">Please log in first.</div>'; return; }
  el.innerHTML = '<div class="feature-loading"><div class="dot"></div><div class="dot"></div><div class="dot"></div><span>Loading history…</span></div>';
  try {
    const res  = await fetch("/api/history/" + encodeURIComponent(currentUser));
    const data = await res.json();
    if (!data.history || data.history.length === 0) {
      el.innerHTML = '<div class="no-data">No conversation history yet. Start chatting!</div>';
      return;
    }
    el.innerHTML = data.history.map(h => {
      const em = EMOTION_MAP[EMOTION_NORMALIZE[h.emotion] || h.emotion] || EMOTION_MAP.general;
      return '<div class="weekly-card" style="margin-bottom:10px;">'
        + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">'
        + '<span class="emotion-tag">' + em.emoji + ' ' + em.label + '</span>'
        + '<span style="font-size:10px;color:var(--muted);">' + new Date(h.timestamp).toLocaleString() + '</span>'
        + '</div>'
        + '<div style="font-size:12px;color:var(--muted);margin-bottom:4px;">You:</div>'
        + '<div style="font-size:13px;margin-bottom:8px;">' + h.user_message + '</div>'
        + '<div style="font-size:12px;color:var(--muted);margin-bottom:4px;">AI:</div>'
        + '<div style="font-size:13px;color:var(--text);">' + h.ai_response + '</div>'
        + '</div>';
    }).join("");
  } catch(e) {
    el.innerHTML = '<div class="no-data">Failed to load history.</div>';
  }
}

async function loadCharts() {
  if (!currentUser) return;
  try {
    const res  = await fetch("/api/mood-data/" + encodeURIComponent(currentUser));
    const data = await res.json();

    if (doughnutChartInst) { doughnutChartInst.destroy(); doughnutChartInst = null; }
    if (lineChartInst)     { lineChartInst.destroy();     lineChartInst = null; }

    const dCtx = document.getElementById("doughnutChart");
    const lCtx = document.getElementById("lineChart");
    if (!dCtx || !lCtx) return;

    const summary  = data.summary  || [];
    const timeline = data.timeline || [];
    const emotions = summary.map(d => d.emotion);
    const counts   = summary.map(d => d.count);
    const colors   = emotions.map(e => EMOTION_COLORS[e] || "#7C4DFF");
    const labels   = emotions.map(e => (EMOTION_MAP[e] || { label: e }).label);

    if (emotions.length) {
      doughnutChartInst = new Chart(dCtx, {
        type: "doughnut",
        data: {
          labels,
          datasets: [{
            data: counts,
            backgroundColor: colors.map(c => c + "CC"),
            borderColor:     colors,
            borderWidth:     3,
            hoverBackgroundColor: colors,
            hoverBorderColor:    "#ffffff",
            hoverBorderWidth:    2,
            hoverOffset:         12,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: "65%",
          plugins: {
            legend: {
              position: "bottom",
              labels: {
                color: "#e8e8f0",
                font: { family: "Sora", size: 11 },
                padding: 16,
                usePointStyle: true,
                pointStyleWidth: 10,
              }
            },
            tooltip: {
              backgroundColor: "rgba(10,10,20,0.9)",
              borderColor: "rgba(255,255,255,0.1)",
              borderWidth: 1,
              titleColor: "#fff",
              bodyColor: "#aaa",
              padding: 12,
              callbacks: {
                label: ctx => `  ${ctx.label}: ${ctx.parsed} sessions`
              }
            }
          }
        }
      });
    } else {
      dCtx.parentElement.innerHTML = '<div class="no-data">Chat more to see your emotion distribution!</div>';
    }

    const timeLabels = timeline.map(t => t.created_at ? t.created_at.slice(0, 10) : "");
    const moodScores = timeline.map(t => t.mood_score ?? 0.5);
    const lineCtx2d  = lCtx.getContext("2d");
    const gradient   = lineCtx2d.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0,   "rgba(255,107,157,0.35)");
    gradient.addColorStop(0.5, "rgba(124,106,255,0.15)");
    gradient.addColorStop(1,   "rgba(0,229,255,0.02)");

    if (timeline.length) {
      lineChartInst = new Chart(lCtx, {
        type: "line",
        data: {
          labels: timeLabels,
          datasets: [{
            label: "Mood Score",
            data: moodScores,
            borderColor: "#FF6B9D",
            backgroundColor: gradient,
            tension: 0.45,
            fill: true,
            pointBackgroundColor: moodScores.map(s =>
              s >= 0.7 ? "#FFD700" : s >= 0.4 ? "#FF9100" : "#FF4444"
            ),
            pointBorderColor:          "#0a0a1a",
            pointBorderWidth:          2,
            pointRadius:               5,
            pointHoverRadius:          9,
            pointHoverBackgroundColor: "#FFFFFF",
            pointHoverBorderColor:     "#FF6B9D",
            pointHoverBorderWidth:     2,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: "index", intersect: false },
          plugins: {
            legend: {
              labels: {
                color: "#e8e8f0",
                font: { family: "Sora", size: 11 },
                usePointStyle: true,
              }
            },
            tooltip: {
              backgroundColor: "rgba(10,10,20,0.92)",
              borderColor: "#FF6B9D44",
              borderWidth: 1,
              titleColor: "#FF6B9D",
              bodyColor:  "#ccc",
              padding: 12,
              callbacks: {
                label: ctx => {
                  const val = ctx.parsed.y;
                  const mood = val >= 0.7 ? "😊 Positive" : val >= 0.4 ? "😐 Neutral" : "😔 Difficult";
                  return `  Score: ${(val * 100).toFixed(0)}%  ${mood}`;
                }
              }
            }
          },
          scales: {
            x: {
              ticks: { color: "#9090B0", font: { size: 10, family: "Sora" }, maxRotation: 45 },
              grid:  { color: "rgba(255,255,255,0.04)" },
              border:{ color: "rgba(255,255,255,0.08)" }
            },
            y: {
              min: 0, max: 1,
              ticks: { color: "#9090B0", font: { size: 10 }, callback: v => (v*100).toFixed(0)+"%" },
              grid:  { color: "rgba(255,255,255,0.06)" },
              border:{ color: "rgba(255,255,255,0.08)" }
            }
          }
        }
      });
    } else {
      lCtx.parentElement.innerHTML = '<div class="no-data">Chat more to build your mood timeline!</div>';
    }

  } catch(e) {
    console.error("Chart load failed:", e);
  }
}

async function loadCalendar() {
  const grid   = document.getElementById("calendarGrid");
  const legend = document.getElementById("calendarLegend");
  if (!grid || !currentUser) return;
  grid.innerHTML = '<div class="no-data">Loading…</div>';
  try {
    const res  = await fetch("/api/mood-calendar/" + encodeURIComponent(currentUser));
    const data = await res.json();
    const raw  = data.calendar || [];
    const days = {};
    raw.forEach(e => { days[e.date] = { emotion: e.emotion, count: e.count }; });
    const now   = new Date();
    const year  = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay    = new Date(year, month, 1).getDay();

    const legendEmotions = [...new Set(Object.values(days).map(d => d.emotion).filter(Boolean))];
    legend.innerHTML = legendEmotions.map(e => {
      const em = EMOTION_MAP[e] || EMOTION_MAP.general;
      const color = EMOTION_COLORS[e] || "#7c6aff";
      return '<span style="font-size:10px;display:flex;align-items:center;gap:4px;"><span style="width:8px;height:8px;border-radius:50%;background:' + color + ';display:inline-block;"></span>' + em.emoji + ' ' + em.label + '</span>';
    }).join("");

    grid.innerHTML = "";
    for (let i = 0; i < firstDay; i++) {
      const blank = document.createElement("div");
      blank.className = "cal-day";
      blank.style.opacity = "0.1";
      grid.appendChild(blank);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const key  = year + "-" + String(month + 1).padStart(2,"0") + "-" + String(d).padStart(2,"0");
      const info = days[key];
      const cell = document.createElement("div");
      cell.className = "cal-day";
      cell.textContent = d;
      if (info) {
        const color = EMOTION_COLORS[info.emotion] || "#7c6aff";
        cell.style.background = color + "33";
        cell.style.borderColor = color + "66";
        cell.title = (EMOTION_MAP[info.emotion] || {label:info.emotion}).label;
      }
      grid.appendChild(cell);
    }
  } catch(e) {
    grid.innerHTML = '<div class="no-data">Could not load calendar.</div>';
  }
}

async function loadWeekly() {
  const el = document.getElementById("weeklyContent");
  if (!el || !currentUser) return;
  el.innerHTML = '<div class="feature-loading"><div class="dot"></div><div class="dot"></div><div class="dot"></div><span>Generating weekly report…</span></div>';
  try {
    const res  = await fetch("/api/weekly-report/" + encodeURIComponent(currentUser));
    const data = await res.json();
    if (!data || data.error) { el.innerHTML = '<div class="no-data">Not enough data for a weekly report yet.</div>'; return; }

    const topEmotionObj     = data.emotions && data.emotions.length ? data.emotions[0] : null;
    const topEmotionKey     = topEmotionObj ? topEmotionObj.emotion : null;
    const topEmotionDisplay = topEmotionKey
      ? (EMOTION_MAP[topEmotionKey] ? EMOTION_MAP[topEmotionKey].emoji + " " + EMOTION_MAP[topEmotionKey].label : topEmotionKey)
      : "—";

    const daily = data.daily || [];
    let trend = "→ Stable";
    if (daily.length >= 2) {
      const first = daily[0].total;
      const last  = daily[daily.length - 1].total;
      trend = last > first ? "↑ Improving" : last < first ? "↓ Harder" : "→ Stable";
    }

    const ws      = data.wellness_score || 0;
    const wsColor = ws >= 70 ? "#69FF47" : ws >= 40 ? "#FF9100" : "#FF4444";

    el.innerHTML =
      '<div class="weekly-card">'
      + '<div style="font-size:15px;font-weight:700;margin-bottom:12px;">📊 Week Overview</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">'
      + '<div style="background:var(--bg);border-radius:10px;padding:12px;"><div style="font-size:10px;color:var(--muted);">Total Sessions</div>'
      + '<div style="font-size:22px;font-weight:700;color:#7C4DFF;">' + (data.total_chats || 0) + '</div></div>'
      + '<div style="background:var(--bg);border-radius:10px;padding:12px;"><div style="font-size:10px;color:var(--muted);">Top Emotion</div>'
      + '<div style="font-size:18px;font-weight:700;">' + topEmotionDisplay + '</div></div>'
      + '<div style="background:var(--bg);border-radius:10px;padding:12px;"><div style="font-size:10px;color:var(--muted);">Wellness Score</div>'
      + '<div style="font-size:22px;font-weight:700;color:' + wsColor + ';">' + ws + '/100</div></div>'
      + '<div style="background:var(--bg);border-radius:10px;padding:12px;"><div style="font-size:10px;color:var(--muted);">Mood Trend</div>'
      + '<div style="font-size:18px;font-weight:700;">' + trend + '</div></div>'
      + '</div></div>'

      + '<div class="weekly-card"><div style="font-size:13px;font-weight:700;margin-bottom:12px;">🎭 Emotion Breakdown</div>'
      + (data.emotions || []).map(e => {
          const color = EMOTION_COLORS[e.emotion] || "#7C4DFF";
          const pct   = Math.round((e.count / (data.total_chats || 1)) * 100);
          const em    = EMOTION_MAP[e.emotion] || { emoji: "💬", label: e.emotion };
          return '<div style="margin-bottom:10px;">'
            + '<div style="display:flex;justify-content:space-between;margin-bottom:4px;">'
            + '<span style="font-size:12px;">' + em.emoji + ' ' + em.label + '</span>'
            + '<span style="font-size:11px;color:' + color + ';font-weight:600;">' + pct + '% (' + e.count + ')</span></div>'
            + '<div style="height:6px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden;">'
            + '<div style="width:' + pct + '%;height:100%;background:' + color + ';border-radius:3px;box-shadow:0 0 8px ' + color + '88;"></div></div></div>';
        }).join("")
      + '</div>'

      + '<div class="weekly-card"><div style="font-size:13px;font-weight:700;margin-bottom:12px;">📅 Daily Activity</div>'
      + '<div style="display:flex;align-items:flex-end;gap:8px;height:90px;">'
      + daily.map(d => {
          const maxTotal = Math.max(...daily.map(x => x.total), 1);
          const h = Math.round((d.total / maxTotal) * 70);
          return '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;">'
            + '<div style="font-size:10px;color:#7C4DFF;font-weight:600;">' + d.total + '</div>'
            + '<div style="width:100%;height:' + h + 'px;background:linear-gradient(180deg,#7C4DFF,#FF6B9D);border-radius:4px 4px 0 0;box-shadow:0 0 10px #7C4DFF66;"></div>'
            + '<div style="font-size:9px;color:var(--muted);">' + d.day.slice(5) + '</div></div>';
        }).join("")
      + '</div></div>'

      + '<div class="weekly-card" style="display:flex;gap:10px;">'
      + '<div style="flex:1;background:rgba(105,255,71,0.07);border:1px solid rgba(105,255,71,0.2);border-radius:10px;padding:12px;">'
      + '<div style="font-size:10px;color:#69FF47;margin-bottom:4px;">🏆 Best Day</div>'
      + '<div style="font-size:13px;font-weight:600;">' + (data.best_day || "—") + '</div></div>'
      + '<div style="flex:1;background:rgba(255,107,157,0.07);border:1px solid rgba(255,107,157,0.2);border-radius:10px;padding:12px;">'
      + '<div style="font-size:10px;color:#FF6B9D;margin-bottom:4px;">📌 Note</div>'
      + '<div style="font-size:13px;font-weight:600;">' + (data.worst_day || "—") + '</div></div>'
      + '</div>';

  } catch(e) {
    el.innerHTML = '<div class="no-data">Could not load weekly report.</div>';
  }
}

async function loadQuote() {
  const el = document.getElementById("quoteText");
  if (!el) return;
  el.textContent = "Loading your quote…";
  try {
    const emotion = detectedEmotion || "calm";
    const raw = await callGroq(
      "You are an inspirational quote generator. Respond with ONLY the quote text, no author, no quotation marks, no extra text.",
      "Generate one short, powerful, emotionally resonant quote for someone feeling " + emotion + ". Maximum 2 sentences."
    );
    el.textContent = raw ? raw.trim() : "Every moment is a fresh beginning.";
  } catch(e) {
    el.textContent = "You are stronger than you think. Keep going.";
  }
}

async function loadForecast() {
  const el = document.getElementById("forecastContent");
  if (!el || !currentUser) return;
  el.innerHTML = '<div class="feature-loading"><div class="dot"></div><div class="dot"></div><div class="dot"></div><span>Generating your forecast…</span></div>';
  try {
    const res  = await fetch("/api/forecast/" + encodeURIComponent(currentUser));
    const data = await res.json();
    if (data.error || !data.forecast) {
      const raw = await callGroq(
        "You are an emotional wellness forecaster. Respond ONLY with valid JSON.",
        'Generate a 3-day emotional forecast. Respond with ONLY this JSON:\n{"days":[{"day":"Today","emoji":"😊","mood":"Reflective","energy":65,"advice":"Take time to journal your thoughts"},{"day":"Tomorrow","emoji":"🌤️","mood":"Improving","energy":72,"advice":"Connect with someone you trust"},{"day":"Day 3","emoji":"✨","mood":"Optimistic","energy":80,"advice":"Set one small achievable goal"}],"overall":"Your emotional energy is gradually building. Trust the process."}'
      );
      renderForecast(parseJSON(raw), el);
    } else {
      renderForecast(data.forecast, el);
    }
  } catch(e) {
    el.innerHTML = '<div class="no-data">Could not load forecast.</div>';
  }
}

function renderForecast(data, el) {
  if (!data || !data.days) { el.innerHTML = '<div class="no-data">No forecast available.</div>'; return; }
  el.innerHTML =
    '<div style="display:flex;flex-direction:column;gap:12px;">'
    + data.days.map(d =>
      '<div class="weekly-card" style="display:flex;align-items:center;gap:16px;">'
      + '<div style="font-size:36px;">' + d.emoji + '</div>'
      + '<div style="flex:1;">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;">'
      + '<span style="font-size:13px;font-weight:600;">' + d.day + '</span>'
      + '<span style="font-size:11px;color:var(--accent);">' + d.mood + '</span></div>'
      + '<div style="height:4px;background:var(--border);border-radius:2px;overflow:hidden;margin:6px 0;">'
      + '<div style="width:' + d.energy + '%;height:100%;background:linear-gradient(90deg,var(--accent),var(--accent2));border-radius:2px;"></div></div>'
      + '<div style="font-size:11px;color:var(--muted);">' + d.advice + '</div>'
      + '</div></div>'
    ).join("")
    + (data.overall ? '<div class="weekly-card"><div style="font-size:13px;line-height:1.7;color:var(--text);font-style:italic;">"' + data.overall + '"</div></div>' : '')
    + '</div>';
}

async function loadDna() {
  const el = document.getElementById("dnaContent");
  if (!el || !currentUser) return;
  el.innerHTML = '<div class="feature-loading"><div class="dot"></div><div class="dot"></div><div class="dot"></div><span>Mapping your Emotional DNA…</span></div>';
  try {
    const raw = await callGroq(
      "You are an emotional psychology expert. Respond ONLY with valid JSON.",
      'Generate an emotional DNA profile for a user. Respond with ONLY this JSON:\n{"archetype":"The Empathetic Warrior","core_traits":["Deeply empathetic","Resilient under pressure","Overthinks decisions"],"emotional_strengths":["Strong intuition","Natural caregiver","Deep loyalty"],"emotional_challenges":["Boundary setting","Self-criticism","Fear of abandonment"],"communication_style":"Heart-led communicator","stress_response":"Internalizes before expressing","healing_style":"Needs quiet reflection + meaningful connection","color":"#7c6aff","element":"Water","season":"Autumn"}'
    );
    const data = parseJSON(raw);
    if (!data) { el.innerHTML = '<div class="no-data">Could not generate DNA profile.</div>'; return; }
    el.innerHTML =
      '<div class="result-card">'
      + '<div style="text-align:center;padding:16px 0;">'
      + '<div style="font-size:48px;margin-bottom:8px;">🧬</div>'
      + '<div style="font-size:20px;font-weight:700;color:' + (data.color || "var(--accent)") + ';">' + data.archetype + '</div>'
      + '<div style="display:flex;justify-content:center;gap:12px;margin-top:8px;">'
      + '<span class="result-tag result-tag-accent">🌊 ' + data.element + '</span>'
      + '<span class="result-tag result-tag-accent">🍂 ' + data.season + '</span></div></div>'
      + '<div class="result-section-title">Core Traits</div>'
      + '<div style="display:flex;flex-wrap:wrap;gap:4px;">' + (data.core_traits || []).map(t => '<span class="result-tag result-tag-accent">◆ ' + t + '</span>').join("") + '</div>'
      + '<div class="result-section-title">💪 Emotional Strengths</div>'
      + '<div style="display:flex;flex-wrap:wrap;gap:4px;">' + (data.emotional_strengths || []).map(s => '<span class="result-tag result-tag-success">✓ ' + s + '</span>').join("") + '</div>'
      + '<div class="result-section-title">🌱 Growth Areas</div>'
      + '<div style="display:flex;flex-wrap:wrap;gap:4px;">' + (data.emotional_challenges || []).map(c => '<span class="result-tag result-tag-warning">⚡ ' + c + '</span>').join("") + '</div>'
      + '<div class="result-section-title">Communication Style</div>'
      + '<div style="font-size:13px;color:var(--text);line-height:1.6;">' + data.communication_style + '</div>'
      + '<div class="result-section-title">Stress Response</div>'
      + '<div style="font-size:13px;color:var(--text);line-height:1.6;">' + data.stress_response + '</div>'
      + '<div class="result-section-title">Healing Style</div>'
      + '<div style="font-size:13px;color:var(--text);line-height:1.6;">' + data.healing_style + '</div>'
      + '</div>';
  } catch(e) {
    el.innerHTML = '<div class="no-data">Could not load Emotional DNA.</div>';
  }
}

async function loadMemory() {
  const el = document.getElementById("memoryContent");
  if (!el || !currentUser) return;
  el.innerHTML = '<div class="feature-loading"><div class="dot"></div><div class="dot"></div><div class="dot"></div><span>Loading memories…</span></div>';
  try {
    const res  = await fetch("/api/memory/get/" + encodeURIComponent(currentUser));
    const data = await res.json();
    if (!data.memories || data.memories.length === 0) {
      el.innerHTML = '<div class="no-data">No memories stored yet. Keep chatting to build your memory bank!</div>';
      return;
    }
    el.innerHTML = data.memories.map(m =>
      '<div class="weekly-card" style="margin-bottom:10px;">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">'
      + '<span class="emotion-tag">' + (EMOTION_EMOJI_MAP[m.emotion] || "💬") + ' ' + m.emotion + '</span>'
      + '<span style="font-size:10px;color:var(--muted);">' + new Date(m.created_at).toLocaleDateString() + '</span></div>'
      + '<div style="font-size:13px;color:var(--text);line-height:1.6;">' + m.insight + '</div>'
      + '</div>'
    ).join("");
  } catch(e) {
    el.innerHTML = '<div class="no-data">Could not load memories.</div>';
  }
}

async function generateJournal() {
  const el  = document.getElementById("journalContent");
  const btn = document.getElementById("journalGenBtn");
  if (!el || !currentUser) return;
  btn.disabled = true;
  btn.textContent = "✍️ Writing…";
  el.innerHTML = '<div class="feature-loading"><div class="dot"></div><div class="dot"></div><div class="dot"></div><span>Writing your journal entry…</span></div>';
  try {
    const raw = await callGroq(
      "You are a compassionate AI journaling assistant. Write in first person as if you are the user.",
      "Write a reflective, emotionally intelligent diary entry for today based on the emotional state: " + detectedEmotion + ". Make it personal, healing, and around 150 words. Start with today's date."
    );
    el.innerHTML = '<div class="journal-entry">' + (raw || "Could not generate entry.").replace(/\n/g, "<br>") + '</div>';
  } catch(e) {
    el.innerHTML = '<div class="no-data">Could not generate journal entry. Check your Groq API key.</div>';
  }
  btn.disabled = false;
  btn.textContent = "✍️ Generate Today's Entry";
}

async function initAvatarPanel() {
  const badge = document.getElementById("avatarMemoryBadge");
  const msgEl = document.getElementById("avatarMessages");
  if (!badge || !msgEl) return;
  if (!currentUser) { badge.textContent = "Log in to activate avatar memory."; return; }
  try {
    const res  = await fetch("/api/memory/get/" + encodeURIComponent(currentUser));
    const data = await res.json();
    const count = data.memories ? data.memories.length : 0;
    badge.textContent = "🧠 " + count + " memories loaded into Aria";
    if (msgEl.children.length === 0) {
      addAvatarMessage("ai", "Hey! I'm Aria 💜 I know your emotional journey. What's on your mind today?");
    }
  } catch(e) {
    badge.textContent = "Memory context unavailable.";
  }
}

function addAvatarMessage(role, text) {
  const el  = document.getElementById("avatarMessages");
  if (!el) return;
  const div = document.createElement("div");
  div.className = "msg-row " + (role === "ai" ? "" : "user");
  div.innerHTML =
    '<div class="avatar ' + (role === "ai" ? "ai" : "user") + '">' + (role === "ai" ? "🤖" : "😊") + '</div>'
    + '<div class="msg-content"><div class="bubble ' + (role === "ai" ? "ai" : "user") + '">' + text + '</div></div>';
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
}

async function sendAvatarMessage() {
  const input = document.getElementById("avatarInput");
  const btn   = document.getElementById("avatarSendBtn");
  const text  = input.value.trim();
  if (!text || !currentUser) return;
  input.value = "";
  input.style.height = "auto";
  btn.disabled = true;
  addAvatarMessage("user", text);
  const badge = document.getElementById("avatarStatusBadge");
  if (badge) badge.textContent = "● Thinking…";
  try {
    const memRes  = await fetch("/api/memory/get/" + encodeURIComponent(currentUser));
    const memData = await memRes.json();
    const memories = (memData.memories || []).slice(0, 5).map(m => m.insight).join("; ");
    const reply = await callGroq(
      "You are Aria, a warm, emotionally intelligent AI avatar companion. You have access to the user's emotional memories: " + (memories || "none yet") + ". Be empathetic, personal, and supportive. Keep responses to 2-3 sentences.",
      text
    );
    addAvatarMessage("ai", reply || "I'm here for you. Tell me more.");
    if (badge) badge.textContent = "● Ready to talk";
  } catch(e) {
    addAvatarMessage("ai", "I'm having trouble connecting right now. But I'm still here 💜");
    if (badge) badge.textContent = "● Ready to talk";
  }
  btn.disabled = false;
}

function handleAvatarKey(e) {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendAvatarMessage(); }
}

function toggleAvatarMic() {
  const btn = document.getElementById("avatarMicBtn");
  const inp = document.getElementById("avatarInput");

  if (avatarMicActive) {
    if (avatarRecognition) { avatarRecognition.abort(); avatarRecognition = null; }
    avatarMicActive = false;
    btn.textContent = "🎤";
    btn.classList.remove("active");
    return;
  }

  // Request mic permission explicitly first
  navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
      // Stop the stream — we just needed permission
      stream.getTracks().forEach(t => t.stop());

      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) { alert("Use Chrome for voice input."); return; }

      avatarRecognition = new SR();
      avatarRecognition.lang            = "en-US";
      avatarRecognition.continuous      = true;
      avatarRecognition.interimResults  = false;
      avatarRecognition.maxAlternatives = 3;

      let hasResult = false;

      avatarRecognition.onstart = () => {
        avatarMicActive = true;
        btn.textContent = "🔴";
        btn.classList.add("active");
        inp.placeholder = "🎤 Listening… speak now";
      };

      avatarRecognition.onspeechstart = () => {
        inp.placeholder = "🎤 Got you, keep talking…";
      };

      avatarRecognition.onresult = e => {
        hasResult = true;
        const t = e.results[e.results.length - 1][0].transcript;
        inp.value = t;
        autoResize(inp);
        // Stop after getting a result
        avatarRecognition.stop();
      };

      avatarRecognition.onspeechend = () => {
        avatarRecognition.stop();
      };

      avatarRecognition.onend = () => {
        avatarMicActive = false;
        btn.textContent = "🎤";
        btn.classList.remove("active");
        inp.placeholder = "Talk to Aria…";
        // Auto-send if we got something
        if (hasResult && inp.value.trim()) {
          sendAvatarMessage();
        } else if (!hasResult) {
          inp.placeholder = "Didn't catch that — tap 🎤 and try again";
          setTimeout(() => inp.placeholder = "Talk to Aria…", 3000);
        }
      };

      avatarRecognition.onerror = e => {
        console.log("Speech error:", e.error);
        avatarMicActive = false;
        btn.textContent = "🎤";
        btn.classList.remove("active");

        if (e.error === "no-speech") {
          inp.placeholder = "No speech heard — tap 🎤 and speak louder";
        } else if (e.error === "not-allowed") {
          inp.placeholder = "Mic blocked — check Chrome settings";
        } else if (e.error === "aborted") {
          inp.placeholder = "Talk to Aria…";
        } else {
          inp.placeholder = "Error: " + e.error + " — try again";
        }
        setTimeout(() => inp.placeholder = "Talk to Aria…", 3000);
      };

      try {
        avatarRecognition.start();
      } catch(err) {
        console.log("Start error:", err.message);
        avatarMicActive = false;
        btn.textContent = "🎤";
      }
    })
    .catch(err => {
      console.log("Mic permission error:", err);
      alert("Could not access microphone: " + err.message);
    });
}

async function runTimeMachine() {
  const input  = document.getElementById("timeMachineInput");
  const result = document.getElementById("timeMachineResult");
  const btn    = document.getElementById("timeMachineBtn");
  const text   = input ? input.value.trim() : "";
  if (!text) { alert("Please describe how you're feeling first."); return; }
  btn.disabled = true;
  btn.textContent = "⏳ Calculating futures…";
  result.innerHTML = '<div class="feature-loading"><div class="dot"></div><div class="dot"></div><div class="dot"></div><span>Simulating your futures…</span></div>';
  try {
    const raw = await callGroq(
      "You are a Future Self AI simulator. Respond ONLY with valid JSON.",
      'Based on this current state: "' + text + '"\n\nGenerate 3 possible futures. Respond ONLY with this JSON:\n{"futures":[{"title":"If You Heal","emoji":"🌱","timeframe":"6 months","mood":"Peaceful","description":"You sought help and made small changes daily. Your anxiety reduced by 60%. You sleep better, smile more.","probability":72,"color":"#4ade80"},{"title":"If Nothing Changes","emoji":"😔","timeframe":"6 months","mood":"Stuck","description":"The patterns continue. Fatigue deepens. But you are still here — and that matters.","probability":20,"color":"#fbbf24"},{"title":"If You Breakthrough","emoji":"🚀","timeframe":"1 year","mood":"Transformed","description":"You faced the hard thing. You rebuilt yourself. Life looks completely different now.","probability":60,"color":"#a78bfa"}],"message":"Your future is not fixed. Every small choice today shapes what becomes possible tomorrow."}'
    );
    const data = parseJSON(raw);
    if (!data || !data.futures) { result.innerHTML = '<div class="no-data">Could not simulate futures.</div>'; return; }
    result.innerHTML =
      '<div style="display:flex;flex-direction:column;gap:12px;margin-top:12px;">'
      + data.futures.map(f =>
        '<div class="weekly-card" style="border-left:3px solid ' + f.color + ';">'
        + '<div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">'
        + '<span style="font-size:28px;">' + f.emoji + '</span>'
        + '<div><div style="font-size:15px;font-weight:700;color:' + f.color + ';">' + f.title + '</div>'
        + '<div style="font-size:10px;color:var(--muted);">' + f.timeframe + ' · ' + f.mood + '</div></div>'
        + '<div style="margin-left:auto;text-align:center;">'
        + '<div style="font-size:18px;font-weight:700;color:' + f.color + ';">' + f.probability + '%</div>'
        + '<div style="font-size:9px;color:var(--muted);">likelihood</div></div></div>'
        + '<div style="font-size:12px;color:var(--text);line-height:1.65;">' + f.description + '</div>'
        + '</div>'
      ).join("")
      + '<div class="weekly-card" style="text-align:center;font-style:italic;font-size:13px;color:var(--text);line-height:1.7;">"' + data.message + '"</div>'
      + '</div>';
  } catch(e) {
    result.innerHTML = '<div class="no-data">Time machine failed. Check your Groq API key.</div>';
  }
  btn.disabled = false;
  btn.textContent = "⏳ Show My Futures";
}

async function loadDigitalTwin() {
  const result = document.getElementById("digitalTwinResult");
  const btn    = document.getElementById("digitalTwinBtn");
  if (!result) return;
  btn.disabled = true;
  btn.textContent = "🧬 Generating…";
  result.innerHTML = '<div class="feature-loading"><div class="dot"></div><div class="dot"></div><div class="dot"></div><span>Building your digital twin…</span></div>';
  try {
    const raw = await callGroq(
      "You are an emotional AI profiler. Respond ONLY with valid JSON.",
      'Generate an emotional digital twin profile. Respond ONLY with this JSON:\n{"twin_name":"Mirror Self","emotional_age":28,"attachment_style":"Anxious-Secure","core_wound":"Fear of not being enough","core_gift":"Extraordinary depth of feeling","blind_spot":"You minimize your own needs","pattern":"You give love the way you wish to receive it","inner_child":"Needs reassurance that they are lovable as they are","shadow_trait":"Tends toward self-abandonment","superpower":"Can feel the emotional truth of any room","current_chapter":"Unlearning","next_chapter":"Becoming","mirror_message":"The version of you reading this is already doing better than you think."}'
    );
    const data = parseJSON(raw);
    if (!data) { result.innerHTML = '<div class="no-data">Could not build digital twin.</div>'; return; }
    result.innerHTML =
      '<div class="result-card">'
      + '<div style="text-align:center;padding:12px 0;">'
      + '<div style="font-size:48px;">🪞</div>'
      + '<div style="font-size:20px;font-weight:700;color:var(--accent);margin-top:6px;">' + data.twin_name + '</div>'
      + '<div style="font-size:11px;color:var(--muted);margin-top:4px;">Emotional Age: ' + data.emotional_age + ' · ' + data.attachment_style + '</div></div>'
      + '<div class="result-section-title">Core Wound</div>'
      + '<div style="font-size:13px;color:var(--danger);line-height:1.6;">' + data.core_wound + '</div>'
      + '<div class="result-section-title">Core Gift</div>'
      + '<div style="font-size:13px;color:var(--success);line-height:1.6;">' + data.core_gift + '</div>'
      + '<div class="result-section-title">Your Pattern</div>'
      + '<div style="font-size:13px;color:var(--text);line-height:1.6;">' + data.pattern + '</div>'
      + '<div class="result-section-title">Blind Spot</div>'
      + '<div style="font-size:13px;color:var(--warning);line-height:1.6;">' + data.blind_spot + '</div>'
      + '<div class="result-section-title">Superpower</div>'
      + '<div style="font-size:13px;color:var(--accent);line-height:1.6;">' + data.superpower + '</div>'
      + '<div class="result-section-title">Inner Child Needs</div>'
      + '<div style="font-size:13px;color:var(--text);line-height:1.6;">' + data.inner_child + '</div>'
      + '<div style="display:flex;gap:8px;margin-top:4px;">'
      + '<span class="result-tag result-tag-warning">📖 Now: ' + data.current_chapter + '</span>'
      + '<span class="result-tag result-tag-success">✨ Next: ' + data.next_chapter + '</span></div>'
      + '<div style="background:rgba(124,106,255,0.08);border:1px solid rgba(124,106,255,0.25);border-radius:12px;padding:16px;margin-top:4px;font-size:13px;font-style:italic;line-height:1.8;text-align:center;color:var(--text);">💜 "' + data.mirror_message + '"</div>'
      + '</div>';
  } catch(e) {
    result.innerHTML = '<div class="no-data">Could not build digital twin. Check your Groq API key.</div>';
  }
  btn.disabled = false;
  btn.textContent = "🧬 Generate My Digital Twin";
}

async function generateFutureProfile() {
  if (!userContext.trim() || !selectedSelf) return;
  const raw = await callGroq(
    "You are a Future Self AI simulator. Always respond ONLY with valid JSON, no markdown.",
    "Based on the user's current state: \"" + userContext + "\"\nFuture Self Type: \"" + selectedSelf.label + "\" - " + selectedSelf.desc + "\n\nRespond ONLY with this JSON:\n{\"name\":\"short poetic name\",\"mood\":\"one word\",\"confidence\":75,\"stress\":40,\"growth\":80,\"year\":\"Late 2025\",\"opening\":\"A 2-3 sentence powerful opening message from this future self.\",\"traits\":[\"trait1\",\"trait2\",\"trait3\"],\"warning\":null}",
    600
  );
  if (!raw) return;
  futureProfile = parseJSON(raw);
  futureMessages = [{ role: "future", text: futureProfile.opening, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }];
  profileStep = "chat";
}

async function sendFutureMessage(inputText) {
  if (!inputText.trim() || !futureProfile) return null;
  futureMessages.push({ role: "user", text: inputText, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) });
  const history = futureMessages.map(m => ({ role: m.role === "future" ? "assistant" : "user", content: m.text }));
  const systemPrompt = "You ARE the user's Future Self: \"" + futureProfile.name + "\" (" + selectedSelf.label + "). The user's current state: \"" + userContext + "\". Traits: " + futureProfile.traits.join(", ") + ". Speak in first person with lived experience. Keep responses to 3-5 sentences. Never break character. " + (selectedSelf.id === "depressed_warning" ? "Warn gently but clearly." : "Offer hope and specific guidance.");
  const reply = await callGroqWithHistory(systemPrompt, history);
  if (!reply) return null;
  futureMessages.push({ role: "future", text: reply, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) });
  return reply;
}

function resetFuture() {
  profileStep = "context"; selectedSelf = null; futureProfile = null; futureMessages = []; userContext = "";
}

async function analyzeRelationship() {
  const conversation = document.getElementById("relConvInput").value.trim();
  const resultDiv = document.getElementById("relResult");
  const btn = document.getElementById("relAnalyzeBtn");
  if (!conversation) { alert("Please paste a conversation first!"); return; }
  btn.disabled = true; btn.textContent = "Analyzing… ⏳";
  resultDiv.innerHTML = '<div class="feature-loading"><div class="dot"></div><div class="dot"></div><div class="dot"></div><span>Reading emotional patterns…</span></div>';
  try {
    const raw = await callGroq(
      "You are an expert relationship therapist. Always respond ONLY with valid JSON, no markdown.",
      'Analyze this conversation:\n"""\n' + conversation + '\n"""\n\nRespond with ONLY this JSON:\n{"compatibility_score":72,"person_a_style":"Empathetic","person_b_style":"Avoidant","relationship_type":"Romantic","emotional_triggers":["feeling ignored"],"red_flags":["dismissive tone"],"strengths":["open expression"],"suggestions":["Practice active listening","Use I feel statements","Schedule check-ins"],"overall_health":"At Risk","summary":"One line summary"}'
    );
    if (!raw) return;
    renderRelationshipResult(parseJSON(raw), resultDiv);
  } catch(e) {
    resultDiv.innerHTML = '<div class="no-data">Analysis failed. Check your Groq API key.</div>';
  }
  btn.disabled = false; btn.textContent = "💞 Analyze Relationship";
}

async function detectBurnout() {
  const userInput = document.getElementById("burnoutInput").value.trim();
  const resultDiv = document.getElementById("burnoutResult");
  const btn = document.getElementById("burnoutCheckBtn");
  btn.disabled = true; btn.textContent = "Scanning… ⏳";
  resultDiv.innerHTML = '<div class="feature-loading"><div class="dot"></div><div class="dot"></div><div class="dot"></div><span>Analyzing burnout signals…</span></div>';
  try {
    const raw = await callGroq(
      "You are a burnout prevention specialist. Always respond ONLY with valid JSON.",
      "Assess burnout risk." + (userInput ? "\nDescription: \"" + userInput + "\"\n" : "\n") +
      'Respond with ONLY this JSON:\n{"risk_level":"High","risk_score":78,"trend":"worsening","warning_signs":["persistent fatigue","emotional numbness"],"root_causes":["overwork","lack of boundaries"],"message":"You are showing significant burnout signals.","immediate_actions":["Take a full day off this week","Go offline for 2 hours tonight","Say no to one commitment"],"week_plan":["Day 1: 30min walk","Day 2: Sleep earlier","Day 3: Share feelings","Day 4: Do one thing you love","Day 5: Rest without guilt"],"affirmation":"You are not a machine. Rest is productive."}'
    );
    if (!raw) return;
    renderBurnoutResult(parseJSON(raw), resultDiv);
  } catch(e) {
    resultDiv.innerHTML = '<div class="no-data">Detection failed. Check your Groq API key.</div>';
  }
  btn.disabled = false; btn.textContent = "🔥 Check My Burnout Risk";
}

async function getCareerSuggestions() {
  const userInput = document.getElementById("careerInput").value.trim();
  const resultDiv = document.getElementById("careerResult");
  const btn = document.getElementById("careerBtn");
  btn.disabled = true; btn.textContent = "Analyzing… ⏳";
  resultDiv.innerHTML = '<div class="feature-loading"><div class="dot"></div><div class="dot"></div><div class="dot"></div><span>Matching your emotional personality to careers…</span></div>';
  try {
    const raw = await callGroq(
      "You are an expert career counselor. Always respond ONLY with valid JSON.",
      "Suggest careers." + (userInput ? "\nDescription: \"" + userInput + "\"\n" : "\n") +
      'Respond with ONLY this JSON:\n{"dominant_traits":["empathetic","creative"],"emotional_superpower":"Deep empathy","work_style":"You thrive in calm environments","energy_type":"Introvert","avoid_environments":["High-pressure sales","Micromanagement"],"top_careers":[{"title":"UX Designer","match_score":91,"emoji":"🎨","reason":"Combines empathy with creativity","avg_salary":"$85,000","growth":"High"},{"title":"Therapist","match_score":88,"emoji":"🧠","reason":"Natural fit for your empathy","avg_salary":"$60,000","growth":"High"}],"skill_to_develop":"Setting boundaries","growth_tip":"Your empathy is a superpower.","next_step":"Take one online course this month"}'
    );
    if (!raw) return;
    renderCareerResult(parseJSON(raw), resultDiv);
  } catch(e) {
    resultDiv.innerHTML = '<div class="no-data">Could not load suggestions. Check your Groq API key.</div>';
  }
  btn.disabled = false; btn.textContent = "🚀 Get Career Matches";
}

function spawnParticles(canvasEl, env) {
  const ctx = canvasEl.getContext("2d");
  canvasEl.width = canvasEl.offsetWidth;
  canvasEl.height = canvasEl.offsetHeight;
  const particles = Array.from({ length: env.particleCount }, () => ({
    x: Math.random() * canvasEl.width, y: Math.random() * canvasEl.height,
    size: Math.random() * 14 + 8,
    speedX: (Math.random() - 0.5) * (env.bgAnimation === "neon" ? 2 : 0.6),
    speedY: env.bgAnimation === "rain" ? Math.random() * 3 + 1 : (Math.random() - 0.5) * 0.5,
    opacity: Math.random() * 0.7 + 0.3, phase: Math.random() * Math.PI * 2,
  }));
  let animId;
  function draw() {
    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
    particles.forEach(p => {
      p.phase += 0.02; p.x += p.speedX + Math.sin(p.phase) * 0.3; p.y += p.speedY;
      if (p.y > canvasEl.height + 20) p.y = -20;
      if (p.x > canvasEl.width + 20) p.x = -20;
      if (p.x < -20) p.x = canvasEl.width + 20;
      ctx.globalAlpha = p.opacity * (0.7 + Math.sin(p.phase) * 0.3);
      ctx.font = p.size + "px serif";
      ctx.fillText(env.particle, p.x, p.y);
    });
    animId = requestAnimationFrame(draw);
  }
  draw();
  return () => cancelAnimationFrame(animId);
}

function renderRelationshipResult(data, containerEl) {
  const score = data.compatibility_score || 0;
  const circ  = 2 * Math.PI * 40;
  const dash  = (score / 100) * circ;
  const scoreColor  = score >= 70 ? "var(--success)" : score >= 50 ? "var(--warning)" : "var(--danger)";
  const healthColors = { Healthy: "result-tag-success", "Needs Work": "result-tag-warning", "At Risk": "result-tag-danger", Toxic: "result-tag-danger" };
  containerEl.innerHTML =
    '<div class="result-card">'
    + '<div style="display:flex;align-items:center;gap:20px;">'
    + '<div class="compat-ring"><svg width="100" height="100" viewBox="0 0 100 100">'
    + '<circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="8"/>'
    + '<circle cx="50" cy="50" r="40" fill="none" stroke="' + scoreColor + '" stroke-width="8" stroke-dasharray="' + dash + ' ' + circ + '" stroke-linecap="round" style="transform-origin:50px 50px"/>'
    + '</svg><div class="compat-ring-label"><div class="compat-ring-num" style="color:' + scoreColor + '">' + score + '</div><div class="compat-ring-sub">/ 100</div></div></div>'
    + '<div style="flex:1;display:flex;flex-direction:column;gap:6px;">'
    + '<div style="font-size:16px;font-weight:700;">Compatibility Score</div>'
    + '<div style="font-size:12px;color:var(--muted);">' + (data.summary || "") + '</div>'
    + '<span class="result-tag ' + (healthColors[data.overall_health] || "result-tag-warning") + '" style="align-self:flex-start;">● ' + data.overall_health + '</span>'
    + '</div></div>'
    + '<div class="result-section-title">Communication Styles</div>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap;">'
    + '<span class="result-tag result-tag-accent">👤 Person A: ' + data.person_a_style + '</span>'
    + '<span class="result-tag result-tag-accent">👤 Person B: ' + data.person_b_style + '</span>'
    + '<span class="result-tag result-tag-accent">🔗 ' + data.relationship_type + '</span></div>'
    + (data.red_flags && data.red_flags.length ? '<div class="result-section-title">⚠️ Red Flags</div><div style="display:flex;flex-wrap:wrap;gap:4px;">' + data.red_flags.map(f => '<span class="result-tag result-tag-danger">⚠ ' + f + '</span>').join("") + '</div>' : "")
    + (data.strengths && data.strengths.length ? '<div class="result-section-title">💪 Strengths</div><div style="display:flex;flex-wrap:wrap;gap:4px;">' + data.strengths.map(s => '<span class="result-tag result-tag-success">✓ ' + s + '</span>').join("") + '</div>' : "")
    + '<div class="result-section-title">💡 Suggestions</div>'
    + data.suggestions.map((s, i) => '<div style="display:flex;gap:10px;align-items:flex-start;padding:4px 0;"><span style="color:var(--accent);font-weight:700;">' + (i+1) + '.</span><span style="font-size:12px;color:var(--text);line-height:1.55;">' + s + '</span></div>').join("")
    + '</div>';
}

function renderBurnoutResult(data, containerEl) {
  const score = data.risk_score || 0;
  const riskColors = { Low: "#4ade80", Moderate: "#fbbf24", High: "#f87171", Critical: "#9C27B0" };
  const riskColor  = riskColors[data.risk_level] || "#f87171";
  const trendIcons = { improving: "↑ Improving", stable: "→ Stable", worsening: "↓ Worsening" };
  const trendCls   = { improving: "result-tag-success", stable: "result-tag-warning", worsening: "result-tag-danger" };
  containerEl.innerHTML =
    '<div class="result-card">'
    + '<div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;">'
    + '<div style="display:flex;flex-direction:column;gap:4px;flex:1;">'
    + '<div class="result-section-title">Burnout Risk Level</div>'
    + '<div style="font-size:32px;font-weight:700;color:' + riskColor + ';">' + data.risk_level + '</div>'
    + '<div class="burnout-meter"><div style="display:flex;justify-content:space-between;font-size:10px;color:var(--muted);"><span>0</span><span>Risk Score: ' + score + '/100</span><span>100</span></div>'
    + '<div class="burnout-meter-track"><div class="burnout-meter-fill" style="width:' + score + '%;background:' + riskColor + ';"></div></div></div></div>'
    + '<span class="result-tag ' + (trendCls[data.trend] || "result-tag-warning") + '">' + (trendIcons[data.trend] || data.trend) + '</span></div>'
    + '<div style="background:rgba(248,113,113,0.07);border:1px solid rgba(248,113,113,0.2);border-radius:10px;padding:12px;font-size:13px;line-height:1.65;">' + data.message + '</div>'
    + '<div class="result-section-title">⚠️ Warning Signs</div>'
    + '<div style="display:flex;flex-wrap:wrap;gap:4px;">' + (data.warning_signs||[]).map(s => '<span class="result-tag result-tag-danger">• ' + s + '</span>').join("") + '</div>'
    + '<div class="result-section-title">🚨 Take Action Now</div>'
    + (data.immediate_actions||[]).map((a,i) => '<div style="display:flex;gap:10px;padding:4px 0;"><span style="color:var(--danger);font-weight:700;">0' + (i+1) + '</span><span style="font-size:12px;line-height:1.55;">' + a + '</span></div>').join("")
    + '<div class="result-section-title">📅 7-Day Recovery Plan</div>'
    + (data.week_plan||[]).map((d,i) => '<div class="result-row"><span style="color:var(--muted);">Day ' + (i+1) + '</span><span style="font-size:12px;text-align:right;max-width:70%;">' + d + '</span></div>').join("")
    + '<div style="background:rgba(124,106,255,0.08);border:1px solid rgba(124,106,255,0.2);border-radius:10px;padding:14px;font-size:13px;font-style:italic;text-align:center;line-height:1.7;">💜 "' + data.affirmation + '"</div>'
    + '</div>';
}

function renderCareerResult(data, containerEl) {
  containerEl.innerHTML =
    '<div class="result-card">'
    + '<div class="result-section-title">Your Emotional Profile</div>'
    + '<div style="font-size:13px;line-height:1.6;">' + (data.work_style||"") + '</div>'
    + '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;">'
    + (data.dominant_traits||[]).map(t => '<span class="result-tag result-tag-accent">✦ ' + t + '</span>').join("")
    + '<span class="result-tag result-tag-success">⚡ ' + (data.energy_type||"") + '</span></div>'
    + '<div style="background:rgba(124,106,255,0.08);border:1px solid rgba(124,106,255,0.2);border-radius:10px;padding:12px;font-size:12px;line-height:1.65;"><span style="color:var(--accent);font-weight:600;">🦸 Superpower: </span>' + (data.emotional_superpower||"") + '</div>'
    + '<div class="result-section-title">🎯 Top Career Matches</div>'
    + (data.top_careers||[]).map(c =>
        '<div class="career-match-card">'
        + '<div style="display:flex;align-items:center;justify-content:space-between;"><div class="career-match-title">' + c.emoji + " " + c.title + '</div>'
        + '<span style="font-size:13px;font-weight:700;color:var(--accent);">' + c.match_score + '%</span></div>'
        + '<div class="career-match-score-bar"><div class="career-match-score-fill" style="width:' + c.match_score + '%;"></div></div>'
        + '<div class="career-match-reason">' + c.reason + '</div>'
        + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:2px;">'
        + '<span class="result-tag result-tag-success" style="font-size:10px;">💰 ' + c.avg_salary + '</span>'
        + '<span class="result-tag result-tag-accent" style="font-size:10px;">📈 ' + c.growth + ' Growth</span></div></div>'
      ).join("")
    + '<div class="result-section-title">❌ Avoid These Environments</div>'
    + '<div style="display:flex;flex-wrap:wrap;gap:4px;">' + (data.avoid_environments||[]).map(e => '<span class="result-tag result-tag-danger">✗ ' + e + '</span>').join("") + '</div>'
    + '<div style="background:rgba(74,222,128,0.07);border:1px solid rgba(74,222,128,0.2);border-radius:10px;padding:14px;display:flex;flex-direction:column;gap:6px;">'
    + '<div style="font-size:11px;font-weight:600;color:var(--success);">💡 Growth Tip</div>'
    + '<div style="font-size:12px;line-height:1.65;">' + (data.growth_tip||"") + '</div></div>'
    + '<div style="background:rgba(251,191,36,0.07);border:1px solid rgba(251,191,36,0.2);border-radius:10px;padding:14px;display:flex;flex-direction:column;gap:6px;">'
    + '<div style="font-size:11px;font-weight:600;color:var(--warning);">🚀 Your Next Step</div>'
    + '<div style="font-size:12px;line-height:1.65;">' + (data.next_step||"") + '</div></div>'
    + '</div>';
}

function renderEnvironmentDisplay(containerEl) {
  const env = getEnv();
  const stats = [
    { label: "Emotion Detected", value: env.label },
    { label: "Environment", value: env.ambience },
    { label: "Particles", value: env.particle + " × " + env.particleCount },
    { label: "Atmosphere", value: env.bgAnimation },
  ];
  containerEl.innerHTML =
    '<div style="background:linear-gradient(135deg,' + env.glowColor + '12,rgba(255,255,255,0.03));border:1px solid ' + env.accent + '44;border-radius:20px;padding:24px;">'
    + '<div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:16px;">'
    + '<div><div style="font-size:13px;color:' + env.accent + ';letter-spacing:2px;text-transform:uppercase;margin-bottom:6px;">Active Environment</div>'
    + '<div style="color:#fff;font-size:24px;font-weight:700;display:flex;gap:12px;align-items:center;">'
    + '<span style="font-size:32px;filter:drop-shadow(0 0 12px ' + env.glowColor + ');">' + env.emoji + '</span>' + env.ambience + '</div>'
    + '<div style="color:#aaa;font-size:13px;margin-top:8px;font-style:italic;">"' + env.message + '"</div></div>'
    + '<div style="padding:14px 18px;background:' + env.glowColor + '18;border:1px solid ' + env.accent + '44;border-radius:14px;text-align:center;">'
    + '<div style="font-size:22px;">' + env.musicEmoji + '</div>'
    + '<div style="color:' + env.accent + ';font-size:11px;margin-top:4px;">' + env.musicLabel + '</div></div></div>'
    + '<div style="margin-top:20px;display:flex;gap:10px;flex-wrap:wrap;">'
    + stats.map(s => '<div style="flex:1 1 140px;background:rgba(0,0,0,0.3);border-radius:10px;padding:10px 14px;border:1px solid rgba(255,255,255,0.06);"><div style="color:#555;font-size:10px;margin-bottom:4px;">' + s.label + '</div><div style="color:' + env.accent + ';font-size:13px;font-weight:600;">' + s.value + '</div></div>').join("")
    + '</div></div>';
}