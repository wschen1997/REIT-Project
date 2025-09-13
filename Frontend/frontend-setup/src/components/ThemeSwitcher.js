import React, { useContext } from 'react';
import { ThemeContext } from '../context/ThemeContext.js';
import { FaSun, FaMoon } from 'react-icons/fa';

const ThemeSwitcher = () => {
  const { theme, toggleTheme } = useContext(ThemeContext);

  const switcherStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
  };

  return (
    // Add the new 'theme-switcher-link' class here
    <div onClick={toggleTheme} className="sidebar-link theme-switcher-link" style={switcherStyle}>
      {theme === 'light' ? <FaMoon /> : <FaSun />}
      <span>
        Switch to {theme === 'light' ? 'Dark' : 'Light'} Mode
      </span>
    </div>
  );
};

export default ThemeSwitcher;