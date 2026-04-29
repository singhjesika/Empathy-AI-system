import re

try:
    import pyttsx3
    VOICE_AVAILABLE = True
except ImportError:
    VOICE_AVAILABLE = False


def speak(text: str, voice_on: bool) -> None:
    """
    Speak `text` aloud using pyttsx3.
    Silently does nothing if voice is off or pyttsx3 is not installed.
    """
    if not voice_on or not VOICE_AVAILABLE:
        return

    # Strip non-ASCII characters that cause TTS errors
    clean = re.sub(r'[^\x00-\x7F]+', '', text).strip()
    if not clean:
        return

    try:
        engine = pyttsx3.init()
        engine.setProperty("rate",   160)
        engine.setProperty("volume", 1.0)
        engine.say(clean)
        engine.runAndWait()
        engine.stop()
    except Exception as e:
        print(f"  (Voice error: {e})")


def is_voice_available() -> bool:
    return VOICE_AVAILABLE