import logging
from datetime import datetime, timedelta

from app.database.queries import get_mood_summary, get_recent_emotions_raw
from app.ai.emotion import calculate_risk_level
from app.services.chat_service import _call_groq_with_retry

logger = logging.getLogger(__name__)

NEGATIVE_EMOTIONS = {"sadness", "anger", "fear", "disgust", "stress"}
POSITIVE_EMOTIONS = {"joy", "trust", "anticipation", "surprise"}

DOW_RISK  = [0.18, 0.10, 0.08, 0.10, 0.06, 0.02, 0.02]
DOW_NAMES = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]

HOUR_RISK = [
    (range(0,  6),  0.22),  
    (range(6,  9),  0.05),   
    (range(9,  12), 0.04),   
    (range(12, 14), 0.06),   
    (range(14, 17), 0.16),   
    (range(17, 20), 0.07),   
    (range(20, 22), 0.08),   
    (range(22, 24), 0.12),   
]

FORECAST_HOURS = [0, 6, 12, 24, 36, 48, 72]


def _hour_factor(hour: int) -> float:
    for rng, val in HOUR_RISK:
        if hour in rng:
            return val
    return 0.05



def _build_forecast_points(now: datetime, negative_ratio: float) -> list[dict]:
    points = []
    for hours_ahead in FORECAST_HOURS:
        future   = now + timedelta(hours=hours_ahead)
        score    = min(0.97,
                       negative_ratio
                       + _hour_factor(future.hour)
                       + DOW_RISK[future.weekday()])
        wellness = max(5, round((1 - score) * 100))
        points.append({
            "hours_ahead": hours_ahead,
            "label":       "Now" if hours_ahead == 0 else f"{hours_ahead}h",
            "wellness":    wellness,
            "risk_score":  round(score * 100),
            "time":        future.strftime("%I%p").lstrip("0"),
            "dow":         future.strftime("%a"),
        })
    return points


def _get_ai_proactive_message(
    name: str,
    risk_level: str,
    lowest: dict,
    top_emotion: str,
    top_negative: str | None,
) -> str:
    
    try:
        prompt = (
            f"Write a warm, personal 2-sentence proactive message for {name}. "
            f"Their emotional risk level is {risk_level}. "
            f"Their dominant emotion is {top_emotion}. "
            f"Their predicted low point is around {lowest.get('time', 'tomorrow')} ({lowest.get('dow','')})."
            + (f" They often feel {top_negative}." if top_negative else "")
            + " Be specific, warm, and hopeful. No bullet points. Use one emoji at the end."
        )
        msg = _call_groq_with_retry(
            messages=[{"role": "user", "content": prompt}],
            max_tokens=80,
            temperature=0.75,
        )
        # If we got a fallback message from retry wrapper, use rule-based instead
        if "here with you" in msg or "got in the way" in msg:
            return _rule_based_message(name, risk_level, lowest)
        return msg
    except Exception:
        return _rule_based_message(name, risk_level, lowest)


def _rule_based_message(name: str, risk_level: str, lowest: dict) -> str:
    t = lowest.get("time", "afternoon")
    if risk_level == "HIGH":
        return (
            f"Hey {name} — based on your patterns, around {t} could feel heavier than usual. "
            "I've already prepared a few things for you. You don't have to face it alone. 💙"
        )
    if risk_level == "MEDIUM":
        return (
            f"Hey {name} — your forecast shows some turbulence around {t}. "
            "I've lined up small support moments in advance. One breath at a time. 🌟"
        )
    return (
        f"Hey {name} — your forecast looks mostly clear! "
        "I'll still check in to keep the momentum going. ☀️"
    )

