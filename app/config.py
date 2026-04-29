import os
from dotenv import load_dotenv

load_dotenv()

# ── Groq ──────────────────────────────────────────────────────────────────────
GROQ_API_KEY   = os.environ.get("GROQ_API_KEY")
GROQ_MODEL     = "llama-3.3-70b-versatile"
GROQ_MAX_TOKENS = 200

# ── Database ──────────────────────────────────────────────────────────────────
DB_FILE = os.path.join(os.path.dirname(__file__), "..", "data", "empathy_memory.db")

# ── Gamification ──────────────────────────────────────────────────────────────
XP_PER_CHAT    = 10
XP_PER_SESSION = 25
XP_EMOTIONS = {
    "sadness": 5,
    "fear":    5,
    "anger":   5,
    "joy":     3,
    "trust":   3,
}

LEVELS = [
    (0,    "Newcomer",       "Just getting started"),
    (100,  "Chatterbox",     "Starting to open up"),
    (250,  "Self-Aware",     "Growing self-awareness"),
    (500,  "Reflector",      "Deep thinker"),
    (1000, "Mind Master",    "Emotional intelligence"),
    (2000, "Empathy Expert", "True empathy champion"),
]

BADGES = [
    ("First Chat",       "Completed first conversation",         lambda s, e: s >= 1),
    ("Feeling Explorer", "Expressed 5 different emotions",       lambda s, e: len(e) >= 5),
    ("Study Buddy",      "Asked for study help 3+ times",        lambda s, e: e.get("study", 0) >= 3),
    ("Stress Buster",    "Faced stress 3+ times and kept going", lambda s, e: e.get("stress", 0) >= 3),
    ("Joy Spreader",     "Expressed joy 5+ times",               lambda s, e: e.get("joy", 0) >= 5),
    ("Consistency",      "Chatted 10+ sessions",                 lambda s, e: s >= 10),
    ("Century",          "Earned 100+ XP",                       lambda s, e: True),
    ("Veteran",          "Chatted 25+ sessions",                 lambda s, e: s >= 25),
]

# ── Emotion Config ────────────────────────────────────────────────────────────
EMOTION_COLORS = {
    "joy":          "#FFD700",
    "sadness":      "#00BFFF",
    "anger":        "#FF4500",
    "fear":         "#BF5FFF",
    "disgust":      "#00FA9A",
    "surprise":     "#FF8C00",
    "trust":        "#00FFCC",
    "anticipation": "#FF6347",
    "study":        "#7CFF6B",
    "stress":       "#FF69B4",
    "health":       "#40E0D0",
    "general":      "#A9A9A9",
}

EMOTION_LABELS = {
    "joy": "Joy", "sadness": "Sadness", "anger": "Anger",
    "fear": "Fear", "disgust": "Disgust", "surprise": "Surprise",
    "trust": "Trust", "anticipation": "Anticipation",
}

ALL_EMOTIONS = [
    "joy", "sadness", "anger", "fear",
    "disgust", "surprise", "trust", "anticipation",
    "study", "stress", "health", "general",
]

NEGATIVE_EMOTIONS = {"sadness", "anger", "fear", "disgust", "stress"}

TOPIC_CORPUS = {
    "study":    "study exam homework assignment college university degree semester lecture project syllabus marks result engineering btech course learn grade tutor notes test class school",
    "stress":   "stress anxious anxiety worried overwhelmed nervous panic pressure frustration burden tension restless uneasy",
    "health":   "sleep eat food exercise water sick health diet rest workout tired body pain energy fatigue",
    "greeting": "hello hi hey good morning good evening good afternoon howdy welcome greetings",
    "farewell": "bye goodbye see you later farewell take care quit exit done",
}

