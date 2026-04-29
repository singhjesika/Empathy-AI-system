// ═══════════════════════════════════════════════════════════════
// CONSTANTS & GLOBALS
// ═══════════════════════════════════════════════════════════════

const EMOTION_MAP = {
  joy:{emoji:"😄",label:"Joyful"}, sadness:{emoji:"😢",label:"Sad"}, anger:{emoji:"😠",label:"Angry"},
  fear:{emoji:"😨",label:"Fearful"}, disgust:{emoji:"🤢",label:"Uneasy"}, surprise:{emoji:"😲",label:"Surprised"},
  trust:{emoji:"🤝",label:"Trusting"}, anticipation:{emoji:"🤩",label:"Excited"}, study:{emoji:"📚",label:"Study"},
  stress:{emoji:"😤",label:"Stressed"}, health:{emoji:"💪",label:"Health"}, greeting:{emoji:"👋",label:"Greeting"},
  farewell:{emoji:"👋",label:"Farewell"}, general:{emoji:"💬",label:"Chat"},
};

const EMOTION_NORMALIZE = {
  joy:"joy",happy:"joy",happiness:"joy",joyful:"joy",excited:"anticipation",
  sad:"sadness",sadness:"sadness",grief:"sadness",depressed:"sadness",
  angry:"anger",anger:"anger",frustrated:"anger",rage:"anger",
  fear:"fear",fearful:"fear",anxious:"fear",anxiety:"fear",
  disgusted:"disgust",disgust:"disgust",uneasy:"disgust",
  surprised:"surprise",surprise:"surprise",shocked:"surprise",
  trust:"trust",trusting:"trust",anticipation:"anticipation",
  study:"study",learning:"study",stress:"stress",stressed:"stress",overwhelmed:"stress",
  health:"health",sick:"health",greeting:"greeting",hello:"greeting",hi:"greeting",
  farewell:"farewell",bye:"farewell",goodbye:"farewell",general:"general",
};

const EMOTION_COLORS = {
  joy:"#FFD700",sadness:"#00BFFF",anger:"#FF4500",fear:"#9400D3",disgust:"#00FA9A",
  surprise:"#00FFCC",trust:"#40E0D0",anticipation:"#BF5FFF",study:"#7CFF6B",
  stress:"#FF8C00",health:"#20B2AA",greeting:"#ff6a9e",farewell:"#c084fc",general:"#7c6aff",
};

const EMOTION_EMOJI_MAP = {
  joy:"😄",sadness:"😢",anger:"😠",fear:"😨",disgust:"🤢",surprise:"😲",
  trust:"🤝",anticipation:"🤩",study:"📚",stress:"😤",health:"💪",
  greeting:"👋",farewell:"👋",general:"💬",
};

const PERSONALITY_LABELS = {friend:"🤝 Friend",coach:"🎯 Coach",therapist:"🧠 Therapist"};

let currentUser        = null;
let currentPersonality = "friend";
let cachedMemories     = [];
let giphyKey           = localStorage.getItem("giphy_key") || "";
let micActive          = false;
let recognition        = null;
let voiceOn            = false;
let deferredPwaPrompt  = null;
let breatheTimer       = null;
let GROQ_API_KEY       = localStorage.getItem("groq_api_key") 
let doughnutChartInst  = null;
let lineChartInst      = null;

// ─── INIT ─────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("giphyBox").style.display = "none";
  document.getElementById("nameInput").addEventListener("keydown", e => {
    if (e.key === "Enter") doLogin();
  });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    });
  }

  window.addEventListener("beforeinstallprompt", e => {
    e.preventDefault();
    deferredPwaPrompt = e;
    setTimeout(() => {
      if (!localStorage.getItem("pwa_dismissed"))
        document.getElementById("pwaBanner").classList.add("visible");
    }, 25000);
  });

  window.addEventListener("load", initAura);
});

// ─── PWA ──────────────────────────────────────────────────────────
function installPWA() {
  if (!deferredPwaPrompt) return;
  deferredPwaPrompt.prompt();
  deferredPwaPrompt.userChoice.then(() => {
    deferredPwaPrompt = null;
    document.getElementById("pwaBanner").classList.remove("visible");
  });
}

function dismissPWA() {
  localStorage.setItem("pwa_dismissed", "1");
  document.getElementById("pwaBanner").classList.remove("visible");
}

