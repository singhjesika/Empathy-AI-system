from app.database.db import init_db
from app.database.queries import (
    save_user, get_user, get_last_emotion,
    add_xp, get_total_xp,
)

from app.services.chat_service import handle_turn
from app.services.mood_service import show_history, show_mood_report
from app.services.xp_service import show_xp_status, get_level
from app.utils.voice import speak, is_voice_available
from app.utils.speech import listen, is_mic_available
from app.utils.helpers import (
    get_time_greeting, get_daily_quote, breathing_exercise,
)
from app.ai.emotion import is_emotion_available
from app.ai.llm import is_llm_available
from app.ai.predictor import is_predict_available
from app.analytics.charts import is_chart_available
from app.config import XP_PER_SESSION, EMOTION_LABELS


def _print_banner() -> None:
    print("=" * 56)
    print("      Welcome to Empathy AI Assistant v9.0")
    print("=" * 56)
    print(f"  Emotion engine : {'ON  (8 emotions via NRCLex)' if is_emotion_available() else 'OFF  ->  pip install nrclex'}")
    print(f"  Voice          : {'ON   ->  type voice off to mute' if is_voice_available() else 'OFF  ->  pip install pyttsx3'}")
    print(f"  Memory         : ON  (SQLite — remembers you!)")
    print(f"  Mood predictor : {'ON  (Random Forest)' if is_predict_available() else 'OFF  ->  pip install scikit-learn'}")
    print(f"  Voice input    : {'ON   ->  type mic on to start talking' if is_mic_available() else 'OFF  ->  pip install SpeechRecognition pyaudio'}")
    print(f"  Analytics      : {'ON   ->  type mood report to see graphs' if is_chart_available() else 'OFF  ->  pip install matplotlib pandas'}")
    print(f"  Deep AI (Groq) : {'ON   ->  Llama3 active (free)' if is_llm_available() else 'OFF/KEY MISSING  ->  set GROQ_API_KEY'}")
    print("  Commands       : history | mood report | xp | breathe | quote | mic on/off | bye")
    print("=" * 56 + "\n")


def _handle_command(cmd: str, user_name: str,
                    voice_on: bool, mic_mode: bool) -> tuple[bool, bool, bool, bool]:
    should_exit = False

    if cmd in ("history", "show history"):
        show_history(user_name)

    elif cmd in ("mood report", "my mood", "mood", "charts", "graph"):
        show_mood_report(user_name)

    elif cmd in ("breathe", "breathing", "calm", "relax"):
        breathing_exercise(voice_on)

    elif cmd in ("quote", "daily quote", "inspire", "motivation"):
        q = get_daily_quote()
        print(f"\n  Daily quote: {q}\n")
        speak(q, voice_on)

    elif cmd in ("xp", "level", "badges", "status", "my xp"):
        show_xp_status(user_name)

    elif cmd == "mic on":
        if is_mic_available():
            mic_mode = True
            m = "Microphone is ON! I am listening. Just speak your message."
            print(f"  Empathy AI: {m}\n")
            speak(m, voice_on)
        else:
            print("  Empathy AI: Microphone not available. Run: pip install SpeechRecognition pyaudio\n")

    elif cmd == "mic off":
        mic_mode = False
        print("  Empathy AI: Microphone OFF. Back to text input.\n")

    elif cmd == "voice off":
        voice_on = False
        print("  Empathy AI: Voice turned OFF.\n")

    elif cmd == "voice on":
        voice_on = True
        m = "Voice is now on!"
        print(f"  Empathy AI: {m}\n")
        speak(m, True)

    elif cmd in ("exit", "quit", "bye", "goodbye"):
        should_exit = True

    else:
        return False, voice_on, mic_mode, False

    return True, voice_on, mic_mode, should_exit


def run() -> None:
    init_db()

    voice_on = is_voice_available()
    mic_mode = False
    turn_count = 0

    _print_banner()

    name = input("  What is your name? ").strip() or "Friend"
    existing_user = get_user(name)
    save_user(name)
    add_xp(name, "session_start", XP_PER_SESSION)

    time_greet = get_time_greeting()

    if existing_user:
        chats = existing_user["total_chats"]
        last_emotion = get_last_emotion(name)
        msg = f"{time_greet}, {name}! Welcome back! You have visited {chats} time(s)."
        print(f"\n  Empathy AI: {msg}")
        speak(msg, voice_on)
        if last_emotion and last_emotion in EMOTION_LABELS:
            followup = f"  Last time you seemed to feel {last_emotion}. How are you feeling today?"
            print(f"  Empathy AI: {followup}\n")
            speak(followup, voice_on)
        else:
            print()
    else:
        msg = f"{time_greet}, {name}! I am your Empathy AI. I will remember you from now on."
        print(f"\n  Empathy AI: {msg}\n")
        speak(msg, voice_on)

    while True:
        try:
            if mic_mode and is_mic_available():
                print("  You (speak): ", end="", flush=True)
                user_input = listen()
                if user_input is None:
                    print("  (Nothing heard — switching to text input for this turn)")
                    user_input = input("  You: ").strip()
            else:
                user_input = input("  You: ").strip()
        except (EOFError, KeyboardInterrupt):
            bye = "Goodbye! Take care."
            print(f"\n  Empathy AI: {bye}")
            speak(bye, voice_on)
            break

        if not user_input:
            print("  Empathy AI: Feel free to share anything on your mind!\n")
            continue

        cmd = user_input.lower()
        handled, voice_on, mic_mode, should_exit = _handle_command(
            cmd, name, voice_on, mic_mode
        )

        if should_exit:
            bye = f"Goodbye {name}! See you next time."
            print(f"  Empathy AI: {bye}\n")
            speak(bye, voice_on)
            break

        if handled:
            continue

        result = handle_turn(user_input, name)

        print(f"\n  Empathy AI: {result['response']}\n")
        speak(result["response"], voice_on)

        print(f"  [+{result['xp_earned']} XP | Total: {result['total_xp']} XP | "
              f"Level {result['level_num']}: {result['level_title']}]\n")

        if result["prediction"]:
            conf = result["prediction"]["confidence"]
            warn = f"  [Mood insight: You might be feeling low soon ({conf}% based on your pattern). Take a break!]"
            print(f"  {warn}\n")
            speak(warn, voice_on)

        turn_count += 1

        if result["topic"] == "farewell":
            break

    print(f"\n  Session ended after {turn_count} exchange(s).")
    total = get_total_xp(name)
    lvl_num, lvl_title, _ = get_level(total)
    print(f"  XP this session : ~{turn_count * 10 + XP_PER_SESSION} XP earned")
    print(f"  Total XP        : {total} XP  |  Level {lvl_num}: {lvl_title}")
    print("=" * 56)