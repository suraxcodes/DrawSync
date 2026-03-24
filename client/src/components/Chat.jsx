import React, { useState, useEffect, useRef } from 'react';
import './Chat.css';

const Chat = ({ socket, roomId, username }) => {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (!socket) return;

    const handleMessage = (msg) => {
      setMessages((prev) => [...prev, msg]);
    };

    socket.on('chat-message', handleMessage);
    return () => socket.off('chat-message', handleMessage);
  }, [socket]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = (e) => {
    e.preventDefault();
    if (inputValue.trim() && socket) {
      const msg = {
        text: inputValue,
        sender: username || 'User',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        id: Math.random().toString(36).substr(2, 9)
      };
      
      socket.emit('chat-message', { roomId, message: msg });
      setMessages((prev) => [...prev, { ...msg, self: true }]);
      setInputValue('');
    }
  };

  return (
    <div className="chat-container">
      <div className="chat-messages">
        {messages.map((msg) => (
          <div key={msg.id} className={`message ${msg.self ? 'self' : ''}`}>
            <span className="sender">{msg.sender}</span>
            <span className="text">{msg.text}</span>
            <span className="time">{msg.timestamp}</span>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>
      <form className="chat-input" onSubmit={sendMessage}>
        <input 
          type="text" 
          placeholder="Type a message..." 
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
        />
        <button type="submit">Send</button>
      </form>
    </div>
  );
};

export default Chat;
