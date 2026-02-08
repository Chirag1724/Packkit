import { useState, useRef, useEffect } from 'react';
import './Chatbot.css';

const Chatbot = () => {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const sendMessage = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage = {
            role: 'user',
            content: input,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const apiHost = window.location.hostname;
            const response = await fetch(`http://${apiHost}:4873/api/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ question: input })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            const assistantMessage = {
                role: 'assistant',
                content: data.answer,
                timestamp: new Date(),
                source: data.source,
                responseTime: data.responseTime
            };

            setMessages(prev => [...prev, assistantMessage]);
        } catch (error) {
            const errorMessage = {
                role: 'assistant',
                content: 'Sorry, I encountered an error. Please make sure the server is running.',
                timestamp: new Date(),
                isError: true
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const clearChat = () => {
        setMessages([]);
    };

    const suggestedQuestions = [
        "How do I install axios?",
        "What is CORS and how to use it?",
        "Show me express middleware examples"
    ];

    return (
        <div className="chat-container">
            {/* Header */}
            <header className="chat-header">
                <div className="chat-logo">
                    <span className="logo-icon">📦</span>
                    <span className="logo-text">PackKit</span>
                </div>
                {messages.length > 0 && (
                    <button className="btn btn-ghost" onClick={clearChat}>
                        Clear
                    </button>
                )}
            </header>

            {/* Messages Area */}
            <main className="chat-main">
                {messages.length === 0 ? (
                    <div className="chat-welcome">
                        <div className="welcome-icon">📦</div>
                        <h1>How can I help you today?</h1>
                        <p className="welcome-subtitle">
                            Ask me anything about npm packages and their documentation.
                        </p>
                        <div className="suggested-questions">
                            {suggestedQuestions.map((q, idx) => (
                                <button
                                    key={idx}
                                    className="suggestion-btn"
                                    onClick={() => setInput(q)}
                                >
                                    {q}
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="messages-list">
                        {messages.map((msg, idx) => (
                            <div
                                key={idx}
                                className={`message ${msg.role} ${msg.isError ? 'error' : ''} slide-up`}
                            >
                                <div className="message-content">
                                    {msg.content}
                                </div>
                                {msg.role === 'assistant' && !msg.isError && (
                                    <div className="message-meta">
                                        {msg.source && <span>Source: {msg.source}</span>}
                                        {msg.responseTime && <span>{msg.responseTime}ms</span>}
                                    </div>
                                )}
                            </div>
                        ))}
                        {isLoading && (
                            <div className="message assistant slide-up">
                                <div className="typing-indicator">
                                    <span></span>
                                    <span></span>
                                    <span></span>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                )}
            </main>

            {/* Input Area */}
            <footer className="chat-footer">
                <div className="input-container">
                    <textarea
                        className="chat-input"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask about any npm package..."
                        rows={1}
                        disabled={isLoading}
                    />
                    <button
                        className="send-btn"
                        onClick={sendMessage}
                        disabled={!input.trim() || isLoading}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                        </svg>
                    </button>
                </div>
                <p className="footer-note">
                    PackKit uses AI to help you understand npm packages
                </p>
            </footer>
        </div>
    );
};

export default Chatbot;
