import json
import logging
from collections import Counter

from app.config import GROQ_MODEL, GROQ_API_KEY
from app.database.db import get_connection
from app.services.chat_service import _call_groq_with_retry

logger = logging.getLogger(__name__)

NEGATIVE_EMOTIONS = {"anger", "fear", "sadness", "stress", "anxiety", "frustration"}
POSITIVE_EMOTIONS = {"joy", "trust", "anticipation", "surprise", "happiness", "calm"}
SOCIAL_EMOTIONS   = {"trust", "joy", "anticipation"}
CREATIVE_TOPICS   = {"study", "art", "music", "writing", "design", "ideas"}



def _load_mood_data(username: str) -> list[dict]:
    """Load last 30 mood entries from SQLite."""
    try:
        conn = get_connection()
        cur  = conn.cursor()
        cur.execute("""
            SELECT emotion, topic, user_input, created_at
            FROM mood_logs
            WHERE user_name = ?
            ORDER BY created_at DESC
            LIMIT 30
        """, (username,))
        rows = [dict(r) for r in cur.fetchall()]
        conn.close()
        return rows
    except Exception as e:
        logger.error(f"DB read error in career coach: {e}")
        return []


def _load_topic_frequency(username: str) -> dict:
    """Count how often each topic appears — reveals user's real interests."""
    try:
        conn = get_connection()
        cur  = conn.cursor()
        cur.execute("""
            SELECT topic, COUNT(*) as count
            FROM mood_logs
            WHERE user_name = ? AND topic IS NOT NULL
            GROUP BY topic
            ORDER BY count DESC
            LIMIT 10
        """, (username,))
        rows = {r["topic"]: r["count"] for r in cur.fetchall()}
        conn.close()
        return rows
    except Exception as e:
        logger.error(f"Topic frequency error: {e}")
        return {}



def _analyse_traits_locally(moods: list[dict], topics: dict) -> dict:
   
    if not moods:
        return {
            "stress_level":    "unknown",
            "social_energy":   "unknown",
            "creativity_hint": "unknown",
            "empathy_hint":    "unknown",
            "dominant_emotion": "general",
            "top_topics":      [],
        }

    emotions   = [m["emotion"] for m in moods]
    em_counter = Counter(emotions)
    total      = len(moods)

    stress_ratio  = sum(em_counter.get(e, 0) for e in NEGATIVE_EMOTIONS) / total
    social_ratio  = sum(em_counter.get(e, 0) for e in SOCIAL_EMOTIONS)   / total
    dominant      = em_counter.most_common(1)[0][0]

    topic_list    = list(topics.keys())[:5]
    creative_hint = any(t in CREATIVE_TOPICS for t in topic_list)

    return {
        "stress_level":    "high" if stress_ratio > 0.5 else "moderate" if stress_ratio > 0.25 else "low",
        "social_energy":   "high" if social_ratio > 0.4 else "moderate" if social_ratio > 0.2 else "low",
        "creativity_hint": "yes" if creative_hint else "unclear",
        "empathy_hint":    "yes" if em_counter.get("sadness", 0) + em_counter.get("trust", 0) > total * 0.2 else "moderate",
        "dominant_emotion": dominant,
        "top_topics":      topic_list,
    }



def _fallback_suggestions(traits: dict) -> dict:
    """
    Return decent career suggestions using only local trait analysis.
    Used when AI is unavailable.
    """
    stress   = traits["stress_level"]
    social   = traits["social_energy"]
    creative = traits["creativity_hint"]

    if creative == "yes" and social == "low":
        careers = [
            {"title": "UX / UI Designer",    "match_score": 88, "reason": "Creative, focused solo work with meaningful user impact"},
            {"title": "Content Writer",       "match_score": 84, "reason": "Independent creative work with flexible structure"},
            {"title": "Data Analyst",         "match_score": 79, "reason": "Quiet, structured problem-solving with clear outcomes"},
        ]
        work_style = "You thrive in calm, focused environments with creative freedom."
    elif social == "high":
        careers = [
            {"title": "Product Manager",      "match_score": 86, "reason": "Combines leadership, empathy, and collaborative energy"},
            {"title": "HR / People Partner",  "match_score": 82, "reason": "Your social energy makes team-building natural"},
            {"title": "Marketing Specialist", "match_score": 79, "reason": "Creative communication with people-facing outcomes"},
        ]
        work_style = "You energise others and do your best work in collaborative teams."
    else:
        careers = [
            {"title": "Software Developer",   "match_score": 85, "reason": "Balanced solo and team work with clear problem-solving"},
            {"title": "Project Coordinator",  "match_score": 80, "reason": "Structured work with meaningful deliverables"},
            {"title": "Research Analyst",     "match_score": 76, "reason": "Deep, independent work with measurable outcomes"},
        ]
        work_style = "You balance independence and collaboration well, suited to hybrid roles."

    avoid = ["High-pressure sales"] if stress == "high" else []
    if social == "low":
        avoid.append("Loud open-plan offices")

    return {
        "dominant_traits":    [traits["stress_level"] + " stress tolerance", "self-aware", "emotionally intelligent"],
        "work_style":         work_style,
        "avoid_environments": avoid or ["Unpredictable, chaotic workplaces"],
        "top_careers":        careers,
        "growth_tip":         "Keep tracking your emotions — self-awareness is your biggest career asset. 💙",
        "powered_by":         "local",
    }



