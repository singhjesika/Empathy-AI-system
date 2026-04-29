from app.config import LEVELS, BADGES
from app.database.queries import add_xp, get_total_xp, get_mood_summary, get_user



def get_level(xp: int) -> tuple[int, str, str]:
    """
    Return (level_number, title, description) for the given XP.
    """
    current = (1, LEVELS[0][1], LEVELS[0][2])
    for i, (threshold, title, desc) in enumerate(LEVELS):
        if xp >= threshold:
            current = (i + 1, title, desc)
    return current


def get_xp_progress(xp: int) -> tuple[int, int | None, str | None]:
    """
    Return (xp_in_current_level, xp_needed_for_next, next_level_title).
    If already at max level, xp_needed and next_title are None.
    """
    for i, (threshold, _title, _desc) in enumerate(LEVELS):
        if i + 1 < len(LEVELS):
            next_thresh, next_title, _ = LEVELS[i + 1]
            if xp < next_thresh:
                return xp - threshold, next_thresh - threshold, next_title
    return xp - LEVELS[-1][0], None, None



def get_emotion_counts(name: str) -> dict[str, int]:
    """Return {emotion: count} dict for the user."""
    rows = get_mood_summary(name)
    return {e: c for e, c in rows}


def check_badges(name: str) -> list[str]:
    """Return list of badge names the user has unlocked."""
    user     = get_user(name)
    sessions = user["total_chats"] if user else 0
    xp       = get_total_xp(name)
    ecounts  = get_emotion_counts(name)

    unlocked = []
    for badge_name, _desc, condition in BADGES:
        if badge_name == "Century":
            if xp >= 100:
                unlocked.append(badge_name)
        else:
            try:
                if condition(sessions, ecounts):
                    unlocked.append(badge_name)
            except Exception:
                pass
    return unlocked


def award_xp(name: str, emotion: str, per_chat: int, emotion_bonus_map: dict) -> int:
    """
    Award XP for one chat turn.
    Returns the total XP earned this turn.
    """
    bonus  = emotion_bonus_map.get(emotion, 0)
    earned = per_chat + bonus
    add_xp(name, f"chat_{emotion}", earned)
    return earned


def show_xp_status(name: str) -> None:
    """Print a formatted XP / level / badge report to the terminal."""
    xp                           = get_total_xp(name)
    lvl_num, lvl_title, lvl_desc = get_level(xp)
    cur, needed, next_title      = get_xp_progress(xp)
    badges                       = check_badges(name)

    print("\n" + "=" * 52)
    print(f"  XP STATUS — {name}")
    print("=" * 52)
    print(f"  Total XP   : {xp} XP")
    print(f"  Level {lvl_num:<4}  : {lvl_title}  —  {lvl_desc}")

    if needed:
        bar_len = 20
        filled  = int((cur / needed) * bar_len)
        bar     = "█" * filled + "░" * (bar_len - filled)
        print(f"  Progress   : [{bar}]  {cur}/{needed} XP to {next_title}")
    else:
        print("  Progress   : MAX LEVEL REACHED!")

    print()
    if badges:
        print(f"  Badges ({len(badges)})  :")
        for b in badges:
            desc = next((d for n, d, _ in BADGES if n == b), "")
            print(f"    * {b:<22}  {desc}")
    else:
        print("  Badges     : None yet — keep chatting!")

    print("=" * 52 + "\n")