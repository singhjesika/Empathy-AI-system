from app.database.queries import (
    get_mood_summary,
    get_mood_timeline,
    get_history_from_db,
)


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
        "summary": get_mood_summary(name),
        "timeline": get_mood_timeline(name),
    }

