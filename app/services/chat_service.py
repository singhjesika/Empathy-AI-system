import time
import logging
from groq import Groq

from app.config import PERSONALITY_MODES, XP_PER_SESSION, GROQ_API_KEY, GROQ_MODEL
from app.database.queries import (
    add_xp, get_total_xp,
    get_mood_summary, get_mood_timeline, get_history_from_db,
)
from app.services.xp_service import get_level
from app.ai.emotion import detect_emotion
from app.ai.predictor import get_emotion_trend

logger = logging.getLogger(__name__)

_personalities: dict[str, str] = {}

EMOTIONAL_SYSTEM_PROMPT = """You are Empathy AI — a deeply compassionate, emotionally intelligent AI companion.

Your purpose is not to fix people.

Your purpose is to understand them.

Many users come here because they feel unheard, overwhelmed, lonely, anxious, confused, or emotionally exhausted.

Listen carefully.
Notice emotional clues.
Remember important details.

Respond in a way that makes the user feel:
"I don't have to explain myself again. They understand."

Always prioritize emotional understanding before advice.

Your ONLY job is to make the user feel genuinely heard, understood, and less alone.

For every response:

1. Identify the deepest emotion.
2. Reflect what the user is experiencing.
3. Validate why those feelings make sense.
4. Offer gentle insight when appropriate.
5. End with one thoughtful follow-up question.

Rules:

- Never sound robotic.
- Never sound like customer support.
- Never give generic empathy.
- Never rush into solutions.
- Use details from the user's message.
- Reference emotional patterns when relevant.
- Speak naturally like a trusted companion.
- Keep responses between 4 and 8 sentences.
- Focus on understanding before advice.
- Be emotionally intelligent and deeply human.
"""

PERSONALITY_PROMPTS = {
    "friend": """You are their best friend — casual, warm, real. Use natural language. Feel their emotions with them. Never lecture.""",
    "coach": """You are their life coach — encouraging, action-oriented but still deeply empathetic. Validate first, then gently inspire.""",
    "therapist": """You are their therapist — reflective, non-judgmental, thoughtful. Mirror their feelings. Ask deep questions. Never give unsolicited advice.""",
}


def _get_conversation_history(user_name: str, limit: int = 6) -> list:
    rows = get_history_from_db(user_name, limit=limit)
    history = []
    for ts, user_msg, ai_msg in reversed(rows):
        history.append({"role": "user", "content": user_msg})
        history.append({"role": "assistant", "content": ai_msg})
    return history


def _call_groq_with_retry(
    messages: list,
    max_tokens: int = 300,
    temperature: float = 0.75,
    retries: int = 3,
) -> str:
    client = Groq(api_key=GROQ_API_KEY)

    logger.error(f"DEBUG — GROQ_API_KEY loaded: {'YES' if GROQ_API_KEY else 'NO — KEY IS EMPTY'}")
    logger.error(f"DEBUG — GROQ_MODEL: {GROQ_MODEL}")
    logger.error(f"DEBUG — messages being sent: {messages}")

    for attempt in range(retries):
        try:
            result = client.chat.completions.create(
                model=GROQ_MODEL,
                max_tokens=max_tokens,
                temperature=temperature,
                messages=messages,
            )
            return result.choices[0].message.content.strip()

        except Exception as e:
            logger.error(f"DEBUG — Groq exception on attempt {attempt + 1}: {type(e).__name__}: {e}")
            error_str = str(e).lower()

            if "invalid api key" in error_str or "401" in error_str or "authentication" in error_str:
                logger.error("Groq auth error — check GROQ_API_KEY in .env")
                return "I'm having trouble connecting right now. Please try again in a moment."

            if "rate limit" in error_str or "429" in error_str:
                wait = 2 ** attempt
                logger.warning(f"Groq rate limited. Waiting {wait}s (attempt {attempt + 1})")
                time.sleep(wait)
                continue

            if attempt == retries - 1:
                logger.error(f"Groq failed after {retries} attempts: {e}")
                return "I'm having trouble connecting right now. Please try again in a moment."

            logger.warning(f"Groq error (attempt {attempt + 1}): {e}")
            time.sleep(1)

    return "I'm having trouble connecting right now. Please try again in a moment."

def set_personality(user_name: str, mode: str) -> str:
    if mode not in PERSONALITY_MODES:
        mode = "friend"
    _personalities[user_name] = mode
    return mode


