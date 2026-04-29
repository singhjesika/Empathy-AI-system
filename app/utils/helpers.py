import datetime
import json
import random
import time
import urllib.request

from app.utils.voice import speak

FALLBACK_QUOTES = [
    "Believe you can and you are halfway there. — Theodore Roosevelt",
    "It always seems impossible until it is done. — Nelson Mandela",
    "You are braver than you believe. — A.A. Milne",
    "Start where you are. Use what you have. Do what you can. — Arthur Ashe",
]


def get_time_greeting() -> str:
    h = datetime.datetime.now().hour
    if h < 12:  return "Good morning"
    if h < 17:  return "Good afternoon"
    return "Good evening"



def get_daily_quote() -> str:
    """Fetch a random quote from ZenQuotes API, or use a fallback."""
    try:
        url = "https://zenquotes.io/api/random"
        req = urllib.request.Request(url, headers={"User-Agent": "EmpathyAI/1.0"})
        with urllib.request.urlopen(req, timeout=5) as r:
            data = json.loads(r.read().decode())[0]
            return f"{data['q']}  — {data['a']}"
    except Exception:
        return random.choice(FALLBACK_QUOTES)


BREATHING_STEPS = [
    ("Inhale slowly through your nose",  4),
    ("Hold your breath",                 7),
    ("Exhale fully through your mouth",  8),
]


def breathing_exercise(voice_on: bool, rounds: int = 3) -> None:
    """
    Guide the user through the 4-7-8 breathing technique.
    Press Ctrl+C at any time to stop.
    """
    print("\n  Breathing exercise — 4-7-8 technique")
    print("  Follow along. Press Ctrl+C anytime to stop.\n")

    try:
        for r in range(1, rounds + 1):
            print(f"  Round {r} of {rounds}")
            for action, secs in BREATHING_STEPS:
                msg = f"{action}... {secs} seconds"
                print(f"    {msg}")
                speak(msg, voice_on)
                for i in range(secs, 0, -1):
                    print(f"      {i}...", end="\r")
                    time.sleep(1)
                print()
            print()

        done = "Great job! You completed the breathing exercise. Feel better?"
        print(f"  {done}")
        speak(done, voice_on)

    except KeyboardInterrupt:
        print("\n  Exercise stopped.")

    print()