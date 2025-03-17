// App.js
import React, { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import * as ReactGaModule from "react-ga4";

import HomePage from "./pages/HomePage.js";
import FilterPage from "./pages/FilterPage.js";
import DetailPage from "./pages/DetailPage.js";
import CrowdfundingPage from "./pages/Crowdfunding.js";
import RecDetailPage from "./pages/RecDetailPage.js";
import AboutUs from "./pages/AboutUs.js";
import ContactUs from "./pages/ContactUs.js";

import "./App.css";

// Log to see exactly what's in ReactGaModule
console.log("ReactGaModule is:", ReactGaModule);
console.log("ReactGaModule.default is:", ReactGaModule.default);

// The second .default is your GA4 instance
const realGA = ReactGaModule.default.default;

// Now you can call .initialize on the real GA object
const TRACKING_ID = "G-HH9G61RW3G"; // Your GA4 measurement ID
realGA.initialize(TRACKING_ID);

// Track pageviews on route change
function AnalyticsTracker() {
  const location = useLocation();
  useEffect(() => {
    realGA.send({ hitType: "pageview", page: location.pathname });
  }, [location]);
  return null;
}

function App() {
  return (
    <div className="App">
      <Router>
        <AnalyticsTracker />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/filter" element={<FilterPage />} />
          <Route path="/reits/:ticker" element={<DetailPage />} />
          <Route path="/Crowdfunding" element={<CrowdfundingPage />} />
          <Route path="/Crowdfunding/:vehicle" element={<RecDetailPage />} />
          <Route path="/about" element={<AboutUs />} />
          <Route path="/contact" element={<ContactUs />} />
        </Routes>
      </Router>
    </div>
  );
}

export default App;
