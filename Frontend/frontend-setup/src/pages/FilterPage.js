import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useLoading } from "../context/LoadingContext.js";

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || "http://127.0.0.1:5000";

function FilterPage() {
  const [reits, setReits] = useState([]);
  const [explanation, setExplanation] = useState("");
  const [selectedPropertyType, setSelectedPropertyType] = useState("");
  const [minAvgReturn, setMinAvgReturn] = useState("");
  const { setLoading: setIsLoading } = useLoading();

  const propertyTypeOptions = [
    "Apartments", "Industrial Assets", "Office Buildings", "Data Centers",
    "Single Family Houses", "Hotels/Resorts", "Retail Centers", "Health Care Communities",
    "Self Storage", "Infrastructure", "Manufactured Homes", "Specialty",
    "Timber", "Medical Facilities", "Life Science Laboratories"
  ];

  const navigate = useNavigate();

  useEffect(() => {
    if (minAvgReturn || selectedPropertyType) {
      fetchREITs();
    }
  }, [minAvgReturn, selectedPropertyType]);

  const fetchREITs = () => {
    setIsLoading(true);
    const url = `${API_BASE_URL}/api/reits`;
    const convertedMinAvgReturn = minAvgReturn ? parseFloat(minAvgReturn) / 100 : "";
    axios
      .get(url, {
        params: {
          min_avg_return: convertedMinAvgReturn,
          property_type: selectedPropertyType,
        },
      })
      .then((response) => {
        let responseData = typeof response.data === "string" ? JSON.parse(response.data) : response.data;
        setReits(responseData.reits || []);
        setExplanation(
          `Filtered REITs: Minimum Annualized Return - ${minAvgReturn}%, Property Type - ${selectedPropertyType}`
        );
      })
      .catch((error) => {
        console.error("Error fetching data:", error);
        setReits([]);
      })
      .finally(() => {
        setIsLoading(false);
      });
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
          <label style={{ marginBottom: '8px' }}>
            Minimum Annualized Return (%):
            <span className="tooltip-icon">
              i
              <span className="tooltip-text">
                Annualized return is calculated by multiplying the average daily return (over the last five years) by 252—the approximate number of trading days in a year.
              </span>
            </span>
          </label>
          <input
            type="number"
            step="0.1"
            value={minAvgReturn}
            onChange={(e) => setMinAvgReturn(e.target.value)}
            placeholder="Enter minimum return (%)"
            className="input-field"
          />
        </div>

        <div className="filter-control-group">
          <label style={{ marginBottom: '8px' }}>Select Property Type:</label>
          <select
            value={selectedPropertyType}
            onChange={(e) => setSelectedPropertyType(e.target.value)}
            className="input-field home-select-input"
          >
            <option value="">-- Select Property Type --</option>
            {propertyTypeOptions.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
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