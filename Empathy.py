from textblob import TextBlob
import random
import datetime
import re

try:
    import pyttsx3
    
    _test = pyttsx3.init()
    _test.stop()
    VOICE_AVAILABLE = True
except Exception:
    VOICE_AVAILABLE = False


def speak(text, voice_on):
    
    if not voice_on or not VOICE_AVAILABLE:
        return
    # Strip emojis so TTS sounds natural
    clean = re.sub(r'[^\x00-\x7F]+', '', text).strip()
    if not clean:
        return
    try:
        engine = pyttsx3.init()
        engine.setProperty("rate", 155)
        engine.setProperty("volume", 1.0)

        # Pick a female voice if available
        for v in engine.getProperty("voices"):
            if any(w in v.name.lower() for w in ["female", "zira", "hazel", "susan"]):
                engine.setProperty("voice", v.id)
                break

        engine.say(clean)
        engine.runAndWait()
        engine.stop()          # ← cleanly release engine after each reply
    except Exception as e:
        print(f"  (Voice error: {e})")


Educational_Suggestions = [
    "Try to plan short study sessions with breaks.",
    "Stay consistent, one step at a time!",
    "Focus on understanding, not memorizing!",
    "Divide your study sessions into focused segments with short breaks in-between!",
    "Use mind mapping to visually organize new information and see connections between ideas!",
    "Make notes in color to enhance recall and focus!",
    "Summarize concepts in your own words to deepen understanding and retention!",
    "Remove distractions and create a dedicated, organized study space!",
    "Regularly practice solving problems or writing essays to reinforce learning!",
    "Use diverse learning resources: textbooks, online tutorials, videos, and podcasts!",
    "Try the Pomodoro method: 25 minutes study, 5 minutes break!",
    "Set small, achievable study goals for each session!",
    "Explain what you learned to someone else — it confirms your understanding!",
    "Reward yourself for reaching milestones, even small ones, to stay motivated!",
]

Motivational_Responses = [
    "Keep believing in yourself!",
    "Every challenge helps you grow!",
    "You've got this!",
    "You are braver than you believe, stronger than you seem, and smarter than you think!",
    "Education is the most powerful weapon you can use to change the world!",
    "The expert in anything was once a beginner!",
    "When it feels impossible, remember: many things seemed impossible until they were done!",
    "Forget all the reasons it won't work and believe in the one reason that it will!",
    "Don't watch the clock; do what it does — keep going!",
    "Success is not about perfection. It's about perseverance!",
    "Your positive action combined with positive thinking results in success!",
    "The future belongs to those who believe in the beauty of their dreams!",
]

Stress_Responses = [
    "Take a deep breath — you're more capable than you think.",
    "It's okay to feel overwhelmed. Try to focus on just one thing at a time.",
    "Step away for 5 minutes. A short break can reset your mind.",
    "You don't have to solve everything at once. Break it into smaller steps.",
    "Feeling stressed is normal. Have you tried writing down what's worrying you?",
    "Remember: this too shall pass. You've handled tough times before!",
]

Health_Responses = [
    "Don't forget to drink water — hydration boosts focus and mood!",
    "A short walk or stretch can do wonders for your energy levels.",
    "Getting enough sleep is just as important as studying hard!",
    "Try to eat balanced meals — your brain needs good fuel!",
    "Taking care of your body is taking care of your future self.",
]

Greeting_Responses = [
    "Hello! How are you feeling today?",
    "Hey there! I'm here to listen and help.",
    "Hi! What's on your mind today?",
    "Good to see you! What would you like to talk about?",
]

Farewell_Responses = [
    "Take care! Remember, every day is a new chance to grow.",
    "Goodbye! Keep believing in yourself.",
    "See you soon! Stay positive and keep moving forward.",
    "Farewell! You're doing great — don't forget that.",
]


