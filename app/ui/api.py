import logging
import time
import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone, date

import starlette
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import HTMLResponse, PlainTextResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel

from app.database.db import init_db, get_connection
from app.database.queries import (
    save_user, get_user, get_last_emotion,
    add_xp, get_total_xp, get_history_from_db,
    get_mood_summary, get_mood_timeline, get_mood_calendar,
    get_last_chat_info, get_mood_streak,
    get_today_chats, save_journal_entry, get_journal_entries,
    get_weekly_stats, get_trigger_patterns,
    get_burnout_status, get_recent_emotions_raw,
)
from app.services.chat_service import handle_turn, set_personality, get_personality, _call_groq_with_retry
from app.services.relationship_analyzer import analyze_relationship
from app.services.burnout_detector import detect_burnout
from app.services.career_coach import get_career_suggestions
from app.services.forecast_service import generate_forecast
from app.services.xp_service import get_level
from app.utils.helpers import get_daily_quote
from app.config import XP_PER_SESSION, GROQ_API_KEY, GROQ_MODEL, PERSONALITY_MODES
from app.ai.emotion import calculate_risk_level
from app.ai.predictor import get_emotion_trend
from app.ai.recommendations import get_topic_intelligence

logger = logging.getLogger(__name__)


# ── Standardized response helpers ───────────────────────────────────────────
def ok(data: dict | list, message: str = "Success") -> JSONResponse:
    """Always return consistent success shape."""
    return JSONResponse({"status": "success", "message": message, "data": data})


def err(message: str, code: int = 500) -> JSONResponse:
    """Always return consistent error shape — never expose raw exceptions."""
    logger.error(f"API error [{code}]: {message}")
    return JSONResponse({"status": "error", "message": message, "data": None}, status_code=code)


