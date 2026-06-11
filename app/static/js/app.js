

const EMOTION_MAP = {
  joy:{emoji:"😄",label:"Joyful"}, sadness:{emoji:"😢",label:"Sad"}, anger:{emoji:"😠",label:"Angry"},
  fear:{emoji:"😨",label:"Fearful"}, disgust:{emoji:"🤢",label:"Uneasy"}, surprise:{emoji:"😲",label:"Surprised"},
  trust:{emoji:"🤝",label:"Trusting"}, anticipation:{emoji:"🤩",label:"Excited"}, study:{emoji:"📚",label:"Study"},
  stress:{emoji:"😤",label:"Stressed"}, health:{emoji:"💪",label:"Health"}, greeting:{emoji:"👋",label:"Greeting"},
  farewell:{emoji:"👋",label:"Farewell"}, general:{emoji:"💬",label:"Chat"},
};

async function loadGroqConfig() {
  try {
    const res = await fetch("/api/config");
    const data = await res.json();
    GROQ_API_KEY = data.groq_api_key;
    console.log("Groq key loaded");
  } catch (err) {
    console.error("Failed to load GROQ config:", err);
  }
}
loadGroqConfig();

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
  happy:        "#FFD700",
  sad:          "#4FC3F7",
  anxious:      "#AB47BC",
  lonely:       "#5C6BC0",
  stressed:     "#FF6D00",
  angry:        "#FF1744",
  confused:     "#FFA726",
  hopeful:      "#69FF47",
  excited:      "#F50057",
  overwhelmed:  "#D500F9",
  calm:         "#00E5FF",
  motivated:    "#EEFF41",
  joy:          "#FFD700",
  sadness:      "#4FC3F7",
  anger:        "#FF1744",
  fear:         "#AB47BC",
  disgust:      "#00E676",
  surprise:     "#FF9100",
  trust:        "#00BCD4",
  anticipation: "#E040FB",
  study:        "#69FF47",
  stress:       "#FF6D00",
  health:       "#1DE9B6",
  greeting:     "#F48FB1",
  farewell:     "#CE93D8",
  general:      "#7C4DFF",
  chat:         "#7C4DFF",
  depressed:    "#5C6BC0",
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
let GROQ_API_KEY       = "";
let doughnutChartInst  = null;
let lineChartInst      = null;


const HEART_EMOTION_PALETTE = {
  joy:         { outer:"rgba(255,200,30,.35)",  mid:"rgba(255,230,80,.60)",  core:"rgba(255,245,180,.95)", spark:"rgba(255,255,200,.98)", bg:["rgba(60,40,0,.28)","rgba(30,20,0,.14)"],  speed:"fast"   },
  sadness:     { outer:"rgba(40,100,220,.32)",  mid:"rgba(80,150,255,.55)",  core:"rgba(180,210,255,.90)", spark:"rgba(200,225,255,.95)", bg:["rgba(0,20,80,.30)","rgba(0,10,40,.15)"],  speed:"slow"   },
  anger:       { outer:"rgba(220,30,30,.40)",   mid:"rgba(255,80,60,.60)",   core:"rgba(255,180,160,.92)", spark:"rgba(255,220,210,.98)", bg:["rgba(80,0,0,.35)","rgba(40,0,0,.18)"],   speed:"fast"   },
  fear:        { outer:"rgba(130,40,200,.30)",  mid:"rgba(180,80,255,.50)",  core:"rgba(220,180,255,.88)", spark:"rgba(240,220,255,.95)", bg:["rgba(30,0,60,.28)","rgba(15,0,30,.14)"],  speed:"slow"   },
  stress:      { outer:"rgba(220,100,20,.35)",  mid:"rgba(255,150,40,.55)",  core:"rgba(255,210,150,.90)", spark:"rgba(255,230,200,.96)", bg:["rgba(60,20,0,.28)","rgba(30,10,0,.14)"],  speed:"fast"   },
  trust:       { outer:"rgba(20,140,200,.30)",  mid:"rgba(60,180,240,.52)",  core:"rgba(160,225,255,.88)", spark:"rgba(200,240,255,.95)", bg:["rgba(0,40,70,.26)","rgba(0,20,35,.13)"],  speed:"medium" },
  anticipation:{ outer:"rgba(160,40,220,.32)",  mid:"rgba(200,80,255,.54)",  core:"rgba(235,180,255,.90)", spark:"rgba(245,210,255,.96)", bg:["rgba(50,0,80,.28)","rgba(25,0,40,.14)"],  speed:"medium" },
  study:       { outer:"rgba(30,180,100,.30)",  mid:"rgba(60,220,140,.52)",  core:"rgba(160,255,200,.88)", spark:"rgba(200,255,225,.95)", bg:["rgba(0,50,20,.26)","rgba(0,25,10,.13)"],  speed:"medium" },
  disgust:     { outer:"rgba(20,130,80,.28)",   mid:"rgba(40,170,110,.50)",  core:"rgba(140,230,180,.86)", spark:"rgba(180,245,210,.93)", bg:["rgba(0,40,20,.24)","rgba(0,20,10,.12)"],  speed:"medium" },
  surprise:    { outer:"rgba(20,180,200,.32)",  mid:"rgba(40,220,240,.54)",  core:"rgba(160,245,255,.90)", spark:"rgba(200,250,255,.96)", bg:["rgba(0,50,60,.26)","rgba(0,25,30,.13)"],  speed:"fast"   },
  health:      { outer:"rgba(30,200,140,.30)",  mid:"rgba(60,240,170,.52)",  core:"rgba(160,255,220,.88)", spark:"rgba(200,255,235,.95)", bg:["rgba(0,60,35,.26)","rgba(0,30,18,.13)"],  speed:"medium" },
  general:     { outer:"rgba(90,120,255,.30)",  mid:"rgba(160,195,255,.55)", core:"rgba(225,238,255,.92)", spark:"rgba(255,255,255,.95)", bg:["rgba(20,40,120,.22)","rgba(50,70,180,.12)"], speed:"medium" },
};


