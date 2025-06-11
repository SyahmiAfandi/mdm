import React, { useState } from 'react';
import axios from 'axios';

export default function ChatPage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg = { sender: 'user', text: input };
    setMessages([...messages, userMsg]);
    setInput('');

    try {
      const response = await axios.post('http://localhost:5000/chat', { message: input });
      const botMsg = { sender: 'bot', text: response.data.reply };
      setMessages(prev => [...prev, botMsg]);
    } catch (err) {
      setMessages(prev => [...prev, { sender: 'bot', text: 'Error connecting to server.' }]);
    }
  };

  return (
    <div className="h-screen p-4 flex flex-col">
      <div className="flex-1 overflow-y-auto mb-4 bg-gray-100 p-4 rounded shadow">
        {messages.map((msg, idx) => (
          <div key={idx} className={`mb-2 text-sm ${msg.sender === 'user' ? 'text-right' : 'text-left'}`}>
            <div className={`inline-block px-3 py-2 rounded-lg ${msg.sender === 'user' ? 'bg-blue-500 text-white' : 'bg-white text-gray-800 border'}`}>
              {msg.text}
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          className="flex-1 border rounded p-2"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Ask L1 Tool Assistant..."
        />
        <button className="bg-blue-600 text-white px-4 py-2 rounded" onClick={handleSend}>
          Send
        </button>
      </div>
    </div>
  );
}
