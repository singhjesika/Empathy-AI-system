// ═══════════════════════════════════════════════════════════════
// GROQ API HELPER
// ═══════════════════════════════════════════════════════════════

async function callGroq(systemPrompt, userPrompt) {
  const key = GROQ_API_KEY;
  if (!key) {
    const k = prompt("Enter your Groq API key to use this feature:");
    if (k) { localStorage.setItem("groq_api_key", k); location.reload(); }
    return null;
  }
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + key,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        {role: "system", content: systemPrompt},
        {role: "user",   content: userPrompt},
      ],
      temperature: 0.7,
      max_tokens: 1000,
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.choices[0].message.content;
}

function parseGroqJSON(raw) {
  return JSON.parse(raw.replace(/```json|```/g, "").trim());
}

// ═══════════════════════════════════════════════════════════════
// RELATIONSHIP ANALYZER
// ═══════════════════════════════════════════════════════════════

async function analyzeRelationship() {
  const conversation = document.getElementById("relConvInput").value.trim();
  const resultDiv    = document.getElementById("relResult");
  const btn          = document.getElementById("relAnalyzeBtn");

  if (!conversation) { alert("Please paste a conversation first!"); return; }

  btn.disabled    = true;
  btn.textContent = "Analyzing… ⏳";
  resultDiv.innerHTML = '<div class="feature-loading"><div class="dot"></div><div class="dot"></div><div class="dot"></div><span>Reading emotional patterns…</span></div>';

  const system = "You are an expert relationship therapist. Always respond ONLY with valid JSON, no markdown.";
  const prompt  =
    'Analyze this conversation:\n"""\n' + conversation + '\n"""\n\n'
    + 'Respond with ONLY this JSON:\n'
    + '{"compatibility_score":72,"person_a_style":"Empathetic","person_b_style":"Avoidant","relationship_type":"Romantic","emotional_triggers":["feeling ignored"],"red_flags":["dismissive tone"],"strengths":["open expression"],"suggestions":["Practice active listening","Use I feel statements","Schedule check-ins"],"overall_health":"At Risk","summary":"One line summary"}';

  try {
    const raw  = await callGroq(system, prompt);
    if (!raw) return;
    const data = parseGroqJSON(raw);

    const score      = data.compatibility_score || 0;
    const circ       = 2 * Math.PI * 40;
    const dash       = (score / 100) * circ;
    const scoreColor = score >= 70 ? "var(--success)" : score >= 50 ? "var(--warning)" : "var(--danger)";
    const healthColors = {"Healthy":"result-tag-success","Needs Work":"result-tag-warning","At Risk":"result-tag-danger","Toxic":"result-tag-danger"};

    resultDiv.innerHTML =
      '<div class="result-card">'
      + '<div style="display:flex;align-items:center;gap:20px;">'
      + '<div class="compat-ring">'
      + '<svg width="100" height="100" viewBox="0 0 100 100">'
      + '<circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="8"/>'
      + '<circle cx="50" cy="50" r="40" fill="none" stroke="' + scoreColor + '" stroke-width="8" stroke-dasharray="' + dash + ' ' + circ + '" stroke-linecap="round" style="transform-origin:50px 50px"/>'
      + '</svg>'
      + '<div class="compat-ring-label"><div class="compat-ring-num" style="color:' + scoreColor + '">' + score + '</div><div class="compat-ring-sub">/ 100</div></div></div>'
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
      + (data.red_flags && data.red_flags.length
        ? '<div class="result-section-title">⚠️ Red Flags</div><div style="display:flex;flex-wrap:wrap;gap:4px;">'
          + data.red_flags.map(f => '<span class="result-tag result-tag-danger">⚠ ' + f + '</span>').join("")
          + '</div>' : "")
      + (data.strengths && data.strengths.length
        ? '<div class="result-section-title">💪 Strengths</div><div style="display:flex;flex-wrap:wrap;gap:4px;">'
          + data.strengths.map(s => '<span class="result-tag result-tag-success">✓ ' + s + '</span>').join("")
          + '</div>' : "")
      + '<div class="result-section-title">💡 Suggestions</div>'
      + data.suggestions.map((s, i) =>
          '<div style="display:flex;gap:10px;align-items:flex-start;padding:4px 0;">'
          + '<span style="color:var(--accent);font-weight:700;">' + (i + 1) + '.</span>'
          + '<span style="font-size:12px;color:var(--text);line-height:1.55;">' + s + '</span></div>'
        ).join("")
      + '</div>';
  } catch(e) {
    resultDiv.innerHTML = '<div class="no-data">Analysis failed. Check your Groq API key. 🙏</div>';
  }

  btn.disabled    = false;
  btn.textContent = "💞 Analyze Relationship";
}

// ═══════════════════════════════════════════════════════════════
// BURNOUT DETECTOR
// ═══════════════════════════════════════════════════════════════