// ─── GIPHY ────────────────────────────────────────────────────────
function saveGiphyKey() {
  const k = document.getElementById("giphyKeyInput").value.trim();
  if (k) {
    giphyKey = k;
    localStorage.setItem("giphy_key", k);
    document.getElementById("giphyBox").style.display = "none";
  }
}

// ─── LOGIN ────────────────────────────────────────────────────────
async function doLogin() {
  const name = document.getElementById("nameInput").value.trim();
  if (!name) { document.getElementById("nameInput").focus(); return; }
  try {
    const res  = await fetch("/api/login", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({name})
    });
    const data = await res.json();
    currentUser = data.name;

    document.getElementById("sidebarName").textContent    = data.name;
    document.getElementById("levelBadge").textContent     = "Lv." + data.level_num;
    document.getElementById("xpLabel").textContent        = data.total_xp + " XP";
    document.getElementById("xpFill").style.width         = Math.min((data.total_xp % 100), 100) + "%";
    document.getElementById("userCard").classList.add("visible");
    document.getElementById("navSection").classList.add("visible");
    document.getElementById("personalityBox").classList.add("visible");
    document.getElementById("insightsBox").classList.add("visible");
    document.getElementById("weatherBox").classList.add("visible");
    document.getElementById("voiceToggleWrap").style.display = "flex";
    document.getElementById("headerTitle").textContent    = "Hey, " + data.name + " 👋";
    document.getElementById("modeBadge").textContent      = data.is_returning ? "Groq AI" : "Welcome";
    document.getElementById("modeBadge").className        = "mode-badge " + (data.is_returning ? "mode-groq" : "mode-fallback");
    document.getElementById("loginScreen").style.display  = "none";
    document.getElementById("chatScreen").classList.add("visible");

    showPanel("messages");

    if (data.is_returning) {
      addMessage("ai", "Welcome back, " + data.name + "! 😊 You've visited " + data.total_chats + " time(s). How are you feeling today?");
    } else {
      addMessage("ai", "Hi " + data.name + "! I'm your Empathy AI companion. 💙 How are you feeling right now?");
    }

    document.getElementById("chatInput").focus();
    loadStreak();
    loadRiskData();
  } catch(e) {
    alert("Login failed: " + e.message);
  }
}

// ─── SEND MESSAGE ─────────────────────────────────────────────────
async function sendMessage() {
  const input = document.getElementById("chatInput");
  const text  = input.value.trim();
  if (!text || !currentUser) return;
  input.value = "";
  input.style.height = "auto";
  document.getElementById("sendBtn").disabled = true;
  addMessage("user", text);

  const panel = document.getElementById("messagesPanel");
  const tRow  = document.createElement("div");
  tRow.id = "typingIndicator";
  tRow.className = "typing-row";
  tRow.innerHTML = '<div class="avatar ai">🧠</div><div class="typing-bubble"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>';
  panel.appendChild(tRow);
  panel.scrollTop = panel.scrollHeight;

  try {
    const res  = await fetch("/api/chat", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({user_name: currentUser, message: text, memories: cachedMemories.slice(0, 3)})
    });
    const data = await res.json();
    const t = document.getElementById("typingIndicator");
    if (t) t.remove();

    addMessage("ai", data.response, data.emotion, data.xp_earned);
    document.getElementById("xpLabel").textContent    = data.total_xp + " XP";
    document.getElementById("xpFill").style.width     = Math.min((data.total_xp % 100), 100) + "%";
    document.getElementById("levelBadge").textContent = "Lv." + data.level_num;
    document.getElementById("modeBadge").textContent  = data.response_mode === "groq" ? "Groq AI" : "Fallback";
    document.getElementById("modeBadge").className    = "mode-badge " + (data.response_mode === "groq" ? "mode-groq" : "mode-fallback");

    if (data.emotion) triggerAura(data.emotion);
    if (voiceOn) speak(data.response);
    if (data.emotion && data.emotion !== "general") saveMem(data.emotion, text, data.response);
    updateWeather(data.emotion);
    loadRiskData();
  } catch(e) {
    const t = document.getElementById("typingIndicator");
    if (t) t.remove();
    addMessage("ai", "⚠️ Error: " + e.message + ". Please try again.");
  }
  document.getElementById("sendBtn").disabled = false;
}

