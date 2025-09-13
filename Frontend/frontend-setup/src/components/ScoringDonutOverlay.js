import React, { useState, useEffect, useRef, useContext } from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip } from "chart.js";
import { ThemeContext } from '../context/ThemeContext.js'; // Import ThemeContext

ChartJS.register(ArcElement, Tooltip);
const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || "http://127.0.0.1:5000";

const LoadingIndicator = ({ text }) => {
  return <p className="donut-overlay-loading-indicator">{text}</p>;
};

const ScoreBar = ({ label, percentile, tier }) => {
  const { theme } = useContext(ThemeContext); // Access the current theme

  const tierToPercentage = { "Excellent": 100, "Good": 75, "Moderate": 50, "Low": 25, "Very Low": 10 };
  const isTier = tier !== undefined;
  const barPercentage = isTier ? (tierToPercentage[tier] || 0) : Math.max(0, Math.min(100, percentile || 0));

  const getSuffix = (p) => {
    if (p === null || p === undefined) return '';
    if (p % 100 >= 11 && p % 100 <= 13) return 'th';
    switch (p % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  };

  const displayValue = isTier ? tier : `${barPercentage}${getSuffix(barPercentage)} Percentile`;

  // THIS IS THE ONLY CHANGE:
  // Updated logic to make all bars "white-ish" in dark mode.
  const getBarColor = () => {
    // If the theme is dark, always use the same light grey color.
    if (theme === 'dark') {
      return '#e0e0e0'; // This is the --text-color-dark from your theme
    }

    // Otherwise, use the original light mode logic with distinct colors.
    if (barPercentage >= 50) {
      return '#5A153D'; // Light mode purple for good scores
    }
    return '#d9534f';   // Light mode red for low scores
  };

  return (
    <div className="score-bar">
      <div className="score-bar-header">
        <span className="score-bar-label">{label}</span>
        <span className="score-bar-value">{displayValue}</span>
      </div>
      <div className="score-bar-track">
        <div
          className="score-bar-fill"
          style={{ width: `${barPercentage}%`, backgroundColor: getBarColor() }}
        />
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
  const { theme } = useContext(ThemeContext); // Access the current theme

  useEffect(() => {
    const startAnalysis = async () => {
      if (!ticker) return;
      setIsLoading(true);
      setError('');
      try {
        const url = `${API_BASE_URL}/api/reits/${ticker}/start-analysis`;
        const response = await fetch(url, { method: 'POST' });
        const data = await response.json();
        if (!response.ok || !data.task_id) { throw new Error(data.error || "Failed to start analysis job."); }
        setJobId(data.task_id);
      } catch (err) {
        setError(`Failed to start job: ${err.message}`);
        setIsLoading(false);
      }
    };
    startAnalysis();
    return () => { if (pollingRef.current) { clearInterval(pollingRef.current); }};
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
        } else if (data.status === 'DELISTED') {
          setError(data.message);
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
  
  // Define colors based on theme
  const donutColor = theme === 'dark' ? '#844ee2' : '#5A153D';
  const donutTrackColor = theme === 'dark' ? '#2a2a2a' : '#e0e0e0';

  const donutChartData = {
    labels: ["Score", "Remaining"],
    datasets: [{ data: [scoreVal, 100 - scoreVal], backgroundColor: [donutColor, donutTrackColor], borderWidth: 0, datalabels: { display: false } }],
  };
  
  const scoreComponents = analysisData ? [
    { label: "Price Stability (Volatility)", percentile: analysisData.percentile_ranks?.Volatility },
    { label: "Historical Performance (Return)", percentile: analysisData.percentile_ranks?.Return },
    { label: "Downside Protection (Skew)", percentile: analysisData.percentile_ranks?.NegativeSkew },
    { label: "Extreme Event Risk (Kurtosis)", percentile: analysisData.percentile_ranks?.TailRisk },
  ] : [];

  return (
    <div className="donut-overlay-backdrop">
      <div className="donut-overlay-container">
        <button onClick={onClose} className="donut-overlay-close-btn">&times;</button>
        
        <div className="donut-overlay-column">
          <h4 className="donut-overlay-title">
            {title}
            <span className="tooltip-icon">i<span className="tooltip-text">{tooltipText}</span></span>
          </h4>
          <div className="donut-overlay-column-content">
            <div className="donut-chart-wrapper"><Doughnut data={donutChartData} options={donutOptions} /></div>
            <p className="donut-score-text">{`${scoreVal}/100`}</p>
          </div>
        </div>
        
        <div className="donut-overlay-column">
          <h4 className="donut-overlay-title">Score Components</h4>
          <div className="donut-overlay-column-content">
            {isLoading && !analysisData && <LoadingIndicator text="Analyzing component scores..." />}
            {error && <p className="error-message">{error}</p>}
            {analysisData && scoreComponents.map(comp => <ScoreBar key={comp.label} {...comp} />)}
          </div>
        </div>

        <div className="donut-overlay-column no-border">
          <h4 className="donut-overlay-title">AI-Powered Analysis</h4>
          <div className="donut-overlay-column-content">
            {isLoading && !analysisData && <LoadingIndicator text="Crafting insights with Gemini..." />}
            {error && <p className="error-message">{error}</p>}
            {analysisData && <p className="donut-ai-text">{analysisData.explanation}</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScoringDonutOverlay;