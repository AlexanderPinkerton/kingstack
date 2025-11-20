import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MutableRefObject,
} from "react";

import { stats, transactions, notifications, team } from "../data/mock-data";
import {
  COLOR_VARIABLES,
  EXTRA_COLOR_TOKENS,
  DEFAULT_RADIUS,
  type ColorVariable,
} from "../data/color-tokens";
import {
  FONT_OPTIONS,
  DEFAULT_FONT_ID,
  type FontOption,
} from "../data/fonts";
import {
  SHADOW_PRESETS,
  DEFAULT_SHADOW_ID,
  type ShadowPreset,
} from "../data/shadow-presets";
import {
  THEME_FILES,
  type ThemeFile,
} from "../data/theme-files";
import {
  SURFACE_SHADE_PRESETS,
  type SurfaceShadePreset,
} from "../data/surface-presets";
import {
  colorToHex,
  getReadableTextColor,
} from "../lib/color-utils";
import {
  STYLE_DEFINITIONS,
  type ThemeStyleDefinition,
  type ThemeStyleVariant,
} from "../styles";

type Mode = "light" | "dark";

type PaletteEntry = {
  variable: ColorVariable;
  value: string;
  isOverride: boolean;
};

export type ThemeLabController = {
  variant: ThemeStyleVariant;
  styleDefinition: ThemeStyleDefinition;
  styleLabel: string;
  heroWrapperClass?: string;
  headerBandClass?: string;
  panelClass?: string;
  heroPanelClass?: string;
  dockWrapperClass?: string;
  dockButtonClass?: string;
  extraCss?: string;
  mode: Mode;
  setMode: (mode: Mode) => void;
  themeFiles: ThemeFile[];
  themeClass: string;
  setThemeClass: (next: string) => void;
  activeTheme?: ThemeFile;
  paletteValues: Record<string, string>;
  paletteList: PaletteEntry[];
  palettePickerTarget: ColorVariable | null;
  setPalettePickerTarget: (value: ColorVariable | null) => void;
  variableOverrides: Partial<Record<ColorVariable, string>>;
  setColorOverride: (target: ColorVariable, value: string) => void;
  assignVariable: (target: ColorVariable, source: ColorVariable) => void;
  resetVariable: (target: ColorVariable) => void;
  resetAllOverrides: () => void;
  previewRef: MutableRefObject<HTMLElement | null>;
  previewStyle: CSSProperties;
  colorStyle: CSSProperties;
  layoutStyle: CSSProperties;
  fontOption: FontOption;
  fontPreset: string;
  setFontPreset: (next: string) => void;
  cycleFontPreset: (direction: number) => void;
  shadowOption: ShadowPreset;
  shadowPreset: string;
  setShadowPreset: (value: string) => void;
  radius: number;
  setRadius: (value: number) => void;
  successToastStyle: CSSProperties;
  warningToastStyle: CSSProperties;
  errorToastStyle: CSSProperties;
  resetLayoutControls: () => void;
  isLayoutDefault: boolean;
  stats: typeof stats;
  transactions: typeof transactions;
  notifications: typeof notifications;
  team: typeof team;
  inProgress: string[];
  setSurfaceColor: (value: string) => void;
  setSurfaceElevatedColor: (value: string) => void;
  resetSurfaceTones: () => void;
  surfaceOverrides: Record<string, string>;
  getSurfaceStyle: (id: string) => CSSProperties | undefined;
  surfaceShadePresets: SurfaceShadePreset[];
  resolvedSurfaceOptions: { label: string; value: string }[];
  resolvedSurfacePaletteColor: string;
  resolvedSurfacePaletteHex: string;
  resolvedPrimaryColor: string;
  resolvedPrimaryOnColor: string;
  resolvedSecondaryColor: string;
  resolvedSecondaryOnColor: string;
};