// ─── ADD MESSAGE ──────────────────────────────────────────────────
function addMessage(role, text, emotion, xp) {
  const panel = document.getElementById("messagesPanel");
  const row   = document.createElement("div");
  row.className = "msg-row " + role;
  const em = emotion ? (EMOTION_MAP[EMOTION_NORMALIZE[emotion] || emotion] || EMOTION_MAP.general) : null;
  row.innerHTML =
    '<div class="avatar ' + role + '">' + (role === "ai" ? "🧠" : "😊") + '</div>'
    + '<div class="msg-content"><div class="bubble ' + role + '">' + text + '</div>'
    + (em && role === "ai" ? '<div class="emotion-tag">' + em.emoji + " " + em.label + '</div>' : "")
    + (xp && role === "ai"  ? '<div class="xp-tag">+' + xp + ' XP</div>' : "")
    + '</div>';
  panel.appendChild(row);
  panel.scrollTop = panel.scrollHeight;
}

// ─── INPUT HELPERS ────────────────────────────────────────────────
function handleKey(e) {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
}

function autoResize(el) {
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 110) + "px";
}

// ─── PERSONALITY ──────────────────────────────────────────────────
async function setPersonality(mode) {
  if (!currentUser) return;
  try {
    await fetch("/api/personality/set", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({user_name: currentUser, mode})
    });
    currentPersonality = mode;
    document.querySelectorAll(".personality-btn").forEach(b => b.classList.remove("active"));
    const btn = document.getElementById("pBtn-" + mode);
    if (btn) btn.classList.add("active");
    document.getElementById("personalityHeaderBadge").textContent = PERSONALITY_LABELS[mode] || mode;
  } catch(e) {}
}

// ─── VOICE ────────────────────────────────────────────────────────
function speak(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.rate = 0.95; utt.pitch = 1; utt.volume = 1;
  window.speechSynthesis.speak(utt);
}

function toggleVoice(el) { voiceOn = el.checked; }

function toggleMic() {
  const btn = document.getElementById("micBtn");
  if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
    alert("Speech recognition not supported.");
    return;
  }
  if (micActive) {
    if (recognition) recognition.stop();
    micActive = false;
    btn.classList.remove("active");
    return;
  }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SR();
  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.onresult = e => {
    const t = e.results[0][0].transcript;
    const inp = document.getElementById("chatInput");
    inp.value = t;
    autoResize(inp);
    micActive = false;
    btn.classList.remove("active");
  };
  recognition.onerror = () => { micActive = false; btn.classList.remove("active"); };
  recognition.onend   = () => { micActive = false; btn.classList.remove("active"); };
  recognition.start();
  micActive = true;
  btn.classList.add("active");
}

// ─── HELPERS ──────────────────────────────────────────────────────
function detectEmotionFromText(text) {
  const t = text.toLowerCase();
  if (/happy|joy|great|amazing/.test(t))      return "joy";
  if (/sad|cry|depressed|lonely/.test(t))     return "sadness";
  if (/angry|frustrated|mad/.test(t))         return "anger";
  if (/scared|afraid|anxious|worried/.test(t))return "fear";
  if (/stressed|overwhelmed/.test(t))         return "stress";
  if (/study|exam|homework/.test(t))          return "study";
  return "general";
}

function updateWeather(emotion) {
  const map = {
    joy:         {emoji:"☀️", title:"Sunny & Bright",      sub:"You're radiating positive energy!"},
    sadness:     {emoji:"🌧️", title:"Rainy & Cloudy",      sub:"It's okay to feel down sometimes."},
    anger:       {emoji:"⛈️", title:"Stormy & Intense",    sub:"Take a deep breath — this will pass."},
    fear:        {emoji:"🌫️", title:"Foggy & Uncertain",   sub:"One step at a time — you've got this."},
    stress:      {emoji:"🌪️", title:"Windy & Restless",    sub:"Try to find your calm center."},
    trust:       {emoji:"🌤️", title:"Partly Sunny",        sub:"You're feeling secure and grounded."},
    anticipation:{emoji:"🌈", title:"Rainbow Ahead",       sub:"Something good is coming your way!"},
    study:       {emoji:"🌥️", title:"Focused & Clear",     sub:"Your mind is in learning mode."},
    general:     {emoji:"🌤️", title:"Your Emotional Weather", sub:"Chat to see your forecast."},
  };
  const key  = EMOTION_NORMALIZE[emotion] || emotion;
  const info = map[key] || map.general;
  document.getElementById("weatherEmoji").textContent = info.emoji;
  document.getElementById("weatherTitle").textContent = info.title;
  document.getElementById("weatherSub").textContent   = info.sub;
}

