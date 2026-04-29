def is_chart_available() -> bool:
    try:
        import matplotlib
        import pandas
        return True
    except ImportError:
        return False


def show_charts(user_name: str) -> None:
    if not is_chart_available():
        print("  (Install matplotlib + pandas for visual graphs)\n")
        return

    import pandas as pd
    import matplotlib.pyplot as plt
    from app.database.queries import get_mood_summary, get_mood_timeline

    summary = get_mood_summary(user_name)
    timeline = get_mood_timeline(user_name)

    if not summary:
        print("  (No mood data to chart yet.)\n")
        return

    emotions = [row[0] for row in summary]
    counts = [row[1] for row in summary]

    fig, axes = plt.subplots(1, 2, figsize=(12, 5))
    fig.suptitle(f"Mood Report for {user_name}", fontsize=14)

    axes[0].bar(emotions, counts, color="steelblue")
    axes[0].set_title("Emotion Frequency")
    axes[0].set_xlabel("Emotion")
    axes[0].set_ylabel("Count")

    if timeline:
        df = pd.DataFrame(timeline)
        df["created_at"] = pd.to_datetime(df["created_at"])
        df = df.sort_values("created_at")
        axes[1].plot(df["created_at"], df["emotion"], marker="o", color="coral")
        axes[1].set_title("Emotion Timeline")
        axes[1].set_xlabel("Time")
        axes[1].set_ylabel("Emotion")
        plt.xticks(rotation=45)

    plt.tight_layout()
    plt.show()