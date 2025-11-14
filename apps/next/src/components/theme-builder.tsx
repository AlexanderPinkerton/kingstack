"use client";

import { useState, useEffect, useMemo } from "react";
import { Download, Copy, RotateCcw, Palette } from "lucide-react";
import { ThemedButton } from "@/components/ui/themed-button";
import { NeonCard } from "@/components/ui/neon-card";

const THEMES = [
  { key: "", label: "Neon Cyan/Purple (Default)" },
  { key: "theme-green", label: "Futuristic Green" },
  { key: "theme-orange", label: "Solarized Orange" },
  { key: "theme-blue", label: "Classic Blue" },
  { key: "theme-magenta", label: "Magenta Dream" },
];

// All CSS variables that can be edited
const CSS_VARIABLES = [
  // Core colors
  { name: "--background", label: "Background", category: "Core" },
  { name: "--foreground", label: "Foreground", category: "Core" },
  { name: "--primary", label: "Primary", category: "Core" },
  {
    name: "--primary-foreground",
    label: "Primary Foreground",
    category: "Core",
  },
  { name: "--secondary", label: "Secondary", category: "Core" },
  {
    name: "--secondary-foreground",
    label: "Secondary Foreground",
    category: "Core",
  },
  { name: "--muted", label: "Muted", category: "Core" },
  { name: "--muted-foreground", label: "Muted Foreground", category: "Core" },
  { name: "--accent", label: "Accent", category: "Core" },
  { name: "--accent-foreground", label: "Accent Foreground", category: "Core" },
  { name: "--destructive", label: "Destructive", category: "Core" },
  { name: "--border", label: "Border", category: "Core" },
  { name: "--input", label: "Input", category: "Core" },
  { name: "--ring", label: "Ring", category: "Core" },
  // Card & Popover
  { name: "--card", label: "Card", category: "Card & Popover" },
  {
    name: "--card-foreground",
    label: "Card Foreground",
    category: "Card & Popover",
  },
  { name: "--popover", label: "Popover", category: "Card & Popover" },
  {
    name: "--popover-foreground",
    label: "Popover Foreground",
    category: "Card & Popover",
  },
  // Accent colors (main ones)
  { name: "--accent-1-m", label: "Accent 1 (Mid)", category: "Accent Colors" },
  { name: "--accent-2-m", label: "Accent 2 (Mid)", category: "Accent Colors" },
  // Charts
  { name: "--chart-1", label: "Chart 1", category: "Charts" },
  { name: "--chart-2", label: "Chart 2", category: "Charts" },
  { name: "--chart-3", label: "Chart 3", category: "Charts" },
  { name: "--chart-4", label: "Chart 4", category: "Charts" },
  { name: "--chart-5", label: "Chart 5", category: "Charts" },
  // Sidebar
  { name: "--sidebar", label: "Sidebar", category: "Sidebar" },
  {
    name: "--sidebar-foreground",
    label: "Sidebar Foreground",
    category: "Sidebar",
  },
  { name: "--sidebar-primary", label: "Sidebar Primary", category: "Sidebar" },
  {
    name: "--sidebar-primary-foreground",
    label: "Sidebar Primary Foreground",
    category: "Sidebar",
  },
  { name: "--sidebar-accent", label: "Sidebar Accent", category: "Sidebar" },
  {
    name: "--sidebar-accent-foreground",
    label: "Sidebar Accent Foreground",
    category: "Sidebar",
  },
  { name: "--sidebar-border", label: "Sidebar Border", category: "Sidebar" },
  { name: "--sidebar-ring", label: "Sidebar Ring", category: "Sidebar" },
  // Radius
  {
    name: "--radius",
    label: "Border Radius",
    category: "Layout",
    isNumber: true,
  },
];

