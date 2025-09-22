import React, { useState, useCallback } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useLoading } from "../context/LoadingContext.js";

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || "http://127.0.0.1:5000";

// No changes to this master list
const MASTER_FILTER_LIST = [
  { 
    apiName: 'property_type', 
    label: 'Property Type',
    type: 'select',
    options: [
        "Apartments", "Industrial Assets", "Office Buildings", "Data Centers",
        "Single Family Houses", "Hotels/Resorts", "Retail Centers", "Health Care Communities",
        "Self Storage", "Infrastructure", "Manufactured Homes", "Specialty",
        "Timber", "Medical Facilities", "Life Science Laboratories"
    ]
  },
  { 
    apiName: 'revenue_growth', // Changed from min_... to be more generic
    label: 'Avg. Revenue Growth (YoY %)',
    metric_name: 'avg_revenue_yoy_growth',
    type: 'numeric',
    placeholder: 'e.g., 5',
    isPercentage: true
  },
  { 
    apiName: 'ffo_growth', // Changed from min_...
    label: 'Avg. FFO Growth (YoY %)',
    metric_name: 'avg_ffo_yoy_growth',
    type: 'numeric',
    placeholder: 'e.g., 10',
    isPercentage: true 
  },
  { 
    apiName: 'operating_margin', // Changed from min_...
    label: 'Operating Margin (TTM %)',
    metric_name: 'operating_margin',
    type: 'numeric',
    placeholder: 'e.g., 15',
    isPercentage: true 
  },
  { 
    apiName: 'interest_coverage', // Matches 'filter_prefix' in backend
    label: 'Interest Coverage Ratio (TTM)',
    metric_name: 'interest_coverage_ratio',
    type: 'numeric',
    placeholder: 'e.g., 3.5',
    isPercentage: false // This is a raw ratio, not a percentage
  },
  { 
    apiName: 'debt_to_asset', // Matches 'filter_prefix' in backend
    label: 'Debt to Asset Ratio (Latest Quarter)',
    metric_name: 'debt_to_asset_ratio', // Matches 'metric_name' in backend
    type: 'numeric',
    placeholder: 'e.g., 0.5',
    isPercentage: false 
  },
  { 
    apiName: 'payout_ratio',
    label: 'Payout Ratio (Latest %)',
    metric_name: 'payout_ratio',
    type: 'numeric',
    placeholder: 'e.g., 65',
    isPercentage: true 
  },
  { 
    apiName: 'ffo_payout_ratio',
    label: 'FFO Payout Ratio (Latest %)',
    metric_name: 'ffo_payout_ratio',
    type: 'numeric',
    placeholder: 'e.g., 55',
    isPercentage: true 
  },
];


