// src/components/ScoringDonutOverlay.js
import React, { useState, useEffect, useRef } from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip } from "chart.js";

ChartJS.register(ArcElement, Tooltip);
const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || "http://127.0.0.1:5000";

const LoadingIndicator = ({ text }) => {
  const loadingStyle = {
    textAlign: 'center',
    color: '#666',
    fontSize: '0.9rem',
    animation: 'pulse 1.5s infinite ease-in-out'
  };
  return <p style={loadingStyle}>{text}</p>;
};

const ScoreBar = ({ label, percentile }) => {
  const percentage = Math.max(0, Math.min(100, percentile || 0));
  const barColor = percentage >= 50 ? '#5A153D' : '#d9534f';
  
  const getSuffix = (p) => {
    if (p % 100 >= 11 && p % 100 <= 13) return 'th';
    switch (p % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  };

  return (
    <div style={{ marginBottom: '20px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: '20px', marginBottom: '5px', fontSize: '0.9rem', color: '#333' }}>
        <span style={{ textAlign: 'left', whiteSpace: 'nowrap' }}>{label}</span>
        <span style={{ fontWeight: 'bold', textAlign: 'right', whiteSpace: 'nowrap' }}>{`${percentage}${getSuffix(percentage)} Percentile`}</span>
      </div>
      <div style={{ background: '#e9ecef', borderRadius: '5px', height: '10px', width: '100%' }}>
        <div style={{
          background: barColor,
          width: `${percentage}%`,
          height: '100%',
          borderRadius: '5px',
          transition: 'width 0.5s ease-in-out'
        }} />
      </div>
    </div>
  );
};


const ScoringDonutOverlay = ({ ticker, score, title, tooltipText, donutOptions, onClose }) => {
  const [analysisData, setAnalysisData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [jobId, setJobId] = useState(null);
  const pollingRef = useRef(null);

  useEffect(() => {
    const startAnalysis = async () => {
      if (!ticker) return;
      setIsLoading(true);
      setError('');
      try {
        const url = `${API_BASE_URL}/api/reits/${ticker}/start-analysis`;
        const response = await fetch(url, { method: 'POST' });
        const data = await response.json();
        if (!response.ok || !data.task_id) {
          throw new Error(data.error || "Failed to start analysis job.");
        }
        setJobId(data.task_id);
      } catch (err) {
        setError(`Failed to start job: ${err.message}`);
        setIsLoading(false);
      }
    };
    startAnalysis();
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [ticker]);

  useEffect(() => {
    if (!jobId) return;
    const pollForResult = async () => {
      try {
        const url = `${API_BASE_URL}/api/reits/analysis-result/${jobId}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.status === 'SUCCESS') {
          setAnalysisData(data.result);
          setIsLoading(false);
          clearInterval(pollingRef.current);
        } else if (data.status === 'FAILURE') {
          setError(data.error || "Analysis job failed on the backend.");
          setIsLoading(false);
          clearInterval(pollingRef.current);
        }
      } catch (err) {
        setError(`Error fetching result: ${err.message}`);
        setIsLoading(false);
        clearInterval(pollingRef.current);
      }
    };
    pollingRef.current = setInterval(pollForResult, 4000);
  }, [jobId]);

  if (score === null || score === undefined) return null;
  const scoreVal = Math.round(score);
  const donutChartData = {
    labels: ["Score", "Remaining"],
    datasets: [{ data: [scoreVal, 100 - scoreVal], backgroundColor: ["#5A153D", "#e0e0e0"], borderWidth: 0, datalabels: { display: false } }],
  };
  
  const scoreComponents = analysisData?.percentile_ranks ? [
    { label: "Price Stability (Volatility)", percentile: analysisData.percentile_ranks.Volatility },
    { label: "Ease of Trading (Illiquidity)", percentile: analysisData.percentile_ranks.Illiquidity },
    { label: "Historical Performance (Return)", percentile: analysisData.percentile_ranks.Return },
    { label: "Downside Protection (Skew)", percentile: analysisData.percentile_ranks.NegativeSkew },
    { label: "Extreme Event Risk (Kurtosis)", percentile: analysisData.percentile_ranks.TailRisk },
  ] : [];

  const columnStyle = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    textAlign: 'center',
  };

  // --- FINAL ALIGNMENT FIX: Reverting to 'center' to vertically align all content. ---
  const columnContentStyle = {
    flexGrow: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center', // This vertically centers the content
    padding: '20px 0'
  };

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 2000 }}>
      <style>
        {`
          @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
          }
        `}
      </style>
      <div style={{ background: "#fff", padding: "20px 40px", borderRadius: "8px", width: "90%", maxWidth: "1200px", minHeight: "400px", display: "flex", gap: "40px", position: "relative" }}>
        <button 
          onClick={onClose} 
          onMouseEnter={(e) => { e.currentTarget.style.color = "#B12D78"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "#5A153D"; }}
          style={{ position: "absolute", top: "10px", right: "15px", background: "transparent", border: "none", fontSize: "2rem", cursor: "pointer", color: "#5A153D", lineHeight: 1, transition: "color 0.2s ease" }}
        >
          &times;
        </button>
        
        {/* Column 1: Donut */}
        <div style={{ ...columnStyle, paddingRight: '40px', borderRight: '1px solid #eee' }}>
          <h4>{title}<span className="tooltip-icon" style={{ marginLeft: "6px", cursor: "pointer" }}>i<span className="tooltip-text">{tooltipText}</span></span></h4>
          <div style={columnContentStyle}>
            <div style={{ width: "200px", margin: "0 auto" }}><Doughnut data={donutChartData} options={donutOptions} /></div>
            <p style={{ marginTop: "20px", fontSize: '1.2rem', fontWeight: 'bold' }}>{`${scoreVal}/100`}</p>
          </div>
        </div>
        
        {/* Column 2: Score Components */}
        <div style={{ ...columnStyle, paddingRight: '40px', borderRight: '1px solid #eee' }}>
          <h4 style={{ marginBottom: 0 }}>Score Components</h4>
          <div style={columnContentStyle}>
            {isLoading && !analysisData && <LoadingIndicator text="Analyzing component scores..." />}
            {error && <p style={{ color: 'red', fontSize: '0.9rem' }}>{error}</p>}
            {analysisData && scoreComponents.map(comp => <ScoreBar key={comp.label} {...comp} />)}
          </div>
        </div>

        {/* Column 3: AI Analysis */}
        <div style={columnStyle}>
          <h4 style={{ marginBottom: 0 }}>AI-Powered Analysis</h4>
          <div style={columnContentStyle}>
            {isLoading && !analysisData && <LoadingIndicator text="Crafting insights with Gemini..." />}
            {error && <p style={{ color: 'red', fontSize: '0.9rem' }}>{error}</p>}
            {analysisData && <p style={{ textAlign: 'justify', color: '#333', fontSize: '1rem', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{analysisData.explanation}</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScoringDonutOverlay;