from app.database.queries import get_mood_streak, get_recent_emotions_raw, get_weekly_pattern_data
from datetime import date, timedelta


NEGATIVE = {"sadness", "anger", "fear", "disgust", "stress"}
POSITIVE = {"joy", "trust", "anticipation", "surprise"}


def analyze_patterns(user_name: str) -> list[dict]:
    alerts = []
    data   = get_weekly_pattern_data(user_name)

    if not data or not data.get("logs"):
        return alerts

    logs           = data["logs"]
    recent_5       = logs[-5:]  if len(logs) >= 5  else logs
    recent_3       = logs[-3:]  if len(logs) >= 3  else logs
    recent_emotions = [r["emotion"] for r in recent_5]
    recent_topics   = [r["topic"]   for r in recent_5 if r["topic"]]

    
    last_3_emotions = [r["emotion"] for r in recent_3]
    if len(last_3_emotions) >= 3 and all(e in NEGATIVE for e in last_3_emotions):
        alerts.append({
            "type":     "spiral",
            "priority": "high",
            "title":    "⚠️ Emotional Spiral Detected",
            "message":  "You've had 3 or more difficult conversations in a row. This is your sign to take a break, breathe, and be kind to yourself.",
            "action":   "Try the breathing exercise right now",
            "action_fn": "startBreathe()",
        })

    
    if len(recent_emotions) >= 5:
        neg_count  = sum(1 for e in recent_emotions if e in NEGATIVE)
        pos_count  = sum(1 for e in recent_emotions if e in POSITIVE)
        if neg_count >= 4 and pos_count <= 1:
            alerts.append({
                "type":     "decline",
                "priority": "high",
                "title":    "📉 Mood Decline Trend",
                "message":  "Your last 5 conversations have mostly been negative emotions. You might be carrying a heavy emotional load right now.",
                "action":   "Open your journal to reflect",
                "action_fn": "showPanel('journal')",
            })

    
    topic_counts = {}
    for t in recent_topics:
        if t and t != "general":
            topic_counts[t] = topic_counts.get(t, 0) + 1
    for topic, count in topic_counts.items():
        if count >= 3:
            tips = {
                "study":  "Break your syllabus into 20-minute daily chunks — small wins build momentum.",
                "stress": "Write down your top 3 worries right now — getting them out of your head helps.",
                "health": "A 10-minute walk and a glass of water can reset your energy more than you think.",
            }
            tip = tips.get(topic, "Consider talking to someone you trust about this.")
            alerts.append({
                "type":     "recurring_topic",
                "priority": "medium",
                "title":    f"🔁 {topic.title()} Keeps Coming Up",
                "message":  f"You've mentioned {topic} {count} times recently. This seems to be weighing on you. Tip: {tip}",
                "action":   "Chat about it now",
                "action_fn": f"document.getElementById('chatInput').value='I want to talk about my {topic} situation';showPanel('messages');document.getElementById('chatInput').focus();",
            })

    
    by_day = data.get("by_day", [])
    if by_day:
        top = by_day[0]
        if top["count"] >= 3:
            today_name = date.today().strftime("%A")
            if top["day_name"] == today_name:
                alerts.append({
                    "type":     "day_pattern",
                    "priority": "medium",
                    "title":    f"📅 {today_name} Is Tough For You",
                    "message":  f"We've noticed you tend to struggle most on {today_name}s ({top['count']} times). Today is {today_name} — take extra care of yourself today.",
                    "action":   "Start a breathing session",
                    "action_fn": "startBreathe()",
                })

    
    streak = data.get("streak", 0)
    last_date_str = data.get("last_chat_date")
    if last_date_str:
        last = date.fromisoformat(last_date_str)
        gap  = (date.today() - last).days
        if gap >= 3:
            alerts.append({
                "type":     "disengagement",
                "priority": "low",
                "title":    "💤 You've Been Away",
                "message":  f"It's been {gap} days since your last check-in. Consistent emotional tracking helps you spot patterns early. We missed you!",
                "action":   "Start today's check-in",
                "action_fn": "document.getElementById('chatInput').focus();showPanel('messages');",
            })

    
    if len(recent_emotions) >= 3 and all(e in POSITIVE for e in recent_emotions[-3:]):
        alerts.append({
            "type":     "positive_streak",
            "priority": "low",
            "title":    "🌟 You're on a Positive Streak!",
            "message":  "Your last 3 check-ins have all been positive emotions. Whatever you're doing — keep doing it! You're thriving.",
            "action":   "Log today's mood",
            "action_fn": "document.getElementById('chatInput').value='I am feeling great today!';showPanel('messages');document.getElementById('chatInput').focus();",
        })

    
    priority_order = {"high": 0, "medium": 1, "low": 2}
    alerts.sort(key=lambda a: priority_order.get(a["priority"], 3))
    return alerts