async function saveMem(emotion, userMsg, aiMsg) {
  try {
    const res  = await fetch("/api/memory/save", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({user_name: currentUser, emotion, user_message: userMsg, ai_response: aiMsg})
    });
    const data = await res.json();
    if (data.insight) {
      cachedMemories.unshift(data.insight);
      if (cachedMemories.length > 10) cachedMemories.pop();
    }
  } catch(e) {}
}

async function loadStreak() {
  try {
    const res  = await fetch("/api/streak/" + encodeURIComponent(currentUser));
    const data = await res.json();
    if (data.streak > 0) {
      document.getElementById("streakRow").style.display = "flex";
      document.getElementById("streakLabel").textContent = "🔥 " + data.streak + " day streak";
    }
  } catch(e) {}
}

async function loadRiskData() {
  if (!currentUser) return;
  try {
    const [risk, trend, topics] = await Promise.all([
      fetch("/api/risk/"       + encodeURIComponent(currentUser)).then(r => r.json()),
      fetch("/api/trend/"      + encodeURIComponent(currentUser)).then(r => r.json()),
      fetch("/api/topic-intel/"+ encodeURIComponent(currentUser)).then(r => r.json()),
    ]);

    const level = (risk.level || "LOW").toUpperCase();
    const badge = document.getElementById("riskBadge");
    badge.className  = "risk-badge risk-" + level;
    badge.textContent = "● " + level;

    const arrows = {improving:"↑", stable:"→", worsening:"↓"};
    document.getElementById("trendArrow").textContent = arrows[trend.trend] || "→";
    document.getElementById("trendLabel").textContent = trend.label || trend.trend || "Stable";

    if (topics && topics.top_topics) {
      document.getElementById("topicPills").innerHTML =
        topics.top_topics.slice(0, 3).map(t => '<span class="topic-pill">' + t + '</span>').join("");
    }
  } catch(e) {}
}

// ─── AURA CANVAS ──────────────────────────────────────────────────
const AURA_CONFIG = {
  joy:        {bg:["#1a1200","#2a1f00"], particles:"confetti", colors:["#FFD700","#ff6a9e","#7c6aff","#4ade80","#fbbf24"], count:90,  speed:1.4},
  sadness:    {bg:["#000a1a","#000f2a"], particles:"rain",     colors:["#00BFFF","#1E90FF","#87CEEB"],                    count:120, speed:2.5},
  anger:      {bg:["#1a0000","#2a0000"], particles:"sparks",   colors:["#FF4500","#FF6347","#FF0000"],                    count:70,  speed:2.0},
  fear:       {bg:["#0a000f","#150020"], particles:"orbs",     colors:["#8B008B","#9400D3","#800080"],                    count:45,  speed:0.4},
  stress:     {bg:["#1a0800","#2a1000"], particles:"smoke",    colors:["#FF8C00","#FFA500","#FF7F50"],                    count:60,  speed:0.8},
  study:      {bg:["#001a1a","#002233"], particles:"stars",    colors:["#7CFF6B","#40E0D0","#7c6aff"],                    count:65,  speed:0.5},
  general:    {bg:["#0a0a0f","#13131a"], particles:"dots",     colors:["#7c6aff","#555577","#444466"],                    count:35,  speed:0.3},
};

let auraParticles  = [];
let auraAnimFrame  = null;
let currentAura    = null;
let auraCtx        = null;
let auraW          = 0;
let auraH          = 0;

function initAura() {
  const canvas = document.getElementById("auraCanvas");
  auraCtx = canvas.getContext("2d");
  resizeAura();
  window.addEventListener("resize", resizeAura);
}

function resizeAura() {
  const canvas = document.getElementById("auraCanvas");
  auraW = canvas.width  = window.innerWidth;
  auraH = canvas.height = window.innerHeight;
}

function triggerAura(emotion) {
  const key    = EMOTION_NORMALIZE[emotion] || emotion;
  const config = AURA_CONFIG[key] || AURA_CONFIG.general;
  if (currentAura === key) return;
  currentAura = key;
  document.getElementById("auraCanvas").classList.add("active");
  auraParticles = [];
  for (let i = 0; i < config.count; i++) auraParticles.push(createAuraParticle(config));
  if (auraAnimFrame) cancelAnimationFrame(auraAnimFrame);
  animateAura(config);
}

function createAuraParticle(config) {
  const color = config.colors[Math.floor(Math.random() * config.colors.length)];
  return {
    x: Math.random() * auraW,
    y: Math.random() * auraH,
    size: Math.random() * 20 + 8,
    color,
    speedX: (Math.random() - .5) * .8,
    speedY: -(config.speed * (Math.random() * .3 + .1)),
    opacity: Math.random() * .7 + .3,
    life: 1,
    decay: 0,
    pulse: Math.random() * Math.PI * 2,
    pulseSpeed: Math.random() * .03 + .01,
  };
}