export function useThemeLabController(
  variant: ThemeStyleVariant = "box",
): ThemeLabController {
  const [mode, setMode] = useState<Mode>("light");
  const [themeClass, setThemeClass] = useState(
    THEME_FILES[0]?.className ?? "",
  );
  const [variableOverrides, setVariableOverrides] = useState<
    Partial<Record<ColorVariable, string>>
  >({});
  const [paletteValues, setPaletteValues] = useState<
    Record<string, string>
  >({});
  const [palettePickerTarget, setPalettePickerTarget] =
    useState<ColorVariable | null>(null);
  const [radius, setRadius] = useState(DEFAULT_RADIUS);
  const [fontPreset, setFontPreset] = useState(DEFAULT_FONT_ID);
  const [shadowPreset, setShadowPreset] = useState(DEFAULT_SHADOW_ID);
  const [surfaceOverrides, setSurfaceOverrides] = useState<
    Record<string, string>
  >({});
  const previewRef = useRef<HTMLElement | null>(null);

  const styleDefinition =
    STYLE_DEFINITIONS[variant] ?? STYLE_DEFINITIONS["box"];

  const activeTheme = THEME_FILES.find(
    (theme) => theme.className === themeClass,
  );
  const fontOption = useMemo(
    () =>
      FONT_OPTIONS.find((option) => option.id === fontPreset) ??
      FONT_OPTIONS[0],
    [fontPreset],
  );
  const shadowOption = useMemo(
    () =>
      SHADOW_PRESETS.find((preset) => preset.id === shadowPreset) ??
      SHADOW_PRESETS[0],
    [shadowPreset],
  );

  const cycleFontPreset = useCallback(
    (direction: number) => {
      const index = FONT_OPTIONS.findIndex(
        (option) => option.id === fontPreset,
      );
      const nextIndex =
        (index + direction + FONT_OPTIONS.length) % FONT_OPTIONS.length;
      const nextFont = FONT_OPTIONS[nextIndex] ?? FONT_OPTIONS[0];
      setFontPreset(nextFont.id);
    },
    [fontPreset],
  );

  const inProgress = useMemo(
    () =>
      transactions
        .filter((item) => item.status === "In review")
        .map((item) => item.name),
    [],
  );

  const getSurfaceStyle = useCallback(
    (id: string): CSSProperties | undefined => {
      const value = surfaceOverrides[id];
      return value ? { backgroundColor: value } : undefined;
    },
    [surfaceOverrides],
  );

  useEffect(() => {
    if (typeof document === "undefined") return;
    FONT_OPTIONS.forEach((option) => {
      if (!option.cssPath) return;
      if (
        document.head.querySelector<HTMLLinkElement>(
          `link[data-font-css="${option.cssPath}"]`,
        )
      ) {
        return;
      }
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = option.cssPath;
      link.dataset.fontCss = option.cssPath;
      document.head.appendChild(link);
    });
  }, []);

  useEffect(() => {
    if (!previewRef.current) return;
    const element = previewRef.current;
    const raf = window.requestAnimationFrame(() => {
      const computed = getComputedStyle(element);
      const nextValues: Partial<Record<ColorVariable, string>> = {};
      const tokens = [...COLOR_VARIABLES, ...EXTRA_COLOR_TOKENS];
      tokens.forEach((variable) => {
        const value = computed.getPropertyValue(variable).trim();
        if (value) {
          nextValues[variable] = value;
        }
      });
      setPaletteValues(nextValues);
    });
    return () => window.cancelAnimationFrame(raf);
  }, [themeClass, mode, variableOverrides]);

  const colorStyle = useMemo<CSSProperties>(() => {
    const entries = Object.entries(variableOverrides).filter(
      ([, value]) => value,
    ) as [string, string][];
    if (!entries.length) {
      return {};
    }
    const style: Record<string, string> = {};
    entries.forEach(([variable, value]) => {
      style[variable] = value;
    });
    return style as CSSProperties;
  }, [variableOverrides]);

  const brutalistFontFamily = '"JetBrainsMono", var(--font-geist-sans)';
  const appliedFontFamily =
    variant === "neo-brutalist"
      ? brutalistFontFamily
      : fontOption.fontFamily;

  const layoutStyle = useMemo<CSSProperties>(
    () => ({
      ["--lab-radius" as keyof CSSProperties]: `${radius}px`,
      ["--lab-font" as keyof CSSProperties]: appliedFontFamily,
      ["--lab-shadow" as keyof CSSProperties]: shadowOption.value,
    }),
    [radius, appliedFontFamily, shadowOption],
  );

  const variantColorOverrides = useMemo<CSSProperties>(
    () => styleDefinition.previewStyleOverrides?.(paletteValues) ?? {},
    [styleDefinition, paletteValues],
  );

  const previewStyle = useMemo<CSSProperties>(
    () => ({
      ...layoutStyle,
      ...colorStyle,
      ...variantColorOverrides,
    }),
    [layoutStyle, colorStyle, variantColorOverrides],
  );

  const assignVariable = (target: ColorVariable, source: ColorVariable) => {
    const sourceValue = paletteValues[source];
    if (!sourceValue) return;
    setVariableOverrides((prev) => ({
      ...prev,
      [target]: sourceValue,
    }));
    setPalettePickerTarget(null);
  };

  const setColorOverride = (target: ColorVariable, value: string) => {
    setVariableOverrides((prev) => ({
      ...prev,
      [target]: value,
    }));
  };

  const resetVariable = (target: ColorVariable) => {
    setVariableOverrides((prev) => {
      if (!(target in prev)) return prev;
      const next = { ...prev };
      delete next[target];
      return next;
    });
  };

  const resetAllOverrides = () => setVariableOverrides({});

  const paletteList: PaletteEntry[] = COLOR_VARIABLES.map((variable) => ({
    variable,
    value: paletteValues[variable] ?? "",
    isOverride: Boolean(variableOverrides[variable]),
  }));

  const successToastStyle = useMemo(() => {
    const bg = paletteValues["--color-success"];
    const text = paletteValues["--color-on-success"];
    const border = paletteValues["--color-success-contrast"];
    return {
      background: bg,
      color: getReadableTextColor(bg, text),
      border: border ? `1px solid ${border}` : undefined,
    };
  }, [paletteValues]);

  const warningToastStyle = useMemo(() => {
    const bg = paletteValues["--color-warning"];
    const text = paletteValues["--color-on-warning"];
    const border = paletteValues["--color-warning-contrast"];
    return {
      background: bg,
      color: getReadableTextColor(bg, text),
      border: border ? `1px solid ${border}` : undefined,
    };
  }, [paletteValues]);

  const errorToastStyle = useMemo(() => {
    const bg = paletteValues["--color-error"];
    const text = paletteValues["--color-on-error"];
    const border = paletteValues["--color-error-contrast"];
    return {
      background: bg,
      color: getReadableTextColor(bg, text),
      border: border ? `1px solid ${border}` : undefined,
    };
  }, [paletteValues]);

  const resetLayoutControls = () => {
    setRadius(DEFAULT_RADIUS);
    setFontPreset(DEFAULT_FONT_ID);
    setShadowPreset(DEFAULT_SHADOW_ID);
  };

  const isLayoutDefault =
    radius === DEFAULT_RADIUS &&
    fontPreset === DEFAULT_FONT_ID &&
    shadowPreset === DEFAULT_SHADOW_ID;

  const setSurfaceColor = (value: string) =>
    setColorOverride("--color-surface", value);
  const setSurfaceElevatedColor = (value: string) =>
    setColorOverride("--color-surface-elevated", value);
  const resetSurfaceTones = () => {
    resetVariable("--color-surface");
    resetVariable("--color-surface-elevated");
  };

  const primaryColor =
    paletteValues["--color-primary"] || "hsl(var(--primary))";
  const primaryOnColor =
    paletteValues["--color-on-primary"] ||
    "hsl(var(--primary-foreground))";
  const secondaryColor =
    paletteValues["--color-secondary"] || "hsl(var(--secondary))";
  const secondaryOnColor =
    paletteValues["--color-on-secondary"] ||
    "hsl(var(--secondary-foreground))";

  return {
    variant,
    styleDefinition,
    styleLabel: styleDefinition.label,
    heroWrapperClass: styleDefinition.heroWrapperClass,
    headerBandClass: styleDefinition.headerBandClass,
    panelClass: styleDefinition.panelClass,
    heroPanelClass: styleDefinition.heroPanelClass,
    dockWrapperClass: styleDefinition.dockWrapperClass,
    dockButtonClass: styleDefinition.dockButtonClass,
    extraCss: styleDefinition.extraCss,
    mode,
    setMode,
    themeFiles: THEME_FILES,
    themeClass,
    setThemeClass,
    activeTheme,
    paletteValues,
    paletteList,
    palettePickerTarget,
    setPalettePickerTarget,
    variableOverrides,
    setColorOverride,
    assignVariable,
    resetVariable,
    resetAllOverrides,
    previewRef,
    previewStyle,
    colorStyle,
    layoutStyle,
    fontOption,
    fontPreset,
    setFontPreset,
    cycleFontPreset,
    shadowOption,
    shadowPreset,
    setShadowPreset,
    radius,
    setRadius,
    successToastStyle,
    warningToastStyle,
    errorToastStyle,
    resetLayoutControls,
    isLayoutDefault,
    stats,
    transactions,
    notifications,
    team,
    inProgress,
    setSurfaceColor,
    setSurfaceElevatedColor,
    resetSurfaceTones,
    surfaceOverrides,
    getSurfaceStyle,
    surfaceShadePresets: SURFACE_SHADE_PRESETS,
    resolvedPrimaryColor: primaryColor,
    resolvedPrimaryOnColor: primaryOnColor,
    resolvedSecondaryColor: secondaryColor,
    resolvedSecondaryOnColor: secondaryOnColor,
  };
}
