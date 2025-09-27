import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useLoading } from '../context/LoadingContext.js';
import PopupModal from "../components/PopupModal.js"; 

// --- Constants and Mock Data ---
const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:5000';
const MOCK_API_CALLS = false; // Set to true to use mock data for testing

const MOCK_RESPONSE = {
  "explanation": "Based on your request for stable, tech-focused REITs, I've selected 'Data Centers' as the property type. To align with 'stable', I've set a maximum Debt to Asset ratio to ensure low leverage and a modest minimum FFO growth to filter for financially healthy companies.",
  "filters": {
    "property_type": "Data Centers",
    "max_debt_to_asset": 0.5,
    "min_ffo_growth": 0.03
  }
};

const MASTER_FILTER_LIST = [
    { apiName: 'property_type', label: 'Property Type', type: 'select', options: ["Apartments", "Industrial Assets", "Office Buildings", "Data Centers", "Single Family Houses", "Hotels/Resorts", "Retail Centers", "Health Care Communities", "Self Storage", "Infrastructure", "Manufactured Homes", "Specialty", "Timber", "Medical Facilities", "Life Science Laboratories"] },
    { apiName: 'revenue_growth', label: 'Avg. Revenue Growth (YoY %)', metric_name: 'avg_revenue_yoy_growth', type: 'numeric', placeholder: 'e.g., 5', isPercentage: true },
    { apiName: 'ffo_growth', label: 'Avg. FFO Growth (YoY %)', metric_name: 'avg_ffo_yoy_growth', type: 'numeric', placeholder: 'e.g., 10', isPercentage: true },
    { apiName: 'operating_margin', label: 'Operating Margin (TTM %)', metric_name: 'operating_margin', type: 'numeric', placeholder: 'e.g., 15', isPercentage: true },
    { apiName: 'interest_coverage', label: 'Interest Coverage Ratio (TTM)', metric_name: 'interest_coverage_ratio', type: 'numeric', placeholder: 'e.g., 3.5', isPercentage: false },
    { apiName: 'debt_to_asset', label: 'Debt to Asset Ratio (Latest Quarter)', metric_name: 'debt_to_asset_ratio', type: 'numeric', placeholder: 'e.g., 0.5', isPercentage: false },
    { apiName: 'ffo_payout_ratio', label: 'Payout Ratio (FFO %)', metric_name: 'ffo_payout_ratio', type: 'numeric', placeholder: 'e.g., 55', isPercentage: true },
    { apiName: 'pe_ratio', label: 'P/E Ratio (TTM)', metric_name: 'pe_ratio', type: 'numeric', placeholder: 'e.g., 15', isPercentage: false },
    { apiName: 'pffo_ratio', label: 'P/FFO Ratio (TTM)', metric_name: 'pffo_ratio', type: 'numeric', placeholder: 'e.g., 12', isPercentage: false },
    { apiName: 'ffo_to_revenue', label: 'FFO / Revenue (Latest %)', metric_name: 'ffo_to_revenue_ratio', type: 'numeric', placeholder: 'e.g., 45', isPercentage: true },
    { apiName: 'net_debt_to_ebitda', label: 'Net Debt / EBITDA (Latest/TTM)', metric_name: 'net_debt_to_ebitda', type: 'numeric', placeholder: 'e.g., 5.5', isPercentage: false },
];

// --- Helper Components ---
const SendIcon = () => ( <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ color: 'var(--text-color-light)'}}><path d="M7 11L12 6L17 11M12 18V7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path></svg> );
const ThinkingIndicator = () => ( <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: 'var(--surface-color-2)', borderRadius: '12px', alignSelf: 'flex-start' }}><style>{`@keyframes bounce { 0%, 80%, 100% { transform: scale(0); } 40% { transform: scale(1.0); } } .dot { width: 8px; height: 8px; background-color: var(--text-color-subtle); border-radius: 50%; display: inline-block; animation: bounce 1.4s infinite ease-in-out both; } .dot1 { animation-delay: -0.32s; } .dot2 { animation-delay: -0.16s; }`}</style><div className="dot dot1"></div><div className="dot dot2"></div><div className="dot dot3"></div></div> );