RESPONSES = {
    "joy": [
        "That is wonderful to hear! Keep that positive energy going!",
        "Amazing! Your happiness is contagious — stay in that beautiful flow!",
        "Love this energy! Celebrate your wins, big or small!",
        "So glad you are feeling joyful! You deserve every bit of it!",
    ],
    "sadness": [
        "I am really sorry you are feeling this way. It is okay to feel sad sometimes.",
        "Your feelings are completely valid. Take it one breath at a time.",
        "It is okay to not be okay. I am here with you right now.",
        "Even the darkest night will end and the sun will rise. Hang in there.",
    ],
    "anger": [
        "I can feel your frustration. Take a slow breath — you have got this.",
        "It makes sense to feel angry. Try to channel that energy into something positive.",
        "Your feelings are valid. When you are ready, let us think through this together.",
        "Anger is a signal that something important matters to you. Let us figure it out.",
    ],
    "fear": [
        "Fear is normal — it means you care. Take it step by step.",
        "You are braver than you think. Face one small thing at a time.",
        "Courage is not the absence of fear — it is moving forward anyway.",
        "Deep breath. You have overcome hard things before, and you can do this too.",
    ],
    "disgust": [
        "That sounds really unpleasant. Trust your instincts and step away from what drains you.",
        "You do not have to accept what feels wrong. Set boundaries and protect your peace.",
    ],
    "surprise": [
        "Wow, that sounds unexpected! How are you feeling about it?",
        "Life is full of surprises! Whether good or bad, you will navigate this.",
    ],
    "trust": [
        "It is great that you feel confident and secure right now!",
        "Trust in yourself — you have the strength to handle whatever comes.",
    ],
    "anticipation": [
        "How exciting — something big is coming your way!",
        "That anticipation means you care deeply about what is ahead. Channel it into preparation!",
    ],
    "study": [
        "Try the Pomodoro method: 25 minutes study, then 5 minutes break!",
        "Focus on understanding, not memorizing — concepts stick longer.",
        "Make colorful notes and summarize in your own words.",
        "Study in a clean, distraction-free space for best focus.",
        "Explain topics to yourself out loud — it is the fastest way to find gaps.",
        "Set one small goal per session. Completing it feels great and builds momentum!",
        "Use past papers and practice problems — repetition builds confidence.",
        "Divide your syllabus into daily chunks so nothing feels overwhelming.",
    ],
    "stress": [
        "Take a deep breath — you are more capable than you think.",
        "It is okay to feel overwhelmed. Focus on just one thing at a time.",
        "Step away for 5 minutes. A short break can completely reset your mind.",
        "Break the big problem into tiny steps and tackle one at a time.",
        "Write down everything worrying you — getting it out of your head helps.",
        "Remember: this too shall pass. You have handled tough times before!",
    ],
    "health": [
        "Drink water first — hydration directly boosts your mood and focus!",
        "A 10-minute walk can reset your energy and clear your mind.",
        "Good sleep is as important as studying hard — protect it.",
        "Eat balanced meals: your brain needs proper fuel to perform.",
        "Stretch for 5 minutes right now — your body will thank you.",
    ],
    "greeting": [
        "Hello! How are you feeling today?",
        "Hey there! I am here to listen and help.",
        "Hi! What is on your mind today?",
        "Good to see you! What would you like to talk about?",
    ],
    "farewell": [
        "Take care! Every day is a new chance to grow.",
        "Goodbye! Keep believing in yourself.",
        "See you soon! Stay positive and keep moving forward.",
        "Farewell! You are doing great — do not forget that.",
    ],
    "general": [
        "Keep believing in yourself!",
        "Every challenge helps you grow!",
        "You have got this!",
        "The expert in anything was once a beginner!",
        "Success is not about perfection — it is about perseverance!",
        "Your positive action combined with positive thinking results in success!",
    ],
}

PERSONALITY_MODES = {
    "friend": {
        "label":       "Friend",
        "emoji":       "🤝",
        "system_hint": (
            "You are a warm, casual best friend. Use empathetic, informal language. "
            "Say things like 'That sounds really tough' or 'I totally get that'. "
            "Be supportive, relatable, and never judgmental."
        ),
    },
    "coach": {
        "label":       "Coach",
        "emoji":       "🎯",
        "system_hint": (
            "You are a motivational life coach. Be direct, action-focused, and solution-oriented. "
            "Give clear steps and strong encouragement. "
            "Say things like 'Let us fix this step by step' or 'Here is what you can do right now'."
        ),
    },
    "therapist": {
        "label":       "Therapist",
        "emoji":       "🧠",
        "system_hint": (
            "You are a calm, professional therapist. Ask reflective questions, validate feelings deeply, "
            "and help the user explore their emotions. "
            "Say things like 'Can you describe what triggered this feeling?' or "
            "'What does this emotion remind you of from before?'."
        ),
    },
}

DEFAULT_PERSONALITY = "friend"

BURNOUT_THRESHOLD_DAYS = 3
BURNOUT_MIN_NEGATIVE   = 3