import React, { createContext, useState, useEffect } from 'react';

// Create the context that components will use
export const ThemeContext = createContext();

// Create the provider component that will wrap your app
export const ThemeProvider = ({ children }) => {
  // Set up the state to hold the current theme
  const [theme, setTheme] = useState('dark'); // Default to 'dark' now

  // This effect runs when the theme changes to update the HTML attribute
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, [theme]);

  // Function to toggle the theme
  const toggleTheme = () => {
    setTheme(currentTheme => (currentTheme === 'light' ? 'dark' : 'light'));
  };

  // Provide the theme and the toggle function to all child components
  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};