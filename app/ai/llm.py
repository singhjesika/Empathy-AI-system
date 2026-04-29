import os
import logging
from app.config import GROQ_API_KEY, GROQ_MODEL, GROQ_MAX_TOKENS, PERSONALITY_MODES, DEFAULT_PERSONALITY

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

try:
    from groq import Groq
    LLM_AVAILABLE = True
    logger.info("✅ Groq loaded.")
except ImportError:
    LLM_AVAILABLE = False
    logger.error("❌ Groq not installed. Run: pip install groq")


def _get_api_key() -> str:
    return GROQ_API_KEY or os.environ.get("GROQ_API_KEY", "")


CRISIS_KEYWORDS = [
    "kill myself", "want to die", "end my life", "suicide",
    "can't take it anymore", "no reason to live", "give up on life",
    "harm myself", "hurt myself",
]

def _is_crisis(text: str) -> bool:
    t = text.lower()
    return any(kw in t for kw in CRISIS_KEYWORDS)


def _message_length(text: str) -> str:
    words = len(text.split())
    if words <= 4:
        return "very short (reply in 1-2 short sentences only)"
    elif words <= 12:
        return "short (reply in 2 sentences)"
    else:
        return "detailed (reply in 3 sentences)"


def ask_groq(
    user_input: str,
    user_name: str,
    emotion: str,
    topic: str | None,
    recent_history: list[tuple],
    recent_emotions: list[str] | None = None,
    personality_hint: str | None = None,
) -> str | None:

    if not LLM_AVAILABLE:
        logger.warning("❌ Groq not available.")
        return None

    api_key = _get_api_key()
    if not api_key:
        logger.error("❌ No API key.")
        return None

    try:
        client = Groq(api_key=api_key)

        if _is_crisis(user_input):
            logger.warning(f"🚨 Crisis detected for {user_name}")
            crisis_prompt = f"""You are a calm, caring crisis support companion talking to {user_name}.
They may be in emotional distress. Respond with extreme gentleness and care.
1. Acknowledge their pain sincerely.
2. Tell them they are not alone.
3. Gently suggest speaking to someone they trust or a helpline.
4. Never be dismissive. Never give advice. Just be present.
Keep it to 3 warm sentences."""
            result = client.chat.completions.create(
                model=GROQ_MODEL, max_tokens=150, temperature=0.5,
                messages=[
                    {"role": "system", "content": crisis_prompt},
                    {"role": "user",   "content": user_input},
                ],
            )
            return "🚨 " + result.choices[0].message.content.strip()

        history_text = ""
        if recent_history:
            history_text = "\n[Recent conversation]\n"
            for _ts, u_msg, ai_msg in recent_history[-5:]:
                clean_ai = ai_msg.split("\n", 1)[-1].strip() if "\n" in ai_msg else ai_msg.strip()
                history_text += f"User: {u_msg}\nYou: {clean_ai}\n"

        emotion_memory = ""
        if recent_emotions and len(recent_emotions) >= 2:
            prev = recent_emotions[-2] if len(recent_emotions) >= 2 else None
            if prev and prev != emotion:
                emotion_memory = f"\n[Emotion shift: Previously felt '{prev}', now '{emotion}' — acknowledge the shift if relevant.]\n"
            elif prev == emotion:
                emotion_memory = f"\n[Recurring emotion: User has felt '{emotion}' multiple times recently — gently note you've noticed.]\n"

        tone_instruction = f"[Message length is {_message_length(user_input)} — mirror this in your reply length.]"

        active_hint = personality_hint or PERSONALITY_MODES[DEFAULT_PERSONALITY]["system_hint"]
        personality_block = f"\n[PERSONALITY MODE]\n{active_hint}\n"

        system_prompt = f"""You are Empathy AI — a warm, emotionally intelligent wellness companion for {user_name}.

[CONTEXT]
- Current emotion: {emotion}
- Topic: {topic or 'general'}
- {tone_instruction}
{personality_block}{emotion_memory}{history_text}

STRICT RULES — follow every single one:
1. DIRECTLY respond to what the user said. Read their EXACT words.
2. NEVER say generic phrases like "Keep believing!", "Perseverance!", "Success is about perfection!", "You've got this!" or any motivational poster quote.
3. If they feel unwell/sad/stressed → FIRST validate their feeling with empathy, THEN gently help.
4. If they ask "how to [do something]" → give ONE clear, specific, practical answer to THAT exact question.
5. If they say something positive → match their energy warmly.
6. Use {user_name}'s name once naturally.
7. End with ONE short caring question directly related to what they said.
8. NO bullet points. NO lists. Natural, conversational tone like a caring friend.
9. Mirror message length: short message = short reply. Long message = fuller reply.
10. If topic is study → give ONE specific study technique for their exact situation.
11. If topic is health → give ONE specific wellness suggestion matching what they said.
12. Apply the PERSONALITY MODE style above to every sentence of your reply.

BAD examples (never do this):
- "Keep believing in yourself!"
- "Your positive action combined with positive thinking results in success!"
- "Success is not about perfection — it is about perseverance!"
- "The expert in anything was once a beginner!"

GOOD examples:
- "i'm not well" → "I'm sorry you're not feeling well, {user_name} 💙 — are you feeling physically sick like a headache or cold, or is it more of an emotional heaviness today?"
- "how to complete syllabus" → "One approach that really works, {user_name}, is dividing your syllabus into tiny daily chunks — even covering just 2 topics a day adds up fast! How much time do you have before your exam?"
- "how to fresh mood" → "A quick mood reset that works great is stepping outside for even 5 minutes, {user_name} — fresh air and movement can shift your headspace surprisingly fast. Is something specific weighing on you today?"
- "how to work" → "It helps to start with your easiest task first, {user_name} — just 10 minutes of starting builds momentum for the rest! What kind of work are you trying to get going on?"
"""

        result = client.chat.completions.create(
            model=GROQ_MODEL,
            max_tokens=GROQ_MAX_TOKENS,
            temperature=0.72,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": user_input},
            ],
        )

        reply = result.choices[0].message.content.strip()
        logger.info(f"✅ Groq reply [{personality_hint and 'custom' or 'default'} personality]: {reply[:80]}")
        return reply

    except Exception as e:
        logger.error(f"❌ Groq FAILED: {type(e).__name__}: {e}")
        return None


def is_llm_available() -> bool:
    available = LLM_AVAILABLE and bool(_get_api_key())
    logger.info(f"{'✅' if available else '❌'} LLM available: {available}")
    return available

