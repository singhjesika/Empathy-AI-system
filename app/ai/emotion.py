try:
    from nrclex import NRCLex
    EMOTION_AVAILABLE = True
except ImportError:
    EMOTION_AVAILABLE = False

from app.config import NEGATIVE_EMOTIONS

NRCLEX_MAP = {
    "joy":          "joy",
    "trust":        "trust",
    "fear":         "fear",
    "surprise":     "surprise",
    "sadness":      "sadness",
    "disgust":      "disgust",
    "anger":        "anger",
    "anticipation": "anticipation",
}

from groq import Groq
from app.config import GROQ_API_KEY

client = Groq(api_key=GROQ_API_KEY)

def detect_emotion(text: str) -> str:
    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            temperature=0,
            max_tokens=10,
            messages=[
                {
                    "role": "system",
                    "content": """
You are an emotion analysis AI.

Return ONLY ONE WORD from this list:

happy
sad
anxious
lonely
stressed
angry
confused
hopeful
excited
overwhelmed
calm
motivated

No explanation.
No punctuation.
One word only.
"""
                },
                {
                    "role": "user",
                    "content": text
                }
            ]
        )

        emotion = response.choices[0].message.content.strip().lower()

        allowed = {
            "happy",
            "sad",
            "anxious",
            "lonely",
            "stressed",
            "angry",
            "confused",
            "hopeful",
            "excited",
            "overwhelmed",
            "calm",
            "motivated",
        }

        if emotion in allowed:
            return emotion

        return "general"

    except Exception:
        return "general"


def is_emotion_available() -> bool:
    return EMOTION_AVAILABLE


def calculate_risk_level(recent_emotions: list[str]) -> dict:
    if not recent_emotions:
        return {"level": "LOW", "score": 0, "message": None}

    negative_count = sum(1 for e in recent_emotions if e in NEGATIVE_EMOTIONS)
    total          = len(recent_emotions)
    ratio          = negative_count / total if total > 0 else 0

    streak = 0
    for e in reversed(recent_emotions):
        if e in NEGATIVE_EMOTIONS:
            streak += 1
        else:
            break

    if ratio >= 0.75 or streak >= 5:
        return {
            "level":   "HIGH",
            "score":   round(ratio * 100),
            "message": "You have been feeling consistently difficult emotions. Please take care of yourself. 💙",
        }
    elif ratio >= 0.5 or streak >= 3:
        return {
            "level":   "MEDIUM",
            "score":   round(ratio * 100),
            "message": "You have been stressed consistently this week. This may indicate early burnout.",
        }
    else:
        return {
            "level":   "LOW",
            "score":   round(ratio * 100),
            "message": None,
        }