async function detectBurnout() {
  const userInput = document.getElementById("burnoutInput").value.trim();
  const resultDiv = document.getElementById("burnoutResult");
  const btn       = document.getElementById("burnoutCheckBtn");

  btn.disabled    = true;
  btn.textContent = "Scanning… ⏳";
  resultDiv.innerHTML = '<div class="feature-loading"><div class="dot"></div><div class="dot"></div><div class="dot"></div><span>Analyzing burnout signals…</span></div>';

  const system = "You are a burnout prevention specialist. Always respond ONLY with valid JSON.";
  const prompt  =
    "Assess burnout risk."
    + (userInput ? '\nDescription: "' + userInput + '"\n' : "\n")
    + 'Respond with ONLY this JSON:\n'
    + '{"risk_level":"High","risk_score":78,"trend":"worsening","warning_signs":["persistent fatigue","emotional numbness"],"root_causes":["overwork","lack of boundaries"],"message":"You are showing significant burnout signals.","immediate_actions":["Take a full day off this week","Go offline for 2 hours tonight","Say no to one commitment"],"week_plan":["Day 1: 30min walk","Day 2: Sleep earlier","Day 3: Share feelings","Day 4: Do one thing you love","Day 5: Rest without guilt"],"affirmation":"You are not a machine. Rest is productive."}';

  try {
    const raw  = await callGroq(system, prompt);
    if (!raw) return;
    const data = parseGroqJSON(raw);

    const score      = data.risk_score || 0;
    const riskColors = {Low:"#4ade80", Moderate:"#fbbf24", High:"#f87171", Critical:"#9C27B0"};
    const riskColor  = riskColors[data.risk_level] || "#f87171";
    const trendIcons = {improving:"↑ Improving", stable:"→ Stable", worsening:"↓ Worsening"};
    const trendCls   = {improving:"result-tag-success", stable:"result-tag-warning", worsening:"result-tag-danger"};

    resultDiv.innerHTML =
      '<div class="result-card">'
      + '<div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;">'
      + '<div style="display:flex;flex-direction:column;gap:4px;flex:1;">'
      + '<div class="result-section-title">Burnout Risk Level</div>'
      + '<div style="font-size:32px;font-weight:700;color:' + riskColor + ';">' + data.risk_level + '</div>'
      + '<div class="burnout-meter">'
      + '<div style="display:flex;justify-content:space-between;font-size:10px;color:var(--muted);"><span>0</span><span>Risk Score: ' + score + '/100</span><span>100</span></div>'
      + '<div class="burnout-meter-track"><div class="burnout-meter-fill" style="width:' + score + '%;background:' + riskColor + ';"></div></div>'
      + '</div></div>'
      + '<span class="result-tag ' + (trendCls[data.trend] || "result-tag-warning") + '">' + (trendIcons[data.trend] || data.trend) + '</span></div>'
      + '<div style="background:rgba(248,113,113,0.07);border:1px solid rgba(248,113,113,0.2);border-radius:10px;padding:12px;font-size:13px;line-height:1.65;color:var(--text);">' + data.message + '</div>'
      + '<div class="result-section-title">⚠️ Warning Signs</div>'
      + '<div style="display:flex;flex-wrap:wrap;gap:4px;">' + (data.warning_signs || []).map(s => '<span class="result-tag result-tag-danger">• ' + s + '</span>').join("") + '</div>'
      + '<div class="result-section-title">🚨 Take Action Now</div>'
      + (data.immediate_actions || []).map((a, i) =>
          '<div style="display:flex;gap:10px;align-items:flex-start;padding:4px 0;">'
          + '<span style="color:var(--danger);font-weight:700;">0' + (i + 1) + '</span>'
          + '<span style="font-size:12px;color:var(--text);line-height:1.55;">' + a + '</span></div>'
        ).join("")
      + '<div class="result-section-title">📅 7-Day Recovery Plan</div>'
      + (data.week_plan || []).map((d, i) =>
          '<div class="result-row"><span style="color:var(--muted);">Day ' + (i + 1) + '</span>'
          + '<span style="font-size:12px;color:var(--text);text-align:right;max-width:70%;">' + d + '</span></div>'
        ).join("")
      + '<div style="background:rgba(124,106,255,0.08);border:1px solid rgba(124,106,255,0.2);border-radius:10px;padding:14px;font-size:13px;font-style:italic;color:var(--text);text-align:center;line-height:1.7;">'
      + '💜 "' + data.affirmation + '"</div>'
      + '</div>';
  } catch(e) {
    resultDiv.innerHTML = '<div class="no-data">Detection failed. Check your API key. 🙏</div>';
  }

  btn.disabled    = false;
  btn.textContent = "🔥 Check My Burnout Risk";
}

// ═══════════════════════════════════════════════════════════════
// CAREER EMOTION COACH
// ═══════════════════════════════════════════════════════════════

