from app.database.db import get_connection
from datetime import date, timedelta


def save_user(name: str):
    conn = get_connection()
    cur  = conn.cursor()
    cur.execute("SELECT * FROM users WHERE name = ?", (name,))
    user = cur.fetchone()
    if user:
        cur.execute("UPDATE users SET total_chats = total_chats + 1 WHERE name = ?", (name,))
    else:
        cur.execute("INSERT INTO users (name, total_chats) VALUES (?, ?)", (name, 1))
    conn.commit()
    conn.close()


def get_user(name: str):
    conn = get_connection()
    cur  = conn.cursor()
    cur.execute("SELECT * FROM users WHERE name = ?", (name,))
    user = cur.fetchone()
    conn.close()
    return dict(user) if user else None


def save_emotion(user_name: str, emotion: str, confidence: int):
    conn = get_connection()
    cur  = conn.cursor()
    cur.execute(
        "INSERT INTO emotions (user_name, emotion, confidence) VALUES (?, ?, ?)",
        (user_name, emotion, confidence)
    )
    conn.commit()
    conn.close()


def get_last_emotion(user_name: str):
    conn = get_connection()
    cur  = conn.cursor()
    cur.execute(
        "SELECT emotion FROM emotions WHERE user_name = ? ORDER BY id DESC LIMIT 1",
        (user_name,)
    )
    row = cur.fetchone()
    conn.close()
    return row["emotion"] if row else None


def add_xp(user_name: str, reason: str, points: int):
    conn = get_connection()
    cur  = conn.cursor()
    cur.execute(
        "INSERT INTO xp (user_name, points, reason) VALUES (?, ?, ?)",
        (user_name, points, reason)
    )
    conn.commit()
    conn.close()


def get_total_xp(user_name: str):
    conn = get_connection()
    cur  = conn.cursor()
    cur.execute("SELECT SUM(points) as total FROM xp WHERE user_name = ?", (user_name,))
    row = cur.fetchone()
    conn.close()
    return row["total"] if row["total"] else 0


def get_emotion_history(user_name: str):
    conn = get_connection()
    cur  = conn.cursor()
    cur.execute(
        "SELECT emotion, confidence, created_at FROM emotions WHERE user_name = ? ORDER BY created_at ASC",
        (user_name,)
    )
    rows = cur.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_mood_summary(user_name: str):
    conn = get_connection()
    cur  = conn.cursor()
    cur.execute(
        "SELECT emotion, COUNT(*) as count FROM mood_logs WHERE user_name = ? GROUP BY emotion",
        (user_name,)
    )
    rows = cur.fetchall()
    conn.close()
    return [(row["emotion"], row["count"]) for row in rows]


def get_mood_timeline(user_name: str):
    conn = get_connection()
    cur  = conn.cursor()
    cur.execute(
        "SELECT emotion, created_at FROM mood_logs WHERE user_name = ? ORDER BY created_at ASC",
        (user_name,)
    )
    rows = cur.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_recent_emotions(user_name: str, limit: int = 10, n: int = None):
    conn  = get_connection()
    cur   = conn.cursor()
    count = n if n is not None else limit
    cur.execute(
        "SELECT emotion, confidence, created_at FROM emotions WHERE user_name = ? ORDER BY created_at DESC LIMIT ?",
        (user_name, count)
    )
    rows = cur.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def save_mood(user_name: str, user_input: str, emotion: str, topic: str, response: str):
    conn = get_connection()
    cur  = conn.cursor()
    cur.execute(
        "INSERT INTO mood_logs (user_name, user_input, emotion, topic, response) VALUES (?, ?, ?, ?, ?)",
        (user_name, user_input, emotion, topic, response)
    )
    conn.commit()
    conn.close()


def get_history_from_db(user_name: str, limit: int = 5):
    conn = get_connection()
    cur  = conn.cursor()
    cur.execute(
        "SELECT created_at, user_input, response FROM mood_logs WHERE user_name = ? ORDER BY id DESC LIMIT ?",
        (user_name, limit)
    )
    rows = cur.fetchall()
    conn.close()
    return [(row["created_at"], row["user_input"], row["response"]) for row in reversed(rows)]


def get_mood_calendar(user_name: str) -> list[dict]:
    conn = get_connection()
    cur  = conn.cursor()
    cur.execute("""
        SELECT DATE(created_at) as day, emotion, COUNT(*) as count
        FROM mood_logs
        WHERE user_name = ? AND created_at >= DATE('now', '-60 days')
        GROUP BY day, emotion
        ORDER BY day ASC, count DESC
    """, (user_name,))
    rows = cur.fetchall()
    conn.close()
    seen = {}
    for row in rows:
        day = row["day"]
        if day not in seen:
            seen[day] = {"date": day, "emotion": row["emotion"], "count": row["count"]}
    return list(seen.values())


