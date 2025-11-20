import type { CSSProperties } from "react";

export type ThemeStyleVariant =
  | "box"
  | "neo-brutalist"
  | "neomorphism"
  | "glassmorphism";

export type ThemeStyleDefinition = {
  id: ThemeStyleVariant;
  label: string;
  heroWrapperClass?: string;
  headerBandClass?: string;
  panelClass?: string;
  heroPanelClass?: string;
  dockWrapperClass?: string;
  dockButtonClass?: string;
  extraCss?: string;
  previewStyleOverrides?: (
    palette: Record<string, string>,
  ) => CSSProperties;
};

const neoBrutalistCss = `
        [data-style="neo-brutalist"] {
          position: relative;
          isolation: isolate;
          background-image: linear-gradient(
            180deg,
            rgba(0, 0, 0, 0.03),
            rgba(0, 0, 0, 0.08)
          );
        }
        [data-style="neo-brutalist"]::before {
          content: "";
          position: fixed;
          inset: 0;
          pointer-events: none;
          opacity: 0.12;
          background-image:
            radial-gradient(circle at 1px 1px, rgba(0, 0, 0, 0.35) 1px, transparent 0),
            repeating-linear-gradient(
              45deg,
              rgba(255, 255, 255, 0.08),
              rgba(255, 255, 255, 0.08) 6px,
              transparent 6px,
              transparent 12px
            );
          background-size: 120px 120px, 140px 140px;
          mix-blend-mode: multiply;
          z-index: -1;
        }
        [data-theme-lab="true"][data-style="neo-brutalist"] [data-slot="card"],
        [data-theme-lab="true"][data-style="neo-brutalist"] section.rounded-3xl {
          border-radius: max(calc(var(--lab-radius, 18px) * 0.12), 4px);
          border: 4px solid var(--color-outline, rgba(0, 0, 0, 0.75));
          box-shadow:
            var(--lab-shadow, 6px 6px 0 rgba(0, 0, 0, 0.4)),
            inset 0 0 0 2px var(--color-outline-variant, rgba(0, 0, 0, 0.2));
        }
        [data-theme-lab="true"][data-style="neo-brutalist"] [data-slot="button"],
        [data-theme-lab="true"][data-style="neo-brutalist"] button[data-slot="button"] {
          border-radius: max(calc(var(--lab-radius, 18px) * 0.08), 2px);
          border-width: 2px;
          border-color: var(--color-outline, rgba(0, 0, 0, 0.85));
          box-shadow: 4px 4px 0 rgba(0, 0, 0, 0.35);
          transform: translate(-2px, -2px);
          transition: transform 120ms ease, box-shadow 120ms ease,
            border-color 120ms ease;
        }
        [data-theme-lab="true"][data-style="neo-brutalist"] [data-slot="input"],
        [data-theme-lab="true"][data-style="neo-brutalist"] [data-slot="badge"],
        [data-theme-lab="true"][data-style="neo-brutalist"] select,
        [data-theme-lab="true"][data-style="neo-brutalist"] textarea {
          border-radius: max(calc(var(--lab-radius, 18px) * 0.08), 2px);
          border-width: 3px;
          border-color: var(--color-outline, rgba(0, 0, 0, 0.65));
          box-shadow: none;
        }
        [data-theme-lab="true"][data-style="neo-brutalist"] [data-slot="button"]:hover,
        [data-style="neo-brutalist"] button[data-slot="button"]:hover {
          transform: translate(-3px, -3px);
          box-shadow: 6px 6px 0 rgba(0, 0, 0, 0.4);
          border-color: var(--color-outline-variant, rgba(0, 0, 0, 0.9));
        }
        [data-theme-lab="true"][data-style="neo-brutalist"] [data-slot="button"]:active,
        [data-style="neo-brutalist"] button[data-slot="button"]:active {
          transform: translate(0, 0);
          box-shadow: 2px 2px 0 rgba(0, 0, 0, 0.35);
        }
        .brutalist-hero {
          border: 5px solid var(--color-outline, rgba(0, 0, 0, 0.8));
          padding: 1.5rem;
          box-shadow: 10px 10px 0 rgba(0, 0, 0, 0.45);
          background: linear-gradient(
              135deg,
              rgba(255, 255, 255, 0.12),
              transparent 60%
            ),
            var(--color-surface, #fff);
        }
        .brutalist-banner {
          background: linear-gradient(
            90deg,
            var(--color-primary),
            var(--color-secondary)
          );
          padding: 0.25rem 0.5rem;
          border: 2px solid var(--color-outline, rgba(0, 0, 0, 0.8));
          box-shadow: 4px 4px 0 rgba(0, 0, 0, 0.4);
        }
        .brutalist-panel {
          background: linear-gradient(
              135deg,
              rgba(255, 255, 255, 0.1),
              transparent 45%
            ),
            var(--color-surface, #fff);
          position: relative;
          overflow: hidden;
        }
        .brutalist-panel::after {
          content: "";
          position: absolute;
          inset: 0;
          background-image: repeating-linear-gradient(
            135deg,
            rgba(0, 0, 0, 0.04),
            rgba(0, 0, 0, 0.04) 8px,
            transparent 8px,
            transparent 16px
          );
          opacity: 0.35;
          pointer-events: none;
        }
`;