def _get_interventions(risk_level: str, top_negative: str | None, lowest: dict) -> list:
    items = []
    if risk_level in ("HIGH", "MEDIUM"):
        items.append({
            "time":   "tonight 9pm",
            "action": "Breathing session auto-scheduled",
            "type":   "breathe",
        })
        items.append({
            "time":   f"tomorrow {lowest.get('time', 'afternoon')}",
            "action": "Gentle check-in from Friend mode",
            "type":   "checkin",
        })
    items.append({
        "time":   "queued now",
        "action": "Quote tailored to your predicted mood",
        "type":   "quote",
    })
    if top_negative == "stress":
        items.append({
            "time":   "tonight",
            "action": "Stress-relief journal prompt ready",
            "type":   "journal",
        })
    elif top_negative == "sadness":
        items.append({
            "time":   "morning",
            "action": "Uplifting affirmation scheduled",
            "type":   "affirmation",
        })
    elif top_negative == "anger":
        items.append({
            "time":   "evening",
            "action": "Calming reflection exercise ready",
            "type":   "reflect",
        })
    return items


def _get_triggers(summary_dict: dict, hour: int, dow: int, total: int) -> list:
    if total == 0:
        return []

    dow_levels = ["High risk","Mild stress","Mild stress","Mild stress",
                  "Low risk","Low risk","Low risk"]
    items = [{"label": f"{DOW_NAMES[dow]} pattern", "level": dow_levels[dow]}]

    stress_ratio = summary_dict.get("stress", 0) / total
    items.append({
        "label": "Recent stress levels" if stress_ratio > 0.3 else "Conversation tone",
        "level": "Elevated" if stress_ratio > 0.3 else "Mild stress" if stress_ratio > 0.1 else "Calm",
    })
    items.append({
        "label": "Afternoon slump window" if 14 <= hour < 17 else "Time of day",
        "level": "Moderate" if 14 <= hour < 17 else "Normal",
    })

    sadness_ratio = summary_dict.get("sadness", 0) / total
    items.append({
        "label": "Sadness pattern",
        "level": "High risk" if sadness_ratio > 0.2 else "Low risk",
    })
    return items



def generate_forecast(user_name: str) -> dict:

    
    _empty = {
        "forecast_points":   [],
        "lowest_point":      {"time": "tomorrow", "dow": "", "hours_ahead": 24},
        "current_risk":      {"level": "LOW", "score": 0,
                              "message": "Chat more to unlock your forecast!"},
        "interventions":     [],
        "proactive_message": f"Hey {user_name} — keep chatting so I can build your personal forecast! 🌱",
        "triggers":          [],
        "top_emotion":       "general",
        "top_negative":      None,
    }

    try:
        summary    = get_mood_summary(user_name) or []
        recent_raw = get_recent_emotions_raw(user_name, n=20) or []
    except Exception as e:
        logger.error(f"Forecast DB error for {user_name}: {e}")
        return _empty

    if not summary:
        return _empty

    try:
        now          = datetime.now()
        summary_dict = {e: c for e, c in summary}
        total_count  = sum(summary_dict.values()) or 1

        negative_ratio = sum(
            summary_dict.get(e, 0) for e in NEGATIVE_EMOTIONS
        ) / total_count

        recent_emotions  = [r["emotion"] for r in recent_raw]
        risk             = calculate_risk_level(recent_emotions)

        forecast_points  = _build_forecast_points(now, negative_ratio)
        lowest           = min(forecast_points, key=lambda p: p["wellness"])

        top_emotion = (
            max(summary_dict, key=summary_dict.get)
            if summary_dict else "general"
        )
        top_negative = next(
            (e for e in ["stress","sadness","anger","fear","disgust"]
             if summary_dict.get(e, 0) > 0),
            None,
        )

        
        proactive_message = _get_ai_proactive_message(
            user_name, risk["level"], lowest, top_emotion, top_negative
        )

        return {
            "forecast_points":   forecast_points,
            "lowest_point":      lowest,
            "current_risk":      risk,
            "interventions":     _get_interventions(risk["level"], top_negative, lowest),
            "proactive_message": proactive_message,
            "triggers":          _get_triggers(summary_dict, now.hour, now.weekday(), total_count),
            "top_emotion":       top_emotion,
            "top_negative":      top_negative,
        }

    except Exception as e:
        logger.error(f"Forecast generation error for {user_name}: {e}")
        return _empty