def get_last_chat_info(user_name: str) -> dict | None:
    conn = get_connection()
    cur  = conn.cursor()
    cur.execute(
        "SELECT created_at, emotion FROM mood_logs WHERE user_name = ? ORDER BY id DESC LIMIT 1",
        (user_name,)
    )
    row = cur.fetchone()
    conn.close()
    return dict(row) if row else None


def get_mood_streak(user_name: str) -> int:
    conn = get_connection()
    cur  = conn.cursor()
    cur.execute("""
        SELECT DISTINCT DATE(created_at) as day
        FROM mood_logs WHERE user_name = ?
        ORDER BY day DESC
    """, (user_name,))
    rows = cur.fetchall()
    conn.close()
    if not rows:
        return 0
    today  = date.today()
    streak = 0
    for i, row in enumerate(rows):
        day = date.fromisoformat(row["day"])
        if day == today - timedelta(days=i):
            streak += 1
        else:
            break
    return streak


def get_today_chats(user_name: str) -> list[dict]:
    conn = get_connection()
    cur  = conn.cursor()
    cur.execute("""
        SELECT user_input, emotion, topic, created_at
        FROM mood_logs
        WHERE user_name = ? AND DATE(created_at) = DATE('now')
        ORDER BY id ASC
    """, (user_name,))
    rows = cur.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def save_journal_entry(user_name: str, date_str: str, summary: str):
    conn = get_connection()
    cur  = conn.cursor()
    cur.execute("""
        INSERT OR REPLACE INTO journal_entries (user_name, date, summary, created_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    """, (user_name, date_str, summary))
    conn.commit()
    conn.close()


def get_journal_entries(user_name: str, limit: int = 14) -> list[dict]:
    conn = get_connection()
    cur  = conn.cursor()
    cur.execute("""
        SELECT date, summary, created_at
        FROM journal_entries
        WHERE user_name = ?
        ORDER BY date DESC
        LIMIT ?
    """, (user_name, limit))
    rows = cur.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_weekly_stats(user_name: str) -> dict:
    conn = get_connection()
    cur  = conn.cursor()

    cur.execute("""
        SELECT emotion, COUNT(*) as count
        FROM mood_logs
        WHERE user_name = ? AND created_at >= DATE('now', '-7 days')
        GROUP BY emotion ORDER BY count DESC
    """, (user_name,))
    emotions = [{"emotion": r["emotion"], "count": r["count"]} for r in cur.fetchall()]

    cur.execute("""
        SELECT DATE(created_at) as day,
               COUNT(*) as total,
               SUM(CASE WHEN emotion IN ('joy','trust','anticipation','surprise','greeting') THEN 1 ELSE 0 END) as positive,
               SUM(CASE WHEN emotion IN ('sadness','anger','fear','disgust','stress') THEN 1 ELSE 0 END) as negative
        FROM mood_logs
        WHERE user_name = ? AND created_at >= DATE('now', '-7 days')
        GROUP BY day ORDER BY day ASC
    """, (user_name,))
    daily = [dict(r) for r in cur.fetchall()]

    cur.execute("""
        SELECT topic, COUNT(*) as count
        FROM mood_logs
        WHERE user_name = ? AND created_at >= DATE('now', '-7 days')
          AND topic IS NOT NULL AND topic != 'general'
        GROUP BY topic ORDER BY count DESC LIMIT 3
    """, (user_name,))
    topics = [{"topic": r["topic"], "count": r["count"]} for r in cur.fetchall()]

    cur.execute("""
        SELECT COUNT(*) as total FROM mood_logs
        WHERE user_name = ? AND created_at >= DATE('now', '-7 days')
    """, (user_name,))
    total = cur.fetchone()["total"]

    conn.close()
    return {"emotions": emotions, "daily": daily, "topics": topics, "total_chats": total}


