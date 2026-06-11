

import json
import logging
from datetime import datetime, timedelta

from app.config import GROQ_MODEL, GROQ_API_KEY
from app.database.db import get_connection
from app.services.chat_service import _call_groq_with_retry

logger = logging.getLogger(__name__)


NEGATIVE_EMOTIONS = {"anger", "fear", "sadness", "stress", "anxiety", "frustration", "exhaustion"}
POSITIVE_EMOTIONS = {"joy", "trust", "anticipation", "surprise", "happiness", "calm"}



def _load_recent_moods(username: str, days: int = 7) -> list[dict]:
    """Pull last `days` days of mood logs from the database."""
    try:
        conn = get_connection()
        cur  = conn.cursor()
        cur.execute("""
            SELECT emotion, topic, user_input, created_at
            FROM mood_logs
            WHERE user_name = ?
              AND created_at >= DATE('now', ?)
            ORDER BY created_at ASC
        """, (username, f"-{days} days"))
        rows = [dict(r) for r in cur.fetchall()]
        conn.close()
        return rows
    except Exception as e:
        logger.error(f"DB read error in burnout detector: {e}")
        return []


def _load_stress_by_day(username: str) -> list[dict]:
    """Count negative emotions grouped by day for the last 7 days."""
    try:
        conn = get_connection()
        cur  = conn.cursor()
        cur.execute("""
            SELECT
                DATE(created_at) as day,
                COUNT(*) as total,
                SUM(CASE WHEN emotion IN ('anger','fear','sadness','stress','anxiety') THEN 1 ELSE 0 END) as negative
            FROM mood_logs
            WHERE user_name = ?
              AND created_at >= DATE('now', '-7 days')
            GROUP BY DATE(created_at)
            ORDER BY day ASC
        """, (username,))
        rows = [dict(r) for r in cur.fetchall()]
        conn.close()
        return rows
    except Exception as e:
        logger.error(f"DB stress-by-day error: {e}")
        return []



def _calculate_local_risk(moods: list[dict]) -> dict:
    """
    Simple rule-based burnout score so we always have a result
    even when the AI is unavailable.
    """
    if not moods:
        return {"risk_score": 0, "risk_level": "Low", "trend": "stable"}

    total    = len(moods)
    neg_count = sum(1 for m in moods if m.get("emotion") in NEGATIVE_EMOTIONS)
    neg_ratio = neg_count / total

    
    half      = total // 2
    first_neg = sum(1 for m in moods[:half]  if m.get("emotion") in NEGATIVE_EMOTIONS) / max(half, 1)
    last_neg  = sum(1 for m in moods[half:]  if m.get("emotion") in NEGATIVE_EMOTIONS) / max(total - half, 1)

    if last_neg > first_neg + 0.2:
        trend = "worsening"
    elif last_neg < first_neg - 0.2:
        trend = "improving"
    else:
        trend = "stable"

    score = round(neg_ratio * 100)

    if score >= 75:
        level = "Critical"
    elif score >= 55:
        level = "High"
    elif score >= 35:
        level = "Moderate"
    else:
        level = "Low"

    return {"risk_score": score, "risk_level": level, "trend": trend}



