import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import BottomBanner from "../components/BottomBanner.js";
import Header from "../components/Header.js";

// Load backend URL from environment variable
const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || "http://127.0.0.1:5000";

function FilterPage() {
  const [reits, setReits] = useState([]);
  const [explanation, setExplanation] = useState("");
  const [selectedPropertyType, setSelectedPropertyType] = useState("");
  const [minAvgReturn, setMinAvgReturn] = useState(""); // User enters a percentage (e.g., "10")

  // Track if the request is in progress
  const [isLoading, setIsLoading] = useState(false);

  const propertyTypeOptions = [
    "Apartments",
    "Industrial Assets",
    "Office Buildings",
    "Data Centers",
    "Single Family Houses",
    "Hotels/Resorts",
    "Retail Centers",
    "Health Care Communities",
    "Self Storage",
    "Infrastructure",
    "Manufactured Homes",
    "Specialty",
    "Timber",
    "Medical Facilities",
    "Life Science Laboratories"
  ];

  const navigate = useNavigate();

  // Whenever minAvgReturn or selectedPropertyType changes, we fetch
  useEffect(() => {
    if (minAvgReturn || selectedPropertyType) {
      fetchREITs();
    }
  }, [minAvgReturn, selectedPropertyType]);

  const fetchREITs = () => {
    console.log("fetchREITs called with:", { minAvgReturn, selectedPropertyType });

    // Start loading
    setIsLoading(true);

    const url = `${API_BASE_URL}/api/reits`;

    // Convert the entered percentage to a decimal (e.g., "10" => 0.10)
    const convertedMinAvgReturn = minAvgReturn ? parseFloat(minAvgReturn) / 100 : "";

    axios
      .get(url, {
        params: {
          min_avg_return: convertedMinAvgReturn,
          property_type: selectedPropertyType
        }
      })
      .then((response) => {
        console.log("Request made to:", url, {
          min_avg_return: convertedMinAvgReturn,
          property_type: selectedPropertyType
        });

        let responseData;
        if (typeof response.data === "string") {
          console.warn("Response data is a string, attempting to parse...");
          try {
            responseData = JSON.parse(response.data);
          } catch (err) {
            console.error("JSON parsing failed!", err);
            return;
          }
        } else {
          responseData = response.data;
        }

        console.log("Fetched Data:", responseData);
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
        // End loading
        setIsLoading(false);
      });
  };

  const formatWebsiteUrl = (url) => {
    if (!url) return "No website available";
    return url.startsWith("http") ? url : `https://${url}`;
  };

  return (
    <div className="filter-page">
      <Header />
      <h2>REIT Screener</h2>

      {/* Minimum Annualized Return with Tooltip */}
      <label>
        Minimum Annualized Return (%):
        <span
          className="tooltip-icon"
          style={{
            marginLeft: "6px",
            cursor: "pointer",
            fontSize: "0.8rem",
            width: "14px",
            height: "14px",
            display: "inline-block",
            textAlign: "center",
            lineHeight: "16px"
          }}
        >
          i
          <span className="tooltip-text">
            Annualized return is calculated by 
            multiplying the average daily return (over the last five years) by 252
            —the approximate number of trading days in a year.
          </span>
        </span>
      </label>
      <input
        type="number"
        step="0.1"
        value={minAvgReturn}
        onChange={(e) => setMinAvgReturn(e.target.value)}
        placeholder="Enter minimum return (%)"
      />

      <br />

      {/* Property Type Selection */}
      <label>Select Property Type:</label>
      <select
        value={selectedPropertyType}
        onChange={(e) => setSelectedPropertyType(e.target.value)}
      >
        <option value="">-- Select Property Type --</option>
        {propertyTypeOptions.map((type) => (
          <option key={type} value={type}>
            {type}
          </option>
        ))}
      </select>

      <h2>Filtered REITs</h2>
      <p>{explanation}</p>

      {/* If loading, show a message; otherwise, show table */}
      {isLoading ? (
        <p>Loading REITs...</p>
      ) : (
        <table border="1" cellPadding="6" className="reits-table">
          <thead>
            <tr>
              <th>Ticker</th>
              <th>Company Name</th>
              <th>Description</th>
              <th>Website</th>
            </tr>
          </thead>
          <tbody>
            {reits.length > 0 ? (
              reits.map((reit, index) => {
                return (
                  <tr key={index}>
                    <td>
                      <button onClick={() => navigate(`/reits/${reit.Ticker}`)}>
                        {reit.Ticker}
                      </button>
                    </td>
                    <td>{reit.Company_Name}</td>
                    <td>{reit.Business_Description || "No description available."}</td>
                    <td>
                      {reit.Website ? (
                        <a
                          href={formatWebsiteUrl(reit.Website)}
                          target="_blank"
                          rel="noopener noreferrer"
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
                <td colSpan="4">No REITs available for the selected criteria.</td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      <button onClick={() => navigate("/")}>Back to Home</button>
    </div>
  );
}

export default FilterPage;
