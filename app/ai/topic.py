import re
from app.config import TOPIC_CORPUS

try:
    import nltk
    from nltk.corpus import stopwords
    from nltk.tokenize import word_tokenize
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
    import numpy as np

    nltk.download("stopwords", quiet=True)
    nltk.download("punkt",     quiet=True)
    nltk.download("punkt_tab", quiet=True)
    PREPROCESS_AVAILABLE = True
except ImportError:
    PREPROCESS_AVAILABLE = False



_tfidf         = None
_corpus_labels = []
_corpus_matrix = None


def _build_tfidf() -> None:
    global _tfidf, _corpus_labels, _corpus_matrix
    if _tfidf is not None:
        return
    _corpus_labels = list(TOPIC_CORPUS.keys())
    docs           = list(TOPIC_CORPUS.values())
    _tfidf         = TfidfVectorizer()
    _corpus_matrix = _tfidf.fit_transform(docs)


def _clean_text(text: str) -> str:
    text = text.lower()
    text = re.sub(r"[^a-z\s]", " ", text)
    if PREPROCESS_AVAILABLE:
        tokens = word_tokenize(text)
        stops  = set(stopwords.words("english"))
        tokens = [t for t in tokens if t not in stops and len(t) > 1]
        return " ".join(tokens)
    return text


def _tfidf_topic(text: str) -> str | None:
    """Return best-matching topic via cosine similarity, or None."""
    if not PREPROCESS_AVAILABLE:
        return None
    _build_tfidf()
    cleaned = _clean_text(text)
    if not cleaned.strip():
        return None
    vec   = _tfidf.transform([cleaned])
    sims  = cosine_similarity(vec, _corpus_matrix)[0]
    best  = int(np.argmax(sims))
    score = sims[best]
    return _corpus_labels[best] if score >= 0.08 else None


def detect_topic(text: str) -> str | None:
    """
    Detect the topic of `text`.
    Priority: greeting/farewell shortcuts → TF-IDF → keyword fallback → None
    Returns: 'study' | 'stress' | 'health' | 'greeting' | 'farewell' | None
    """
    t     = text.lower()
    words = set(re.findall(r"\b\w+\b", t))

    
    if words & {"bye", "goodbye", "farewell", "exit", "quit"} or "see you" in t:
        return "farewell"
    if words & {"hello", "hi", "hey", "howdy"} or any(
            p in t for p in ["good morning", "good evening",
                              "good afternoon", "what's up"]):
        return "greeting"

    
    result = _tfidf_topic(text)
    if result:
        return result

    if words & {
        "study", "studies", "studying", "course", "exam", "exams",
        "finals", "final", "homework", "assignment", "learn", "learning",
        "class", "school", "college", "test", "grade", "student",
        "engineering", "university", "degree", "semester", "lecture",
        "project", "lab", "syllabus", "marks", "result", "tutor",
        "notes", "concentrate", "concentration", "focus", "revision",
        "btech", "mtech",
    } or "b.tech" in t or "m.tech" in t:
        return "study"

    if words & {
        "stress", "stressed", "anxious", "anxiety", "worried",
        "overwhelmed", "nervous", "panic", "pressure", "drained",
        "burnout", "burned", "burnt", "exhausted", "tense", "tension",
    }:
        return "stress"

    if words & {
        "sleep", "eat", "eating", "food", "exercise", "water",
        "sick", "health", "diet", "rest", "workout", "tired",
        "fitness", "physical", "fatigue", "body", "pain",
    }:
        return "health"

    return None