// Convert any color format (oklch, lab, rgb, etc.) to hex using canvas
function colorToHex(colorValue: string): string {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return "#ffffff";
  }

  // If it's already a hex color, return it
  if (/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(colorValue)) {
    return colorValue.length === 4
      ? `#${colorValue[1]}${colorValue[1]}${colorValue[2]}${colorValue[2]}${colorValue[3]}${colorValue[3]}`
      : colorValue;
  }

  try {
    // Use canvas to convert any color format to RGB
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      return "#ffffff";
    }

    // Set the color and read it back as RGB
    ctx.fillStyle = colorValue;
    ctx.fillRect(0, 0, 1, 1);

    const imageData = ctx.getImageData(0, 0, 1, 1);
    const r = imageData.data[0];
    const g = imageData.data[1];
    const b = imageData.data[2];

    // Convert RGB to hex
    const hex = `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
    return hex;
  } catch (e) {
    console.warn("Failed to convert color to hex:", e, colorValue);
  }

  return "#ffffff";
}

function getCssVar(varName: string): string {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return "";
  }
  return getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim();
}

export const ThemeBuilder: React.FC = () => {
  // Initialize with empty string to avoid hydration mismatch
  const [selectedTheme, setSelectedTheme] = useState("");
  const [isMounted, setIsMounted] = useState(false);

  const [customValues, setCustomValues] = useState<Record<string, string>>({});

  const [activeTab, setActiveTab] = useState<"presets" | "custom">("presets");

  // Group variables by category
  const groupedVariables = useMemo(() => {
    const groups: Record<string, typeof CSS_VARIABLES> = {};
    CSS_VARIABLES.forEach((variable) => {
      if (!groups[variable.category]) {
        groups[variable.category] = [];
      }
      groups[variable.category].push(variable);
    });
    return groups;
  }, []);

  // Initialize on mount (client-side only)
  useEffect(() => {
    // Use requestAnimationFrame to defer setState calls
    requestAnimationFrame(() => {
      setIsMounted(true);

      // Load theme from localStorage
      const savedTheme = localStorage.getItem("kingstack-theme") || "";
      setSelectedTheme(savedTheme);

      // Apply saved theme immediately
      if (savedTheme && typeof document !== "undefined") {
        document.documentElement.classList.remove(
          ...THEMES.map((t) => t.key).filter(Boolean),
        );
        document.documentElement.classList.add(savedTheme);
      }

      // Load colors after a brief delay to ensure styles are computed
      const loadColors = () => {
        const newValues: Record<string, string> = {};
        CSS_VARIABLES.forEach(({ name, isNumber }) => {
          const val = getCssVar(name);
          if (isNumber) {
            const numMatch = val.match(/[\d.]+/);
            newValues[name] = numMatch ? numMatch[0] : "0.625";
          } else {
            if (val) {
              // Convert any color format to hex
              const hex = colorToHex(val);
              newValues[name] = hex;
            } else {
              newValues[name] = "#ffffff";
            }
          }
        });
        setCustomValues(newValues);
      };

      // Small delay to ensure DOM and styles are ready
      setTimeout(loadColors, 150);
    });
  }, []);

  // Apply theme
  useEffect(() => {
    if (typeof document === "undefined") return;

    // Remove all theme classes
    document.documentElement.classList.remove(
      ...THEMES.map((t) => t.key).filter(Boolean),
    );

    // Apply selected theme
    if (selectedTheme) {
      document.documentElement.classList.add(selectedTheme);
    }

    // Save to localStorage
    localStorage.setItem("kingstack-theme", selectedTheme);

    // Reload custom values from computed styles after theme change
    // Use setTimeout to defer setState call
    const timer = setTimeout(() => {
      const newValues: Record<string, string> = {};
      CSS_VARIABLES.forEach(({ name, isNumber }) => {
        const val = getCssVar(name);
        if (isNumber) {
          const numMatch = val.match(/[\d.]+/);
          newValues[name] = numMatch ? numMatch[0] : "0.625";
        } else {
          if (val) {
            // Convert any color format to hex
            const hex = colorToHex(val);
            newValues[name] = hex;
          } else {
            newValues[name] = "#ffffff";
          }
        }
      });
      setCustomValues(newValues);
    }, 0);

    return () => clearTimeout(timer);
  }, [selectedTheme]);

  // Apply custom values
  const handleCustomChange = (varName: string, value: string) => {
    const variable = CSS_VARIABLES.find((v) => v.name === varName);

    if (variable?.isNumber) {
      // For radius, add 'rem' unit
      const newValues = { ...customValues, [varName]: value };
      setCustomValues(newValues);
      document.documentElement.style.setProperty(varName, `${value}rem`);
    } else {
      // Validate hex color format
      const hexPattern = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
      if (hexPattern.test(value)) {
        // Normalize 3-digit hex to 6-digit
        const normalizedHex =
          value.length === 4
            ? `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`
            : value;

        const newValues = { ...customValues, [varName]: normalizedHex };
        setCustomValues(newValues);
        document.documentElement.style.setProperty(varName, normalizedHex);
      } else if (value === "" || value.startsWith("#")) {
        // Allow empty or partial hex input while typing
        const newValues = { ...customValues, [varName]: value };
        setCustomValues(newValues);
      }
      // Ignore invalid values
    }
  };

  // Reset to default
  const handleReset = () => {
    if (typeof document === "undefined") return;
    CSS_VARIABLES.forEach(({ name }) => {
      document.documentElement.style.removeProperty(name);
    });
    // Reload values
    const newValues: Record<string, string> = {};
    CSS_VARIABLES.forEach(({ name, isNumber }) => {
      const val = getCssVar(name);
      if (isNumber) {
        const numMatch = val.match(/[\d.]+/);
        newValues[name] = numMatch ? numMatch[0] : "0.625";
      } else {
        if (val.startsWith("oklch")) {
          newValues[name] = oklchToHex(val);
        } else {
          newValues[name] = val || "#ffffff";
        }
      }
    });
    setCustomValues(newValues);
  };

  // Export as CSS
  const handleExportCSS = () => {
    const css = `:root {\n${CSS_VARIABLES.map(({ name }) => {
      // Get the actual computed value (could be hex or oklch)
      const value =
        getCssVar(name) ||
        document.documentElement.style.getPropertyValue(name);
      return `  ${name}: ${value || "inherit"};`;
    }).join("\n")}\n}`;

    const blob = new Blob([css], { type: "text/css" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "theme.css";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export as JSON
  const handleExportJSON = () => {
    const theme: Record<string, string> = {};
    CSS_VARIABLES.forEach(({ name }) => {
      // Get the actual computed value (could be hex or oklch)
      const value =
        getCssVar(name) ||
        document.documentElement.style.getPropertyValue(name);
      theme[name] = value || "";
    });

    const json = JSON.stringify(theme, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "theme.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Copy CSS to clipboard
  const handleCopyCSS = async () => {
    const css = `:root {\n${CSS_VARIABLES.map(({ name }) => {
      // Get the actual computed value (could be hex or oklch)
      const value =
        getCssVar(name) ||
        document.documentElement.style.getPropertyValue(name);
      return `  ${name}: ${value || "inherit"};`;
    }).join("\n")}\n}`;

    await navigator.clipboard.writeText(css);
    alert("CSS copied to clipboard!");
  };

  return (
    <div className="space-y-6">
      {/* Header with tabs */}
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">Theme Builder</h2>
          <p className="text-slate-400 text-sm">
            Choose a preset theme or customize every color to your liking
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ThemedButton
            onClick={handleReset}
            className="text-sm px-4 py-2"
            variant="outline"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset
          </ThemedButton>
          <ThemedButton
            onClick={handleCopyCSS}
            className="text-sm px-4 py-2"
            variant="outline"
          >
            <Copy className="w-4 h-4 mr-2" />
            Copy CSS
          </ThemedButton>
          <ThemedButton
            onClick={handleExportCSS}
            className="text-sm px-4 py-2"
            variant="outline"
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSS
          </ThemedButton>
          <ThemedButton
            onClick={handleExportJSON}
            className="text-sm px-4 py-2"
            variant="outline"
          >
            <Download className="w-4 h-4 mr-2" />
            Export JSON
          </ThemedButton>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-700">
        <button
          onClick={() => setActiveTab("presets")}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === "presets"
              ? "text-purple-400 border-b-2 border-purple-400"
              : "text-slate-400 hover:text-white"
          }`}
        >
          Preset Themes
        </button>
        <button
          onClick={() => setActiveTab("custom")}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === "custom"
              ? "text-purple-400 border-b-2 border-purple-400"
              : "text-slate-400 hover:text-white"
          }`}
        >
          Custom Editor
        </button>
      </div>

      {/* Preset Themes */}
      {activeTab === "presets" && (
        <NeonCard className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {THEMES.map((theme) => {
              const isSelected = isMounted && selectedTheme === theme.key;
              return (
                <button
                  key={theme.key}
                  onClick={() => setSelectedTheme(theme.key)}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    isSelected
                      ? "border-purple-500 bg-purple-500/10"
                      : "border-slate-600 hover:border-slate-500 bg-slate-800/30"
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <Palette className="w-5 h-5 text-slate-400" />
                    <span className="font-semibold text-white">
                      {theme.label}
                    </span>
                  </div>
                  {isSelected && (
                    <span className="text-xs text-purple-400">Active</span>
                  )}
                </button>
              );
            })}
          </div>
        </NeonCard>
      )}

      {/* Custom Editor */}
      {activeTab === "custom" && (
        <div className="space-y-6">
          {Object.entries(groupedVariables).map(([category, variables]) => (
            <NeonCard key={category} className="p-6">
              <h3 className="text-lg font-semibold text-white mb-4">
                {category}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {variables.map((variable) => (
                  <div key={variable.name} className="space-y-2">
                    <label className="text-sm text-slate-300 block">
                      {variable.label}
                    </label>
                    {variable.isNumber ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.01"
                          value={customValues[variable.name] || "0.625"}
                          onChange={(e) =>
                            handleCustomChange(variable.name, e.target.value)
                          }
                          className="flex-1 px-3 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                        <span className="text-xs text-slate-400">rem</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={customValues[variable.name] || "#ffffff"}
                          onChange={(e) =>
                            handleCustomChange(variable.name, e.target.value)
                          }
                          className="w-12 h-10 rounded border border-slate-600 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={customValues[variable.name] || "#ffffff"}
                          onChange={(e) =>
                            handleCustomChange(variable.name, e.target.value)
                          }
                          className="flex-1 px-3 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-500"
                          placeholder="#ffffff"
                        />
                      </div>
                    )}
                    <div className="text-xs text-slate-500 font-mono">
                      {variable.name}
                    </div>
                  </div>
                ))}
              </div>
            </NeonCard>
          ))}
        </div>
      )}

      {/* Preview Section */}
      <NeonCard className="p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Live Preview</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="p-4 bg-[var(--background)] border border-[var(--border)] rounded-lg">
              <div className="text-[var(--foreground)] mb-2">
                Background & Foreground
              </div>
              <div className="px-3 py-2 bg-[var(--primary)] text-[var(--primary-foreground)] rounded inline-block">
                Primary Button
              </div>
            </div>
            <div className="p-4 bg-[var(--card)] border border-[var(--border)] rounded-lg">
              <div className="text-[var(--card-foreground)]">
                Card Component
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <div className="p-4 bg-gradient-to-r from-[var(--gradient-from)] to-[var(--gradient-to)] rounded-lg">
              <div className="text-white font-semibold">Gradient Preview</div>
            </div>
            <div className="flex gap-2">
              <div
                className="flex-1 h-12 rounded"
                style={{ backgroundColor: `var(--accent-1-m)` }}
              />
              <div
                className="flex-1 h-12 rounded"
                style={{ backgroundColor: `var(--accent-2-m)` }}
              />
              <div
                className="flex-1 h-12 rounded"
                style={{ backgroundColor: `var(--accent-mix)` }}
              />
            </div>
            <div className="text-xs text-slate-400 text-center">
              Accent 1 • Accent 2 • Accent Mix
            </div>
          </div>
        </div>
      </NeonCard>
    </div>
  );
};
