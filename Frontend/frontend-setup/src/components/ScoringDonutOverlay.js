import React, { useState, useEffect } from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip } from "chart.js";

// Register only the essential Chart.js components.
ChartJS.register(ArcElement, Tooltip);

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || "http://127.0.0.1:5000";

// --- NEW: A helper component for the Z-score bars ---
const ScoreBar = ({ label, value, higherIsBetter }) => {
  // Normalize Z-score to a 0-100 scale for the bar width.
  // We'll cap the visual representation at a Z-score of +/- 2.5.
  const zScore = parseFloat(value) || 0;
  const percentage = Math.max(0, Math.min(100, (zScore + 2.5) * 20));

  // Determine color based on whether a high or low score is good.
  // A "good" Z-score (low risk, high return) is green.
  // A "bad" Z-score (high risk, low return) is red.
  const isGood = higherIsBetter ? zScore > 0 : zScore < 0;
  const barColor = isGood ? 'rgba(34, 139, 34, 0.7)' : 'rgba(220, 20, 60, 0.7)';

  return (
    <div style={{ marginBottom: '15px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '0.9rem' }}>
        <span>{label}</span>
        <span style={{ fontWeight: 'bold' }}>{zScore.toFixed(2)}</span>
      </div>
      <div style={{ background: '#e0e0e0', borderRadius: '4px', height: '10px', width: '100%' }}>
        <div style={{
          background: barColor,
          width: `${percentage}%`,
          height: '100%',
          borderRadius: '4px',
          transition: 'width 0.5s ease-in-out'
        }} />
      </div>
    </div>
  );
};


/**
 * A reusable modal overlay component to display a scoring donut chart in a three-column layout.
 * @param {object} props - Component props.
 * @param {string} props.ticker - The REIT ticker to fetch analysis for.
 * @param {number} props.score - The score value (0-100) to display.
 * @param {string} props.title - The title to display above the donut chart.
 * @param {string} props.tooltipText - The text for the info tooltip.
 * @param {object} props.donutOptions - The chart options object for the donut.
 * @param {function} props.onClose - The function to call when the overlay should be closed.
 */
const ScoringDonutOverlay = ({ ticker, score, title, tooltipText, donutOptions, onClose }) => {
  // State for fetching and storing the analysis data (Z-scores and explanation)
  const [analysisData, setAnalysisData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    // This effect runs ONLY when the component is mounted (i.e., when the overlay is opened).
    if (!ticker) {
      setError("Ticker not provided.");
      setIsLoading(false);
      return;
    }

    const fetchAnalysis = async () => {
        console.log(`[ScoringDonutOverlay] Fetching stability analysis for ${ticker}...`);
        setIsLoading(true);
        setError('');

        try {
            const response = await fetch(`<span class="math-inline">\{API\_BASE\_URL\}/api/reits/</span>{ticker}/stability-analysis`);
            const data = await response.json();

            if (!response.ok) {
                // This creates an error object that includes the response data
                const error = new Error(data.error || `HTTP error! status: ${response.status}`);
                error.response = { json: () => Promise.resolve(data) }; // Attach data to the error
                throw error;
            }

            console.log(`[ScoringDonutOverlay] Received data for ${ticker}:`, data);
            setAnalysisData(data);

        } catch (err) {
            console.error(`[ScoringDonutOverlay] A fetch error occurred for ${ticker}:`);
            // We will try to get more details from the response body
            try {
                // err.response might not exist on a network failure, so we check
                const errorData = err.response ? await err.response.json() : { error: err.message };
                console.error("[ScoringDonutOverlay] Detailed error from server:", errorData);

                if (errorData.traceback) {
                    console.error("--- DETAILED BACKEND TRACEBACK ---");
                    console.error(errorData.traceback);
                    console.error("--- END OF TRACEBACK ---");
                    setError("Server error. The full error report has been printed to your browser's developer console (Press F12).");
                } else {
                    setError(errorData.error || "An unknown error occurred.");
                }
            } catch (parseError) {
                setError("Could not load analysis. The server responded with an unreadable error.");
            }
        } finally {
            setIsLoading(false);
        }
    };

    fetchAnalysis();
  }, [ticker]); // Dependency array ensures this runs only once per ticker when opened.


  if (score === null || score === undefined) {
    return null;
  }

  const scoreVal = Math.round(score);

  // This is the EXACT same donut chart data structure from DetailPage.js
  const donutChartData = {
    labels: ["Score", "Remaining"],
    datasets: [
      {
        data: [scoreVal, 100 - scoreVal],
        backgroundColor: ["#5A153D", "#e0e0e0"],
        borderWidth: 0,
        datalabels: { display: false },
      },
    ],
  };
  
  // A mapping to render the score bars correctly
  const scoreComponents = analysisData?.z_scores ? [
    { label: "Volatility", value: analysisData.z_scores.Z_Score_Std_Dev, higherIsBetter: false },
    { label: "Illiquidity", value: analysisData.z_scores.Z_Score_Illiquidity, higherIsBetter: false },
    { label: "Return", value: analysisData.z_scores.Z_Score_Return, higherIsBetter: true },
    { label: "Negative Skew", value: analysisData.z_scores.Z_Score_Skew, higherIsBetter: false },
    { label: "Tail Risk", value: analysisData.z_scores.Z_Score_Kurtosis, higherIsBetter: false },
  ] : [];


  return (
    // Full-screen overlay
    <div
      style={{
        position: "fixed",
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: "rgba(0,0,0,0.6)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 2000,
      }}
    >
      {/* Main modal container */}
      <div
        style={{
          background: "#fff",
          padding: "20px 40px",
          borderRadius: "8px",
          width: "90%",
          maxWidth: "1000px", // Wider for the three-column layout
          minHeight: "400px", // Ensure a decent height
          display: "flex", 
          gap: "30px",     // Space between columns
          position: "relative",
        }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          onMouseEnter={(e) => { e.currentTarget.style.color = "#B12D78"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "#5A153D"; }}
          style={{
            position: "absolute", top: "10px", right: "15px",
            background: "transparent", border: "none", fontSize: "1.8rem",
            cursor: "pointer", color: "#5A153D", lineHeight: 1,
          }}
        >
          &times;
        </button>

        {/* --- COLUMN 1: The Donut Chart (Flex: 1) --- */}
        <div style={{ flex: 1, textAlign: 'center', paddingRight: '30px', borderRight: '1px solid #eee' }}>
          <h4>
            {title}
            <span
              className="tooltip-icon"
              style={{
                marginLeft: "6px", cursor: "pointer", fontSize: "0.8rem",
                width: "14px", height: "14px", display: "inline-block",
                textAlign: "center", lineHeight: "16px",
              }}
            >
              i
              <span className="tooltip-text">{tooltipText}</span>
            </span>
          </h4>
          <div style={{ width: "200px", margin: "20px auto 0" }}>
            {/* The donut chart remains exactly as you designed it */}
            <Doughnut data={donutChartData} options={donutOptions} />
          </div>
          <p style={{ marginTop: "20px", fontSize: '1.2rem', fontWeight: 'bold' }}>
            {`${scoreVal}/100`}
          </p>
        </div>

        {/* --- COLUMN 2: The Component Bar Charts (Flex: 1) --- */}
        <div style={{ flex: 1, paddingRight: '30px', borderRight: '1px solid #eee' }}>
           <h4 style={{ textAlign: 'center' }}>Score Components</h4>
           {isLoading && <p>Loading Components...</p>}
           {error && <p style={{color: 'red', fontSize: '0.9rem'}}>{error}</p>}
           {analysisData && scoreComponents.map(comp => (
             <ScoreBar key={comp.label} {...comp} />
           ))}
        </div>


        {/* --- COLUMN 3: The AI Explanation (Flex: 1) --- */}
        <div style={{ flex: 1 }}>
          <h4 style={{ textAlign: 'center' }}>AI-Powered Analysis</h4>
           {isLoading && (
             <div style={{textAlign: 'center', color: '#666', fontSize: '0.9rem', marginTop: '50px' }}>
                <div className="spinner" /> {/* A simple CSS spinner can be added */}
                <p>Generating insights with Gemini...</p>
             </div>
           )}
          {error && <p style={{color: 'red', fontSize: '0.9rem'}}>{error}</p>}
          {analysisData && (
             <p style={{
                 color: '#333',
                 fontSize: '1rem',
                 lineHeight: '1.6',
                 whiteSpace: 'pre-wrap' // respects newlines from the API response
              }}>
                {analysisData.explanation}
             </p>
          )}
        </div>

      </div>
    </div>
  );
};

export default ScoringDonutOverlay;