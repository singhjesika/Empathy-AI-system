from groq import Groq
from app.config import GROQ_API_KEY, GROQ_MODEL

print("Testing Groq API...")
try:
    client = Groq(api_key=GROQ_API_KEY)
    r = client.chat.completions.create(
        model=GROQ_MODEL,
        max_tokens=50,
        messages=[{"role": "user", "content": "say hello to Jesika warmly"}]
    )
    print("✅ SUCCESS:", r.choices[0].message.content)
except Exception as e:
    print(f"❌ FAILED: {type(e).__name__}: {e}")