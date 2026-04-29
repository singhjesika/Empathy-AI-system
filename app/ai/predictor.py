from app.config import ALL_EMOTIONS, NEGATIVE_EMOTIONS

try:
    from sklearn.ensemble import RandomForestClassifier
    PREDICT_AVAILABLE = True
except ImportError:
    PREDICT_AVAILABLE = False


def build_features(emotion_sequence: list[str]) -> list[int]:
    counts = {e: 0 for e in ALL_EMOTIONS}
    for e in emotion_sequence:
        if e in counts:
            counts[e] += 1
    return [counts[e] for e in ALL_EMOTIONS]


def train_mood_model(name: str):
    if not PREDICT_AVAILABLE:
        return None

    from app.database.db import get_connection
    conn = get_connection()
    c    = conn.cursor()
    c.execute(
        "SELECT emotion FROM mood_logs WHERE user_name = ? ORDER BY id DESC LIMIT 100",
        (name,),
    )
    rows = c.fetchall()
    conn.close()

    emotions = [r[0] for r in rows if r[0]]
    if len(emotions) < 8:
        return None

    WINDOW = 5
    X, y = [], []
    for i in range(len(emotions) - WINDOW):
        window = emotions[i : i + WINDOW]
        next_e = emotions[i + WINDOW]
        X.append(build_features(window))
        y.append(1 if next_e in NEGATIVE_EMOTIONS else 0)

    if len(set(y)) < 2:
        return None

    model = RandomForestClassifier(n_estimators=50, max_depth=4, random_state=42)
    model.fit(X, y)
    return model


def predict_next_mood(
    name: str,
    recent_emotions: list[str],
) -> tuple[bool | None, int | None]:
    if not PREDICT_AVAILABLE:
        return None, None

    model = train_mood_model(name)
    if model is None:
        return None, None

    features   = [build_features(recent_emotions[-5:])]
    pred       = model.predict(features)[0]
    proba      = model.predict_proba(features)[0]
    confidence = round(max(proba) * 100)
    return bool(pred), confidence


def is_predict_available() -> bool:
    return PREDICT_AVAILABLE


def get_emotion_trend(user_name: str) -> dict:
    try:
        from app.database.db import get_connection
        conn = get_connection()
        cur  = conn.cursor()

        cur.execute("""
            SELECT
                SUM(CASE WHEN emotion IN ('joy','trust','anticipation','surprise','greeting') THEN 1 ELSE 0 END) as positive,
                COUNT(*) as total
            FROM mood_logs
            WHERE user_name = ? AND created_at >= DATE('now', '-7 days')
        """, (user_name,))
        this_week = cur.fetchone()

        cur.execute("""
            SELECT
                SUM(CASE WHEN emotion IN ('joy','trust','anticipation','surprise','greeting') THEN 1 ELSE 0 END) as positive,
                COUNT(*) as total
            FROM mood_logs
            WHERE user_name = ?
              AND created_at >= DATE('now', '-14 days')
              AND created_at  < DATE('now', '-7 days')
        """, (user_name,))
        last_week = cur.fetchone()
        conn.close()

        this_pos   = this_week["positive"] or 0
        this_total = this_week["total"]    or 1
        last_pos   = last_week["positive"] or 0
        last_total = last_week["total"]    or 1

        this_score = round((this_pos / this_total) * 100)
        last_score = round((last_pos / last_total) * 100)
        diff       = this_score - last_score

        if last_total <= 1:
            return {"trend": "neutral", "change_pct": 0, "message": None}

        if diff >= 10:
            return {
                "trend":      "improving",
                "change_pct": diff,
                "message":    f"Your mood has improved by {diff}% compared to last week. Keep it up! 🌟",
            }
        elif diff <= -10:
            return {
                "trend":      "declining",
                "change_pct": abs(diff),
                "message":    f"Your mood has dipped by {abs(diff)}% compared to last week. You are not alone. 💙",
            }
        else:
            return {
                "trend":      "stable",
                "change_pct": abs(diff),
                "message":    "Your mood has been stable this week. Consistency is great! 😊",
            }

    except Exception:
        return {"trend": "neutral", "change_pct": 0, "message": None}