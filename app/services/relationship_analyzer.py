import json
import os
from dotenv import load_dotenv
from groq import Groq

load_dotenv()

from app.config import GROQ_MODEL

client = Groq(api_key=os.environ.get("GROQ_API_KEY"))


def analyze_relationship(user_name: str, conversation_text: str) -> dict:
    if not conversation_text or not conversation_text.strip():
        return {
            "compatibility_score": 0,
            "person_a_style": "Unknown",
            "person_b_style": "Unknown",
            "emotional_triggers": [],
            "red_flags": [],
            "strengths": [],
            "suggestions": ["Please provide a conversation to analyze."],
        }

    prompt = f"""
You are an expert relationship and emotional intelligence analyst.
Analyze the following conversation and provide:
1. Emotional Compatibility Score (0-100)
2. Communication Style of each person (Assertive / Passive / Aggressive / Empathetic)
3. Emotional Triggers detected
4. Red flags (if any)
5. Strengths in the relationship
6. 3 actionable suggestions to improve emotional connection

Conversation:
{conversation_text}

Respond ONLY with a valid JSON object in this exact format (no extra text, no markdown):
{{
  "compatibility_score": 78,
  "person_a_style": "Empathetic",
  "person_b_style": "Assertive",
  "emotional_triggers": ["feeling ignored", "work stress"],
  "red_flags": ["dismissive responses", "lack of validation"],
  "strengths": ["open communication", "shared humor"],
  "suggestions": ["suggestion1", "suggestion2", "suggestion3"]
}}

Rules:
- compatibility_score must be an integer between 0 and 100
- person_a_style and person_b_style must be one of: Assertive, Passive, Aggressive, Empathetic
- Return ONLY the JSON. No explanation, no markdown fences.
"""

    try:
        response = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
        )
        raw = response.choices[0].message.content
        raw = raw.strip().replace("```json", "").replace("```", "").strip()
        return json.loads(raw)

    except json.JSONDecodeError:
        return {
            "compatibility_score": 0,
            "person_a_style": "Unknown",
            "person_b_style": "Unknown",
            "emotional_triggers": [],
            "red_flags": [],
            "strengths": [],
            "suggestions": ["Could not parse analysis. Please try again."],
        }

    except Exception as e:
        return {
            "compatibility_score": 0,
            "person_a_style": "Unknown",
            "person_b_style": "Unknown",
            "emotional_triggers": [],
            "red_flags": [],
            "strengths": [],
            "suggestions": [f"Analysis failed: {str(e)}"],
        }