# ── Lifespan (replaces deprecated @app.on_event) ────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    init_db()
    conn = get_connection()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS memories (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            user_name     TEXT      NOT NULL,
            emotion       TEXT,
            insight       TEXT      NOT NULL,
            source_message TEXT,
            created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()
    logger.info("✅ Database initialised")
    yield
    # Shutdown (nothing needed yet)


app = FastAPI(title="Empathy AI Assistant", lifespan=lifespan)

BASE_DIR      = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TEMPLATES_DIR = os.path.join(BASE_DIR, "app", "templates")
templates     = Jinja2Templates(directory=TEMPLATES_DIR)

static_path = os.path.join(BASE_DIR, "app", "static")
if os.path.exists(static_path):
    app.mount("/static", StaticFiles(directory=static_path), name="static")


def _render(template_name: str, request: Request, context: dict = {}):
    _ver = tuple(int(x) for x in starlette.__version__.split(".")[:2])
    if _ver >= (0, 29):
        return templates.TemplateResponse(request=request, name=template_name, context=context)
    return templates.TemplateResponse(template_name, {"request": request, **context})


# ── Pydantic models ──────────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    name: str

class ChatRequest(BaseModel):
    user_name: str
    message: str
    memories: list = []

class PersonalityRequest(BaseModel):
    user_name: str
    mode: str

class MemoryRequest(BaseModel):
    user_name: str
    emotion: str
    user_message: str
    ai_response: str

class AvatarChatRequest(BaseModel):
    user_name: str
    message: str
    emotion: str = "general"


# ── Routes ───────────────────────────────────────────────────────────────────
@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    return _render("index.html", request)


@app.post("/api/login")
async def login(data: LoginRequest):
    try:
        name     = data.name.strip() or "Friend"
        existing = get_user(name)
        save_user(name)
        add_xp(name, "session_start", XP_PER_SESSION)
        total_xp               = get_total_xp(name)
        lvl_num, lvl_title, _  = get_level(total_xp)
        last_emotion           = get_last_emotion(name) if existing else None
        return {
            "name":         name,
            "is_returning": existing is not None,
            "total_chats":  existing["total_chats"] if existing else 0,
            "last_emotion": last_emotion,
            "total_xp":     total_xp,
            "level_num":    lvl_num,
            "level_title":  lvl_title,
        }
    except Exception as e:
        logger.error(f"Login error: {e}")
        return err("Login failed. Please try again.", 500)


@app.post("/api/chat")
async def chat(data: ChatRequest):
    try:
        effective_message = data.message
        if data.memories:
            mem_context       = " | ".join(data.memories[:3])
            effective_message = f"[Memory: {mem_context}]\n{data.message}"

        result = handle_turn(effective_message, data.user_name)
        return {
            "response":      result["response"],
            "emotion":       result["emotion"],
            "topic":         result["topic"],
            "response_mode": result["response_mode"],
            "xp_earned":     result["xp_earned"],
            "total_xp":      result["total_xp"],
            "level_num":     result["level_num"],
            "level_title":   result["level_title"],
            "prediction":    result["prediction"],
            "personality":   result["personality"],
        }
    except Exception as e:
        logger.error(f"Chat error for {data.user_name}: {e}")
        # Return a graceful response — never crash the chat
        return {
            "response":      "I'm here with you. Something got in the way — want to try again? 💙",
            "emotion":       "general",
            "topic":         None,
            "response_mode": "Empathetic",
            "xp_earned":     0,
            "total_xp":      get_total_xp(data.user_name),
            "level_num":     1,
            "level_title":   "Beginner",
            "prediction":    None,
            "personality":   "friend",
        }


@app.get("/api/history/{user_name}")
async def history(user_name: str):
    try:
        rows = get_history_from_db(user_name, limit=20)
        return {"history": [{"timestamp": r[0], "user_message": r[1], "ai_response": r[2]} for r in rows]}
    except Exception as e:
        logger.error(f"History error: {e}")
        return {"history": []}


@app.get("/api/xp/{user_name}")
async def xp_status(user_name: str):
    try:
        total                  = get_total_xp(user_name)
        lvl_num, lvl_title, _ = get_level(total)
        return {"total_xp": total, "level_num": lvl_num, "level_title": lvl_title}
    except Exception as e:
        logger.error(f"XP error: {e}")
        return {"total_xp": 0, "level_num": 1, "level_title": "Beginner"}


@app.get("/api/quote")
async def quote():
    try:
        return {"quote": get_daily_quote()}
    except Exception:
        return {"quote": "Every day is a new beginning. 🌱"}


@app.get("/api/mood-data/{user_name}")
async def mood_data(user_name: str):
    try:
        summary  = get_mood_summary(user_name)
        timeline = get_mood_timeline(user_name)
        return {
            "summary":  [{"emotion": e, "count": c} for e, c in summary],
            "timeline": [dict(r) for r in timeline],
        }
    except Exception as e:
        logger.error(f"Mood data error: {e}")
        return {"summary": [], "timeline": []}


@app.get("/api/mood-calendar/{user_name}")
async def mood_calendar(user_name: str):
    try:
        return {"calendar": get_mood_calendar(user_name)}
    except Exception as e:
        logger.error(f"Calendar error: {e}")
        return {"calendar": []}


@app.get("/api/followup/{user_name}")
async def followup(user_name: str):
    try:
        info = get_last_chat_info(user_name)
        if not info:
            return {"show": False}
        last_time = datetime.fromisoformat(info["created_at"])
        if last_time.tzinfo is None:
            last_time = last_time.replace(tzinfo=timezone.utc)
        hours_ago = (datetime.now(timezone.utc) - last_time).total_seconds() / 3600
        if hours_ago >= 20:
            return {"show": True, "emotion": info["emotion"], "hours_ago": round(hours_ago)}
        return {"show": False}
    except Exception as e:
        logger.error(f"Follow-up error: {e}")
        return {"show": False}


@app.get("/api/streak/{user_name}")
async def streak(user_name: str):
    try:
        return {"streak": get_mood_streak(user_name)}
    except Exception as e:
        logger.error(f"Streak error: {e}")
        return {"streak": 0}


@app.get("/api/journal/{user_name}")
async def journal_list(user_name: str):
    try:
        return {"entries": get_journal_entries(user_name)}
    except Exception as e:
        logger.error(f"Journal list error: {e}")
        return {"entries": []}


@app.post("/api/journal/generate/{user_name}")
async def journal_generate(user_name: str):
    try:
        chats = get_today_chats(user_name)
        if not chats:
            return {"success": False, "message": "No chats today yet — start a conversation first!"}

        chat_text = "\n".join(
            f"User said: '{c['user_input']}' (emotion: {c['emotion']}, topic: {c['topic'] or 'general'})"
            for c in chats
        )

        summary = _call_groq_with_retry(
            messages=[
                {
                    "role": "system",
                    "content": (
                        f"You are a compassionate journal writer for {user_name}. "
                        "Based on today's chat session data, write a warm, reflective 3-4 sentence "
                        "personal diary entry in first person (as if written by the user). "
                        "Mention specific emotions and topics they discussed. "
                        "Make it feel personal, insightful, and hopeful. No bullet points."
                    ),
                },
                {"role": "user", "content": f"Today's chat data:\n{chat_text}"},
            ],
            max_tokens=250,
            temperature=0.7,
        )

        date_str = date.today().isoformat()
        save_journal_entry(user_name, date_str, summary)
        return {"success": True, "date": date_str, "summary": summary}

    except Exception as e:
        logger.error(f"Journal generate error: {e}")
        return {"success": False, "message": "Could not generate journal entry. Please try again."}


@app.get("/api/weekly-report/{user_name}")
async def weekly_report(user_name: str):
    try:
        stats    = get_weekly_stats(user_name)
        triggers = get_trigger_patterns(user_name)

        best_day  = max(stats["daily"], key=lambda d: d["positive"], default=None) if stats["daily"] else None
        worst_day = (
            max(stats["daily"], key=lambda d: d["negative"], default=None)
            if stats["daily"] and any(d["negative"] > 0 for d in stats["daily"])
            else None
        )

        total_pos = sum(d["positive"] for d in stats["daily"])
        total_neg = sum(d["negative"] for d in stats["daily"])
        total_all = stats["total_chats"] or 1
        neutral   = total_all - total_pos - total_neg
        wellness  = round(((total_pos + neutral * 0.5) / total_all) * 100)

        return {
            "total_chats":    stats["total_chats"],
            "emotions":       stats["emotions"],
            "daily":          stats["daily"],
            "topics":         stats["topics"],
            "best_day":       best_day["day"] if best_day else None,
            "worst_day":      worst_day["day"] if worst_day else "No tough days! 🎉",
            "wellness_score": wellness,
            "triggers":       triggers,
        }
    except Exception as e:
        logger.error(f"Weekly report error: {e}")
        return {
            "total_chats": 0, "emotions": [], "daily": [], "topics": [],
            "best_day": None, "worst_day": None, "wellness_score": 50, "triggers": [],
        }


@app.post("/api/personality/set")
async def set_personality_route(data: PersonalityRequest):
    try:
        mode = set_personality(data.user_name, data.mode)
        cfg  = PERSONALITY_MODES[mode]
        return {"success": True, "mode": mode, "label": cfg["label"], "emoji": cfg["emoji"]}
    except Exception as e:
        logger.error(f"Personality set error: {e}")
        return {"success": False, "mode": "friend", "label": "Friend", "emoji": "💙"}


@app.get("/api/personality/{user_name}")
async def get_personality_route(user_name: str):
    try:
        mode = get_personality(user_name)
        cfg  = PERSONALITY_MODES[mode]
        return {"mode": mode, "label": cfg["label"], "emoji": cfg["emoji"]}
    except Exception as e:
        logger.error(f"Personality get error: {e}")
        return {"mode": "friend", "label": "Friend", "emoji": "💙"}


@app.get("/api/burnout/{user_name}")
async def burnout_check(user_name: str):
    try:
        return get_burnout_status(user_name)
    except Exception as e:
        logger.error(f"Burnout check error: {e}")
        return {"level": "low", "message": "Looking good!", "score": 0}


@app.get("/api/risk/{user_name}")
async def risk_level(user_name: str):
    try:
        recent   = get_recent_emotions_raw(user_name, n=10)
        emotions = [r["emotion"] for r in recent]
        return calculate_risk_level(emotions)
    except Exception as e:
        logger.error(f"Risk level error: {e}")
        return {"level": "LOW", "score": 0}


@app.get("/api/trend/{user_name}")
async def emotion_trend(user_name: str):
    try:
        return get_emotion_trend(user_name)
    except Exception as e:
        logger.error(f"Trend error: {e}")
        return {"trend": "stable", "message": "Keep chatting to see your trend!"}


@app.get("/api/topic-intel/{user_name}")
async def topic_intel(user_name: str):
    try:
        return get_topic_intelligence(user_name)
    except Exception as e:
        logger.error(f"Topic intel error: {e}")
        return {"topics": []}


@app.get("/api/forecast/{user_name}")
async def emotional_forecast(user_name: str):
    try:
        return generate_forecast(user_name)
    except Exception as e:
        logger.error(f"Forecast error for {user_name}: {e}")
        return {
            "forecast_points":   [],
            "current_risk":      {"level": "LOW", "score": 0, "message": "Keep chatting for a forecast!"},
            "interventions":     [],
            "proactive_message": "Chat more to unlock your personal forecast! 🌟",
            "triggers":          [],
            "top_emotion":       "general",
            "top_negative":      None,
            "lowest_point":      {"time": "tomorrow", "dow": "", "hours_ahead": 24},
        }


@app.get("/api/emotional-dna/{user_name}")
async def emotional_dna(user_name: str):
    try:
        conn = get_connection()
        cur  = conn.cursor()

        cur.execute("""
            SELECT emotion, COUNT(*) as count FROM mood_logs
            WHERE user_name = ? GROUP BY emotion
        """, (user_name,))
        emotion_counts = {r["emotion"]: r["count"] for r in cur.fetchall()}

        cur.execute("SELECT COUNT(*) as total FROM mood_logs WHERE user_name = ?", (user_name,))
        total = cur.fetchone()["total"] or 1

        cur.execute("""
            SELECT COUNT(DISTINCT DATE(created_at)) as days
            FROM mood_logs WHERE user_name = ?
        """, (user_name,))
        active_days = cur.fetchone()["days"] or 0

        cur.execute("""
            SELECT emotion, created_at FROM mood_logs
            WHERE user_name = ? ORDER BY id ASC LIMIT 1
        """, (user_name,))
        first = cur.fetchone()

        cur.execute("""
            SELECT
              SUM(CASE WHEN emotion IN ('joy','trust','anticipation','surprise') THEN 1 ELSE 0 END) as pos,
              COUNT(*) as tot
            FROM mood_logs WHERE user_name = ?
            AND created_at >= DATE('now', '-7 days')
        """, (user_name,))
        week = cur.fetchone()
        conn.close()

        pos_ratio    = (week["pos"] or 0) / max(week["tot"] or 1, 1)
        growth_score = min(100, round(pos_ratio * 60 + min(active_days, 30) * 1.3 + min(total, 50) * 0.2))
        dominant     = max(emotion_counts, key=emotion_counts.get) if emotion_counts else "general"

        archetype_map = {
            "joy":          ("The Optimist",   "You radiate warmth and lift others naturally. 🌟"),
            "sadness":      ("The Empath",     "You feel deeply — your sensitivity is your superpower. 💙"),
            "anger":        ("The Warrior",    "You fight for what matters. Channel that fire. 🔥"),
            "fear":         ("The Guardian",   "Your caution protects everyone around you. 🛡️"),
            "stress":       ("The Achiever",   "You care intensely — that's what drives greatness. ⚡"),
            "trust":        ("The Anchor",     "People lean on you. Your stability is rare. ⚓"),
            "anticipation": ("The Visionary",  "You live ahead of the moment — always planning. 🚀"),
            "study":        ("The Scholar",    "Your hunger for knowledge sets you apart. 📚"),
            "health":       ("The Nurturer",   "You protect your body and mind with wisdom. 💪"),
            "general":      ("The Explorer",   "You are still finding your emotional voice. 🌍"),
        }
        archetype, archetype_desc = archetype_map.get(dominant, archetype_map["general"])

        milestones = []
        if total >= 1:         milestones.append({"icon":"🌱","label":"First Words","desc":"Started the journey"})
        if total >= 10:        milestones.append({"icon":"💬","label":"Chatterbox","desc":"10 conversations deep"})
        if total >= 25:        milestones.append({"icon":"🔥","label":"Committed","desc":"25 messages shared"})
        if total >= 50:        milestones.append({"icon":"💎","label":"Diamond Mind","desc":"50 emotional check-ins"})
        if active_days >= 3:   milestones.append({"icon":"📅","label":"Consistent","desc":"3 active days"})
        if active_days >= 7:   milestones.append({"icon":"🏆","label":"Week Warrior","desc":"7 days of growth"})
        if growth_score >= 70: milestones.append({"icon":"⭐","label":"Thriving","desc":"Growth score above 70"})

        radar = {k: round(emotion_counts.get(k, 0) / total * 100) for k in
                 ["joy","trust","anticipation","sadness","stress","anger","fear","study"]}

        letter = None
        if total >= 5:
            top_emotions = sorted(emotion_counts.items(), key=lambda x: x[1], reverse=True)[:3]
            emotions_str = ", ".join(f"{e}({c})" for e, c in top_emotions)
            since        = first["created_at"][:10] if first else "recently"
            letter       = _call_groq_with_retry(
                messages=[{
                    "role": "user",
                    "content": (
                        f"Write a warm 3-sentence letter from {user_name}'s past self (since {since}) "
                        f"to their present self. Their top emotions were: {emotions_str}. "
                        f"They had {active_days} active days and a growth score of {growth_score}/100. "
                        f"Make it personal, hopeful, and emotional. No bullet points. No sign-off needed."
                    ),
                }],
                max_tokens=180,
                temperature=0.8,
            )

        return {
            "archetype":        archetype,
            "archetype_desc":   archetype_desc,
            "growth_score":     growth_score,
            "active_days":      active_days,
            "total_messages":   total,
            "dominant_emotion": dominant,
            "radar":            radar,
            "milestones":       milestones,
            "letter":           letter,
            "first_chat_date":  first["created_at"][:10] if first else None,
        }

    except Exception as e:
        logger.error(f"Emotional DNA error: {e}")
        return {
            "archetype": "The Explorer", "archetype_desc": "You are still finding your emotional voice. 🌍",
            "growth_score": 0, "active_days": 0, "total_messages": 0,
            "dominant_emotion": "general", "radar": {}, "milestones": [], "letter": None,
            "first_chat_date": None,
        }


@app.post("/api/memory/save")
async def save_memory_endpoint(data: MemoryRequest):
    try:
        insight = _call_groq_with_retry(
            messages=[{
                "role": "user",
                "content": (
                    f"Extract one key emotional insight from this exchange in max 12 words. "
                    f"User said: '{data.user_message}'. Emotion detected: {data.emotion}. "
                    f"Format: Start with 'User' then verb. Output only the sentence, nothing else."
                ),
            }],
            max_tokens=60,
            temperature=0.4,
        )
        # Fallback if Groq returns its own fallback message
        if "here with you" in insight or "got in the way" in insight:
            insight = f"User felt {data.emotion} and shared their thoughts."

        conn = get_connection()
        conn.execute(
            "INSERT INTO memories (user_name, emotion, insight, source_message) VALUES (?, ?, ?, ?)",
            (data.user_name, data.emotion, insight, data.user_message[:200]),
        )
        conn.commit()
        conn.close()
        return {"success": True, "insight": insight}

    except Exception as e:
        logger.error(f"Memory save error: {e}")
        return {"success": False, "insight": None, "message": "Could not save memory."}


@app.get("/api/memory/get/{user_name}")
async def get_memories_endpoint(user_name: str):
    try:
        conn = get_connection()
        cur  = conn.cursor()
        cur.execute("""
            SELECT id, emotion, insight, source_message, created_at
            FROM memories WHERE user_name = ?
            ORDER BY created_at DESC LIMIT 30
        """, (user_name,))
        rows = [dict(r) for r in cur.fetchall()]
        cur.execute("SELECT COUNT(*) as total FROM memories WHERE user_name = ?", (user_name,))
        total = cur.fetchone()["total"]
        conn.close()
        return {"memories": rows, "total": total}
    except Exception as e:
        logger.error(f"Memory get error: {e}")
        return {"memories": [], "total": 0}


@app.delete("/api/memory/clear/{user_name}")
async def clear_memories_endpoint(user_name: str):
    try:
        conn = get_connection()
        conn.execute("DELETE FROM memories WHERE user_name = ?", (user_name,))
        conn.commit()
        conn.close()
        return {"success": True}
    except Exception as e:
        logger.error(f"Memory clear error: {e}")
        return {"success": False, "message": "Could not clear memories."}


@app.post("/api/avatar/chat")
async def avatar_chat_endpoint(data: AvatarChatRequest):
    try:
        conn = get_connection()
        cur  = conn.cursor()
        cur.execute("""
            SELECT insight FROM memories WHERE user_name = ?
            ORDER BY created_at DESC LIMIT 5
        """, (data.user_name,))
        memories = [r["insight"] for r in cur.fetchall()]
        conn.close()

        memory_context = f"Things I remember about you: {'; '.join(memories)}. " if memories else ""

        response = _call_groq_with_retry(
            messages=[
                {
                    "role": "system",
                    "content": (
                        f"You are an animated AI avatar companion named Aria. {memory_context}"
                        f"You speak in short, warm sentences (2-3 max). "
                        f"You can see the user's current emotion is: {data.emotion}. "
                        f"Be empathetic, playful, and emotionally intelligent. Never use lists or bullet points."
                    ),
                },
                {"role": "user", "content": data.message},
            ],
            max_tokens=120,
            temperature=0.75,
        )

        emotion_map = {
            "joy": "happy", "sadness": "sad", "anger": "concerned",
            "fear": "caring", "stress": "calm", "trust": "happy",
            "anticipation": "excited", "general": "neutral",
        }
        return {
            "response":       response,
            "avatar_emotion": emotion_map.get(data.emotion, "neutral"),
        }

    except Exception as e:
        logger.error(f"Avatar chat error: {e}")
        return {"response": "I'm here with you. Tell me more. 💙", "avatar_emotion": "caring"}


# ── Relationship Analyzer ────────────────────────────────────────────────────
@app.post("/api/relationship-analyze")
async def relationship_analyze(data: dict):
    try:
        conversation = data.get("conversation", "").strip()
        username     = data.get("username", "user")

        if not conversation:
            return JSONResponse(
                {"status": "error", "message": "Please paste a conversation to analyze. 💬"},
                status_code=400,
            )
        if len(conversation) < 20:
            return JSONResponse(
                {"status": "error", "message": "Conversation is too short to analyze meaningfully."},
                status_code=400,
            )

        result = analyze_relationship(username, conversation)
        return result

    except Exception as e:
        logger.error(f"Relationship analyze error: {e}")
        return JSONResponse(
            {"status": "error", "message": "Analysis unavailable right now. Please try again in a moment. 🙏"},
            status_code=500,
        )


# ── Burnout Detector ─────────────────────────────────────────────────────────
@app.get("/api/burnout-check")
async def burnout_checker(username: str = "user"):
    try:
        return detect_burnout(username)
    except Exception as e:
        logger.error(f"Burnout detector error: {e}")
        return {"level": "unknown", "message": "Could not check burnout status. Try again later.", "score": 0}


# ── Career Coach ─────────────────────────────────────────────────────────────
@app.post("/api/career-coach")
async def career_coach(data: dict):
    try:
        username   = data.get("username", "user")
        user_input = data.get("user_input", "").strip()

        if not user_input:
            return JSONResponse(
                {"status": "error", "message": "Please share what you'd like career advice on. 🚀"},
                status_code=400,
            )

        return get_career_suggestions(username, user_input)

    except Exception as e:
        logger.error(f"Career coach error: {e}")
        return JSONResponse(
            {"status": "error", "message": "Career coach is unavailable right now. Please try again. 🙏"},
            status_code=500,
        )


# ── PWA endpoints ────────────────────────────────────────────────────────────
@app.get("/manifest.json")
async def manifest():
    return JSONResponse({
        "name":             "Empathy AI Assistant",
        "short_name":       "Empathy AI",
        "description":      "Your personal emotional support companion",
        "start_url":        "/",
        "display":          "standalone",
        "background_color": "#0a0a0f",
        "theme_color":      "#7c6aff",
        "orientation":      "portrait-primary",
        "icons": [
            {"src": "/static/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable"},
            {"src": "/static/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable"},
        ],
        "categories": ["health", "lifestyle"],
        "lang":       "en",
    })


@app.get("/sw.js")
async def service_worker():
    sw_content = """const CACHE='empathy-v1';const URLS=['/'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(URLS).catch(()=>{})));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));});
self.addEventListener('push',e=>{const d=e.data?e.data.json():{title:'Empathy AI',body:'How are you feeling today?'};e.waitUntil(self.registration.showNotification(d.title,{body:d.body,icon:'/static/icon-192.png'}));});
"""
    return PlainTextResponse(sw_content, media_type="application/javascript")