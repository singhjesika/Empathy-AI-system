import json
import logging
from groq import Groq
from app.config import GROQ_API_KEY, GROQ_MODEL
from app.database.queries import get_mood_summary, get_mood_timeline, get_history_from_db

logger = logging.getLogger(__name__)


def build_digital_twin(user_name: str) -> dict:
    client = Groq(api_key=GROQ_API_KEY)

    mood_summary = get_mood_summary(user_name)
    mood_timeline = get_mood_timeline(user_name)
    recent_history = get_history_from_db(user_name, limit=20)

    if not mood_summary or len(mood_summary) < 3:
        return {"error": "not_enough_data", "message": "Chat for a few more days to unlock your Digital Twin."}

    summary_text = ", ".join([f"{emotion}: {count} times" for emotion, count in mood_summary])
    timeline_text = str(mood_timeline[:10]) if mood_timeline else "No timeline data"
    history_text = "\n".join([f"User: {u}\nAI: {a}" for _, u, a in recent_history[:10]])

    prompt = f"""You are an Emotional Pattern Intelligence AI. Analyze this user's emotional data and build their Digital Twin profile.

Mood Summary: {summary_text}
Recent Timeline: {timeline_text}
Recent Conversations:
{history_text}

Respond ONLY with this exact JSON (no markdown):
{{
  "dominant_emotion": "their most frequent emotional state",
  "emotional_age": "e.g. Emotionally mature but self-critical",
  "core_wound": "The deep emotional pattern driving their struggles. One sentence.",
  "hidden_strength": "A strength they probably don't see in themselves. One sentence.",
  "patterns": [
    {{
      "trigger": "What causes this pattern",
      "pattern": "What happens emotionally",
      "frequency": "How often this occurs",
      "insight": "Deep psychological insight about this pattern"
    }},
    {{
      "trigger": "Second trigger",
      "pattern": "What happens emotionally",
      "frequency": "How often",
      "insight": "Deep insight"
    }},
    {{
      "trigger": "Third trigger",
      "pattern": "What happens emotionally",
      "frequency": "How often",
      "insight": "Deep insight"
    }}
  ],
  "predictions": [
    {{
      "risk": "Burnout",
      "probability": 78,
      "timeframe": "Within 10 days",
      "warning": "Specific warning based on their patterns",
      "prevention": "One specific action they can take today"
    }},
    {{
      "risk": "Emotional Withdrawal",
      "probability": 62,
      "timeframe": "Within 2 weeks",
      "warning": "Specific warning",
      "prevention": "One specific prevention action"
    }}
  ],
  "happiness_triggers": ["thing 1", "thing 2", "thing 3"],
  "energy_drains": ["drain 1", "drain 2", "drain 3"],
  "confidence_boosters": ["booster 1", "booster 2"],
  "twin_message": "A deeply personal message from the Digital Twin to the user. 2-3 sentences that feel like the AI truly knows them."
}}"""

    try:
        result = client.chat.completions.create(
            model=GROQ_MODEL,
            max_tokens=1500,
            temperature=0.75,
            messages=[
                {"role": "system", "content": "You are an Emotional Pattern Intelligence AI. Always respond ONLY with valid JSON."},
                {"role": "user", "content": prompt}
            ]
        )
        raw = result.choices[0].message.content.strip()
        raw = raw.replace("```json", "").replace("```", "").strip()
        twin_data = json.loads(raw)
        twin_data["data_points"] = len(mood_summary)
        twin_data["conversations_analyzed"] = len(recent_history)
        return twin_data
    except Exception as e:
        logger.error(f"Digital Twin error: {e}")
        return {"error": "generation_failed", "message": "Could not generate your Digital Twin right now."}


def get_live_twin_warning(user_name: str, current_message: str) -> dict:
    client = Groq(api_key=GROQ_API_KEY)

    mood_summary = get_mood_summary(user_name)
    recent_history = get_history_from_db(user_name, limit=10)

    if not mood_summary or len(mood_summary) < 3:
        return {"warning": False}

    summary_text = ", ".join([f"{emotion}: {count} times" for emotion, count in mood_summary])
    history_text = "\n".join([f"User: {u}" for _, u, a in recent_history[:5]])

    prompt = f"""Analyze if this user's current message shows a dangerous emotional pattern based on their history.

Their emotional history: {summary_text}
Recent messages: {history_text}
Current message: "{current_message}"

Respond ONLY with this JSON:
{{
  "warning": true or false,
  "risk_type": "Burnout / Depression Spiral / Anxiety Spike / Resignation Pattern / null",
  "probability": number 0-100,
  "message": "A specific warning message if warning is true, else null",
  "action": "One immediate action they can take, else null"
}}"""

    try:
        result = client.chat.completions.create(
            model=GROQ_MODEL,
            max_tokens=300,
            temperature=0.5,
            messages=[
                {"role": "system", "content": "You are an emotional pattern detector. Respond ONLY with valid JSON."},
                {"role": "user", "content": prompt}
            ]
        )
        raw = result.choices[0].message.content.strip()
        raw = raw.replace("```json", "").replace("```", "").strip()
        return json.loads(raw)
    except Exception as e:
        logger.error(f"Twin warning error: {e}")
        return {"warning": False}