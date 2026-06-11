# 🧠 Empathy AI Assistant

> An intelligent emotional support web application powered by Groq AI — helping users track moods, reflect through journaling, understand relationships, and build emotional resilience.


## ✨ Features

| Feature | Description |
|---|---|
| 💬 **AI Chat** | Empathetic conversations powered by Groq LLM |
| 📊 **Mood Tracker** | Log daily moods with visual trend charts |
| 📔 **Journal** | Private journaling with AI-generated reflections |
| 🌡️ **Emotion Heatmap** | Calendar-based visualization of emotional patterns |
| 📈 **Weekly Report** | Auto-generated emotional health summaries |
| 🔮 **Mood Forecast** | Predict emotional trends from historical data |
| 💑 **Relationship Analysis** | Analyze relationship dynamics with AI insights |
| 🔥 **Burnout Detection** | Early warning system for emotional exhaustion |
| 🚀 **Career Coaching** | AI-guided career and motivation support |
| ⏳ **Time Machine** | Revisit past emotional states and growth journey |
| 🤖 **Digital Twin** | Personalized AI model that learns your emotional patterns |
| 🎙️ **Voice Avatar** | Speech recognition for hands-free interaction |

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | FastAPI + Uvicorn (Python) |
| **AI Engine** | Groq API (LLaMA 3) |
| **Database** | SQLite |
| **Frontend** | Vanilla JS + HTML + CSS |
| **Charts** | Chart.js |
| **Auth** | JWT-based login system |

---

## 📁 Project Structure

```
Empathy-AI-system/
├── main.py                  # FastAPI app entry point
├── database.py              # SQLite models and connection
├── auth.py                  # Login / JWT authentication
├── requirements.txt
├── .env                     # API keys (not committed)
│
├── routes/
│   ├── chat.py              # AI chat endpoint
│   ├── mood.py              # Mood logging and retrieval
│   ├── journal.py           # Journal CRUD
│   ├── report.py            # Weekly report generation
│   ├── forecast.py          # Mood forecast
│   ├── relationship.py      # Relationship analysis
│   ├── burnout.py           # Burnout detection
│   ├── career.py            # Career coaching
│   └── twin.py              # Digital twin
│
└── static/
    ├── index.html           # Login page
    ├── dashboard.html       # Main dashboard
    ├── chat.html            # AI chat UI
    ├── mood.html            # Mood tracker
    ├── journal.html         # Journal UI
    ├── heatmap.html         # Emotion heatmap calendar
    ├── report.html          # Weekly report
    ├── forecast.html        # Mood forecast
    ├── relationship.html    # Relationship analysis
    ├── burnout.html         # Burnout checker
    ├── career.html          # Career coaching
    ├── timemachine.html     # Time machine
    └── avatar.html          # Voice avatar
```

---

## 🚀 Getting Started

### 1. Clone the repository
```bash
git clone https://github.com/singhjesika/Empathy-AI-system.git
cd Empathy-AI-system
```

### 2. Create virtual environment
```bash
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Mac/Linux
```

### 3. Install dependencies
```bash
pip install -r requirements.txt
```

### 4. Set up environment variables
Create a `.env` file in the root:
```env
GROQ_API_KEY=your_groq_api_key_here
SECRET_KEY=your_jwt_secret_here
```
Get your free Groq API key at → https://console.groq.com

### 5. Run the app
```bash
uvicorn main:app --reload
```

Open your browser at → **http://localhost:8000**

---

## 🔑 Environment Variables

| Variable | Description | Where to get |
|---|---|---|
| `GROQ_API_KEY` | Groq LLM API key | https://console.groq.com |
| `SECRET_KEY` | JWT signing secret | Any random string |

## 📊 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/register` | Register new user |
| POST | `/auth/login` | Login and get JWT token |
| POST | `/chat` | Send message to AI |
| POST | `/mood` | Log mood entry |
| GET | `/mood/history` | Get mood history |
| GET | `/mood/heatmap` | Heatmap calendar data |
| POST | `/journal` | Create journal entry |
| GET | `/journal` | Get all journal entries |
| GET | `/report/weekly` | Generate weekly report |
| GET | `/forecast` | Get mood forecast |
| POST | `/relationship/analyze` | Analyze relationship |
| GET | `/burnout/score` | Get burnout score |
| POST | `/career/coach` | Get career coaching |

Full interactive docs → **http://localhost:8000/docs**

---

## 🤝 Contributing

1. Fork the repo
2. Create a branch: `git checkout -b feature/your-feature`
3. Commit: `git commit -m "Add your feature"`
4. Push: `git push origin feature/your-feature`
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License.

---

## 👩‍💻 Author

**Jesika PRATAP Singh**
- GitHub: [@singhjesika](https://github.com/singhjesika)

---

> _"Technology with empathy — because mental wellness matters."_ 💙