const neomorphismCss = `
        [data-style="neomorphism"] {
          background: linear-gradient(180deg, #f9fafc, #edf1f7 60%, #e3e8f0);
        }
        [data-style="neomorphism"]::before {
          content: "";
          position: fixed;
          inset: 0;
          pointer-events: none;
          background: radial-gradient(circle at 20% 20%, rgba(255, 255, 255, 0.35), transparent 45%);
          opacity: 0.6;
          z-index: -1;
        }
        [data-style="neomorphism"] [data-slot="card"],
        [data-style="neomorphism"] section.rounded-3xl {
          border-radius: calc(var(--lab-radius, 18px) + 20px);
          border: 1px solid rgba(255, 255, 255, 0.4);
          background: linear-gradient(145deg, rgba(255, 255, 255, 0.96), rgba(210, 210, 210, 0.2));
          box-shadow:
            -6px -6px 16px rgba(255, 255, 255, 0.75),
            6px 6px 16px rgba(0, 0, 0, 0.08);
        }
        .neomorph-panel--flat {
          box-shadow: none !important;
          border: 1px solid rgba(255, 255, 255, 0.6) !important;
        }
        [data-style="neomorphism"] [data-slot="button"],
        [data-style="neomorphism"] button[data-slot="button"] {
          border-radius: 4px;
          border: none;
          background: #f4f4f4;
          color: var(--foreground);
          box-shadow:
            inset 0.5px 0.5px 1px rgba(255, 255, 255, 0.9),
            inset -0.5px -0.5px 1px rgba(0, 0, 0, 0.12),
            0.45px 0.45px 0.63px rgba(0, 0, 0, 0.18),
            2px 2px 6px rgba(0, 0, 0, 0.12),
            -1px -1px 4px rgba(255, 255, 255, 0.6);
          transition: box-shadow 200ms cubic-bezier(0.4, 0, 0.2, 1),
            transform 200ms cubic-bezier(0.4, 0, 0.2, 1);
        }
        [data-style="neomorphism"] [data-slot="button"].bg-primary,
        [data-style="neomorphism"] button[data-slot="button"].bg-primary {
          background: hsl(var(--primary));
          color: hsl(var(--primary-foreground));
          box-shadow:
            inset 0.5px 0.5px 1px rgba(255, 255, 255, 0.6),
            inset -0.5px -0.5px 1px rgba(0, 0, 0, 0.12),
            0.45px 0.45px 0.63px rgba(0, 0, 0, 0.18),
            2px 2px 6px rgba(0, 0, 0, 0.12),
            -1px -1px 4px rgba(255, 255, 255, 0.5);
        }
        [data-style="neomorphism"] [data-slot="button"]:hover,
        [data-style="neomorphism"] button[data-slot="button"]:hover {
          box-shadow:
            inset 0.5px 0.5px 1px rgba(255, 255, 255, 0.9),
            inset -0.5px -0.5px 1px rgba(0, 0, 0, 0.12),
            1px 1px 2px rgba(0, 0, 0, 0.18),
            4px 4px 8px rgba(0, 0, 0, 0.15),
            -2px -2px 6px rgba(255, 255, 255, 0.8);
          transform: translateY(-1px);
        }
        [data-style="neomorphism"] [data-slot="button"]:active,
        [data-style="neomorphism"] button[data-slot="button"]:active {
          box-shadow:
            inset 3px 3px 6px rgba(0, 0, 0, 0.18),
            inset -2px -2px 6px rgba(255, 255, 255, 0.8);
          transform: translateY(0);
        }
        [data-style="neomorphism"] [data-slot="input"],
        [data-style="neomorphism"] [data-slot="badge"],
        [data-style="neomorphism"] select,
        [data-style="neomorphism"] textarea {
          border-radius: 12px;
          border: none;
          background: #f4f4f4;
          padding: 1rem;
          box-shadow:
            inset 0.5px 0.5px 1px rgba(255, 255, 255, 0.9),
            inset -0.5px -0.5px 1px rgba(0, 0, 0, 0.12),
            inset 0 1px 1.5px rgba(0, 0, 0, 0.1);
          font-size: 14px;
        }
        .neomorph-hero {
          border-radius: calc(var(--lab-radius, 18px) + 30px);
          padding: 2rem;
          background: radial-gradient(circle at top left, rgba(255, 255, 255, 0.9), rgba(200, 200, 200, 0.3));
          box-shadow:
            -20px -20px 40px rgba(255, 255, 255, 0.9),
            20px 20px 40px rgba(0, 0, 0, 0.12);
        }
        .neomorph-banner {
          border-radius: calc(var(--lab-radius, 18px) + 16px);
          background: radial-gradient(circle, rgba(255, 255, 255, 0.9), rgba(200, 200, 200, 0.4));
          padding: 0.4rem 0.8rem;
          box-shadow:
            -6px -6px 14px rgba(255, 255, 255, 0.8),
            6px 6px 14px rgba(0, 0, 0, 0.1);
        }
        .neomorph-panel {
          border-radius: calc(var(--lab-radius, 18px) + 24px);
          background: linear-gradient(160deg, rgba(255, 255, 255, 0.97), rgba(226, 230, 236, 0.5));
          box-shadow:
            -6px -6px 16px rgba(255, 255, 255, 0.75),
            6px 6px 16px rgba(0, 0, 0, 0.08);
        }
        .neomorph-dock {
          position: fixed;
          bottom: 2.5rem;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          gap: 1rem;
          padding: 0.75rem 1.75rem;
          border-radius: 999px;
          background: linear-gradient(145deg, rgba(255, 255, 255, 0.9), rgba(230, 230, 230, 0.4));
          box-shadow:
            -12px -12px 30px rgba(255, 255, 255, 0.9),
            12px 12px 30px rgba(0, 0, 0, 0.15);
          z-index: 45;
        }
        .neomorph-dock-button {
          border-radius: 4px;
          border: none;
          box-shadow:
            -4px -4px 12px rgba(255, 255, 255, 0.8),
            4px 4px 12px rgba(0, 0, 0, 0.1);
          background: #f8f9fb;
          color: var(--foreground);
        }
        .neomorph-dock-button:hover {
          transform: translateY(-1px);
          box-shadow:
            -3px -3px 10px rgba(255, 255, 255, 0.85),
            3px 3px 10px rgba(0, 0, 0, 0.12);
        }
        .neomorph-dock-button:active {
          transform: translateY(0);
          box-shadow:
            inset 2px 2px 6px rgba(0, 0, 0, 0.15),
            inset -2px -2px 6px rgba(255, 255, 255, 0.85);
        }
`;

