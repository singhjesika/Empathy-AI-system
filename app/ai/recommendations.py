import random
from app.config import RESPONSES, EMOTION_LABELS, NEGATIVE_EMOTIONS


def get_response(
    emotion: str,
    topic: str | None,
    user_name: str | None = None,
) -> tuple[str, str]:
    name_part = f" {user_name}," if user_name else ""

    TOPIC_OVERRIDES = {"farewell", "greeting", "study", "stress", "health"}
    if topic in TOPIC_OVERRIDES:
        category = topic
        emotion  = topic
    else:
        category = emotion if emotion in RESPONSES else "general"

    PREFIX_MAP = {
        "study":    "Study tip: ",
        "stress":   f"I hear you{name_part} — ",
        "health":   "Your well-being matters! ",
        "greeting": "",
        "farewell": "",
    }
    prefix = PREFIX_MAP.get(category, "")
    text   = prefix + random.choice(RESPONSES.get(category, RESPONSES["general"]))
    return text, emotion


def format_emotion_label(emotion: str, mode: str = "fallback") -> str:
    label = EMOTION_LABELS.get(emotion, "")
    if mode == "groq":
        return "🧠 [Groq AI]\n"
    if label:
        return f"  [Emotion: {label}]\n"
    return ""


def get_topic_intelligence(user_name: str) -> dict:
    try:
        from app.database.db import get_connection
        conn = get_connection()
        cur  = conn.cursor()

        cur.execute("""
            SELECT topic, COUNT(*) as count
            FROM mood_logs
            WHERE user_name = ?
              AND topic IS NOT NULL
              AND topic != 'general'
            GROUP BY topic
            ORDER BY count DESC
            LIMIT 1
        """, (user_name,))
        top_topic_row = cur.fetchone()

        cur.execute("""
            SELECT topic,
                   SUM(CASE WHEN emotion IN ('sadness','anger','fear','disgust','stress') THEN 1 ELSE 0 END) as neg,
                   COUNT(*) as total
            FROM mood_logs
            WHERE user_name = ?
              AND topic IS NOT NULL
              AND topic != 'general'
            GROUP BY topic
            ORDER BY neg DESC
            LIMIT 1
        """, (user_name,))
        stress_topic_row = cur.fetchone()

        cur.execute("""
            SELECT topic, emotion, COUNT(*) as count
            FROM mood_logs
            WHERE user_name = ?
              AND topic IS NOT NULL
              AND topic != 'general'
              AND emotion IN ('sadness','anger','fear','disgust','stress')
            GROUP BY topic, emotion
            ORDER BY count DESC
            LIMIT 3
        """, (user_name,))
        combos = [dict(r) for r in cur.fetchall()]

        conn.close()

        top_topic    = top_topic_row["topic"]    if top_topic_row    else None
        stress_topic = stress_topic_row["topic"] if stress_topic_row else None
        stress_neg   = stress_topic_row["neg"]   if stress_topic_row else 0

        message = None
        if stress_topic and stress_neg >= 2:
            message = f"Most of your stress seems to be related to {stress_topic}."
        elif top_topic:
            message = f"You talk most about {top_topic}."

        return {
            "top_topic":    top_topic,
            "stress_topic": stress_topic,
            "combos":       combos,
            "message":      message,
        }

    except Exception:
        return {"top_topic": None, "stress_topic": None, "combos": [], "message": None}