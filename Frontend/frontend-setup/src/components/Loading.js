// src/components/Loading.js

import React from "react";

const Loading = ({ isOverlay = true }) => {
  // Reorder the elements here: Text first, then the spinner
  const loadingContent = (
    <div className="loading-box">
      Loading, please wait...
      <div className="loading-spinner"></div>
    </div>
  );

  // The full-screen overlay version
  if (isOverlay) {
    return (
      <div className="modal-overlay">
        {loadingContent}
      </div>
    );
  }

  // The local version
  return (
    <div className="loading-local">
      {loadingContent}
    </div>
  );
};

export default Loading;