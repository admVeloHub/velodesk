/**
 * ThemeContext — dark mode por perfil
 * VERSION: v1.0.0 | DATE: 2026-06-18
 */
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [darkMode, setDarkModeState] = useState(() => localStorage.getItem('velodeskDarkMode') === '1');

  useEffect(() => {
    document.body.classList.toggle('velodesk-dark', darkMode);
    localStorage.setItem('velodeskDarkMode', darkMode ? '1' : '0');
  }, [darkMode]);

  const toggleDarkMode = useCallback(() => setDarkModeState((v) => !v), []);

  return (
    <ThemeContext.Provider value={{ darkMode, toggleDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme requires ThemeProvider');
  return ctx;
}
