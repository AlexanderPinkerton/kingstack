"use client";

import { useState } from "react";
import {
  Check,
  Code2,
  Copy,
  Layers3,
  Palette,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Zap,
} from "lucide-react";
import { observer } from "mobx-react-lite";
import { browserLogger } from "@/lib/browser-logger";
import { ThemePreview } from "./theme-preview";
import {
  THEME_PRESETS,
  ThemeLabStore,
  type ThemeColorKey,
  type ThemeDensity,
} from "./theme-lab-store";

const logger = browserLogger.child({ component: "ThemeBuilder" });

const COLOR_CONTROLS: readonly {
  key: ThemeColorKey;
  label: string;
  token: string;
}[] = [
  { key: "accentOne", label: "Signal", token: "--accent-1-m" },
  { key: "accentTwo", label: "Depth", token: "--accent-2-m" },
  { key: "background", label: "Canvas", token: "--background" },
  { key: "surface", label: "Surface", token: "--card" },
  { key: "foreground", label: "Text", token: "--foreground" },
] as const;

const ColorControl = observer(function ColorControl({
  store,
  colorKey,
  label,
  token,
}: {
  store: ThemeLabStore;
  colorKey: ThemeColorKey;
  label: string;
  token: string;
}) {
  const value = store.palette[colorKey];

  return (
    <label className="group flex cursor-pointer items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.025] p-2.5 transition hover:border-white/20 hover:bg-white/[0.045]">
      <span
        className="relative size-9 shrink-0 overflow-hidden rounded-lg border border-white/15 shadow-lg"
        style={{ backgroundColor: value }}
      >
        <input
          type="color"
          value={value}
          onChange={(event) => store.setColor(colorKey, event.target.value)}
          aria-label={`Change ${label}`}
          className="absolute inset-0 size-full cursor-pointer opacity-0"
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-medium text-white/75">{label}</span>
        <span className="mt-0.5 block truncate font-mono text-[0.58rem] text-white/30">
          {token}
        </span>
      </span>
      <span className="font-mono text-[0.58rem] uppercase text-white/30">
        {value}
      </span>
    </label>
  );
});

