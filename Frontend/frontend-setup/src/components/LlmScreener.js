import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:5000';
const MOCK_API_CALLS = true;

// NEW: Updated mock response to match the new backend structure
const MOCK_RESPONSE = {
  "explanation": "Based on your request for stable, tech-focused REITs, I've selected 'Data Centers' as the property type. To align with 'stable', I've set a maximum Debt to Asset ratio to ensure low leverage and a modest minimum FFO growth to filter for financially healthy companies.",
  "filters": {
    "property_type": "Data Centers",
    "max_debt_to_asset": 0.5,
    "min_ffo_growth": 0.03
  }
};

const SendIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ color: 'var(--text-color-light)'}}>
    <path d="M7 11L12 6L17 11M12 18V7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
  </svg>
);

// NEW: Local "thinking" loading indicator component
const ThinkingIndicator = () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: 'var(--surface-color-2)', borderRadius: '12px', alignSelf: 'flex-start' }}>
        <style>{`
            @keyframes bounce { 0%, 80%, 100% { transform: scale(0); } 40% { transform: scale(1.0); } }
            .dot { width: 8px; height: 8px; background-color: var(--text-color-subtle); border-radius: 50%; display: inline-block; animation: bounce 1.4s infinite ease-in-out both; }
            .dot1 { animation-delay: -0.32s; }
            .dot2 { animation-delay: -0.16s; }
        `}</style>
        <div className="dot dot1"></div>
        <div className="dot dot2"></div>
        <div className="dot dot3"></div>
    </div>
);

function LlmScreener() {
  const [query, setQuery] = useState('');
  const [conversation, setConversation] = useState([]); // NEW: State for conversation history
  const [generatedFilters, setGeneratedFilters] = useState({}); // NEW: State for filters only
  const [isLoading, setIsLoading] = useState(false); // NEW: Local loading state
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const chatEndRef = useRef(null); // NEW: Ref to auto-scroll chat

  // NEW: Effect to scroll to the bottom of the chat when new messages are added
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation, isLoading]);

  const handleGenerateFilters = async () => {
    if (!query.trim() || isLoading) return;

    const userMessage = { sender: 'user', text: query };
    setConversation(prev => [...prev, userMessage]);
    setIsLoading(true);
    setQuery('');
    setError('');

    if (MOCK_API_CALLS) {
      console.warn("Using MOCKED API response.");
      setTimeout(() => {
        const aiMessage = { sender: 'ai', ...MOCK_RESPONSE };
        setConversation(prev => [...prev, aiMessage]);
        setGeneratedFilters(MOCK_RESPONSE.filters);
        setIsLoading(false);
      }, 1500);
      return;
    }

    try {
      const response = await axios.post(`${API_BASE_URL}/api/llm-filter`, { query });
      const { explanation, filters } = response.data;
      const aiMessage = { sender: 'ai', explanation, filters };
      setConversation(prev => [...prev, aiMessage]);
      setGeneratedFilters(filters);
    } catch (err) {
      console.error('Error generating filters:', err);
      setError('Failed to generate filters. The AI might be busy, or an error occurred.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleGenerateFilters();
    }
  };
  
  const handleApplyFilters = () => {
      if(Object.keys(generatedFilters).length > 0) {
          navigate('/filter', { state: { llmFilters: generatedFilters } });
      }
  };

  return (
    <div className="llm-page-layout" style={{ display: 'flex', gap: '2rem', maxWidth: '1200px', margin: '2rem auto', height: 'calc(100vh - 120px)'}}>
      
      {/* Left Column: Conversation Panel */}
      <div className="llm-conversation-panel" style={{ flex: 1.5, display: 'flex', flexDirection: 'column', background: 'var(--surface-color-1)', border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
        <div className="llm-results-area" style={{ flexGrow: 1, overflowY: 'auto', padding: '1.5rem 2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {conversation.map((msg, index) => (
            <div key={index} style={{ alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
              {msg.sender === 'user' ? (
                <p style={{ background: 'var(--primary-color)', color: 'var(--text-color-light)', padding: '10px 14px', borderRadius: '12px', margin: 0 }}>
                  {msg.text}
                </p>
              ) : (
                <p style={{ background: 'var(--surface-color-2)', color: 'var(--text-color-dark)', padding: '10px 14px', borderRadius: '12px', margin: 0 }}>
                  {msg.explanation}
                </p>
              )}
            </div>
          ))}
          {isLoading && <ThinkingIndicator />}
          <div ref={chatEndRef} />
        </div>
        <div className="llm-input-area" style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border-color)'}}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input
              type="text" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={handleKeyDown}
              placeholder="Describe the REITs you want to find..."
              className="input-field" disabled={isLoading}
              style={{ flexGrow: 1, padding: '14px 50px 14px 18px', borderRadius: '25px', margin: 0 }}
            />
            <button onClick={handleGenerateFilters} disabled={isLoading} className="btn" style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', width: '36px', height: '36px', borderRadius: '50%', background: 'var(--primary-color)', padding: '0', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', opacity: isLoading ? 0.5 : 1 }}>
              <SendIcon />
            </button>
          </div>
        </div>
      </div>

      {/* Right Column: Filters Panel */}
      <div className="llm-filters-panel" style={{ flex: 1, background: 'var(--surface-color-1)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem', color: 'var(--text-color-dark)', borderBottom: '1px solid var(--border-color-light)', paddingBottom: '0.75rem' }}>Generated Filters</h3>
          {Object.keys(generatedFilters).length > 0 ? (
            <div>
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', background: 'var(--surface-color-2)', color: 'var(--text-color-dark)', padding: '1rem', borderRadius: '4px' }}>
                {JSON.stringify(generatedFilters, null, 2)}
              </pre>
              <button onClick={handleApplyFilters} className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
                  Apply These Filters
              </button>
            </div>
          ) : (
             <p style={{ color: 'var(--text-color-subtle)', textAlign: 'center', marginTop: '3rem' }}>Filters will appear here once generated.</p>
          )}
      </div>
    </div>
  );
}

export default LlmScreener;