def get_trigger_patterns(user_name: str) -> dict:
    conn = get_connection()
    cur  = conn.cursor()

    cur.execute("""
        SELECT
            CASE strftime('%w', created_at)
                WHEN '0' THEN 'Sunday'   WHEN '1' THEN 'Monday'
                WHEN '2' THEN 'Tuesday'  WHEN '3' THEN 'Wednesday'
                WHEN '4' THEN 'Thursday' WHEN '5' THEN 'Friday'
                WHEN '6' THEN 'Saturday'
            END as day_name,
            COUNT(*) as count
        FROM mood_logs
        WHERE user_name = ? AND emotion IN ('sadness','anger','fear','disgust','stress')
        GROUP BY strftime('%w', created_at)
        ORDER BY count DESC
    """, (user_name,))
    by_day = [dict(r) for r in cur.fetchall()]

    cur.execute("""
        SELECT topic, COUNT(*) as count
        FROM mood_logs
        WHERE user_name = ? AND emotion IN ('sadness','anger','fear','disgust','stress')
          AND topic IS NOT NULL AND topic != 'general'
        GROUP BY topic ORDER BY count DESC LIMIT 5
    """, (user_name,))
    by_topic = [dict(r) for r in cur.fetchall()]

    cur.execute("""
        SELECT emotion, COUNT(*) as count
        FROM mood_logs
        WHERE user_name = ? AND emotion IN ('sadness','anger','fear','disgust','stress')
        GROUP BY emotion ORDER BY count DESC LIMIT 1
    """, (user_name,))
    top_neg = cur.fetchone()

    cur.execute("""
        SELECT COUNT(*) as total,
               SUM(CASE WHEN emotion IN ('joy','trust','anticipation','surprise') THEN 1 ELSE 0 END) as positive
        FROM mood_logs WHERE user_name = ?
    """, (user_name,))
    row = cur.fetchone()
    total_all = row["total"] or 1
    positive  = row["positive"] or 0
    wellness_score = round((positive / total_all) * 100)

    conn.close()
    return {
        "by_day":         by_day,
        "by_topic":       by_topic,
        "top_negative":   dict(top_neg) if top_neg else None,
        "wellness_score": wellness_score,
    }


def get_recent_emotions_raw(user_name: str, n: int = 10) -> list[dict]:
    conn = get_connection()
    cur  = conn.cursor()
    cur.execute("""
        SELECT emotion, topic, created_at
        FROM mood_logs
        WHERE user_name = ?
        ORDER BY id DESC LIMIT ?
    """, (user_name, n))
    rows = cur.fetchall()
    conn.close()
    return [dict(r) for r in reversed(rows)]


def get_weekly_pattern_data(user_name: str) -> dict:
    conn = get_connection()
    cur  = conn.cursor()

    cur.execute("""
        SELECT emotion, topic, created_at
        FROM mood_logs WHERE user_name = ?
        ORDER BY id DESC LIMIT 20
    """, (user_name,))
    logs = [dict(r) for r in reversed(cur.fetchall())]

    cur.execute("""
        SELECT
            CASE strftime('%w', created_at)
                WHEN '0' THEN 'Sunday'   WHEN '1' THEN 'Monday'
                WHEN '2' THEN 'Tuesday'  WHEN '3' THEN 'Wednesday'
                WHEN '4' THEN 'Thursday' WHEN '5' THEN 'Friday'
                WHEN '6' THEN 'Saturday'
            END as day_name,
            COUNT(*) as count
        FROM mood_logs
        WHERE user_name = ? AND emotion IN ('sadness','anger','fear','disgust','stress')
        GROUP BY strftime('%w', created_at)
        ORDER BY count DESC LIMIT 1
    """, (user_name,))
    row    = cur.fetchone()
    by_day = [dict(row)] if row else []

    cur.execute("""
        SELECT DATE(created_at) as day
        FROM mood_logs WHERE user_name = ?
        ORDER BY id DESC LIMIT 1
    """, (user_name,))
    last_row       = cur.fetchone()
    last_chat_date = last_row["day"] if last_row else None

    conn.close()
    streak = get_mood_streak(user_name)

    return {
        "logs":           logs,
        "by_day":         by_day,
        "last_chat_date": last_chat_date,
        "streak":         streak,
    }


def get_burnout_status(user_name: str, threshold_days: int = 3, min_negative: int = 3) -> dict:
    conn = get_connection()
    cur  = conn.cursor()

    cur.execute("""
        SELECT DATE(created_at) as day,
               SUM(CASE WHEN emotion IN ('sadness','anger','fear','disgust','stress') THEN 1 ELSE 0 END) as neg_count,
               COUNT(*) as total
        FROM mood_logs
        WHERE user_name = ? AND created_at >= DATE('now', ?)
        GROUP BY day
        ORDER BY day DESC
    """, (user_name, f"-{threshold_days} days"))
    rows = cur.fetchall()
    conn.close()

    if not rows:
        return {"burnout_risk": False, "consecutive_negative_days": 0, "message": None}

    consecutive = 0
    today = date.today()
    for i, row in enumerate(rows):
        day = date.fromisoformat(row["day"])
        if day == today - timedelta(days=i) and row["neg_count"] >= min_negative:
            consecutive += 1
        else:
            break

    if consecutive >= threshold_days:
        return {
            "burnout_risk":               True,
            "consecutive_negative_days":  consecutive,
            "message": (
                f"You have had {consecutive} consecutive days of difficult emotions. "
                "Consider taking a break or slowing down. 💙"
            ),
        }

    return {
        "burnout_risk":              False,
        "consecutive_negative_days": consecutive,
        "message":                   None,
    }