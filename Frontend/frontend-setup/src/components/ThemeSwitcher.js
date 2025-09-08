// src/components/ThemeSwitcher.js
import React, { useContext } from 'react';
import { ThemeContext } from '../context/ThemeContext.js'; // Use the new context

const ThemeSwitcher = () => {
  // Get the global theme and toggle function from the context
  const { theme, toggleTheme } = useContext(ThemeContext);

  const buttonStyle = {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    zIndex: 9999,
    padding: '10px',
    cursor: 'pointer'
  };

  return (
    <button onClick={toggleTheme} style={buttonStyle}>
      Switch to {theme === 'light' ? 'Dark' : 'Light'} Mode
    </button>
  );
};

export default ThemeSwitcher;