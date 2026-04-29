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

# ── Friendly fallback messages shown to user when AI fails ──────────────────
_FALLBACK_RESPONSES = [
    "I'm here with you, even if I'm a little slow right now. Tell me more. 💙",
    "Something got in the way of my response — but I'm listening. How are you feeling? 🌿",
    "I had a small hiccup, but I'm still here for you. Want to share more? 💜",
]
_fallback_index = 0


def _get_fallback() -> str:
    global _fallback_index
    msg = _FALLBACK_RESPONSES[_fallback_index % len(_FALLBACK_RESPONSES)]
    _fallback_index += 1
    return msg


# ── Core retry wrapper ───────────────────────────────────────────────────────
def _call_groq_with_retry(
    messages: list,
    max_tokens: int = 300,
    temperature: float = 0.75,
    retries: int = 3,
) -> str:
    """
    Call Groq API with automatic retry on transient errors.
    Returns AI text on success, or a friendly fallback string on failure.
    Never raises — safe to call anywhere.
    """
    client = Groq(api_key=GROQ_API_KEY)

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
            error_str = str(e).lower()

            # Wrong / missing API key — retrying won't help
            if "invalid api key" in error_str or "401" in error_str or "authentication" in error_str:
                logger.error("Groq auth error — check GROQ_API_KEY in .env")
                return _get_fallback()

            # Rate limited — wait with exponential back-off
            if "rate limit" in error_str or "429" in error_str:
                wait = 2 ** attempt        # 1 s, 2 s, 4 s
                logger.warning(f"Groq rate limited. Waiting {wait}s (attempt {attempt + 1})")
                time.sleep(wait)
                continue

            # Last attempt — give up gracefully
            if attempt == retries - 1:
                logger.error(f"Groq failed after {retries} attempts: {e}")
                return _get_fallback()

            # Other transient error — short wait then retry
            logger.warning(f"Groq error (attempt {attempt + 1}): {e}")
            time.sleep(1)

    return _get_fallback()


# ── Personality helpers ──────────────────────────────────────────────────────
def set_personality(user_name: str, mode: str) -> str:
    if mode not in PERSONALITY_MODES:
        mode = "friend"
    _personalities[user_name] = mode
    return mode


def get_personality(user_name: str) -> str:
    return _personalities.get(user_name, "friend")


# ── Main chat handler ────────────────────────────────────────────────────────
def handle_turn(message: str, user_name: str) -> dict:
    personality   = get_personality(user_name)
    cfg           = PERSONALITY_MODES[personality]
    system_prompt = cfg.get(
        "system_hint",
        "You are a compassionate AI assistant. Be warm, supportive, and emotionally intelligent.",
    )

    emotion = detect_emotion(message)
    topic   = None

    # ✅ All Groq calls now go through the retry wrapper
    response = _call_groq_with_retry(
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": message},
        ],
        max_tokens=300,
        temperature=0.75,
    )

    response_mode = cfg.get("label", "Empathetic")

    # Save to DB — silent on failure so chat always continues
    try:
        from app.database.queries import save_mood, save_emotion
        save_mood(user_name, message, emotion, topic or "general", response)
        save_emotion(user_name, emotion, 100)
    except Exception as db_err:
        logger.warning(f"DB save failed for {user_name}: {db_err}")

    add_xp(user_name, "chat", XP_PER_SESSION)
    total_xp              = get_total_xp(user_name)
    lvl_num, lvl_title, _ = get_level(total_xp)
    prediction            = get_emotion_trend(user_name)

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


# ── CLI helpers (unchanged) ──────────────────────────────────────────────────
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