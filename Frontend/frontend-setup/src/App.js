import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage.js";
import FilterPage from "./pages/FilterPage.js";
import DetailPage from "./pages/DetailPage.js";
import CrowdfundingPage from "./pages/Crowdfunding.js"; // <-- Crowdfunding list page
import RecDetailPage from "./pages/RecDetailPage.js";   // <-- NEW IMPORT for the detail page
import "./App.css";

function App() {
  return (
    <div className="App">
      <Router>
        <Routes>
          {/* Home route => HomePage */}
          <Route path="/" element={<HomePage />} />
          <Route path="/filter" element={<FilterPage />} />
          <Route path="/reits/:ticker" element={<DetailPage />} />

          {/* Crowdfunding list route */}
          <Route path="/Crowdfunding" element={<CrowdfundingPage />} />

          {/* Crowdfunding detail route */}
          <Route path="/Crowdfunding/:vehicle" element={<RecDetailPage />} />
        </Routes>
      </Router>
    </div>
  );
}

export default App;