function LlmScreenerPage() {
  // --- STATE MANAGEMENT ---
  // LLM Conversation State
  const [query, setQuery] = useState('');
  const [conversation, setConversation] = useState([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [error, setError] = useState('');
  const [isLimitModalOpen, setIsLimitModalOpen] = useState(false);
  
  // Filter & Results State (from FilterPage)
  const [reits, setReits] = useState([]);
  const [explanation, setExplanation] = useState("Add filters manually or use the AI assistant.");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState([]);
  
  // Global Loading State & Navigation
  const { setLoading: setGlobalLoading } = useLoading();
  const navigate = useNavigate();
  const chatEndRef = useRef(null);
  const hasAiResponded = conversation.some(msg => msg.sender === 'ai');

  // --- HOOKS ---
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation, isAiLoading]);

  // --- CORE LOGIC ---

  // 1. Function to handle the AI conversation
  const handleGenerateFilters = async () => {
    if (hasAiResponded) {
        setIsLimitModalOpen(true);
        return;
    }
    if (!query.trim() || isAiLoading) return;

    const userMessage = { sender: 'user', text: query };
    setConversation(prev => [...prev, userMessage]);
    setIsAiLoading(true);
    setQuery('');
    setError('');

    if (MOCK_API_CALLS) {
      setTimeout(() => {
        const { explanation, filters } = MOCK_RESPONSE;
        const aiMessage = { sender: 'ai', explanation, filters };
        setConversation(prev => [...prev, aiMessage]);
        // NEW: This is the magic link between the two panels
        translateAiFiltersToUi(filters);
        setIsAiLoading(false);
      }, 1500);
      return;
    }

    try {
      const response = await axios.post(`${API_BASE_URL}/api/llm-filter`, { query });
      const { explanation, filters } = response.data;
      const aiMessage = { sender: 'ai', explanation, filters };
      setConversation(prev => [...prev, aiMessage]);
      translateAiFiltersToUi(filters);
    } catch (err) {
      console.error('Error generating filters:', err);
      setError('Failed to generate filters. The AI might be busy, or an error occurred.');
    } finally {
      setIsAiLoading(false);
    }
  };

  // 2. NEW: Function to translate AI response into the UI's filter state
  const translateAiFiltersToUi = (aiFilters) => {
    const newActiveFilters = [];
    Object.entries(aiFilters).forEach(([key, value]) => {
        if (key === 'property_type') {
            const masterFilter = MASTER_FILTER_LIST.find(f => f.apiName === 'property_type');
            if (masterFilter) {
                newActiveFilters.push({ id: Date.now() + Math.random(), ...masterFilter, condition: 'equals', value: value, value2: '' });
            }
        } else if (key.startsWith('min_')) {
            const baseApiName = key.replace('min_', '');
            const masterFilter = MASTER_FILTER_LIST.find(f => f.apiName === baseApiName);
            if (masterFilter) {
                const existing = newActiveFilters.find(f => f.apiName === baseApiName);
                if (existing) { existing.value = masterFilter.isPercentage ? value * 100 : value; existing.condition = 'between'; }
                else { newActiveFilters.push({ id: Date.now() + Math.random(), ...masterFilter, condition: 'over', value: masterFilter.isPercentage ? value * 100 : value, value2: '' }); }
            }
        } else if (key.startsWith('max_')) {
            const baseApiName = key.replace('max_', '');
            const masterFilter = MASTER_FILTER_LIST.find(f => f.apiName === baseApiName);
            if (masterFilter) {
                const existing = newActiveFilters.find(f => f.apiName === baseApiName);
                if (existing) { existing.value2 = masterFilter.isPercentage ? value * 100 : value; existing.condition = 'between'; }
                else { newActiveFilters.push({ id: Date.now() + Math.random(), ...masterFilter, condition: 'under', value: masterFilter.isPercentage ? value * 100 : value, value2: '' }); }
            }
        }
    });
    setActiveFilters(newActiveFilters);
    setExplanation("AI has suggested filters. Click 'Apply Filters' to see the results.")
  };

  // 3. Functions from FilterPage to manage filters and results
  const handleAddFilter = (filter) => {
    if (!activeFilters.some(f => f.apiName === filter.apiName)) {
      const newFilter = { id: Date.now(), ...filter, condition: filter.type === 'select' ? 'equals' : 'over', value: '', value2: '' };
      setActiveFilters(prev => [...prev, newFilter]);
    }
    setIsModalOpen(false);
  };

  const handleUpdateFilter = (id, field, value) => setActiveFilters(prev => prev.map(f => (f.id === id ? { ...f, [field]: value } : f)));
  const handleRemoveFilter = (id) => setActiveFilters(prev => prev.filter(f => f.id !== id));
  const handleResetFilters = () => {
    setActiveFilters([]);
    setReits([]);
    setExplanation("Add filters manually or use the AI assistant.");
  };

  // 4. API call from FilterPage to get REIT data
  const handleApplyFilters = useCallback(() => {
    if (activeFilters.length === 0) { handleResetFilters(); return; }
    setGlobalLoading(true);
    const url = `${API_BASE_URL}/api/reits/advanced-filter`;
    const requestParams = {};
    activeFilters.forEach(filter => {
      if (filter.value !== '') {
        if (filter.type === 'select') { requestParams[filter.apiName] = filter.value; }
        else if (filter.type === 'numeric') {
          const baseApiName = filter.apiName;
          const isPercentage = filter.isPercentage !== false;
          const multiplier = isPercentage ? 100 : 1;
          const val1 = parseFloat(filter.value) / multiplier;
          if (filter.condition === 'over') { requestParams[`min_${baseApiName}`] = val1; }
          else if (filter.condition === 'under') { requestParams[`max_${baseApiName}`] = val1; }
          else if (filter.condition === 'between' && filter.value2 !== '') {
            const val2 = parseFloat(filter.value2) / multiplier;
            requestParams[`min_${baseApiName}`] = Math.min(val1, val2);
            requestParams[`max_${baseApiName}`] = Math.max(val1, val2);
          }
        }
      }
    });

    axios.get(url, { params: requestParams })
      .then((response) => {
        const reitsData = response.data.reits || [];
        setReits(reitsData);
        setExplanation(`Displaying ${reitsData.length} results based on your criteria.`);
      })
      .catch((error) => {
        console.error("Error fetching data:", error);
        setReits([]);
        setExplanation("An error occurred while fetching data.");
      })
      .finally(() => { setGlobalLoading(false); });
  }, [activeFilters, setGlobalLoading]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleGenerateFilters(); }
  };
  
  const availableFilters = MASTER_FILTER_LIST.filter(mf => !activeFilters.some(af => af.apiName === mf.apiName));

  // --- RENDER ---
  return (
    <div style={{ display: 'flex', gap: '2rem', maxWidth: '1400px', margin: '2rem auto', height: 'calc(100vh - 120px)'}}>
      {/* Left Column: Conversation */}
      <div style={{ flex: 1.2, display: 'flex', flexDirection: 'column', background: 'var(--surface-color-1)', border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color-light)'}}>
            <h3 style={{ margin: 0, color: 'var(--text-color-dark)'}}>AI Assistant</h3>
        </div>
        <div style={{ flexGrow: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {conversation.length === 0 && !isAiLoading && <p style={{color: 'var(--text-color-subtle)', textAlign: 'center', marginTop: '3rem'}}>Start by describing the REITs you're looking for.</p>}
          {conversation.map((msg, index) => (
            <div key={index} style={{ alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
              {msg.sender === 'user' ? (
                <p style={{ background: 'var(--primary-color)', color: 'var(--text-color-light)', padding: '10px 14px', borderRadius: '12px', margin: 0 }}>{msg.text}</p>
              ) : (
                <p style={{ background: 'var(--surface-color-2)', color: 'var(--text-color-dark)', padding: '10px 14px', borderRadius: '12px', margin: 0, whiteSpace: 'pre-wrap' }}>{msg.explanation}</p>
              )}
            </div>
          ))}
          {isAiLoading && <ThinkingIndicator />}
          {error && <p style={{color: 'var(--error-color)'}}>{error}</p>}
          <div ref={chatEndRef} />
        </div>
        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border-color)'}}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={handleKeyDown} placeholder={hasAiResponded ? "Please refresh to start a new search." : "e.g., Profitable industrial REITs with low debt..."} className="input-field" disabled={isAiLoading} style={{ flexGrow: 1, padding: '14px 50px 14px 18px', borderRadius: '25px', margin: 0 }} />
            <button onClick={handleGenerateFilters} disabled={isAiLoading} className="btn" style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', width: '36px', height: '36px', borderRadius: '50%', background: 'var(--primary-color)', padding: '0', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', opacity: (isAiLoading || hasAiResponded) ? 0.5 : 1 }}>
              <SendIcon />
            </button>
          </div>
        </div>
      </div>

      {/* Right Column: Filters & Results */}
      <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '1.5rem', overflowY: 'auto' }}>
        <div className="filter-controls" style={{ background: 'var(--surface-color-1)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'center', borderBottom: '1px solid var(--border-color-light)', paddingBottom: '1.5rem', marginBottom: '1.5rem' }}>
            <h3 style={{ margin: 0, color: 'var(--text-color-dark)'}}>REIT Screener</h3>
            <div style={{marginLeft: 'auto', display: 'flex', gap: '15px'}}>
                <button className="btn btn-secondary btn-sm" onClick={() => setIsModalOpen(true)}>+ Add Filter</button>
                <button className="btn btn-secondary btn-sm" onClick={handleResetFilters}>Reset All</button>
                <button className="btn btn-primary btn-sm" onClick={handleApplyFilters}>Apply Filters</button>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {activeFilters.length > 0 ? (
              activeFilters.map(filter => (
                <div key={filter.id} className="card filter-row-layout">
                  <label>{filter.label}</label>
                  {filter.type === 'numeric' && ( <> <select className="input-field" value={filter.condition} onChange={(e) => handleUpdateFilter(filter.id, 'condition', e.target.value)}><option value="over">Over</option><option value="under">Under</option><option value="between">Between</option></select><input type="number" className="input-field" placeholder={filter.placeholder} value={filter.value} onChange={(e) => handleUpdateFilter(filter.id, 'value', e.target.value)} /> {filter.condition === 'between' && ( <> <span>and</span> <input type="number" className="input-field" placeholder="Value 2" value={filter.value2} onChange={(e) => handleUpdateFilter(filter.id, 'value2', e.target.value)} /> </>)}</>)}
                  {filter.type === 'select' && (<select className="input-field" value={filter.value} onChange={(e) => handleUpdateFilter(filter.id, 'value', e.target.value)}><option value="">-- Select --</option>{filter.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}</select>)}
                  <button className="sidebar-close-btn" onClick={() => handleRemoveFilter(filter.id)}>&times;</button>
                </div>
              ))
            ) : <p className="filter-explanation">No active filters.</p>}
          </div>
        </div>
        <div className="filter-results" style={{ flexGrow: 1 }}>
            <p className="filter-explanation">{explanation}</p>
            <div className="reits-table-container">
                <table className="reits-table">
                <thead><tr><th>Company Name</th><th>Metrics</th><th>Website</th></tr></thead>
                <tbody>
                    {reits.length > 0 ? ( reits.map((reit, index) => (
                    <tr key={reit.Ticker} style={{backgroundColor: index % 2 !== 0 ? 'var(--surface-color-2)' : 'var(--background-color)'}}>
                        <td className="reit-company-name-clickable" onClick={() => navigate(`/reits/${reit.Ticker}`)}>{reit.Company_Name}</td>
                        <td style={{ fontSize: '0.9rem' }}>{activeFilters.filter(f => f.type === 'numeric').map(filter => { const metricName = filter.metric_name; const metricValue = reit[metricName]; let displayValue = 'N/A'; if (metricValue != null) { displayValue = filter.isPercentage ? `${(metricValue * 100).toFixed(2)}%` : metricValue.toFixed(2); } const shortLabel = filter.label.split('(')[0].trim(); return `${shortLabel}: ${displayValue}`; }).join(' | ')}</td>
                        <td>{reit.Website ? (<a href={reit.Website.startsWith("http") ? reit.Website : `https://${reit.Website}`} target="_blank" rel="noopener noreferrer" className="reit-link">Visit</a>) : ("No website")}</td>
                    </tr>
                    ))) : (<tr><td colSpan="3">No REITs match the selected criteria.</td></tr>)}
                </tbody>
                </table>
            </div>
        </div>
        {isModalOpen && (<div className="modal-overlay" onClick={() => setIsModalOpen(false)}><div className="modal-box" onClick={e => e.stopPropagation()}><h3 className="popup-modal-title">Select a Filter</h3><div style={{ marginTop: '1rem' }}>{availableFilters.map(filter => (<div key={filter.apiName} className="dropdown-item" onClick={() => handleAddFilter(filter)}>{filter.label}</div>))}</div></div></div>)}
        <PopupModal
          show={isLimitModalOpen}
          onClose={() => setIsLimitModalOpen(false)}
          title="One Request Per Session"
        >
          <p style={{ margin: '1rem 0' }}>
            Since this product is still in a testing phase, we limit the AI assistant to one response per session.
          </p>
          <button
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '1.5rem' }}
            onClick={() => setIsLimitModalOpen(false)}
          >
            Got it
          </button>
        </PopupModal>
      </div>
    </div>
  );
}

export default LlmScreenerPage;