function FilterPage() {
  const [reits, setReits] = useState([]);
  const [explanation, setExplanation] = useState("Add a filter to begin screening for REITs.");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState([]);
  
  const { setLoading: setIsLoading } = useLoading();
  const navigate = useNavigate();

  // CHANGE #1: Add value2 for 'between' condition
  const handleAddFilter = (filter) => {
    if (activeFilters.some(f => f.apiName === filter.apiName)) {
      setIsModalOpen(false);
      return;
    }
    const newFilter = {
      id: Date.now(),
      ...filter,
      condition: filter.type === 'select' ? 'equals' : 'over',
      value: '',
      value2: '' // Add a second value field for the 'between' case
    };
    setActiveFilters(prev => [...prev, newFilter]);
    setIsModalOpen(false);
  };

  const handleUpdateFilter = (id, field, value) => {
    setActiveFilters(prev => 
      prev.map(f => (f.id === id ? { ...f, [field]: value } : f))
    );
  };

  const handleRemoveFilter = (id) => {
    setActiveFilters(prev => prev.filter(f => f.id !== id));
  };
  
  const handleResetFilters = () => {
    setActiveFilters([]);
    setReits([]);
    setExplanation("Add a filter to begin screening for REITs.");
  };

  // CHANGE #2: Update API logic to handle 'over', 'under', and 'between'
  const handleApplyFilters = useCallback(() => {
    if (activeFilters.length === 0) {
      handleResetFilters();
      return;
    }

    setIsLoading(true);
    const url = `${API_BASE_URL}/api/reits/advanced-filter`;
    
    const requestParams = {};
    activeFilters.forEach(filter => {
      // Basic validation: only send filters that have a value
      if (filter.value !== '') {
        if (filter.type === 'select') {
          requestParams[filter.apiName] = filter.value;
        } else if (filter.type === 'numeric') {
          // Construct API parameters based on the condition
          const baseApiName = filter.apiName;

          // --- MODIFIED LOGIC ---
          // Check the isPercentage flag before dividing. Default to true if not specified.
          const isPercentage = filter.isPercentage !== false;
          const multiplier = isPercentage ? 100 : 1;
          const val1 = parseFloat(filter.value) / multiplier;
          // --- END OF MODIFIED LOGIC ---

          if (filter.condition === 'over') {
            requestParams[`min_${baseApiName}`] = val1;
          } else if (filter.condition === 'under') {
            requestParams[`max_${baseApiName}`] = val1;
          } else if (filter.condition === 'between' && filter.value2 !== '') {
            // --- ALSO APPLY THE CHANGE HERE ---
            const val2 = parseFloat(filter.value2) / multiplier;
            requestParams[`min_${baseApiName}`] = Math.min(val1, val2);
            requestParams[`max_${baseApiName}`] = Math.max(val1, val2);
          }
        }
      }
    });

    console.log("Sending to backend:", requestParams);

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
      .finally(() => {
        setIsLoading(false);
      });
  }, [activeFilters, setIsLoading]);

  const formatWebsiteUrl = (url) => {
    if (!url) return "No website available";
    return url.startsWith("http") ? url : `https://${url}`;
  };

  const availableFilters = MASTER_FILTER_LIST.filter(
    masterFilter => !activeFilters.some(activeFilter => activeFilter.apiName === masterFilter.apiName)
  );

  return (
    <div className="filter-page">
      <h2 className="filter-page-title">REIT Screener</h2>
      
      <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
        <button className="btn btn-secondary btn-sm" onClick={() => setIsModalOpen(true)}>
          + Add Filter
        </button>
        <button className="btn btn-secondary btn-sm" onClick={handleResetFilters}>Reset All</button>
        <button className="btn btn-primary btn-sm" onClick={handleApplyFilters}>Apply Filters</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {activeFilters.length > 0 ? (
          activeFilters.map(filter => (
            <div key={filter.id} className="card filter-row-layout">
              <label>{filter.label}</label>
              
              {/* CHANGE #3: Add "Between" to dropdown and render second input box */}
              {filter.type === 'numeric' && (
                <>
                  <select 
                    className="input-field"
                    value={filter.condition}
                    onChange={(e) => handleUpdateFilter(filter.id, 'condition', e.target.value)}
                  >
                    <option value="over">Over</option>
                    <option value="under">Under</option>
                    <option value="between">Between</option>
                  </select>

                  <input
                    type="number"
                    className="input-field"
                    placeholder={filter.placeholder || 'Value'}
                    value={filter.value}
                    onChange={(e) => handleUpdateFilter(filter.id, 'value', e.target.value)}
                  />

                  {filter.condition === 'between' && (
                    <>
                      <span>and</span>
                      <input
                        type="number"
                        className="input-field"
                        placeholder="Value 2"
                        value={filter.value2}
                        onChange={(e) => handleUpdateFilter(filter.id, 'value2', e.target.value)}
                      />
                    </>
                  )}
                </>
              )}

              {filter.type === 'select' && (
                <select
                  className="input-field"
                  value={filter.value}
                  onChange={(e) => handleUpdateFilter(filter.id, 'value', e.target.value)}
                >
                  <option value="">-- Select --</option>
                  {filter.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              )}
              
              <button className="sidebar-close-btn" onClick={() => handleRemoveFilter(filter.id)}>
                &times;
              </button>
            </div>
          ))
        ) : (
          <p className="filter-explanation">No active filters.</p>
        )}
      </div>

      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3 className="popup-modal-title">Select a Filter</h3>
            <div style={{ marginTop: '1rem' }}>
              {availableFilters.map(filter => (
                <div key={filter.apiName} className="dropdown-item" onClick={() => handleAddFilter(filter)}>
                  {filter.label}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <h2 className="filter-results-title">Filtered REITs</h2>
      <p className="filter-explanation">{explanation}</p>
      
      <div className="reits-table-container">
        <table className="reits-table">
          <thead>
            <tr>
              <th>Company Name</th>
              <th>Metrics</th>
              <th>Website</th>
            </tr>
          </thead>
          <tbody>
            {reits.length > 0 ? (
              reits.map((reit, index) => {
                const rowStyle = {
                  backgroundColor: index % 2 !== 0 ? 'var(--surface-color-2)' : 'var(--background-color)'
                };

                return (
                  <tr key={reit.Ticker} style={rowStyle}>
                    <td
                      className="reit-company-name-clickable"
                      onClick={() => navigate(`/reits/${reit.Ticker}`)}
                    >
                      {reit.Company_Name}
                    </td>

                    {/* New Metrics Cell */}
                    <td style={{ fontSize: '0.9rem' }}>
                      {activeFilters
                        .filter(f => f.type === 'numeric')
                        .map(filter => {
                          const metricName = filter.metric_name; // Directly use metric_name
                          const metricValue = reit[metricName];
                          let displayValue = 'N/A';

                          if (metricValue != null) {
                            displayValue = filter.isPercentage
                              ? `${(metricValue * 100).toFixed(2)}%`
                              : metricValue.toFixed(2);
                          }
                          
                          // Creates a label like "ICR" or "FFO Growth" for brevity
                          const shortLabel = filter.label.split('(')[0].trim(); 
                          return `${shortLabel}: ${displayValue}`;
                        })
                        .join(' | ')}
                    </td>

                    <td>
                      {reit.Website ? (
                        <a
                          href={formatWebsiteUrl(reit.Website)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="reit-link"
                        >
                          Visit
                        </a>
                      ) : (
                        "No website available"
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="3">No REITs available for the selected criteria.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default FilterPage;