const PresetPicker = observer(function PresetPicker({
  store,
}: {
  store: ThemeLabStore;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/35">
            Art direction
          </p>
          <p className="mt-1 text-xs leading-5 text-white/45">
            Same components, four different systems.
          </p>
        </div>
        <Palette className="size-4 text-[#a89cff]" aria-hidden="true" />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {THEME_PRESETS.map((preset) => {
          const selected = preset.id === store.selectedPresetId;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => store.selectPreset(preset.id)}
              aria-pressed={selected}
              className={`rounded-xl border p-3 text-left transition ${
                selected
                  ? "border-white/30 bg-white/[0.08]"
                  : "border-white/[0.08] bg-white/[0.025] hover:border-white/20"
              }`}
            >
              <span className="flex -space-x-1.5">
                {[
                  preset.palette.background,
                  preset.palette.surface,
                  preset.palette.accentOne,
                  preset.palette.accentTwo,
                ].map((color) => (
                  <span
                    key={color}
                    className="size-5 rounded-full border-2 border-[#111216]"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </span>
              <span className="mt-3 flex items-center gap-1.5 text-xs font-medium text-white/75">
                {preset.name}
                {selected && (
                  <Check className="size-3 text-[#d8ff70]" aria-hidden="true" />
                )}
              </span>
              <span className="mt-1 block text-[0.58rem] leading-4 text-white/30">
                {preset.description}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
});

function RangeControl({
  label,
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="flex items-center justify-between text-xs">
        <span className="font-medium text-white/65">{label}</span>
        <span className="font-mono text-[0.62rem] text-white/35">
          {value}
          {suffix}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-2 h-1.5 w-full cursor-pointer accent-[#d8ff70]"
      />
    </label>
  );
}

const DensityControl = observer(function DensityControl({
  store,
}: {
  store: ThemeLabStore;
}) {
  const options: readonly ThemeDensity[] = ["compact", "comfortable"];
  return (
    <div>
      <p className="text-xs font-medium text-white/65">Density</p>
      <div className="mt-2 grid grid-cols-2 rounded-lg border border-white/10 bg-black/20 p-1">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => store.setDensity(option)}
            className={`rounded-md px-2 py-1.5 text-[0.62rem] capitalize transition ${
              store.density === option
                ? "bg-white/10 text-white"
                : "text-white/35 hover:text-white/60"
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
});

const cascade = [
  {
    label: "Source tokens",
    value: "5 colors",
    detail: "Canvas · surface · text · two accents",
  },
  {
    label: "Derived aliases",
    value: "36 variables",
    detail: "Borders · muted text · charts · rings · gradients",
  },
  {
    label: "UI consumers",
    value: "One tree",
    detail: "Navigation · cards · controls · chart · statuses",
  },
] as const;

export const ThemeBuilder = observer(function ThemeBuilder() {
  const [store] = useState(() => new ThemeLabStore());
  const [copied, setCopied] = useState(false);

  async function copyCss(): Promise<void> {
    try {
      await navigator.clipboard.writeText(store.cssText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch (error) {
      logger.warn("theme.css_copy_failed", {
        reason: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-[#0c0d10] shadow-2xl shadow-black/30">
        <div className="grid min-w-0 lg:grid-cols-[19rem_minmax(0,1fr)]">
          <aside className="border-b border-white/10 bg-[#111216] p-4 sm:p-5 lg:border-b-0 lg:border-r">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-[#d8ff70]">
                  <Zap className="size-3.5" aria-hidden="true" />
                  Live token controls
                </div>
                <h2 className="mt-3 text-xl font-semibold tracking-[-0.035em]">
                  Direct the system.
                </h2>
              </div>
              {store.isCustomized && (
                <span className="rounded-full border border-[#d8ff70]/25 bg-[#d8ff70]/10 px-2 py-1 font-mono text-[0.55rem] uppercase text-[#d8ff70]">
                  {store.customizationCount} changed
                </span>
              )}
            </div>

            <div className="mt-6">
              <PresetPicker store={store} />
            </div>

            <div className="mt-6 border-t border-white/[0.08] pt-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/35">
                    Source tokens
                  </p>
                  <p className="mt-1 text-xs text-white/40">
                    Edit five values. Watch everything move.
                  </p>
                </div>
                <SlidersHorizontal
                  className="size-4 text-[#8ee8ff]"
                  aria-hidden="true"
                />
              </div>
              <div className="mt-3 space-y-2">
                {COLOR_CONTROLS.map((control) => (
                  <ColorControl
                    key={control.key}
                    store={store}
                    colorKey={control.key}
                    label={control.label}
                    token={control.token}
                  />
                ))}
              </div>
            </div>

            <div className="mt-6 space-y-5 border-t border-white/[0.08] pt-5">
              <RangeControl
                label="Corner language"
                value={store.radius}
                min={0}
                max={28}
                suffix="px"
                onChange={(value) => store.setRadius(value)}
              />
              <RangeControl
                label="Ambient glow"
                value={store.glow}
                min={0}
                max={70}
                suffix="%"
                onChange={(value) => store.setGlow(value)}
              />
              <DensityControl store={store} />
            </div>

            <div className="mt-6 grid grid-cols-2 gap-2 border-t border-white/[0.08] pt-5">
              <button
                type="button"
                onClick={() => store.reset()}
                disabled={!store.isCustomized}
                className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.035] px-3 text-xs text-white/55 transition hover:bg-white/[0.07] hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
              >
                <RotateCcw className="size-3.5" aria-hidden="true" />
                Reset
              </button>
              <button
                type="button"
                onClick={() => void copyCss()}
                className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg bg-[#d8ff70] px-3 text-xs font-semibold text-[#11130d] transition hover:bg-[#e3ff98]"
              >
                {copied ? (
                  <Check className="size-3.5" aria-hidden="true" />
                ) : (
                  <Copy className="size-3.5" aria-hidden="true" />
                )}
                {copied ? "Copied" : "Copy CSS"}
              </button>
            </div>
          </aside>

          <div className="min-w-0 bg-[#090a0c] p-4 sm:p-6">
            <ThemePreview store={store} />
          </div>
        </div>
      </section>

      <section className="grid overflow-hidden rounded-2xl border border-white/10 bg-[#111216]/85 lg:grid-cols-[1fr_1.15fr]">
        <div className="border-b border-white/10 p-5 sm:p-6 lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#a89cff]">
            <Layers3 className="size-4" aria-hidden="true" />
            The cascade
          </div>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em]">
            Five colors. An entire interface.
          </h2>
          <p className="mt-3 max-w-lg text-sm leading-6 text-white/45">
            Components never receive theme props. They consume semantic CSS
            variables, and the browser resolves the graph instantly at the
            scoped boundary.
          </p>

          <div className="mt-6 grid gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            {cascade.map((step, index) => (
              <div
                key={step.label}
                className="relative rounded-xl border border-white/[0.08] bg-white/[0.025] p-3"
              >
                <span className="font-mono text-[0.58rem] text-[#d8ff70]">
                  0{index + 1}
                </span>
                <p className="mt-2 text-xs font-medium text-white/75">
                  {step.label}
                </p>
                <p className="mt-1 text-lg font-semibold tracking-[-0.03em]">
                  {step.value}
                </p>
                <p className="mt-2 text-[0.62rem] leading-4 text-white/30">
                  {step.detail}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="min-w-0 bg-[#090a0c] p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-white/40">
              <Code2 className="size-3.5" aria-hidden="true" />
              Generated CSS
            </div>
            <span className="inline-flex items-center gap-1.5 text-[0.62rem] text-[#8ee8ff]">
              <Sparkles className="size-3" aria-hidden="true" />
              {store.selectedPreset.name}
              {store.isCustomized ? " · modified" : ""}
            </span>
          </div>
          <pre className="mt-4 max-h-[23rem] overflow-auto rounded-xl border border-white/[0.08] bg-black/35 p-4 text-[0.68rem] leading-5 text-white/55">
            <code>{store.cssText}</code>
          </pre>
        </div>
      </section>
    </div>
  );
});
