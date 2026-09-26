/**
 * ThemeToggle — light / dark theme switch.
 *
 * Mechanism:
 *   • Dark (default): no data-theme attribute on <html>
 *   • Light:          data-theme="light" on <html>
 *
 * Preference is persisted in localStorage under the key "bobguard-theme".
 * On mount the stored preference is restored before the first paint.
 */
import { useState, useEffect } from "react";

const STORAGE_KEY = "bobguard-theme";

function applyTheme(theme) {
  if (theme === "light") {
    document.documentElement.setAttribute("data-theme", "light");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "light" ? "light" : "dark";
  });

  // Apply on mount and whenever theme changes
  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  function toggle() {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }

  const isDark = theme === "dark";

  return (
    <button
      className="theme-toggle"
      onClick={toggle}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Switch to light theme" : "Switch to dark theme"}
    >
      {isDark ? "☀️" : "🌙"}
    </button>
  );
}
