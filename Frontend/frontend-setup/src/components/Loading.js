import React from "react";

const Loading = () => {
  return (
    // We can reuse the .modal-overlay class for the background
    <div className="modal-overlay">
      <div className="loading-box">
        Loading, please wait...
      </div>
    </div>
  );
};

export default Loading;