def get_career_suggestions(username: str, user_input: str = "") -> dict:
    """
    Returns career suggestions dict. Never raises — always returns
    a safe, user-friendly response.
    """
    moods  = _load_mood_data(username)
    topics = _load_topic_frequency(username)
    traits = _analyse_traits_locally(moods, topics)

    
    if not moods:
        return {
            "dominant_traits":    ["curious", "self-aware"],
            "work_style":         "Chat with me more so I can understand your emotional work style! 🌱",
            "avoid_environments": [],
            "top_careers": [
                {"title": "Keep exploring!", "match_score": 0,
                 "reason": "Log more emotions so I can personalise your career matches."},
            ],
            "growth_tip":  "Start by chatting daily — even 2 minutes helps build your emotional profile.",
            "powered_by":  "local",
        }

    
    mood_summary = [
        {"emotion": m["emotion"], "topic": m.get("topic", "general")}
        for m in moods
    ]

    prompt = f"""You are an expert career counselor specializing in emotional intelligence.
Analyze this user's emotional patterns and suggest the best career paths.

Emotional data ({len(moods)} recent entries):
{json.dumps(mood_summary, indent=2)}

Most discussed topics: {json.dumps(topics)}

Local trait analysis: {json.dumps(traits)}

User's own words (if provided): "{user_input or 'Not provided'}"

Respond ONLY with a valid JSON object in this exact format:
{{
  "dominant_traits": ["trait1", "trait2", "trait3"],
  "work_style": "2-sentence description of how this person works best.",
  "avoid_environments": ["environment1", "environment2"],
  "top_careers": [
    {{
      "title": "Career Title",
      "match_score": 91,
      "reason": "One sentence explaining why this fits their emotional pattern."
    }},
    {{
      "title": "Career Title",
      "match_score": 85,
      "reason": "One sentence explaining why this fits their emotional pattern."
    }},
    {{
      "title": "Career Title",
      "match_score": 79,
      "reason": "One sentence explaining why this fits their emotional pattern."
    }}
  ],
  "growth_tip": "One specific, actionable tip based on their emotional data."
}}

Rules:
- dominant_traits: 3 specific personality traits derived from the data
- match_score: integer 0-100
- Be specific to THEIR data — not generic advice
- Return ONLY the JSON. No markdown, no extra text."""

    try:
        raw = _call_groq_with_retry(
            messages=[{"role": "user", "content": prompt}],
            max_tokens=500,
            temperature=0.6,
        )

    
        raw = raw.strip().replace("```json", "").replace("```", "").strip()

        
        start = raw.find("{")
        end   = raw.rfind("}") + 1
        if start != -1 and end > start:
            raw = raw[start:end]

        result = json.loads(raw)

        
        result.setdefault("dominant_traits",    traits.get("dominant_emotion", "general"))
        result.setdefault("work_style",         "You have a unique emotional work style worth exploring.")
        result.setdefault("avoid_environments", [])
        result.setdefault("top_careers",        [])
        result.setdefault("growth_tip",         "Keep reflecting on your emotions — it's your superpower. 💙")
        result["powered_by"] = "ai"

        for career in result.get("top_careers", []):
            if "match_score" in career:
                career["match_score"] = max(0, min(100, int(career["match_score"])))

        return result

    except json.JSONDecodeError:
        logger.warning(f"Career coach AI returned invalid JSON for {username} — using local fallback")
        return _fallback_suggestions(traits)

    except Exception as e:
        logger.error(f"Career coach error for {username}: {e}")
        return _fallback_suggestions(traits)