async function getCareerSuggestions() {
  const userInput = document.getElementById("careerInput").value.trim();
  const resultDiv = document.getElementById("careerResult");
  const btn       = document.getElementById("careerBtn");

  btn.disabled    = true;
  btn.textContent = "Analyzing… ⏳";
  resultDiv.innerHTML = '<div class="feature-loading"><div class="dot"></div><div class="dot"></div><div class="dot"></div><span>Matching your emotional personality to careers…</span></div>';

  const system = "You are an expert career counselor. Always respond ONLY with valid JSON.";
  const prompt  =
    "Suggest careers."
    + (userInput ? '\nDescription: "' + userInput + '"\n' : "\n")
    + 'Respond with ONLY this JSON:\n'
    + '{"dominant_traits":["empathetic","creative"],"emotional_superpower":"Deep empathy","work_style":"You thrive in calm environments","energy_type":"Introvert","avoid_environments":["High-pressure sales","Micromanagement"],"top_careers":[{"title":"UX Designer","match_score":91,"emoji":"🎨","reason":"Combines empathy with creativity","avg_salary":"$85,000","growth":"High"},{"title":"Therapist","match_score":88,"emoji":"🧠","reason":"Natural fit for your empathy","avg_salary":"$60,000","growth":"High"}],"skill_to_develop":"Setting boundaries","growth_tip":"Your empathy is a superpower.","next_step":"Take one online course this month"}';

  try {
    const raw  = await callGroq(system, prompt);
    if (!raw) return;
    const data = parseGroqJSON(raw);

    resultDiv.innerHTML =
      '<div class="result-card">'
      + '<div class="result-section-title">Your Emotional Profile</div>'
      + '<div style="font-size:13px;color:var(--text);line-height:1.6;">' + (data.work_style || "") + '</div>'
      + '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;">'
      + (data.dominant_traits || []).map(t => '<span class="result-tag result-tag-accent">✦ ' + t + '</span>').join("")
      + '<span class="result-tag result-tag-success">⚡ ' + (data.energy_type || "") + '</span></div>'
      + '<div style="background:rgba(124,106,255,0.08);border:1px solid rgba(124,106,255,0.2);border-radius:10px;padding:12px;font-size:12px;color:var(--text);line-height:1.65;">'
      + '<span style="color:var(--accent);font-weight:600;">🦸 Superpower: </span>' + (data.emotional_superpower || "") + '</div>'
      + '<div class="result-section-title">🎯 Top Career Matches</div>'
      + (data.top_careers || []).map(c =>
          '<div class="career-match-card">'
          + '<div style="display:flex;align-items:center;justify-content:space-between;">'
          + '<div class="career-match-title">' + c.emoji + " " + c.title + '</div>'
          + '<span style="font-size:13px;font-weight:700;color:var(--accent);">' + c.match_score + '%</span></div>'
          + '<div class="career-match-score-bar"><div class="career-match-score-fill" style="width:' + c.match_score + '%;"></div></div>'
          + '<div class="career-match-reason">' + c.reason + '</div>'
          + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:2px;">'
          + '<span class="result-tag result-tag-success" style="font-size:10px;">💰 ' + c.avg_salary + '</span>'
          + '<span class="result-tag result-tag-accent"  style="font-size:10px;">📈 ' + c.growth + ' Growth</span>'
          + '</div></div>'
        ).join("")
      + '<div class="result-section-title">❌ Avoid These Environments</div>'
      + '<div style="display:flex;flex-wrap:wrap;gap:4px;">'
      + (data.avoid_environments || []).map(e => '<span class="result-tag result-tag-danger">✗ ' + e + '</span>').join("")
      + '</div>'
      + '<div style="background:rgba(74,222,128,0.07);border:1px solid rgba(74,222,128,0.2);border-radius:10px;padding:14px;display:flex;flex-direction:column;gap:6px;">'
      + '<div style="font-size:11px;font-weight:600;color:var(--success);">💡 Growth Tip</div>'
      + '<div style="font-size:12px;color:var(--text);line-height:1.65;">' + (data.growth_tip || "") + '</div></div>'
      + '<div style="background:rgba(251,191,36,0.07);border:1px solid rgba(251,191,36,0.2);border-radius:10px;padding:14px;display:flex;flex-direction:column;gap:6px;">'
      + '<div style="font-size:11px;font-weight:600;color:var(--warning);">🚀 Your Next Step</div>'
      + '<div style="font-size:12px;color:var(--text);line-height:1.65;">' + (data.next_step || "") + '</div></div>'
      + '</div>';
  } catch(e) {
    resultDiv.innerHTML = '<div class="no-data">Could not load suggestions. Check your API key. 🙏</div>';
  }

  btn.disabled    = false;
  btn.textContent = "🚀 Get Career Matches";
}