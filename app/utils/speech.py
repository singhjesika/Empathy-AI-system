try:
    import speech_recognition as sr
    MIC_AVAILABLE = True
except ImportError:
    MIC_AVAILABLE = False


def listen() -> str | None:
    """
    Record one spoken utterance and return the transcribed text.
    Returns None if nothing was heard or recognition failed.
    """
    if not MIC_AVAILABLE:
        return None

    r = sr.Recognizer()
    r.pause_threshold  = 1.0
    r.energy_threshold = 300

    try:
        with sr.Microphone() as source:
            print("  [Listening... speak now]")
            r.adjust_for_ambient_noise(source, duration=0.5)
            audio = r.listen(source, timeout=6, phrase_time_limit=10)

        text = r.recognize_google(audio)
        print(f"  [You said]: {text}")
        return text

    except sr.WaitTimeoutError:
        print("  [No speech detected — try again]")
    except sr.UnknownValueError:
        print("  [Could not understand — please speak clearly]")
    except Exception as e:
        print(f"  [Mic error: {e}]")

    return None


def is_mic_available() -> bool:
    return MIC_AVAILABLE