function animateAura(config) {
  if (!auraCtx) return;
  const grad = auraCtx.createRadialGradient(auraW/2, auraH/2, 0, auraW/2, auraH/2, Math.max(auraW, auraH) * .8);
  grad.addColorStop(0, config.bg[1]);
  grad.addColorStop(1, config.bg[0]);
  auraCtx.fillStyle = grad;
  auraCtx.fillRect(0, 0, auraW, auraH);

  auraParticles.forEach((p, idx) => {
    p.pulse += p.pulseSpeed;
    const glowSize = p.size * (1 + Math.sin(p.pulse) * .3);
    auraCtx.save();
    auraCtx.globalAlpha = p.opacity;
    auraCtx.translate(p.x, p.y);
    const g = auraCtx.createRadialGradient(0, 0, 0, 0, 0, glowSize);
    g.addColorStop(0, p.color + "cc");
    g.addColorStop(1, p.color + "00");
    auraCtx.fillStyle = g;
    auraCtx.beginPath();
    auraCtx.arc(0, 0, glowSize, 0, Math.PI * 2);
    auraCtx.fill();
    auraCtx.restore();
    p.x += p.speedX;
    p.y += p.speedY;
    if (p.y < -20 || p.x < -50 || p.x > auraW + 50) {
      const np = createAuraParticle(config);
      np.y = auraH + 10;
      auraParticles[idx] = np;
    }
  });
  auraAnimFrame = requestAnimationFrame(() => animateAura(config));
}

// ─── BREATHING EXERCISE ───────────────────────────────────────────
const BREATHE_PHASES       = [{name:"Inhale",duration:4},{name:"Hold",duration:4},{name:"Exhale",duration:4},{name:"Hold",duration:4}];
const BREATHE_TOTAL_CYCLES = 4;
let breatheCycle    = 0;
let breathePhaseIdx = 0;
let breatheTickCount = 0;

function startBreathe() {
  document.getElementById("breatheOverlay").classList.add("visible");
  breatheCycle = 0; breathePhaseIdx = 0; breatheTickCount = 0;
  if (breatheTimer) clearInterval(breatheTimer);
  updateBreatheUI();
  breatheTimer = setInterval(breatheTick, 1000);
}

function breatheTick() {
  const phase = BREATHE_PHASES[breathePhaseIdx];
  breatheTickCount++;
  if (breatheTickCount >= phase.duration) {
    breatheTickCount = 0;
    breathePhaseIdx++;
    if (breathePhaseIdx >= BREATHE_PHASES.length) {
      breathePhaseIdx = 0;
      breatheCycle++;
      if (breatheCycle >= BREATHE_TOTAL_CYCLES) { stopBreathe(); return; }
    }
  }
  updateBreatheUI();
}

function updateBreatheUI() {
  const phase      = BREATHE_PHASES[breathePhaseIdx];
  const remaining  = phase.duration - breatheTickCount;
  const totalTicks = BREATHE_TOTAL_CYCLES * BREATHE_PHASES.reduce((s, p) => s + p.duration, 0);
  const doneTicks  = breatheCycle * BREATHE_PHASES.reduce((s, p) => s + p.duration, 0)
    + BREATHE_PHASES.slice(0, breathePhaseIdx).reduce((s, p) => s + p.duration, 0)
    + breatheTickCount;

  document.getElementById("breathePhase").textContent  = phase.name;
  document.getElementById("breatheCount").textContent  = remaining;
  document.getElementById("breatheCycles").textContent = "Cycle " + (breatheCycle + 1) + " of " + BREATHE_TOTAL_CYCLES;
  document.getElementById("breatheFill").style.width   = Math.round((doneTicks / totalTicks) * 100) + "%";

  const scale = phase.name === "Inhale"  ? 1 + (breatheTickCount / phase.duration) * 0.25
              : phase.name === "Exhale"  ? 1.25 - (breatheTickCount / phase.duration) * 0.25
              : breathePhaseIdx === 1    ? 1.25
              : 1;
  document.getElementById("breatheRing").style.transform = "scale(" + scale + ")";
}

function stopBreathe() {
  if (breatheTimer) clearInterval(breatheTimer);
  breatheTimer = null;
  document.getElementById("breatheOverlay").classList.remove("visible");
}