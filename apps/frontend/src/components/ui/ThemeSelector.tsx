"use client";
import React, { useEffect, useState } from "react";

const THEMES = [
  { key: "", label: "Neon Cyan/Purple (Default)" },
  { key: "theme-green", label: "Futuristic Green" },
  { key: "theme-orange", label: "Solarized Orange" },
  { key: "theme-blue", label: "Classic Blue" },
  { key: "theme-magenta", label: "Magenta Dream" },
];

function getInitialTheme() {
  if (typeof window !== "undefined") {
    return localStorage.getItem("kingstack-theme") || "";
  }
  return "";
}

export const ThemeSelector: React.FC = () => {
  const [theme, setTheme] = useState(getInitialTheme());

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.classList.remove(
        ...THEMES.map((t) => t.key).filter(Boolean)
      );
      if (theme) document.documentElement.classList.add(theme);
      localStorage.setItem("kingstack-theme", theme);
    }
  }, [theme]);

  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", margin: "16px 0" }}>
      <label htmlFor="theme-select" style={{ fontWeight: 600 }}>Theme:</label>
      <select
        id="theme-select"
        value={theme}
        onChange={e => setTheme(e.target.value)}
        style={{ padding: 6, borderRadius: 6 }}
      >
        {THEMES.map(({ key, label }) => (
          <option key={key} value={key}>{label}</option>
        ))}
      </select>
    </div>
  );
};
