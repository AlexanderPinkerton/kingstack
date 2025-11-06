import { useState } from "react";

const COLOR_VARIABLES = [
  { name: "--primary", label: "Primary" },
  { name: "--background", label: "Background" },
  { name: "--accent", label: "Accent" },
  { name: "--foreground", label: "Foreground" },
  { name: "--accent-1-m", label: "Accent 1" },
  { name: "--accent-2-m", label: "Accent 2" },
];

function getCssVar(varName: string) {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return ""; // Or a sensible fallback
  }
  return getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim();
}

export const ThemeEditor: React.FC = () => {
  // Get initial values from CSS variables
  const [colors, setColors] = useState(() => {
    const initial: Record<string, string> = {};
    COLOR_VARIABLES.forEach(({ name }) => {
      let val = getCssVar(name);
      // Try to convert oklch to hex for color input, fallback to white
      try {
        if (val.startsWith("oklch")) {
          // Optionally: parse oklch to hex (not natively supported by input[type=color])
          // For now, fallback to #ffffff
          val = "#ffffff";
        }
      } catch {}
      initial[name] = val || "#ffffff";
    });
    return initial;
  });

  const handleChange = (varName: string, value: string) => {
    setColors((prev) => ({ ...prev, [varName]: value }));
    document.documentElement.style.setProperty(varName, value);
  };

  return (
    <div
      style={{
        background: "#222",
        color: "#eee",
        padding: 16,
        borderRadius: 8,
        margin: 16,
        maxWidth: 400,
      }}
    >
      <h2 style={{ fontWeight: 700, marginBottom: 8 }}>Live Theme Editor</h2>
      {COLOR_VARIABLES.map(({ name, label }) => (
        <div
          key={name}
          style={{ marginBottom: 12, display: "flex", alignItems: "center" }}
        >
          <label style={{ minWidth: 100 }}>{label}</label>
          <input
            type="color"
            value={colors[name]}
            onChange={(e) => handleChange(name, e.target.value)}
            style={{
              marginLeft: 12,
              width: 40,
              height: 32,
              border: "none",
              background: "none",
            }}
          />
          <span style={{ marginLeft: 12, fontSize: 12 }}>{name}</span>
        </div>
      ))}
      <div style={{ fontSize: 12, color: "#aaa" }}>
        Changes are live and only affect your session.
      </div>
    </div>
  );
};
