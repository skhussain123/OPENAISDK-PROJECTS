

```bash
uv add openai-agents
uv add fastapi
uv add motor
uv add uvicorn
uv add python-dotenv 

uv run uvicorn main:app --reload

or 

python -m uvicorn main:app --reload
```

#### pyproject.toml
```bash
[project]
name = "practice"
version = "0.1.0"
description = "Add your description here"
readme = "README.md"
requires-python = ">=3.11"
dependencies = [
    "fastapi>=0.121.2",
    "motor>=3.7.1",
    "openai-agents>=0.5.1",
    "uvicorn>=0.38.0",
]
```

#### Main.py
```bash
import os
from agents import Agent, OpenAIChatCompletionsModel, set_tracing_disabled, Runner
from openai import AsyncOpenAI
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Config ---
gemini_api_key = os.getenv('GEMINI_API_KEY')
mongodb_uri = 'mongodb://localhost:27017'

# --- OpenAI / Gemini Client ---
external_client = AsyncOpenAI(
    api_key=gemini_api_key,
    base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
)

# --- MongoDB Setup ---
mongo_client = AsyncIOMotorClient(mongodb_uri)
db = mongo_client['student_db']
sessions_collection = db['sessions']

# --- Disable tracing ---
set_tracing_disabled(True)

# --- MongoDB Session Manager ---
class MongoSessionManager:
    def __init__(self, collection):
        self.collection = collection

    async def get_session(self, session_id: str):
        doc = await self.collection.find_one({"_id": session_id})
        if doc:
            return doc.get("messages", [])
        return []

    async def save_message(self, session_id: str, role: str, content: str):
        await self.collection.update_one(
            {"_id": session_id},
            {"$push": {"messages": {"role": role, "content": content}}},
            upsert=True
        )

# --- Session Wrapper for Runner ---
class UserSession:
    def __init__(self, messages):
        self.messages = messages

    async def get_items(self):
        return self.messages

    async def add_items(self, items):
        self.messages.extend(items)

# --- Request/Response Models ---
class ChatRequest(BaseModel):
    session_id: str
    message: str

class ChatResponse(BaseModel):
    response: str
    session_id: str

# --- Initialize Agent ---
agent = Agent(
    name="Assistant",
    instructions="You are a helpful assistant. Be concise and friendly.",
    model=OpenAIChatCompletionsModel(model="gemini-2.0-flash", openai_client=external_client),
)

session_manager = MongoSessionManager(sessions_collection)

# --- Routes ---
@app.get("/")
def read_root():
    return {"message": "Chat API is running"}

@app.post("/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    session_id = request.session_id
    user_message = request.message

    # Fetch previous messages from MongoDB
    history = await session_manager.get_session(session_id)
    user_session = UserSession([{"role": m["role"], "content": m["content"]} for m in history])

    # Save user message to DB
    await session_manager.save_message(session_id, "user", user_message)

    # Run agent with chat history
    result = await Runner.run(starting_agent=agent, input=user_message, session=user_session)

    # Save AI response to DB
    await session_manager.save_message(session_id, "assistant", result.final_output)

    return ChatResponse(response=result.final_output, session_id=session_id)
```

![alt text](image2.PNG)

### Frontend Code
```bash
'use client'

import { useState } from 'react';

export default function ChatClient() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState('user_123');

  const handleSubmit = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const res = await fetch('http://127.0.0.1:8000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, message: userMessage }),
      });

      const data = await res.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'error', content: `Error: ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Chat with AI</h1>
      
      <div style={{ 
        border: '1px solid #ccc', 
        borderRadius: '8px', 
        padding: '15px', 
        height: '400px', 
        overflowY: 'auto',
        marginBottom: '15px',
        backgroundColor: '#f9f9f9'
      }}>
        {messages.map((msg, idx) => (
          <div key={idx} style={{ marginBottom: '10px', textAlign: msg.role === 'user' ? 'right' : 'left' }}>
            <div style={{
              display: 'inline-block',
              padding: '10px 15px',
              borderRadius: '8px',
              backgroundColor: msg.role === 'user' ? '#007bff' : msg.role === 'error' ? '#dc3545' : '#28a745',
              color: 'white',
              maxWidth: '70%',
              wordWrap: 'break-word'
            }}>
              {msg.content}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '10px' }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder="Type message..."
          disabled={loading}
          style={{ 
            flex: 1, 
            padding: '10px', 
            border: '1px solid #ccc', 
            borderRadius: '4px',
            fontSize: '14px'
          }}
        />
        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            padding: '10px 20px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1
          }}
        >
          {loading ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  );
}
```