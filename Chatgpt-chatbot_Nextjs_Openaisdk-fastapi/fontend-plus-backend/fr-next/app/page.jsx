'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, MessageCircle } from 'lucide-react';
import './ChatClient.css';

export default function ChatClient() {
  const [message, setMessage] = useState('');
  const [chats, setChats] = useState([{ id: Date.now(), messages: [] }]);
  const [currentChatIndex, setCurrentChatIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);

  // Load chats from localStorage on mount
  useEffect(() => {
    const savedChats = localStorage.getItem('chatSessions');
    if (savedChats) {
      const parsed = JSON.parse(savedChats);
      setChats(parsed.length ? parsed : [{ id: Date.now(), messages: [] }]);
      setCurrentChatIndex(parsed.length ? parsed.length - 1 : 0);
    }
  }, []);

  // Save chats to localStorage and scroll
  useEffect(() => {
    localStorage.setItem('chatSessions', JSON.stringify(chats));
    scrollToBottom();
  }, [chats, currentChatIndex]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const currentChat = chats[currentChatIndex];

  // Send message to backend
  const handleSubmit = async () => {
    if (!message.trim() || loading) return;

    const userMessage = message;
    setMessage('');
    const updatedMessages = [...(currentChat?.messages || []), { role: 'user', content: userMessage }];
    updateCurrentChat(updatedMessages);
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('http://127.0.0.1:8000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage }),
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      updateCurrentChat([...updatedMessages, { role: 'assistant', content: data.response }]);
    } catch (err) {
      updateCurrentChat([...updatedMessages, { role: 'error', content: `Error: ${err.message}` }]);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const updateCurrentChat = (messages) => {
    const updatedChats = [...chats];
    updatedChats[currentChatIndex] = { ...updatedChats[currentChatIndex], messages };
    setChats(updatedChats);
  };

  // Create new chat
  const handleNewChat = () => {
    const newChat = { id: Date.now(), messages: [] };
    setChats([...chats, newChat]);
    setCurrentChatIndex(chats.length);
    setMessage('');
    setError(null);
  };

  // Switch between chats
  const handleSwitchChat = (index) => {
    setCurrentChatIndex(index);
    setError(null);
  };

  return (
    <div className="chat-container">
      {/* Sidebar */}
      <div className="chat-sidebar">
        <div className="new-chat" onClick={handleNewChat}>
          <MessageCircle size={20} />
          <span>نیا Chat</span>
        </div>
        <div className="chat-list">
          <div className="chat-list-title">آپ کے Chats</div>
          {chats.map((chat, idx) => (
            <div
              key={chat.id}
              className={`chat-tab ${idx === currentChatIndex ? 'active' : ''}`}
              onClick={() => handleSwitchChat(idx)}
            >
              Chat {idx + 1}
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="chat-main">
        <div className="chat-header">
          <h1>Chat with AI</h1>
        </div>

        <div className="chat-messages">
          {currentChat?.messages?.length === 0 ? (
            <div className="chat-empty">
              <MessageCircle size={64} />
              <p>کوئی سوال پوچھیں</p>
              <p>میں آپ کی مدد کے لیے یہاں ہوں</p>
            </div>
          ) : (
            <>
              {currentChat?.messages?.map((msg, idx) => (
                <div
                  key={idx}
                  className={`chat-message ${msg.role === 'user' ? 'user' : msg.role === 'error' ? 'error' : 'assistant'}`}
                >
                  <p>{msg.content}</p>
                </div>
              ))}
              {loading && (
                <div className="chat-message assistant typing">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              )}
              <div ref={messagesEndRef}></div>
            </>
          )}
        </div>

        {error && <div className="chat-error">خرابی: {error}</div>}

        <div className="chat-input">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="کچھ لکھیں..."
            rows={1}
          />
          <button onClick={handleSubmit} disabled={loading || !message.trim()}>
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
