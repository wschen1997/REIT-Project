// src/context/LoadingContext.js
import React, { useState, createContext, useContext, useMemo } from 'react';

// Create the context
const LoadingContext = createContext();

// Create a provider component
export const LoadingProvider = ({ children }) => {
  const [isLoading, setIsLoading] = useState(false);

  // Memoize the value to prevent unnecessary re-renders
  const value = useMemo(() => ({
    isLoading,
    setLoading: setIsLoading,
  }), [isLoading]);

  return (
    <LoadingContext.Provider value={value}>
      {children}
    </LoadingContext.Provider>
  );
};

// Create a custom hook for easy access to the context
export const useLoading = () => {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error('useLoading must be used within a LoadingProvider');
  }
  return context;
};