import { useState, useRef, useEffect } from 'react';
import './Chatbot.css';

const Chatbot = () => {
    const [messages, setMessages] = useState([
        {
            role: 'assistant',
            content: 'Hello! I\'m PackKit AI Assistant. Ask me anything about your npm packages and their documentation.',
            timestamp: new Date()
        }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSubmit = async (e) => {
        e.preventDefault();
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
            const response = await fetch('http://localhost:4873/api/chat', {
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
                source: data.source,
                responseTime: data.responseTime,
                timestamp: new Date(),
                cached: data.source === 'cache'
            };

            setMessages(prev => [...prev, assistantMessage]);
        } catch (error) {
            const errorMessage = {
                role: 'assistant',
                content: 'Sorry, I encountered an error processing your request. Please make sure the server is running on port 4873.',
                error: true,
                timestamp: new Date()
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
            inputRef.current?.focus();
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
        }
    };

    const formatTime = (date) => {
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const clearChat = () => {
        setMessages([
            {
                role: 'assistant',
                content: 'Chat cleared! How can I help you today?',
                timestamp: new Date()
            }
        ]);
    };

    const suggestedQuestions = [
        "What is React?",
        "How do I use express?",
        "Explain mongoose schema",
        "What are the features of axios?"
    ];

    const handleSuggestionClick = (question) => {
        setInput(question);
        inputRef.current?.focus();
    };

    return (
        <div className="chatbot-container">
            <div className="chatbot-header">
                <div className="header-content">
                    <div className="header-title">
                        <h1>🤖 PackKit AI Assistant</h1>
                        <p className="header-subtitle">Intelligent Documentation Helper</p>
                    </div>
                    <button className="btn btn-secondary clear-btn" onClick={clearChat}>
                        🗑️ Clear Chat
                    </button>
                </div>
            </div>

            <div className="chatbot-main">
                <div className="messages-container">
                    {messages.map((message, idx) => (
                        <div
                            key={idx}
                            className={`message ${message.role} ${message.error ? 'error' : ''} fade-in`}
                        >
                            <div className="message-avatar">
                                {message.role === 'user' ? '👤' : '🤖'}
                            </div>
                            <div className="message-content-wrapper">
                                <div className="message-header">
                                    <span className="message-role">
                                        {message.role === 'user' ? 'You' : 'PackKit AI'}
                                    </span>
                                    <span className="message-time">{formatTime(message.timestamp)}</span>
                                </div>
                                <div className="message-content">{message.content}</div>
                                {message.source && (
                                    <div className="message-meta">
                                        <span className="meta-tag">
                                            📦 Source: {message.source}
                                        </span>
                                    </div>
                                )}
                                {message.responseTime && (
                                    <div className="message-meta">
                                        <span className="meta-tag">
                                            ⚡ {message.responseTime}ms
                                        </span>
                                        {message.cached && (
                                            <span className="meta-tag cached">
                                                💾 Cached
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}

                    {isLoading && (
                        <div className="message assistant fade-in">
                            <div className="message-avatar">🤖</div>
                            <div className="message-content-wrapper">
                                <div className="typing-indicator">
                                    <span></span>
                                    <span></span>
                                    <span></span>
                                </div>
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {messages.length <= 1 && !isLoading && (
                    <div className="suggestions-container fade-in">
                        <p className="suggestions-title">Try asking:</p>
                        <div className="suggestions-grid">
                            {suggestedQuestions.map((question, idx) => (
                                <button
                                    key={idx}
                                    className="suggestion-card"
                                    onClick={() => handleSuggestionClick(question)}
                                >
                                    <span className="suggestion-icon">💡</span>
                                    {question}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="chatbot-footer">
                <form onSubmit={handleSubmit} className="input-form">
                    <div className="input-wrapper">
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Ask me anything about npm packages..."
                            className="chat-input"
                            rows="1"
                            disabled={isLoading}
                        />
                        <button
                            type="submit"
                            className="btn btn-primary send-btn"
                            disabled={!input.trim() || isLoading}
                        >
                            {isLoading ? '⏳' : '🚀'} Send
                        </button>
                    </div>
                    <p className="input-hint">
                        Press Enter to send, Shift+Enter for new line
                    </p>
                </form>
            </div>
        </div>
    );
};

export default Chatbot;
