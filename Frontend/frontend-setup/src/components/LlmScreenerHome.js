import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useLoading } from '../context/LoadingContext.js';
import PopupModal from "../components/PopupModal.js";
import Joyride, { EVENTS, ACTIONS, STATUS } from 'react-joyride';

// --- Constants and Mock Data ---
const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:5000';
const MOCK_API_CALLS = true; // Set to true to use mock data for testing
const DEVELOPER_MODE = false; // Set to false to test the 2-use limit for regular users

const MOCK_RESPONSE = {
  "explanation": "To align with 'stable', I've set a maximum Debt to Asset ratio to ensure low leverage and a modest minimum FFO growth to filter for financially healthy companies.",
  "filters": {
    "max_debt_to_asset": 0.6,
    "min_ffo_growth": 0.02,
    "min_revenue_growth": 0.01,
    "min_interest_coverage": 2.0
  }
};

const MASTER_FILTER_LIST = [
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


function LlmScreenerHome({ onLimitReached, startTour, onTourFinish }) {
  // --- TOUR STATE AND STEPS ---
  const [runTour, setRunTour] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [tourPauseState, setTourPauseState] = useState(null); // Manages the new pause behavior

  const tourSteps = [
    { // Index 0
      target: '#tour-step-1-input',
      content: 'Start by typing your investment idea here. You can be as general as you’d like (e.g. “stable and safe stocks” or “stocks with growth potential”). Click "Next" to continue.',
      disableBeacon: true,
    },
    { // Index 1
      target: '#tour-step-2-filters',
      content: 'The AI translated your generic input into specific financial filters — so you don’t need to be an expert. We handle the complexity for you.',
      disableBeacon: true,
    },
    { // Index 2
      target: '#tour-step-3-ai-message',
      content: 'You can view the AI\'s logic for the chosen filters right here.',
      disableBeacon: true,
      placement: 'right', // Positions the tooltip to the right of the chat bubble
    },
    { // Index 3
      target: '#tour-step-adjust-filters',
      content: 'You can adjust the values, add new filters, or remove them as you see fit.',
      disableBeacon: true,
    },
    { // Index 4
      target: '#tour-step-4-apply',
      content: 'Now, click "Next" to apply these filters...',
      disableBeacon: true,
    },
    { // Index 5
      target: '#tour-step-5-results',
      content: '...and the matching companies will be instantly displayed in this table!',
      disableBeacon: true,
    },
    { // Index 6
      target: '#tour-step-company-name',
      content: 'These are clickable and will direct you to a detail page showing all the data.',
      disableBeacon: true,
    },
    { // Index 7
      target: '#tour-step-website',
      content: 'These will direct you to the company\'s actual website.',
      disableBeacon: true,
    },
  ];

  const handleJoyrideCallback = (data) => {
    const { action, index, status, type } = data;

    // This handles events that occur DURING a step (e.g., clicking a button in the tooltip)
    if ([EVENTS.STEP_AFTER, EVENTS.TOOLTIP_CLOSE].includes(type)) {
      // If the user clicks the "X" button...
      if (action === ACTIONS.CLOSE) {
        // ...manually trigger all the cleanup logic and call onTourFinish.
        setRunTour(false);
        setTourStep(0);
        setTourPauseState(null);
        if (onTourFinish) {
          onTourFinish();
        }
        return; // Stop processing
      }
      
      // Logic for pausing after the first step
      if (index === 0 && action === ACTIONS.NEXT) {
        setRunTour(false);
        setTourPauseState('waitingForSendClick');
        return;
      }
      
      // Logic for pausing before the results appear
      if (index === 4 && action === ACTIONS.NEXT) {
        handleApplyFilters();
        return;
      }

      // Standard progression for all other "Next" clicks
      const nextStep = index + (action === ACTIONS.PREV ? -1 : 1);
      setTourStep(nextStep);
    } 
    // This handles when the tour finishes NORMALLY (by clicking the final "Close" button)
    else if (status === STATUS.FINISHED) {
      setRunTour(false);
      setTourStep(0);
      setTourPauseState(null);
      if (onTourFinish) {
        onTourFinish();
      }
    }
  };




  const TourTooltip = ({ index, size, step, closeProps, primaryProps, tooltipProps }) => {
    const isLastStep = index === size - 1;

    return (
      <div {...tooltipProps} className="card" style={{ position: 'relative', padding: '1.5rem', maxWidth: '350px', margin: 0 }}>
        <button {...closeProps} className="sidebar-close-btn" style={{position: 'absolute', top: '10px', right: '10px', zIndex: 1}}>
          &times;
        </button>
        
        <div style={{ textAlign: 'left', fontSize: '0.95rem', paddingRight: '2rem' }}>
          {step.content}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: '1.5rem', width: '100%' }}>
          <button {...primaryProps} className="btn btn-secondary btn-sm">
            {isLastStep ? 'Close' : 'Next'}
          </button>
        </div>
      </div>
    );
  };

  // --- STATE MANAGEMENT ---
  const [query, setQuery] = useState('');
  const [conversation, setConversation] = useState([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [error, setError] = useState('');
  const [isLimitModalOpen, setIsLimitModalOpen] = useState(false);
  const [reits, setReits] = useState([]);
  const [explanation, setExplanation] = useState("Add filters manually or use the AI assistant.");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState([]);
  const { isLoading, setLoading: setGlobalLoading } = useLoading();
  const navigate = useNavigate();
  const usageCount = parseInt(localStorage.getItem('llmUsageCount') || '0', 10);
  const USAGE_LIMIT = 2;
  const isLimitReached = !DEVELOPER_MODE && (usageCount >= USAGE_LIMIT);
  const isInitialMount = useRef(true);
  const chatPanelRef = useRef(null);

  // --- HOOKS ---
  useEffect(() => {
    if (isInitialMount.current) { isInitialMount.current = false; return; }
    const lastMessage = conversation.length > 0 ? conversation[conversation.length - 1] : null;
    if (lastMessage && lastMessage.sender === 'ai') {
        const chatPanel = chatPanelRef.current;
        if (chatPanel) {
            chatPanel.scrollTo({ top: chatPanel.scrollHeight, behavior: 'smooth' });
        }
    }
  }, [conversation]);

  // Starts the tour when the prop is received
  useEffect(() => {
    if (startTour) {
      setRunTour(true);
    }
  }, [startTour]);

  // This effect RESUMES the tour after it has been paused
  useEffect(() => {
      if (activeFilters.length > 0 && tourPauseState === 'waitingForSendClick') {
        setTourStep(1); // Set to the "Great! AI has translated..." step
        setRunTour(true); // Re-start the tour
        setTourPauseState(null); // Clear the pause state
      }
  }, [activeFilters, tourPauseState]);


  useEffect(() => {
    // If we were waiting for results and the global loading has just finished...
    if (tourPauseState === 'waitingForResults' && !isLoading) {
      setTourStep(5); // ...advance to the results step
      setRunTour(true); // ...restart the tour
      setTourPauseState(null); // ...and reset the pause state
    }
  }, [isLoading, tourPauseState]);

  // --- CORE LOGIC ---
  const handleGenerateFilters = async () => {
    if (!DEVELOPER_MODE) {
        const currentCount = parseInt(localStorage.getItem('llmUsageCount') || '0', 10);
        if (currentCount >= USAGE_LIMIT) { setIsLimitModalOpen(true); return; }
    }
    if (!query.trim() || isAiLoading) return;

    if (tourPauseState === 'waitingForSendClick') {
        // Don't set state here, the useEffect will handle resuming the tour
    }

    if (!DEVELOPER_MODE) {
        const currentCount = parseInt(localStorage.getItem('llmUsageCount') || '0', 10);
        localStorage.setItem('llmUsageCount', (currentCount + 1).toString());
    }
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

  const translateAiFiltersToUi = (aiFilters) => {
    const newActiveFilters = [];
    Object.entries(aiFilters).forEach(([key, value]) => {
        if (key.startsWith('min_')) {
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

  const handleApplyFilters = useCallback(() => {
    // If the tour is on the "Apply Filters" step, pause it and wait for results
    if (runTour && tourStep === 4) {
      setRunTour(false);
      setTourPauseState('waitingForResults');
    }

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
  }, [activeFilters, setGlobalLoading, runTour, tourStep]); // Keep dependencies as they are

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleGenerateFilters(); }
  };
  const availableFilters = MASTER_FILTER_LIST.filter(mf => !activeFilters.some(af => af.apiName === mf.apiName));

  // --- RENDER ---
  return (
    <>
      <style>{`
        @keyframes tour-pulse-animation {
            0% { box-shadow: 0 0 0 0 rgba(0, 123, 255, 0.7); }
            70% { box-shadow: 0 0 0 10px rgba(0, 123, 255, 0); }
            100% { box-shadow: 0 0 0 0 rgba(0, 123, 255, 0); }
        }
        .tour-highlight-send-button {
            animation: tour-pulse-animation 2s infinite;
        }
      `}</style>
      <style>{`
        .custom-spotlight-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background-color: rgba(0, 0, 0, 0.6);
          z-index: 1001; /* Must be higher than other elements */
        }
        .lift-above-overlay {
          position: relative;
          z-index: 1002; /* Higher than the overlay */
          background: var(--surface-color-1); /* Match the panel's background */
        }
      `}</style>
      {tourPauseState === 'waitingForSendClick' && <div className="custom-spotlight-overlay"></div>}
      <Joyride
        callback={handleJoyrideCallback}
        stepIndex={tourStep}
        steps={tourSteps}
        run={runTour}
        continuous={true}
        showProgress={false}
        showSkipButton={false}
        disableScrolling={tourStep === 0}
        scrollOffset={300}
        tooltipComponent={TourTooltip}
      />
      <div style={{ display: 'flex', gap: '2rem', maxWidth: '1400px', margin: '0 auto', minHeight: '650px', fontSize: '0.9rem' }}>
        <div style={{ flex: 1.2, display: 'flex', flexDirection: 'column', background: 'var(--surface-color-1)', border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '1.5rem', textAlign: 'left', borderBottom: '1px solid var(--border-color-light)'}}>
              <h3 style={{ margin: 0, color: 'var(--text-color-dark)'}}>Viserra AI Assistant</h3>
          </div>
          <div ref={chatPanelRef} style={{ flexGrow: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {conversation.length === 0 && !isAiLoading && <p style={{color: 'var(--text-color-subtle)', textAlign: 'center', marginTop: '3rem'}}>Start by describing the type of investment you're looking for.</p>}
            {conversation.map((msg, index) => (
              <div key={index} style={{ alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                {msg.sender === 'user' ? ( <p style={{ background: 'var(--primary-color)', color: 'var(--text-color-light)', padding: '10px 14px', borderRadius: '12px', margin: 0, textAlign: 'left', fontSize: '0.9rem' }}>{msg.text}</p> ) 
                : ( <p id={index === conversation.length - 1 ? 'tour-step-3-ai-message' : undefined} style={{ background: 'var(--surface-color-2)', color: 'var(--text-color-dark)', padding: '10px 14px', borderRadius: '12px', margin: 0, whiteSpace: 'pre-wrap', textAlign: 'left', fontSize: '0.9rem' }}>{msg.explanation}</p> )}
              </div>
            ))}
            {isAiLoading && <ThinkingIndicator />}
            {error && <p style={{color: 'var(--error-color)'}}>{error}</p>}
          </div>
          <div 
            className={tourPauseState === 'waitingForSendClick' ? 'lift-above-overlay' : ''}
            style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border-color)'}}
          >
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input id="tour-step-1-input" type="text" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={handleKeyDown} placeholder={isLimitReached ? "You've reached the demo limit." : "e.g., Profitable and safe stocks..."} className="input-field" disabled={isAiLoading || isLimitReached} style={{ flexGrow: 1, padding: '14px 50px 14px 18px', fontSize: '0.9rem', borderRadius: '25px', margin: 0 }} />
              <button 
                id="tour-step-2-send" 
                onClick={handleGenerateFilters} 
                disabled={isAiLoading} 
                className={`ai-send-btn ${tourPauseState === 'waitingForSendClick' ? 'tour-highlight-send-button' : ''}`}
                style={{ opacity: (isAiLoading || isLimitReached) ? 0.5 : 1 }} 
              >
                <SendIcon />
              </button>
            </div>
          </div>
        </div>
        <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '1.5rem', overflowY: 'auto' }}>
          <div id="tour-step-2-filters" className="filter-controls" style={{ background: 'var(--surface-color-1)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.5rem' }}>
            <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'center', borderBottom: '1px solid var(--border-color-light)', paddingBottom: '1.5rem', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, color: 'var(--text-color-dark)'}}>Equity Screener</h3>
              <div style={{marginLeft: 'auto', display: 'flex', gap: '15px'}}>
                  <button className="btn btn-secondary btn-sm" onClick={() => setIsModalOpen(true)}>+ Add Filter</button>
                  <button className="btn btn-secondary btn-sm" onClick={handleResetFilters}>Reset All</button>
              </div>
            </div>
            <div id="tour-step-adjust-filters" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {activeFilters.length > 0 ? ( activeFilters.map(filter => (
                  <div key={filter.id} className="card filter-row-layout">
                    <label>{filter.label}</label>
                    {filter.type === 'numeric' && ( <> <select className="input-field" value={filter.condition} onChange={(e) => handleUpdateFilter(filter.id, 'condition', e.target.value)}><option value="over">Over</option><option value="under">Under</option><option value="between">Between</option></select><input type="number" className="input-field" placeholder={filter.placeholder} value={filter.value} onChange={(e) => handleUpdateFilter(filter.id, 'value', e.target.value)} /> {filter.condition === 'between' && ( <> <span>and</span> <input type="number" className="input-field" placeholder="Value 2" value={filter.value2} onChange={(e) => handleUpdateFilter(filter.id, 'value2', e.target.value)} /> </>)}</>)}
                    {filter.type === 'select' && (<select className="input-field" value={filter.value} onChange={(e) => handleUpdateFilter(filter.id, 'value', e.target.value)}><option value="">-- Select --</option>{filter.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}</select>)}
                    <button className="sidebar-close-btn" onClick={() => handleRemoveFilter(filter.id)}>&times;</button>
                  </div>
              ))) : <p className="filter-explanation">No active filters.</p>}
            </div>
            {activeFilters.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                <button id="tour-step-4-apply" className="btn btn-primary btn-sm" onClick={handleApplyFilters} style={{ width: 'auto' }}>Apply Filters</button>
              </div>
            )}
          </div>
          <div id="tour-step-5-results" className="filter-results" style={{ flexGrow: 1 }}>
            <p className="filter-explanation">{explanation}</p>
            <div className="reits-table-container">
              <table className="reits-table">
                <thead><tr><th>Company Name</th><th>Metrics</th><th>Website</th></tr></thead>
                <tbody>
                  {reits.length > 0 ? ( reits.map((reit, index) => (
                    <tr key={reit.Ticker} style={{backgroundColor: index % 2 !== 0 ? 'var(--surface-color-2)' : 'var(--background-color)'}}>
                      <td id={index === 0 ? 'tour-step-company-name' : undefined} className="reit-company-name-clickable" onClick={() => navigate(`/reits/${reit.Ticker}`)}>{reit.Company_Name}</td>
                      <td style={{ fontSize: '0.9rem' }}>{activeFilters.filter(f => f.type === 'numeric').map(filter => { const metricName = filter.metric_name; const metricValue = reit[metricName]; let displayValue = 'N/A'; if (metricValue != null) { displayValue = filter.isPercentage ? `${(metricValue * 100).toFixed(2)}%` : metricValue.toFixed(2); } const shortLabel = filter.label.split('(')[0].trim(); return `${shortLabel}: ${displayValue}`; }).join(' | ')}</td>
                      <td id={index === 0 ? 'tour-step-website' : undefined}>{reit.Website ? (<a href={reit.Website.startsWith("http") ? reit.Website : `https://${reit.Website}`} target="_blank" rel="noopener noreferrer" className="reit-link">Visit</a>) : ("No website")}</td>
                    </tr>
                  ))) : (<tr><td colSpan="3">No companies match the selected criteria.</td></tr>)}
                </tbody>
              </table>
            </div>
          </div>
          {isModalOpen && (<div className="modal-overlay" onClick={() => setIsModalOpen(false)}><div className="modal-box" onClick={e => e.stopPropagation()}><h3 className="popup-modal-title">Select a Filter</h3><div style={{ marginTop: '1rem' }}>{availableFilters.map(filter => (<div key={filter.apiName} className="dropdown-item" onClick={() => handleAddFilter(filter)}>{filter.label}</div>))}</div></div></div>)}
          <PopupModal show={isLimitModalOpen} onClose={() => setIsLimitModalOpen(false)} title="You've Reached the Demo Limit">
            <p style={{ margin: '1rem 0' }}>Since our product is still in the testing phase, we limit the AI assistant to two responses per session.</p>
            <p style={{ margin: '1rem 0' }}>If you're finding this tool useful, please join our early access list to get updates and be notified of our official launch!</p>
            <button className="btn btn-primary" style={{ width: '100%', marginTop: '1.5rem' }} onClick={() => { onLimitReached(); setIsLimitModalOpen(false); }}>Join the Waitlist</button>
          </PopupModal>
        </div>
      </div>
    </>
  );
}

export default LlmScreenerHome;