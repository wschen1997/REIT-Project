// src/components/ScoringDonutOverlay.js
import React, { useState, useEffect, useRef } from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip } from "chart.js";

ChartJS.register(ArcElement, Tooltip);
const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || "http://127.0.0.1:5000";

const ScoreBar = ({ label, value, higherIsBetter }) => {
  const zScore = parseFloat(value) || 0;
  const percentage = Math.max(0, Math.min(100, (zScore + 2.5) * 20));
  const isGood = higherIsBetter ? zScore > 0 : zScore < 0;
  const barColor = isGood ? 'rgba(34, 139, 34, 0.7)' : 'rgba(220, 20, 60, 0.7)';
  return (
    <div style={{ marginBottom: '15px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '0.9rem' }}>
        <span>{label}</span>
        <span style={{ fontWeight: 'bold' }}>{zScore.toFixed(2)}</span>
      </div>
      <div style={{ background: '#e0e0e0', borderRadius: '4px', height: '10px', width: '100%' }}>
        <div style={{ background: barColor, width: `${percentage}%`, height: '100%', borderRadius: '4px', transition: 'width 0.5s ease-in-out' }} />
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
    // === Step 1: Start the analysis job ===
    const startAnalysis = async () => {
      if (!ticker) return;
      console.log(`[Overlay] Requesting analysis for ${ticker}...`);
      setIsLoading(true);
      setError('');
      try {
        const response = await fetch(`${API_BASE_URL}/api/reits/${ticker}/start-analysis`, { method: 'POST' });
        const data = await response.json();
        if (!response.ok || !data.task_id) {
          throw new Error("Failed to start analysis job.");
        }
        console.log(`[Overlay] Job started with ID: ${data.task_id}`);
        setJobId(data.task_id);
      } catch (err) {
        console.error(err);
        setError("Could not start the analysis job.");
        setIsLoading(false);
      }
    };
    startAnalysis();
    
    // === Step 3: Cleanup function to stop polling when component unmounts ===
    return () => {
      if (pollingRef.current) {
        console.log("[Overlay] Cleaning up polling interval.");
        clearInterval(pollingRef.current);
      }
    };
  }, [ticker]);

  useEffect(() => {
    // === Step 2: Poll for the result once we have a job ID ===
    if (!jobId) return;

    const pollForResult = async () => {
      console.log(`[Overlay] Polling for result of job ${jobId}...`);
      try {
        const response = await fetch(`${API_BASE_URL}/api/reits/analysis-result/${jobId}`);
        const data = await response.json();
        
        if (data.status === 'SUCCESS') {
          console.log("[Overlay] Job SUCCESS. Data received:", data.result);
          setAnalysisData(data.result);
          setIsLoading(false);
          clearInterval(pollingRef.current);
        } else if (data.status === 'FAILURE') {
          console.error("[Overlay] Job FAILURE:", data.error);
          setError(data.error || "Analysis job failed.");
          setIsLoading(false);
          clearInterval(pollingRef.current);
        } else {
          // Status is PENDING, do nothing and wait for the next poll.
          console.log("[Overlay] Job PENDING...");
        }
      } catch (err) {
        console.error("Polling error:", err);
        setError("Error fetching analysis result.");
        setIsLoading(false);
        clearInterval(pollingRef.current);
      }
    };
    
    // Start polling every 4 seconds
    pollingRef.current = setInterval(pollForResult, 4000);

  }, [jobId]);

  // The rest of the component for rendering remains largely the same
  if (score === null || score === undefined) return null;
  const scoreVal = Math.round(score);
  const donutChartData = {
    labels: ["Score", "Remaining"],
    datasets: [{ data: [scoreVal, 100 - scoreVal], backgroundColor: ["#5A153D", "#e0e0e0"], borderWidth: 0, datalabels: { display: false } }],
  };
  const scoreComponents = analysisData?.z_scores ? [
    { label: "Volatility", value: analysisData.z_scores.Z_Score_Std_Dev, higherIsBetter: false },
    { label: "Illiquidity", value: analysisData.z_scores.Z_Score_Illiquidity, higherIsBetter: false },
    { label: "Return", value: analysisData.z_scores.Z_Score_Return, higherIsBetter: true },
    { label: "Negative Skew", value: analysisData.z_scores.Z_Score_Skew, higherIsBetter: false },
    { label: "Tail Risk", value: analysisData.z_scores.Z_Score_Kurtosis, higherIsBetter: false },
  ] : [];

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 2000 }}>
      <div style={{ background: "#fff", padding: "20px 40px", borderRadius: "8px", width: "90%", maxWidth: "1000px", minHeight: "400px", display: "flex", gap: "30px", position: "relative" }}>
        <button onClick={onClose} style={{ position: "absolute", top: "10px", right: "15px", background: "transparent", border: "none", fontSize: "1.8rem", cursor: "pointer", color: "#5A153D", lineHeight: 1 }}>&times;</button>
        <div style={{ flex: 1, textAlign: 'center', paddingRight: '30px', borderRight: '1px solid #eee' }}>
          <h4>{title}<span className="tooltip-icon" style={{ marginLeft: "6px", cursor: "pointer" }}>i<span className="tooltip-text">{tooltipText}</span></span></h4>
          <div style={{ width: "200px", margin: "20px auto 0" }}><Doughnut data={donutChartData} options={donutOptions} /></div>
          <p style={{ marginTop: "20px", fontSize: '1.2rem', fontWeight: 'bold' }}>{`${scoreVal}/100`}</p>
        </div>
        <div style={{ flex: 1, paddingRight: '30px', borderRight: '1px solid #eee' }}>
          <h4 style={{ textAlign: 'center' }}>Score Components</h4>
          {isLoading && !analysisData && <p>Analyzing Components...</p>}
          {error && <p style={{ color: 'red', fontSize: '0.9rem' }}>{error}</p>}
          {analysisData && scoreComponents.map(comp => <ScoreBar key={comp.label} {...comp} />)}
        </div>
        <div style={{ flex: 1 }}>
          <h4 style={{ textAlign: 'center' }}>AI-Powered Analysis</h4>
          {isLoading && !analysisData && <div style={{ textAlign: 'center', color: '#666', fontSize: '0.9rem', marginTop: '50px' }}><p>Crafting insights with Gemini... This may take a moment.</p></div>}
          {error && <p style={{ color: 'red', fontSize: '0.9rem' }}>{error}</p>}
          {analysisData && <p style={{ color: '#333', fontSize: '1rem', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{analysisData.explanation}</p>}
        </div>
      </div>
    </div>
  );
};

export default ScoringDonutOverlay;