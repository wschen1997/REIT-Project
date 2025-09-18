// src/components/Loading.js

import React, { useState, useEffect } from "react";

// 1. Add the useMediaQuery hook to this file
const useMediaQuery = (query) => {
  const [matches, setMatches] = useState(window.matchMedia(query).matches);

  useEffect(() => {
    const media = window.matchMedia(query);
    const listener = () => setMatches(media.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [query]);

  return matches;
};

const Loading = ({ isOverlay = true }) => {
  // 2. Use the hook to detect if the screen is mobile-sized
  const isMobile = useMediaQuery('(max-width: 768px)');

  // 3. Create a new variable. It's true if the prop is true OR if it's a mobile screen.
  const showAsOverlay = isOverlay || isMobile;

  const loadingContent = (
    <div className="loading-box">
      Loading, please wait...
      <div className="loading-spinner"></div>
    </div>
  );

  // 4. Use the new variable in the condition
  if (showAsOverlay) {
    return (
      <div className="modal-overlay">
        {loadingContent}
      </div>
    );
  }

  // This local version will now only render on desktop when isOverlay is false
  return (
    <div className="loading-local">
      {loadingContent}
    </div>
  );
};

export default Loading;