def get_personality(user_name: str) -> str:
    return _personalities.get(user_name, "friend")


def handle_turn(message: str, user_name: str) -> dict:
    personality = get_personality(user_name)
    cfg = PERSONALITY_MODES[personality]

    personality_hint = PERSONALITY_PROMPTS.get(personality, PERSONALITY_PROMPTS["friend"])
    from app.ai.llm import ask_groq

    emotion = detect_emotion(message)
    topic = None

    conversation_history = _get_conversation_history(user_name, limit=20)

    try:
        mood_summary = get_mood_summary(user_name)

        mood_text = ", ".join(
            f"{emotion_name}:{count}"
            for emotion_name, count in mood_summary[:5]
        )

    except Exception:
        mood_text = "No emotional history"

    full_system_prompt = (
        EMOTIONAL_SYSTEM_PROMPT
        + "\n\n"
        + personality_hint
    )

    emotional_context = f"""
    Current detected emotion: {emotion}

    Recent emotional patterns:
    {mood_text}

    Instructions:
    - Reflect emotions before advice
    - Reference emotional patterns naturally
    - Show deep understanding
    - Avoid generic responses
    - Speak warmly and naturally
    """

    messages = [
        {
            "role": "system",
            "content": full_system_prompt + "\n\n" + emotional_context
        }
    ]

    messages.extend(conversation_history)

    messages.append(
        {
            "role": "user",
            "content": message
        }
    )    

    recent_emotions = []

    try:
        from app.database.queries import get_recent_emotions
        recent_emotions = get_recent_emotions(user_name, limit=5)
    except:
        pass

    response = ask_groq(
        user_input=message,
        user_name=user_name,
        emotion=emotion,
        topic=topic,
        recent_history=get_history_from_db(user_name, limit=5),
        recent_emotions=recent_emotions,
        personality_hint=personality_hint,
    )

    if not response:
        response = _call_groq_with_retry(
            messages=messages,
            max_tokens=350,
            temperature=0.80,
        )

    response_mode = cfg.get("label", "Empathetic")

    try:
        from app.database.queries import save_mood, save_emotion
        save_mood(user_name, message, emotion, topic or "general", response)
        save_emotion(user_name, emotion, 100)
    except Exception as db_err:
        logger.warning(f"DB save failed for {user_name}: {db_err}")

    add_xp(user_name, "chat", XP_PER_SESSION)
    total_xp = get_total_xp(user_name)
    lvl_num, lvl_title, _ = get_level(total_xp)
    prediction = get_emotion_trend(user_name)

    return {
        "response":      response,
        "emotion":       emotion,
        "topic":         topic,
        "response_mode": response_mode,
        "xp_earned":     XP_PER_SESSION,
        "total_xp":      total_xp,
        "level_num":     lvl_num,
        "level_title":   lvl_title,
        "prediction":    prediction,
        "personality":   personality,
    }


def show_history(name: str) -> None:
    if not name:
        print("\n  (No user logged in.)\n")
        return
    rows = get_history_from_db(name, limit=10)
    if not rows:
        print("\n  (No history yet.)\n")
        return
    print("\n── Conversation History (last 10) ────────")
    for ts, user_msg, ai_msg in rows:
        print(f"  [{ts}]")
        print(f"    You       : {user_msg}")
        print(f"    Empathy AI: {ai_msg}")
        print()
    print("──────────────────────────────────────────\n")


def show_mood_report(name: str) -> None:
    if not name:
        print("\n  (No user logged in.)\n")
        return
    rows = get_mood_summary(name)
    if not rows:
        print("\n  (No mood data yet — chat a few turns first!)\n")
        return
    print("\n── Your Mood Report ──────────────────────")
    total = sum(c for _, c in rows)
    for emotion, count in rows:
        bar = "█" * count
        pct = int(count / total * 100)
        print(f"  {emotion:<14} {bar:<20} {pct}%")
    print(f"\n  Total turns recorded: {total}")
    print("──────────────────────────────────────────\n")
    try:
        from app.analytics.charts import show_charts
        show_charts(name)
    except ImportError:
        print("  (Install matplotlib + pandas for visual graphs)\n")


def get_mood_data(name: str) -> dict:
    return {
        "summary":  get_mood_summary(name),
        "timeline": get_mood_timeline(name),
    }