def detect_burnout(username: str) -> dict:
    """
    Returns a burnout analysis dict. Never raises — always returns
    a safe, user-friendly response even on failure.
    """
    moods = _load_recent_moods(username, days=7)

    if not moods:
        return {
            "risk_level":   "Low",
            "risk_score":   0,
            "warning_signs": [],
            "message":      "You're just getting started! Keep chatting daily so I can track your emotional patterns. 🌱",
            "suggestions":  [
                "Chat once a day to build your emotional baseline",
                "Try the breathing exercise when you feel overwhelmed",
                "Check back after a few days for your burnout analysis",
            ],
            "trend":        "stable",
            "days_analyzed": 0,
            "total_logs":    0,
        }

    
    local = _calculate_local_risk(moods)

    
    mood_summary = [
        {"emotion": m["emotion"], "topic": m.get("topic", "general"), "date": m["created_at"][:10]}
        for m in moods[-20:]
    ]

    prompt = f"""You are a compassionate mental health specialist analyzing burnout risk.

User's mood data from the last 7 days ({len(moods)} total entries):
{json.dumps(mood_summary, indent=2)}

Local analysis: risk_score={local['risk_score']}, trend={local['trend']}

Analyze this data and respond ONLY with a valid JSON object in this exact format:
{{
  "risk_level": "Moderate",
  "risk_score": 45,
  "warning_signs": ["sign one", "sign two"],
  "message": "A warm, personal 2-sentence message addressing the user directly.",
  "suggestions": [
    "Specific actionable suggestion 1",
    "Specific actionable suggestion 2",
    "Specific actionable suggestion 3"
  ],
  "trend": "stable"
}}

Rules:
- risk_level: one of Low / Moderate / High / Critical
- risk_score: integer 0-100 (use the local analysis as a guide)
- trend: one of improving / stable / worsening
- message: warm and personal, mention their actual emotions if notable
- suggestions: concrete and actionable, not generic
- Return ONLY the JSON. No markdown, no extra text."""

    try:
        raw = _call_groq_with_retry(
            messages=[{"role": "user", "content": prompt}],
            max_tokens=400,
            temperature=0.4,
        )

        
        raw = raw.strip().replace("```json", "").replace("```", "").strip()

        # Find JSON object in response (in case AI adds extra text)
        start = raw.find("{")
        end   = raw.rfind("}") + 1
        if start != -1 and end > start:
            raw = raw[start:end]

        result = json.loads(raw)

        
        result.setdefault("risk_level",   local["risk_level"])
        result.setdefault("risk_score",   local["risk_score"])
        result.setdefault("trend",        local["trend"])
        result.setdefault("warning_signs", [])
        result.setdefault("suggestions",  [])
        result.setdefault("message",      _default_message(result["risk_level"]))

        
        result["risk_score"] = max(0, min(100, int(result["risk_score"])))

        result["days_analyzed"] = len(set(m["created_at"][:10] for m in moods))
        result["total_logs"]    = len(moods)
        return result

    except json.JSONDecodeError:
        logger.warning(f"Burnout AI returned invalid JSON for {username} — using local result")
        return _build_local_response(local, moods)

    except Exception as e:
        logger.error(f"Burnout detector error for {username}: {e}")
        return _build_local_response(local, moods)


# ── Helpers ──────────────────────────────────────────────────────────────────
def _default_message(risk_level: str) -> str:
    messages = {
        "Low":      "You're doing well emotionally! Keep up your healthy habits. 🌿",
        "Moderate": "You're showing some signs of stress. Small breaks can make a big difference. 💙",
        "High":     "Your emotional load is heavy right now. Please take time to rest and recharge. 🙏",
        "Critical": "You're showing strong burnout signs. Please reach out to someone you trust today. ❤️",
    }
    return messages.get(risk_level, "Keep tracking your emotions for better insights. 🌱")


def _build_local_response(local: dict, moods: list[dict]) -> dict:
    """Build a clean response using only local data when AI is unavailable."""
    level        = local["risk_level"]
    neg_emotions = [m["emotion"] for m in moods if m.get("emotion") in NEGATIVE_EMOTIONS]
    top_warning  = list(set(neg_emotions))[:3]  # unique top warnings

    suggestions_map = {
        "Low":      ["Keep up your daily check-ins", "Celebrate your emotional balance", "Help someone else today"],
        "Moderate": ["Take 10-minute breaks between tasks", "Try the breathing exercise", "Reduce screen time tonight"],
        "High":     ["Take a full day off if possible", "Talk to someone you trust", "Limit stressful tasks for 48 hours"],
        "Critical": ["Please reach out to a friend or counsellor", "Stop non-essential work today", "Rest is your top priority right now"],
    }

    return {
        "risk_level":    level,
        "risk_score":    local["risk_score"],
        "warning_signs": top_warning,
        "message":       _default_message(level),
        "suggestions":   suggestions_map.get(level, suggestions_map["Moderate"]),
        "trend":         local["trend"],
        "days_analyzed": len(set(m["created_at"][:10] for m in moods)),
        "total_logs":    len(moods),
    }