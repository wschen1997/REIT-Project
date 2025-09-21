import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useLoading } from "../context/LoadingContext.js";

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || "http://127.0.0.1:5000";

function FilterPage() {
  const [reits, setReits] = useState([]);
  const [explanation, setExplanation] = useState("Select a filter to begin screening for REITs.");

  // New consolidated state for all filters
  const [filters, setFilters] = useState({
      selectedPropertyType: "",
      minRevenueGrowth: "", // Renamed from Cagr
      minFfoGrowth: "",     // Renamed from Cagr
      minOperatingMargin: "",
  });
  const [appliedFilters, setAppliedFilters] = useState({});
  const { setLoading: setIsLoading } = useLoading();

  const propertyTypeOptions = [
    "Apartments", "Industrial Assets", "Office Buildings", "Data Centers",
    "Single Family Houses", "Hotels/Resorts", "Retail Centers", "Health Care Communities",
    "Self Storage", "Infrastructure", "Manufactured Homes", "Specialty",
    "Timber", "Medical Facilities", "Life Science Laboratories"
  ];

  const navigate = useNavigate();

  const fetchREITs = useCallback(() => {
    // Check if there are any applied filters. If not, don't make an API call.
    const hasAppliedFilters = Object.values(appliedFilters).some(value => value !== "" && value !== null);
    if (!hasAppliedFilters) {
      setReits([]);
      setExplanation("Select filters and click Apply to begin screening.");
      return;
    }

    setIsLoading(true);
    const url = `${API_BASE_URL}/api/reits/advanced-filter`;

    const requestParams = {
        property_type: appliedFilters.selectedPropertyType,
        min_revenue_growth: appliedFilters.minRevenueGrowth ? parseFloat(appliedFilters.minRevenueGrowth) / 100 : null,
        min_ffo_growth: appliedFilters.minFfoGrowth ? parseFloat(appliedFilters.minFfoGrowth) / 100 : null,
        min_operating_margin: appliedFilters.minOperatingMargin ? parseFloat(appliedFilters.minOperatingMargin) / 100 : null,
    };
    
    Object.keys(requestParams).forEach(key => {
        if (requestParams[key] === null || requestParams[key] === "") {
            delete requestParams[key];
        }
    });

    console.log("Sending to backend:", requestParams);

    axios.get(url, { params: requestParams })
      .then((response) => {
        const reitsData = response.data.reits || [];
        setReits(reitsData);
        if (reitsData.length > 0) {
            setExplanation(`Displaying ${reitsData.length} results.`);
        } else {
            setExplanation("No REITs found matching your specific criteria. Try adjusting your filters.");
        }
      })
      .catch((error) => {
        console.error("Error fetching data:", error);
        setReits([]);
        setExplanation("An error occurred while fetching data.");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [appliedFilters, setIsLoading]); // This now depends on appliedFilters

  useEffect(() => {
    fetchREITs();
  }, [fetchREITs]); // This now triggers ONLY when appliedFilters changes.

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prevFilters => ({
        ...prevFilters,
        [name]: value,
    }));
  };

  const handleApplyClick = () => {
    setAppliedFilters(filters);
  };

  const formatWebsiteUrl = (url) => {
    if (!url) return "No website available";
    return url.startsWith("http") ? url : `https://${url}`;
  };

  return (
    <div className="filter-page">
      <h2 className="filter-page-title">REIT Screener</h2>

      <div className="filter-controls">
        <div className="filter-control-group">
          <label>Select Property Type:</label>
          <select
            name="selectedPropertyType"
            value={filters.selectedPropertyType}
            onChange={handleFilterChange}
            className="input-field home-select-input"
          >
            <option value="">-- All Property Types --</option>
            {propertyTypeOptions.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        <div className="filter-control-group">
          <label>Min. Avg. Revenue Growth (YoY %):</label>
          <input
            type="number" step="0.5" name="minRevenueGrowth"
            value={filters.minRevenueGrowth} onChange={handleFilterChange}
            placeholder="e.g., 3.5" className="input-field"
          />
        </div>

        <div className="filter-control-group">
          <label>Min. Avg. FFO Growth (YoY %):</label>
          <input
            type="number" step="0.5" name="minFfoGrowth"
            value={filters.minFfoGrowth} onChange={handleFilterChange}
            placeholder="e.g., 4" className="input-field"
          />
        </div>
        
        <div className="filter-control-group">
          <label>Min. Operating Margin (TTM %):</label>
          <input
            type="number" step="1" name="minOperatingMargin"
            value={filters.minOperatingMargin} onChange={handleFilterChange}
            placeholder="e.g., 15" className="input-field"
          />
        </div>
      </div>

      <div className="filter-actions">
        <button onClick={handleApplyClick} className="btn btn-primary btn-apply-filters">
          Apply Filters
        </button>
      </div>

      <h2 className="filter-results-title">Filtered REITs</h2>
      <p className="filter-explanation">{explanation}</p>

      {/* --- THIS IS THE ONLY CHANGE --- */}
      <div className="reits-table-container">
        <table className="reits-table">
          <thead>
            <tr>
              <th>Company Name</th>
              <th>Description</th>
              <th>Website</th>
            </tr>
          </thead>
          <tbody>
            {reits.length > 0 ? (
              reits.map((reit, index) => (
                <tr key={index}>
                  <td
                    className="reit-company-name-clickable"
                    onClick={() => navigate(`/reits/${reit.Ticker}`)}
                  >
                    {reit.Company_Name}
                  </td>
                  <td>{reit.Business_Description || "No description available."}</td>
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
              ))
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