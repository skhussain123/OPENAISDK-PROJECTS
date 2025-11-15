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