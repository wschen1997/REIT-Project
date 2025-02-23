import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage.js";
import FilterPage from "./pages/FilterPage.js";
import DetailPage from "./pages/DetailPage.js";
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
        </Routes>
      </Router>
    </div>
  );
}

export default App;
