import json
import logging
from groq import Groq
from app.config import GROQ_API_KEY, GROQ_MODEL

logger = logging.getLogger(__name__)

def generate_time_machine(user_input: str) -> dict:
    client = Groq(api_key=GROQ_API_KEY)

    prompt = f"""You are an Emotional Time Machine AI. The user shared their current emotional state.
Generate 3 vivid future simulations based on different paths they could take.

User's current state: "{user_input}"

Respond ONLY with this exact JSON (no markdown, no backticks):
{{
  "current_summary": "One sentence summary of their current emotional state",
  "futures": [
    {{
      "id": "same_path",
      "title": "Continue Same Path",
      "emoji": "😔",
      "timeframe": "6 Months Later",
      "stats": {{
        "stress": 91,
        "confidence": 22,
        "burnout_risk": "Extreme",
        "happiness": 18,
        "relationship_health": "Declining"
      }},
      "story": "A deeply personal 2-3 sentence story of what their life looks like if nothing changes. Use second person. Be specific and emotional.",
      "ai_message": "A raw honest message from this future self. One powerful sentence."
    }},
    {{
      "id": "small_changes",
      "title": "Small Changes Path",
      "emoji": "🌱",
      "timeframe": "6 Months Later",
      "stats": {{
        "stress": 42,
        "confidence": 71,
        "burnout_risk": "Low",
        "happiness": 65,
        "relationship_health": "Improving"
      }},
      "story": "A hopeful 2-3 sentence story of what their life looks like with small consistent changes. Specific and warm.",
      "ai_message": "An encouraging message from this future self. One powerful sentence."
    }},
    {{
      "id": "best_version",
      "title": "Best Version Path",
      "emoji": "🏆",
      "timeframe": "1 Year Later",
      "stats": {{
        "stress": 18,
        "confidence": 94,
        "burnout_risk": "None",
        "happiness": 91,
        "relationship_health": "Thriving"
      }},
      "story": "An inspiring 2-3 sentence story of their best possible future. Deeply personal and emotional.",
      "ai_message": "A powerful message from their best future self. One sentence that gives chills."
    }}
  ]
}}"""

    try:
        result = client.chat.completions.create(
            model=GROQ_MODEL,
            max_tokens=1200,
            temperature=0.85,
            messages=[
                {"role": "system", "content": "You are an Emotional Time Machine. Always respond ONLY with valid JSON."},
                {"role": "user", "content": prompt}
            ]
        )
        raw = result.choices[0].message.content.strip()
        raw = raw.replace("```json", "").replace("```", "").strip()
        return json.loads(raw)
    except Exception as e:
        logger.error(f"Time Machine error: {e}")
        return None


def chat_with_future_self(future_id: str, future_story: str, user_message: str, history: list) -> str:
    client = Groq(api_key=GROQ_API_KEY)

    system = f"""You ARE the user's future self from the "{future_id}" timeline.
Your story: {future_story}
Speak in first person. You REMEMBER being where they are now.
Be deeply emotional, specific, and real. Never break character.
Keep responses to 3-4 sentences. Never say you are an AI."""

    messages = [{"role": "system", "content": system}]
    messages.extend(history)
    messages.append({"role": "user", "content": user_message})

    try:
        result = client.chat.completions.create(
            model=GROQ_MODEL,
            max_tokens=300,
            temperature=0.85,
            messages=messages
        )
        return result.choices[0].message.content.strip()
    except Exception as e:
        logger.error(f"Future self chat error: {e}")
        return "I'm here. Ask me anything about where this path leads."