const HEART_SPEED_MAP = { fast:"2.2s", medium:"4.5s", slow:"7s" };


function applyHeartEmotion(emotion) {
  const key     = EMOTION_NORMALIZE[emotion] || emotion;
  const palette = HEART_EMOTION_PALETTE[key] || HEART_EMOTION_PALETTE.general;

  const outer  = document.querySelector(".ht-outer");
  const mid    = document.querySelector(".ht-mid");
  const core   = document.querySelector(".ht-core");
  const sparks = document.querySelectorAll(".ht-spark");
  const panel  = document.getElementById("messagesPanel");

  if (!outer) return;  

  const dur = HEART_SPEED_MAP[palette.speed] || "4.5s";

  // stroke colours
  outer.style.stroke = palette.outer;
  mid.style.stroke   = palette.mid;
  core.style.stroke  = palette.core;
  sparks.forEach(s => s.style.fill = palette.spark);

  
  outer.style.animationDuration = `3.4s, ${dur}`;
  mid.style.animationDuration   = `3.4s, ${dur}`;
  core.style.animationDuration  = `3.4s, ${dur}`;

}

function heartBeat() {
  const paths = document.querySelectorAll(".ht-outer,.ht-mid,.ht-core");
  if (!paths.length) return;
  paths.forEach(p => {
    p.style.transition = "stroke-width .12s ease-out";
    const base = p.classList.contains("ht-outer") ? 11
               : p.classList.contains("ht-mid")   ? 5 : 1.5;
    p.style.strokeWidth = (base * 1.9) + "px";
    setTimeout(() => { p.style.strokeWidth = ""; p.style.transition = "stroke-width .4s ease-in"; }, 160);
  });
}

function heartRedraw() {
  const paths = document.querySelectorAll(".ht-outer,.ht-mid,.ht-core");
  const sparks = document.querySelectorAll(".ht-spark");
  if (!paths.length) return;

  // clone → replace to restart CSS animations
  paths.forEach(p => {
    const clone = p.cloneNode(true);
    p.parentNode.replaceChild(clone, p);
  });
  sparks.forEach(s => {
    const clone = s.cloneNode(true);
    s.parentNode.replaceChild(clone, s);
  });
}

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

function saveGiphyKey() {
  const k = document.getElementById("giphyKeyInput").value.trim();
  if (k) {
    giphyKey = k;
    localStorage.setItem("giphy_key", k);
    document.getElementById("giphyBox").style.display = "none";
  }
}

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

    
    if (data.emotion) {
      applyHeartEmotion(data.emotion);
      heartBeat();
      triggerAura(data.emotion);
    }

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


function handleKey(e) {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
}

function autoResize(el) {
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 110) + "px";
}

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

function detectEmotionFromText(text) {
  const t = text.toLowerCase();
  if (/happy|joy|great|amazing/.test(t))       return "joy";
  if (/sad|cry|depressed|lonely/.test(t))      return "sadness";
  if (/angry|frustrated|mad/.test(t))          return "anger";
  if (/scared|afraid|anxious|worried/.test(t)) return "fear";
  if (/stressed|overwhelmed/.test(t))          return "stress";
  if (/study|exam|homework/.test(t))           return "study";
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
    badge.className   = "risk-badge risk-" + level;
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

const BREATHE_PHASES       = [{name:"Inhale",duration:4},{name:"Hold",duration:4},{name:"Exhale",duration:4},{name:"Hold",duration:4}];
const BREATHE_TOTAL_CYCLES = 4;
let breatheCycle     = 0;
let breathePhaseIdx  = 0;
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