const glassmorphismCss = `
        [data-style="glassmorphism"] {
          --glass-backdrop-default:
            radial-gradient(
              circle at 12% 25%,
              color-mix(in srgb, var(--color-surface) 65%, transparent),
              transparent 55%
            ),
            radial-gradient(
              circle at 85% 10%,
              color-mix(in srgb, var(--color-primary) 35%, transparent),
              transparent 60%
            ),
            linear-gradient(
              180deg,
              color-mix(in srgb, var(--color-surface) 80%, var(--color-inverse-surface)),
              color-mix(in srgb, var(--color-inverse-surface) 70%, var(--color-surface) 30%)
            );
          background: var(--glass-backdrop, var(--glass-backdrop-default));
          min-height: 100vh;
        }
        [data-style="glassmorphism"]::before {
          content: "";
          position: fixed;
          inset: 0;
          background-image:
            radial-gradient(circle at 20% 20%, rgba(255, 255, 255, 0.14), transparent 38%),
            radial-gradient(circle at 80% 5%, rgba(255, 255, 255, 0.08), transparent 40%);
          pointer-events: none;
          filter: blur(6px);
        }
        [data-style="glassmorphism"] [data-slot="card"],
        [data-style="glassmorphism"] section.rounded-3xl {
          position: relative;
          overflow: hidden;
          border-radius: calc(var(--lab-radius, 18px) + 24px);
          border: 1px solid rgba(255, 255, 255, 0.3);
          background: rgba(255, 255, 255, 0.22);
          box-shadow:
            0 8px 32px rgba(0, 0, 0, 0.1),
            inset 0 1px 0 rgba(255, 255, 255, 0.5),
            inset 0 -1px 0 rgba(255, 255, 255, 0.1),
            inset 0 0 26px 13px rgba(255, 255, 255, 0.13);
          backdrop-filter: blur(25px);
          -webkit-backdrop-filter: blur(25px);
          color: var(--color-on-surface);
        }
        [data-style="glassmorphism"] [data-slot="card"]::before,
        [data-style="glassmorphism"] section.rounded-3xl::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.8),
            transparent
          );
        }
        [data-style="glassmorphism"] [data-slot="card"]::after,
        [data-style="glassmorphism"] section.rounded-3xl::after {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          width: 1px;
          height: 100%;
          background: linear-gradient(
            180deg,
            rgba(255, 255, 255, 0.8),
            transparent,
            rgba(255, 255, 255, 0.3)
          );
        }
        [data-style="glassmorphism"] [data-slot="button"],
        [data-style="glassmorphism"] button[data-slot="button"] {
          border-radius: calc(var(--lab-radius, 18px) * 0.65);
          border: 1px solid rgba(255, 255, 255, 0.35);
          background: rgba(255, 255, 255, 0.22);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          color: var(--color-on-surface, #0f172a);
          box-shadow:
            0 10px 28px rgba(15, 23, 42, 0.25),
            inset 0 1px 0 rgba(255, 255, 255, 0.6),
            inset 0 -1px 0 rgba(255, 255, 255, 0.08);
        }
        [data-style="glassmorphism"] [data-slot="button"].bg-primary,
        [data-style="glassmorphism"] button[data-slot="button"].bg-primary {
          border-color: rgba(255, 255, 255, 0.45);
          background: linear-gradient(
            130deg,
            color-mix(in srgb, var(--color-primary) 65%, rgba(255, 255, 255, 0.25)),
            color-mix(in srgb, var(--color-primary) 30%, transparent)
          );
          color: var(--color-on-primary, #f8fafc);
        }
        [data-style="glassmorphism"] [data-slot="button"]:hover,
        [data-style="glassmorphism"] button[data-slot="button"]:hover {
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.65),
            0 18px 50px color-mix(in srgb, var(--color-inverse-surface) 45%, transparent);
          transform: translateY(-1px);
        }
        [data-style="glassmorphism"] [data-slot="input"],
        [data-style="glassmorphism"] [data-slot="badge"],
        [data-style="glassmorphism"] select,
        [data-style="glassmorphism"] textarea {
          border-radius: calc(var(--lab-radius, 18px) * 0.6);
          border: 1px solid color-mix(in srgb, var(--color-on-surface) 25%, transparent);
          background: color-mix(in srgb, var(--color-surface) 25%, transparent);
          backdrop-filter: blur(18px);
          color: var(--color-on-surface, #f8fafc);
        }
        .glass-hero {
          border-radius: calc(var(--lab-radius, 18px) + 40px);
          background: linear-gradient(
              120deg,
              color-mix(in srgb, var(--color-surface) 35%, rgba(255, 255, 255, 0.2)),
              color-mix(in srgb, var(--color-surface) 20%, transparent)
            );
          border: 1px solid color-mix(in srgb, var(--color-on-surface) 30%, transparent);
          box-shadow:
            0 30px 80px color-mix(in srgb, var(--color-inverse-surface) 60%, transparent),
            inset 0 1px 0 rgba(255, 255, 255, 0.35);
        }
        .glass-banner {
          border-radius: 9999px;
          padding: 0.35rem 0.9rem;
          border: 1px solid color-mix(in srgb, var(--color-on-surface) 30%, transparent);
          background: color-mix(in srgb, var(--color-surface) 35%, transparent);
          backdrop-filter: blur(12px);
        }
        .glass-panel {
          border-radius: calc(var(--lab-radius, 18px) + 28px);
          border: 1px solid color-mix(in srgb, var(--color-on-surface) 25%, transparent);
          background: linear-gradient(
            145deg,
            color-mix(in srgb, var(--color-surface) 35%, transparent),
            color-mix(in srgb, var(--color-inverse-surface) 45%, transparent)
          );
          color: var(--color-on-surface);
        }
        .glass-dock {
          position: fixed;
          bottom: 2rem;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          gap: 1rem;
          padding: 0.5rem 1.5rem;
          border-radius: 999px;
          border: 1px solid color-mix(in srgb, var(--color-on-surface) 25%, transparent);
          background: color-mix(in srgb, var(--color-inverse-surface) 45%, transparent);
          backdrop-filter: blur(24px);
          box-shadow: 0 20px 60px color-mix(in srgb, var(--color-inverse-surface) 55%, transparent);
        }
        .glass-dock-button {
          border-radius: 999px;
          background: color-mix(in srgb, var(--color-surface) 35%, transparent);
          border: 1px solid color-mix(in srgb, var(--color-on-surface) 25%, transparent);
          color: var(--color-on-surface);
        }
`;