class EmpathyAssistant:
    def __init__(self, voice_on=True):
        self.user_name = None
        self.history   = []          
        self.turn_count = 0
        self.voice_on  = voice_on and VOICE_AVAILABLE

    def get_time_greeting(self):
        hour = datetime.datetime.now().hour
        if hour < 12:
            return "Good morning"
        elif hour < 17:
            return "Good afternoon"
        else:
            return "Good evening"

    def detect_topic(self, text):
        text_lower = text.lower()

        study_keywords    = ["study", "course", "exam", "homework", "assignment",
                             "learn", "class", "school", "college", "test", "grade",
                             "student", "b.tech", "btech", "m.tech", "engineering",
                             "university", "degree", "semester", "lecture", "project",
                             "lab", "syllabus", "marks", "result", "tutor", "notes"]
        stress_keywords   = ["stress", "stressed", "anxious", "anxiety", "worried",
                             "overwhelmed", "nervous", "panic", "pressure", "tired"]
        health_keywords   = ["sleep", "eat", "food", "exercise", "water", "sick",
                             "health", "diet", "rest", "workout"]
        greeting_keywords = ["hello", "hi", "hey", "good morning", "good evening",
                             "good afternoon", "what's up", "howdy"]
        farewell_keywords = ["bye", "goodbye", "see you", "later", "farewell",
                             "take care", "quit", "exit"]

        if any(kw in text_lower for kw in farewell_keywords):
            return "farewell"
        if any(kw in text_lower for kw in greeting_keywords):
            return "greeting"
        if any(kw in text_lower for kw in study_keywords):
            return "study"
        if any(kw in text_lower for kw in stress_keywords):
            return "stress"
        if any(kw in text_lower for kw in health_keywords):
            return "health"
        return "general"

    
    def handle_user_input(self, user_input):
        blob      = TextBlob(user_input)
        polarity  = blob.sentiment.polarity      # -1.0 (negative) → +1.0 (positive)
        topic     = self.detect_topic(user_input)
        name_part = f" {self.user_name}," if self.user_name else ""

       
        if topic == "farewell":
            response = random.choice(Farewell_Responses)

        elif topic == "greeting":
            response = random.choice(Greeting_Responses)

        elif topic == "study":
            prefix   = "📚 Study tip for you: "
            response = prefix + random.choice(Educational_Suggestions)

        elif topic == "stress":
            prefix   = f"😊 I hear you{name_part} — it's okay to feel this way. "
            response = prefix + random.choice(Stress_Responses)

        elif topic == "health":
            prefix   = "💪 Your well-being matters! "
            response = prefix + random.choice(Health_Responses)

        
        elif polarity < -0.2:
            prefix   = f"💙 It sounds like you're going through a hard time{name_part}. "
            response = prefix + random.choice(Motivational_Responses)

        elif polarity > 0.2:
            prefix   = f"😄 Great to hear positive vibes{name_part}! "
            response = prefix + random.choice(Motivational_Responses)

        else:
            response = "🌟 " + random.choice(Motivational_Responses)

        
        timestamp = datetime.datetime.now().strftime("%H:%M:%S")
        self.history.append((timestamp, user_input, response))
        self.turn_count += 1

        return response

    def show_history(self):
        if not self.history:
            print("\n  (No conversation history yet.)\n")
            return
        print("\n── Conversation History ──────────────────")
        for ts, user_msg, bot_msg in self.history:
            print(f"  [{ts}] You       : {user_msg}")
            print(f"  [{ts}] Empathy AI: {bot_msg}")
            print()
        print("──────────────────────────────────────────\n")




def main():
    assistant = EmpathyAssistant(voice_on=True)

    print("=" * 52)
    print("       Welcome to Empathy AI Assistant 🤖")
    print("=" * 52)

    if VOICE_AVAILABLE:
        print("  🔊 Voice is ON  — type 'voice off' to mute.")
    else:
        print("  🔇 Voice unavailable. Run:  pip install pyttsx3")

    print("  📜 Type 'history'  to see conversation log.")
    print("  🚪 Type 'bye'      to quit.\n")


    name = input("  Before we start — what's your name? ").strip()
    if name:
        assistant.user_name = name
        greeting = assistant.get_time_greeting()
        msg = f"{greeting}, {name}! I'm here to support you. 😊"
    else:
        msg = "Hello! I'm here to support you. 😊"

    print(f"\n  Empathy AI: {msg}\n")
    speak(msg, assistant.voice_on)

    
    while True:
        try:
            user_input = input("  You: ").strip()
        except (EOFError, KeyboardInterrupt):
            bye_msg = "Goodbye! Take care. 💙"
            print(f"\n  Empathy AI: {bye_msg}")
            speak(bye_msg, assistant.voice_on)
            break

        if not user_input:
            hint = "Feel free to share anything on your mind!"
            print(f"  Empathy AI: {hint}\n")
            speak(hint, assistant.voice_on)
            continue

        cmd = user_input.lower()

        
        if cmd in ["history", "show history"]:
            assistant.show_history()
            continue

        if cmd == "voice off":
            assistant.voice_on = False
            print("  Empathy AI: 🔇 Voice turned OFF.\n")
            continue

        if cmd == "voice on":
            if VOICE_AVAILABLE:
                assistant.voice_on = True
                print("  Empathy AI: 🔊 Voice turned ON.\n")
                speak("Voice is now on!", True)
            else:
                print("  Empathy AI: pyttsx3 not installed. Run: pip install pyttsx3\n")
            continue

        if cmd in ["exit", "quit"]:
            bye_msg = "Goodbye! Keep believing in yourself. 💙"
            print(f"  Empathy AI: {bye_msg}\n")
            speak(bye_msg, assistant.voice_on)
            break

       
        response = assistant.handle_user_input(user_input)
        print(f"\n  Empathy AI: {response}\n")
        speak(response, assistant.voice_on)

        if assistant.detect_topic(user_input) == "farewell":
            break

    print(f"\n  (Session ended after {assistant.turn_count} exchange(s).)")
    print("=" * 52)


if __name__ == "__main__":
    main()