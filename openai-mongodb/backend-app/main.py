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