export const STYLE_DEFINITIONS: Record<
  ThemeStyleVariant,
  ThemeStyleDefinition
> = {
  box: {
    id: "box",
    label: "Box",
  },
  "neo-brutalist": {
    id: "neo-brutalist",
    label: "Neo-Brutalist",
    heroWrapperClass: "brutalist-hero",
    headerBandClass: "brutalist-banner",
    panelClass: "brutalist-panel",
    extraCss: neoBrutalistCss,
  },
  neomorphism: {
    id: "neomorphism",
    label: "Neomorphism",
    heroWrapperClass: "neomorph-hero",
    headerBandClass: "neomorph-banner",
    panelClass: "neomorph-panel",
    heroPanelClass: "neomorph-panel--flat",
    dockWrapperClass: "neomorph-dock",
    dockButtonClass: "neomorph-dock-button",
    extraCss: neomorphismCss,
    previewStyleOverrides: () => ({
      ["--color-surface" as keyof CSSProperties]: "#f4f6fa",
      ["--color-surface-elevated" as keyof CSSProperties]: "#f7f8fb",
      ["--color-surface-dim" as keyof CSSProperties]: "#eceff3",
      ["--color-surface-bright" as keyof CSSProperties]: "#ffffff",
    }),
  },
  glassmorphism: {
    id: "glassmorphism",
    label: "Glassmorphism",
    heroWrapperClass: "glass-hero",
    headerBandClass: "glass-banner",
    panelClass: "glass-panel",
    heroPanelClass: "glass-panel",
    dockWrapperClass: "glass-dock",
    dockButtonClass: "glass-dock-button",
    extraCss: glassmorphismCss,
  },
};
