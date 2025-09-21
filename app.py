from flask import Flask, render_template, request, jsonify
import os
import json
from groq import Groq
from flask_cors import CORS
import time

app = Flask(__name__)
# Restrict CORS for security - only allow same origin
CORS(app, origins=["http://localhost:5000", "https://*.replit.dev", "https://*.repl.co"])

# Initialize Groq client
groq_api_key = os.environ.get("GROQ_API_KEY")
if groq_api_key:
    client = Groq(api_key=groq_api_key)
else:
    client = None

# Persona definitions
PERSONAS = {
    "nonchalant": {
        "name": "Nonchalant",
        "prompt": "You are a savage, unfiltered AI with a laid-back, don’t-give-a-damn tone. Throw out brutal, no-filter replies like you’re too cool to care. Use slang, sarcasm, and hit hard—keep it short and ruthless."
    },
    "chalant": {
        "name": "Chalant",
        "prompt": "You are an energetic, enthusiastic AI with a bold, in-your-face tone. Be intense, use exclamation points, and make every response feel urgent!"
    },
    "gemini": {
        "name": "Gemini-Type",
        "prompt": "You are a witty, clever AI with a playful, conversational vibe like Gemini. Use humor, metaphors, and keep things lively and engaging."
    }
}

# 5 selected models for rotation
MODELS = [
    "llama-3.1-8b-instant",
    "llama-3.3-70b-versatile",
    "openai/gpt-oss-20b",
    "openai/gpt-oss-120b",
    "groq/compound"
]

model_index = 0
chat_history = []
HISTORY_FILE = "chat_history.json"

# Load or initialize chat history
def load_history():
    global chat_history
    try:
        with open(HISTORY_FILE, "r") as f:
            chat_history = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        chat_history = []

# Save chat history
def save_history():
    with open(HISTORY_FILE, "w") as f:
        json.dump(chat_history, f)

# Load history on start
load_history()

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/chat", methods=["POST"])
def chat():
    global model_index
    data = request.json
    user_message = data.get("message")
    persona = data.get("persona", "nonchalant")

    if not user_message:
        return jsonify({"error": "No message provided"}), 400

    if not client:
        return jsonify({"error": "GROQ_API_KEY is not configured. Please set your API key in the environment variables."}), 500

    system_prompt = {"role": "system", "content": PERSONAS[persona]["prompt"]}
    chat_history.append({"role": "user", "content": user_message})
    messages = [system_prompt] + chat_history[-10:]

    current_model = MODELS[model_index]
    model_index = (model_index + 1) % len(MODELS)

    try:
        response = client.chat.completions.create(
            messages=messages,
            model=current_model,
            temperature=0.7,
            max_tokens=1024,
            top_p=1,
            stream=False
        )
        assistant_reply = response.choices[0].message.content
        chat_history.append({"role": "assistant", "content": assistant_reply})
        save_history()
        return jsonify({"reply": assistant_reply, "model": current_model})
    except Exception as e:
        next_model = MODELS[model_index]
        model_index = (model_index + 1) % len(MODELS)
        return jsonify({"error": f"Model {current_model} error ({str(e)}). Falling back to {next_model}."}), 500

@app.route("/clear", methods=["POST"])
def clear_chat():
    global chat_history
    chat_history = []
    save_history()
    return jsonify({"status": "Chat cleared"})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)