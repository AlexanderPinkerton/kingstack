"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
} from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Layers,
  SlidersHorizontal,
  Moon,
  Palette,
  Sparkles,
  Square,
  Sun,
} from "lucide-react";
import Link from "next/link";

import "./themes/adonis_rose_yellow.css";
import "./themes/apocalyptic_orange.css";
import "./themes/apricot_buff.css";
import "./themes/british_phone_booth.css";
import "./themes/island_light.css";
import "./themes/jade_glass.css";
import "./themes/crystal_green.css";
import "./themes/cyan_sky.css";
import "./themes/fountain.css";
import "./themes/koopa_green_shell.css";
import "./themes/thuja_green.css";
import "./themes/celtic_queen.css";
import "./themes/pinkman.css";
import "./themes/if_i_could_fly.css";
import "./themes/crop_circle.css";
import "./themes/apricot_sorbet.css";
import "./themes/mesa_sunrise.css";
import "./themes/james_blonde.css";
import "./themes/maya_blue.css";
import "./themes/miami_coral.css";
import "./themes/sky_dancer.css";
import "./themes/spectral_green.css";
import "./themes/yellow.css";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

const hexPattern = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

let sharedCanvasCtx: CanvasRenderingContext2D | null = null;

function getCanvasContext() {
  if (sharedCanvasCtx || typeof document === "undefined") return sharedCanvasCtx;
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  sharedCanvasCtx = canvas.getContext("2d");
  return sharedCanvasCtx;
}

function colorToHex(color: string) {
  if (!color) return "#000000";
  if (hexPattern.test(color)) {
    if (color.length === 4) {
      return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`.toLowerCase();
    }
    return color.toLowerCase();
  }
  const ctx = getCanvasContext();
  if (!ctx) return "#000000";
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  const data = ctx.getImageData(0, 0, 1, 1).data;
  const toHex = (value: number) => value.toString(16).padStart(2, "0");
  return `#${toHex(data[0])}${toHex(data[1])}${toHex(data[2])}`;
}

function hexToRgb(hex: string) {
  const normalized = colorToHex(hex).replace("#", "");
  const bigint = parseInt(normalized, 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255,
  };
}

function relativeLuminance(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const R = channel(r);
  const G = channel(g);
  const B = channel(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function contrastRatio(hex1: string, hex2: string) {
  const L1 = relativeLuminance(hex1);
  const L2 = relativeLuminance(hex2);
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}

function getReadableTextColor(background?: string, text?: string) {
  const bgHex = background ? colorToHex(background) : "#000000";
  const textHex = text ? colorToHex(text) : "";
  if (!textHex) {
    return relativeLuminance(bgHex) > 0.6 ? "#0f172a" : "#ffffff";
  }
  const ratio = contrastRatio(bgHex, textHex);
  if (ratio < 3.5) {
    return relativeLuminance(bgHex) > 0.6 ? "#0f172a" : "#ffffff";
  }
  return textHex;
}

const stats = [
  { label: "Active Workspaces", value: "38", change: "+6 this week" },
  { label: "In-flight Projects", value: "124", change: "+18% MoM" },
  { label: "Open Approvals", value: "9", change: "3 urgent" },
];

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const transactions = [
  {
    name: "Island App Launch",
    owner: "Product Ops",
    status: "In review",
    amount: "$24,800",
    date: "Jun 12",
  },
  {
    name: "Supplier Onboarding",
    owner: "Finance",
    status: "Approved",
    amount: "$8,140",
    date: "Jun 11",
  },
  {
    name: "Campaign Refresh",
    owner: "Marketing",
    status: "Blocked",
    amount: "$12,430",
    date: "Jun 10",
  },
  {
    name: "Beta Research Pass",
    owner: "UX Team",
    status: "Scheduled",
    amount: "$2,760",
    date: "Jun 08",
  },
];

const notifications = [
  {
    title: "Compliance sync",
    description: "2 contracts awaiting legal review",
    tone: "warning",
  },
  {
    title: "Billing export",
    description: "June report ready for download",
    tone: "success",
  },
  {
    title: "Escalated incident",
    description: "API gateway latency above threshold",
    tone: "danger",
  },
];

const team = [
  { name: "Isla Brennan", role: "Product Design", initials: "IB" },
  { name: "Quincy Morales", role: "AI Systems", initials: "QM" },
  { name: "Sara Yoon", role: "Growth", initials: "SY" },
  { name: "Leo Chen", role: "Platform", initials: "LC" },
];

const COLOR_VARIABLES = [
  "--color-primary",
  "--color-on-primary",
  "--color-secondary",
  "--color-on-secondary",
  "--color-tertiary",
  "--color-on-tertiary",
  "--color-surface",
  "--color-on-surface",
  "--color-surface-elevated",
  "--color-surface-dim",
  "--color-outline",
  "--color-outline-variant",
  "--color-inverse-surface",
  "--color-on-inverse-surface",
  "--color-error",
  "--color-on-error",
  "--color-success",
  "--color-on-success",
  "--color-warning",
] as const;
const EXTRA_COLOR_TOKENS = [
  "--color-success-contrast",
  "--color-warning-contrast",
  "--color-error-contrast",
  "--sidebar",
  "--sidebar-foreground",
  "--sidebar-primary",
  "--sidebar-primary-foreground",
  "--sidebar-accent",
  "--sidebar-accent-foreground",
  "--sidebar-border",
  "--sidebar-ring",
] as const;

type ColorVariable = (typeof COLOR_VARIABLES)[number];
type SurfaceTarget = {
  id: string;
  label: string;
  defaultColor: string;
};

const SURFACE_SHADE_PRESETS = [
  {
    key: "cream",
    label: "Cream",
    values: ["#FEFEFB", "#FAF9F4", "#F0EEE6"],
  },
  {
    key: "primary",
    label: "Primary",
    values: [
      "color-mix(in srgb, white 96%, var(--color-primary))",
      "color-mix(in srgb, white 90%, var(--color-primary))",
      "color-mix(in srgb, white 80%, var(--color-primary))",
    ],
  },
  {
    key: "secondary",
    label: "Secondary",
    values: [
      "color-mix(in srgb, white 96%, var(--color-secondary))",
      "color-mix(in srgb, white 90%, var(--color-secondary))",
      "color-mix(in srgb, white 80%, var(--color-secondary))",
    ],
  },
  {
    key: "tertiary",
    label: "Tertiary",
    values: [
      "color-mix(in srgb, white 96%, var(--color-tertiary))",
      "color-mix(in srgb, white 90%, var(--color-tertiary))",
      "color-mix(in srgb, white 80%, var(--color-tertiary))",
    ],
  },
];

type FontOption = {
  id: string;
  label: string;
  fontFamily: string;
  cssPath?: string;
  className?: string;
};

const FONT_OPTIONS: FontOption[] = [
  {
    id: "geist",
    label: "Default (Geist)",
    fontFamily: "var(--font-geist-sans)",
  },
  {
    id: "aktura",
    label: "Aktura",
    fontFamily: "\"Aktura\", sans-serif",
    cssPath: "/fonts/Aktura_Complete/Fonts/WEB/css/aktura.css",
  },
  {
    id: "anton",
    label: "Anton",
    fontFamily: "\"Anton\", sans-serif",
    cssPath: "/fonts/Anton_Complete/Fonts/WEB/css/anton.css",
  },
  {
    id: "author",
    label: "Author",
    fontFamily: "\"Author\", sans-serif",
    cssPath: "/fonts/Author_Complete/Fonts/WEB/css/author.css",
  },
  {
    id: "azeret",
    label: "Azeret Mono",
    fontFamily: "\"AzeretMono\", monospace",
    cssPath: "/fonts/AzeretMono_Complete/Fonts/WEB/css/azeret-mono.css",
  },
  {
    id: "bespoke-serif",
    label: "Bespoke Serif",
    fontFamily: "\"BespokeSerif\", serif",
    cssPath: "/fonts/BespokeSerif_Complete/Fonts/WEB/css/bespoke-serif.css",
  },
  {
    id: "bespoke-slab",
    label: "Bespoke Slab",
    fontFamily: "\"BespokeSlab\", serif",
    cssPath: "/fonts/BespokeSlab_Complete/Fonts/WEB/css/bespoke-slab.css",
  },
  {
    id: "bevellier",
    label: "Bevellier",
    fontFamily: "\"Bevellier\", serif",
    cssPath: "/fonts/Bevellier_Complete/Fonts/WEB/css/bevellier.css",
  },
  {
    id: "bonny",
    label: "Bonny",
    fontFamily: "\"Bonny\", sans-serif",
    cssPath: "/fonts/Bonny_Complete/Fonts/WEB/css/bonny.css",
  },
  {
    id: "boska",
    label: "Boska",
    fontFamily: "\"Boska\", serif",
    cssPath: "/fonts/Boska_Complete/Fonts/WEB/css/boska.css",
  },
  {
    id: "boxing",
    label: "Boxing",
    fontFamily: "\"Boxing\", sans-serif",
    cssPath: "/fonts/Boxing_Complete/Fonts/WEB/css/boxing.css",
  },
  {
    id: "cabinet",
    label: "Cabinet Grotesk",
    fontFamily: "\"CabinetGrotesk\", sans-serif",
    cssPath: "/fonts/CabinetGrotesk_Complete/Fonts/WEB/css/cabinet-grotesk.css",
  },
  {
    id: "chillax",
    label: "Chillax",
    fontFamily: "\"Chillax\", sans-serif",
    cssPath: "/fonts/Chillax_Complete/Fonts/WEB/css/chillax.css",
  },
  {
    id: "chubbo",
    label: "Chubbo",
    fontFamily: "\"Chubbo\", sans-serif",
    cssPath: "/fonts/Chubbo_Complete/Fonts/WEB/css/chubbo.css",
  },
  {
    id: "clash",
    label: "Clash Display",
    fontFamily: "\"ClashDisplay\", sans-serif",
    cssPath: "/fonts/ClashDisplay_Complete/Fonts/WEB/css/clash-display.css",
  },
  {
    id: "crimson",
    label: "Crimson Pro",
    fontFamily: "\"CrimsonPro\", serif",
    cssPath: "/fonts/CrimsonPro_Complete/Fonts/WEB/css/crimson-pro.css",
  },
  {
    id: "epilogue",
    label: "Epilogue",
    fontFamily: "\"Epilogue\", sans-serif",
    cssPath: "/fonts/Epilogue_Complete/Fonts/WEB/css/epilogue.css",
  },
  {
    id: "excon",
    label: "Excon",
    fontFamily: "\"Excon\", sans-serif",
    cssPath: "/fonts/Excon_Complete/Fonts/WEB/css/excon.css",
  },
  {
    id: "expose",
    label: "Expose",
    fontFamily: "\"Expose\", sans-serif",
    cssPath: "/fonts/Expose_Complete/Fonts/WEB/css/expose.css",
  },
  {
    id: "gambarino",
    label: "Gambarino",
    fontFamily: "\"Gambarino\", serif",
    cssPath: "/fonts/Gambarino_Complete/Fonts/WEB/css/gambarino.css",
  },
  {
    id: "gambetta",
    label: "Gambetta",
    fontFamily: "\"Gambetta\", serif",
    cssPath: "/fonts/Gambetta_Complete/Fonts/WEB/css/gambetta.css",
  },
  {
    id: "jetbrains",
    label: "JetBrains Mono",
    fontFamily: "\"JetBrainsMono\", monospace",
    cssPath: "/fonts/JetBrainsMono_Complete/Fonts/WEB/css/jet-brains-mono.css",
  },
  {
    id: "literata",
    label: "Literata",
    fontFamily: "\"Literata\", serif",
    cssPath: "/fonts/Literata_Complete/Fonts/WEB/css/literata.css",
  },
  {
    id: "lora",
    label: "Lora",
    fontFamily: "\"Lora\", serif",
    cssPath: "/fonts/Lora_Complete/Fonts/WEB/css/lora.css",
  },
  {
    id: "neco",
    label: "Neco",
    fontFamily: "\"Neco\", sans-serif",
    cssPath: "/fonts/Neco_Complete/Fonts/WEB/css/neco.css",
  },
  {
    id: "new-title",
    label: "New Title",
    fontFamily: "\"NewTitle\", serif",
    cssPath: "/fonts/NewTitle_Complete/Fonts/WEB/css/new-title.css",
  },
  {
    id: "nunito",
    label: "Nunito",
    fontFamily: "\"Nunito\", sans-serif",
    cssPath: "/fonts/Nunito_Complete/Fonts/WEB/css/nunito.css",
  },
  {
    id: "oswald",
    label: "Oswald",
    fontFamily: "\"Oswald\", sans-serif",
    cssPath: "/fonts/Oswald_Complete/Fonts/WEB/css/oswald.css",
  },
  {
    id: "pally",
    label: "Pally",
    fontFamily: "\"Pally\", sans-serif",
    cssPath: "/fonts/Pally_Complete/Fonts/WEB/css/pally.css",
  },
  {
    id: "paquito",
    label: "Paquito",
    fontFamily: "\"Paquito\", sans-serif",
    cssPath: "/fonts/Paquito_Complete/Fonts/WEB/css/paquito.css",
  },
  {
    id: "pramukh-rounded",
    label: "Pramukh Rounded",
    fontFamily: "\"PramukhRounded\", sans-serif",
    cssPath: "/fonts/PramukhRounded_Complete/Fonts/WEB/css/pramukh-rounded.css",
  },
  {
    id: "ranade",
    label: "Ranade",
    fontFamily: "\"Ranade\", sans-serif",
    cssPath: "/fonts/Ranade_Complete/Fonts/WEB/css/ranade.css",
  },
  {
    id: "recia",
    label: "Recia",
    fontFamily: "\"Recia\", serif",
    cssPath: "/fonts/Recia_Complete/Fonts/WEB/css/recia.css",
  },
  {
    id: "roundo",
    label: "Roundo",
    fontFamily: "\"Roundo\", sans-serif",
    cssPath: "/fonts/Roundo_Complete/Fonts/WEB/css/roundo.css",
  },
  {
    id: "rowan",
    label: "Rowan",
    fontFamily: "\"Rowan\", serif",
    cssPath: "/fonts/Rowan_Complete/Fonts/WEB/css/rowan.css",
  },
  {
    id: "satoshi",
    label: "Satoshi",
    fontFamily: "\"Satoshi\", sans-serif",
    cssPath: "/fonts/Satoshi_Complete/Fonts/WEB/css/satoshi.css",
  },
  {
    id: "sentient",
    label: "Sentient",
    fontFamily: "\"Sentient\", serif",
    cssPath: "/fonts/Sentient_Complete/Fonts/WEB/css/sentient.css",
  },
  {
    id: "sora",
    label: "Sora",
    fontFamily: "\"Sora\", sans-serif",
    cssPath: "/fonts/Sora_Complete/Fonts/WEB/css/sora.css",
  },
  {
    id: "supreme",
    label: "Supreme",
    fontFamily: "\"Supreme\", sans-serif",
    cssPath: "/fonts/Supreme_Complete/Fonts/WEB/css/supreme.css",
  },
  {
    id: "switzer",
    label: "Switzer",
    fontFamily: "\"Switzer\", sans-serif",
    cssPath: "/fonts/Switzer_Complete/Fonts/WEB/css/switzer.css",
  },
  {
    id: "synonym",
    label: "Synonym",
    fontFamily: "\"Synonym\", sans-serif",
    cssPath: "/fonts/Synonym_Complete/Fonts/WEB/css/synonym.css",
  },
  {
    id: "tabular",
    label: "Tabular",
    fontFamily: "\"Tabular\", sans-serif",
    cssPath: "/fonts/Tabular_Complete/Fonts/WEB/css/tabular.css",
  },
  {
    id: "zodiak",
    label: "Zodiak",
    fontFamily: "\"Zodiak\", serif",
    cssPath: "/fonts/Zodiak_Complete/Fonts/WEB/css/zodiak.css",
  },
];

const SHADOW_PRESETS = [
  {
    id: "flat",
    label: "No shadow",
    value: "none",
  },
  {
    id: "soft",
    label: "Soft ambient",
    value: "0 35px 60px -30px rgba(15, 23, 42, 0.4)",
  },
  {
    id: "contrast",
    label: "High contrast",
    value:
      "0 20px 35px rgba(12, 10, 29, 0.35), inset 0 1px 0 rgba(255,255,255,0.25)",
  },
  {
    id: "minimal",
    label: "Minimal outline",
    value: "0 12px 26px -18px rgba(15, 23, 42, 0.9)",
  },
];

const DEFAULT_RADIUS = 0;
const DEFAULT_SHADOW_ID = "flat";

const THEME_FILES = [
  {
    id: "island-light",
    className: "theme-island-light",
    label: "Island Light",
    fileName: "island_light.css",
    description: "Tropical blues and corals for bright, airy workspaces.",
  },
  {
    id: "british-phone-booth",
    className: "theme-british-phone-booth",
    label: "British Phone Booth",
    fileName: "british_phone_booth.css",
    description: "Signal-red primaries accented with mint and teal highlights.",
  },
  {
    id: "adonis-rose-yellow",
    className: "theme-adonis-rose-yellow",
    label: "Adonis Rose Yellow",
    fileName: "adonis_rose_yellow.css",
    description: "Sunlit rose gold with powder-blue accents and porcelain surfaces.",
  },
  {
    id: "spectral-green",
    className: "theme-spectral-green",
    label: "Spectral Green",
    fileName: "spectral_green.css",
    description: "Deep emerald primaries paired with blush neutrals and stark contrasts.",
  },
  {
    id: "sky-dancer",
    className: "theme-sky-dancer",
    label: "Sky Dancer",
    fileName: "sky_dancer.css",
    description: "Azure gradients with apricot supports inspired by crisp alpine skies.",
  },
  {
    id: "yellow",
    className: "theme-yellow",
    label: "Sunburst Yellow",
    fileName: "yellow.css",
    description: "Bold citrus primaries paired with electric violets.",
  },
  {
    id: "apricot-buff",
    className: "theme-apricot-buff",
    label: "Apricot Buff",
    fileName: "apricot_buff.css",
    description: "Warm apricot primaries with arctic blues and porcelain whites.",
  },
  {
    id: "apocalyptic-orange",
    className: "theme-apocalyptic-orange",
    label: "Apocalyptic Orange",
    fileName: "apocalyptic_orange.css",
    description: "Blazing oranges with arctic support tones for high-drama surfaces.",
  },
  {
    id: "maya-blue",
    className: "theme-maya-blue",
    label: "Maya Blue",
    fileName: "maya_blue.css",
    description: "Airy blues with sun-bleached neutrals reminiscent of coastal mornings.",
  },
  {
    id: "miami-coral",
    className: "theme-miami-coral",
    label: "Miami Coral",
    fileName: "miami_coral.css",
    description: "Vibrant coral gradients with muted sand and gold support tones.",
  },
  {
    id: "jade-glass",
    className: "theme-jade-glass",
    label: "Jade Glass",
    fileName: "jade_glass.css",
    description: "Translucent jade primaries with smoky neutrals and minimalist contrast.",
  },
  {
    id: "james-blonde",
    className: "theme-james-blonde",
    label: "James Blonde",
    fileName: "james_blonde.css",
    description: "Champagne gold base tones with moody mauves for playful luxury.",
  },
  {
    id: "crystal-green",
    className: "theme-crystal-green",
    label: "Crystal Green",
    fileName: "crystal_green.css",
    description: "Glassy verdant hues with deep forest anchors and luminous surfaces.",
  },
  {
    id: "cyan-sky",
    className: "theme-cyan-sky",
    label: "Cyan Sky",
    fileName: "cyan_sky.css",
    description: "Electric cyan primaries with warm amber neutrals inspired by tropical sunrises.",
  },
  {
    id: "koopa-green-shell",
    className: "theme-koopa-green-shell",
    label: "Koopa Green Shell",
    fileName: "koopa_green_shell.css",
    description: "Playful mint primaries with warm coral support inspired by retro game palettes.",
  },
  {
    id: "thuja-green",
    className: "theme-thuja-green",
    label: "Thuja Green",
    fileName: "thuja_green.css",
    description: "Deep evergreen primaries paired with terracotta accents and lavender lights.",
  },
  {
    id: "celtic-queen",
    className: "theme-celtic-queen",
    label: "Celtic Queen",
    fileName: "celtic_queen.css",
    description: "Emerald primaries with sea-glass blues and moody teals for regal dashboards.",
  },
  {
    id: "pinkman",
    className: "theme-pinkman",
    label: "Pinkman",
    fileName: "pinkman.css",
    description: "High-energy magenta primaries with golden highlights and teal supports.",
  },
  {
    id: "if-i-could-fly",
    className: "theme-if-i-could-fly",
    label: "If I Could Fly",
    fileName: "if_i_could_fly.css",
    description: "Violet primaries with blush highlights and eucalyptus greens for dreamy apps.",
  },
  {
    id: "crop-circle",
    className: "theme-crop-circle",
    label: "Crop Circle",
    fileName: "crop_circle.css",
    description: "Golden primaries with teal shadows for organic editorial layouts.",
  },
  {
    id: "apricot-sorbet",
    className: "theme-apricot-sorbet",
    label: "Apricot Sorbet",
    fileName: "apricot_sorbet.css",
    description: "Sun-baked apricot gradients with deep amber accents and cocoa neutrals.",
  },
  {
    id: "mesa-sunrise",
    className: "theme-mesa-sunrise",
    label: "Mesa Sunrise",
    fileName: "mesa_sunrise.css",
    description: "Earthy canyon primaries with smoldering reds for desert-inspired dashboards.",
  },
  {
    id: "fountain",
    className: "theme-fountain",
    label: "Fountain",
    fileName: "fountain.css",
    description: "Spa blues with blush undertones for serene, watery interfaces.",
  },
];

type ThemeStyleVariant = "box" | "neo-brutalist" | "neomorphism";

type ThemeStylePageProps = {
  variant?: ThemeStyleVariant;
};

export function ThemeStylePage({ variant = "box" }: ThemeStylePageProps) {
  const [mode, setMode] = useState<"light" | "dark">("light");
  const [themeClass, setThemeClass] = useState(THEME_FILES[0].className);
  const [variableOverrides, setVariableOverrides] =
    useState<Partial<Record<ColorVariable, string>>>({});
  const [paletteValues, setPaletteValues] = useState<Record<string, string>>({});
  const [palettePickerTarget, setPalettePickerTarget] =
    useState<ColorVariable | null>(null);
  const [radius, setRadius] = useState(DEFAULT_RADIUS);
  const [fontPreset, setFontPreset] = useState(FONT_OPTIONS[0].id);
  const [shadowPreset, setShadowPreset] = useState(DEFAULT_SHADOW_ID);
  const [surfaceOverrides, setSurfaceOverrides] = useState<Record<string, string>>({});
  const [activeSurface, setActiveSurface] = useState<SurfaceTarget | null>(null);
  const previewRef = useRef<HTMLElement | null>(null);
  const styleVariant = variant ?? "box";
  const styleLabel =
    styleVariant === "neo-brutalist"
      ? "Neo-Brutalist"
      : styleVariant === "neomorphism"
        ? "Neomorphism"
        : "Box";
  const inProgress = transactions
    .filter((item) => item.status === "In review")
    .map((item) => item.name);
  const activeTheme = THEME_FILES.find((theme) => theme.className === themeClass);
  const fontOption = useMemo(
    () => FONT_OPTIONS.find((option) => option.id === fontPreset) ?? FONT_OPTIONS[0],
    [fontPreset, setFontPreset],
  );
  const shadowOption = useMemo(
    () =>
      SHADOW_PRESETS.find((option) => option.id === shadowPreset) ??
      SHADOW_PRESETS[0],
    [shadowPreset],
  );
  const cycleFontPreset = useCallback(
    (direction: number) => {
      const index = FONT_OPTIONS.findIndex((option) => option.id === fontPreset);
      const nextIndex =
        (index + direction + FONT_OPTIONS.length) % FONT_OPTIONS.length;
      const nextFont = FONT_OPTIONS[nextIndex] ?? FONT_OPTIONS[0];
      setFontPreset(nextFont.id);
    },
    [fontPreset],
  );

  const surfacePaletteOptions = useMemo(
    () =>
      [
        {
          label: "Surface",
          value: paletteValues["--color-surface"],
        },
        {
          label: "Surface elevated",
          value: paletteValues["--color-surface-elevated"],
        },
        {
          label: "Primary",
          value: paletteValues["--color-primary"],
        },
        {
          label: "Secondary",
          value: paletteValues["--color-secondary"],
        },
        {
          label: "Tertiary",
          value: paletteValues["--color-tertiary"],
        },
      ].filter(
        (option): option is { label: string; value: string } => Boolean(option.value),
      ),
    [paletteValues],
  );
  const resolvedSurfaceColor = useMemo(() => {
    if (!activeSurface) {
      return surfacePaletteOptions[0]?.value ?? "#f8f9fb";
    }
    return surfaceOverrides[activeSurface.id] ?? activeSurface.defaultColor;
  }, [activeSurface, surfaceOverrides, surfacePaletteOptions]);
  const resolvedSurfaceHex = useMemo(
    () => colorToHex(resolvedSurfaceColor),
    [resolvedSurfaceColor],
  );
  const applySurfaceColor = useCallback(
    (value: string) => {
      if (!activeSurface) return;
      setSurfaceOverrides((prev) => ({
        ...prev,
        [activeSurface.id]: value,
      }));
    },
    [activeSurface],
  );
  const resetSurfaceColor = useCallback(() => {
    if (!activeSurface) return;
    setSurfaceOverrides((prev) => {
      if (!(activeSurface.id in prev)) return prev;
      const next = { ...prev };
      delete next[activeSurface.id];
      return next;
    });
  }, [activeSurface]);
  const getSurfaceStyle = useCallback(
    (id: string): CSSProperties | undefined => {
      const value = surfaceOverrides[id];
      return value ? { backgroundColor: value } : undefined;
    },
    [surfaceOverrides],
  );
  const handleSurfaceContextMenu = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      if (typeof window === "undefined") return;
      const target = event.target as HTMLElement | null;
      const surfaceElement =
        target?.closest<HTMLElement>("[data-surface-id]") ??
        (event.currentTarget as HTMLElement | null);
      if (!surfaceElement) return;
      const id = surfaceElement.dataset.surfaceId;
      if (!id) return;
      const label = surfaceElement.dataset.surfaceLabel ?? "Surface";
      const defaultColor =
        window.getComputedStyle(surfaceElement).backgroundColor || "transparent";
      setActiveSurface({
        id,
        label,
        defaultColor,
      });
    },
    [],
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
    styleVariant === "neo-brutalist"
      ? brutalistFontFamily
      : styleVariant === "neomorphism"
        ? fontOption.fontFamily
        : fontOption.fontFamily;
  const variantColorOverrides = useMemo<CSSProperties>(() => {
    if (styleVariant === "neomorphism") {
      return {
        ["--color-surface" as keyof CSSProperties]: "#f4f6fa",
        ["--color-surface-elevated" as keyof CSSProperties]: "#f7f8fb",
        ["--color-surface-dim" as keyof CSSProperties]: "#eceff3",
        ["--color-surface-bright" as keyof CSSProperties]: "#fff",
      };
    }
    return {};
  }, [styleVariant]);
  const layoutStyle = useMemo<CSSProperties>(
    () => ({
      ["--lab-radius" as keyof CSSProperties]: `${radius}px`,
      ["--lab-font" as keyof CSSProperties]: appliedFontFamily,
      ["--lab-shadow" as keyof CSSProperties]: shadowOption.value,
    }),
    [radius, appliedFontFamily, shadowOption],
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

  const paletteList = COLOR_VARIABLES.map((variable) => ({
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
    setFontPreset(FONT_OPTIONS[0].id);
    setShadowPreset(DEFAULT_SHADOW_ID);
  };

  const isLayoutDefault =
    radius === DEFAULT_RADIUS &&
    fontPreset === FONT_OPTIONS[0].id &&
    shadowPreset === DEFAULT_SHADOW_ID;
  const setSurfaceColor = (value: string) =>
    setColorOverride("--color-surface" as ColorVariable, value);
  const setSurfaceElevatedColor = (value: string) =>
    setColorOverride("--color-surface-elevated" as ColorVariable, value);
  const resetSurfaceTones = () => {
    resetVariable("--color-surface" as ColorVariable);
    resetVariable("--color-surface-elevated" as ColorVariable);
  };
  const heroWrapperClass =
    styleVariant === "neo-brutalist"
      ? "brutalist-hero"
      : styleVariant === "neomorphism"
        ? "neomorph-hero"
        : "";
  const headerBandClass =
    styleVariant === "neo-brutalist"
      ? "brutalist-banner"
      : styleVariant === "neomorphism"
        ? "neomorph-banner"
        : "";
  const panelClass =
    styleVariant === "neo-brutalist"
      ? "brutalist-panel"
      : styleVariant === "neomorphism"
        ? "neomorph-panel"
        : "";
  const primaryColor = paletteValues["--color-primary"] || "hsl(var(--primary))";
  const primaryOnColor =
    paletteValues["--color-on-primary"] || "hsl(var(--primary-foreground))";
  const secondaryColor =
    paletteValues["--color-secondary"] || "hsl(var(--secondary))";
  const secondaryOnColor =
    paletteValues["--color-on-secondary"] ||
    "hsl(var(--secondary-foreground))";
  const designControlsSheet = (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          className={cn(
            "gap-2 rounded-full bg-background/90 px-5 shadow-lg shadow-primary/20",
            styleVariant === "neomorphism" && "neomorph-dock-button",
          )}
        >
          <SlidersHorizontal className="size-4" />
          Design controls
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="flex h-full flex-col overflow-y-auto border-l border-border/70 sm:max-w-md"
      >
        <SheetHeader>
          <SheetTitle>Design surface controls</SheetTitle>
          <SheetDescription>
            Adjust shared radius, font family, and elevation shadows across the preview.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-6 px-4 pb-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Border radius</Label>
              <span className="text-sm font-mono text-muted-foreground">{radius}px</span>
            </div>
            <input
              type="range"
              min={0}
              max={36}
              value={radius}
              onChange={(event) => setRadius(Number(event.target.value))}
              className="w-full"
              style={{ accentColor: "hsl(var(--primary))" }}
            />
            <p className="text-muted-foreground text-xs">
              Applies to cards, buttons, inputs, and major surface containers.
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold">Font family</p>
            <div className="grid max-h-[400px] gap-3 overflow-y-auto pr-1">
              {FONT_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setFontPreset(option.id)}
                  className={cn(
                    "rounded-2xl border p-4 text-left transition hover:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring",
                    fontPreset === option.id
                      ? "border-primary bg-primary/10"
                      : "border-border bg-muted/30",
                  )}
                >
                  <p className="text-sm font-semibold">{option.label}</p>
                  <p
                    className="text-muted-foreground text-xs"
                    style={{ fontFamily: option.fontFamily }}
                  >
                    {option.label} — the quick brown fox tests curves and ligatures.
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold">Shadow preset</p>
            <div className="space-y-2">
              {SHADOW_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setShadowPreset(preset.id)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition hover:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring",
                    shadowPreset === preset.id
                      ? "border-primary bg-primary/10"
                      : "border-border bg-muted/30",
                  )}
                >
                  <span>{preset.label}</span>
                  <span className="text-xs font-mono text-muted-foreground">preset</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <SheetFooter>
          <Button variant="secondary" onClick={resetLayoutControls} disabled={isLayoutDefault}>
            Reset layout styling
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
  const themeOverridesSheet = (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          className={cn(
            "gap-2 rounded-full bg-primary text-primary-foreground px-5 shadow-lg shadow-primary/30",
            styleVariant === "neomorphism" && "neomorph-dock-button",
          )}
        >
          <Palette className="size-4" />
          Theme overrides
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="flex h-full flex-col overflow-y-auto border-l border-border/70 sm:max-w-md"
      >
        <SheetHeader>
          <SheetTitle>Variable overrides</SheetTitle>
          <SheetDescription>
            Reassign CSS variables to any palette color to stress-test extreme combinations.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4 pb-6">
          <div className="rounded-2xl border border-border/70 bg-muted/10 p-4">
            <p className="text-sm font-semibold">Variables</p>
            <p className="text-muted-foreground text-xs">
              Use the color picker to override any token or pull from an existing theme value.
            </p>
          </div>
          <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
            {paletteList.map(({ variable, value, isOverride }) => {
              const effectiveValue = variableOverrides[variable] ?? value ?? "";
              const hexValue = colorToHex(effectiveValue);
              return (
                <div
                  key={`override-${variable}`}
                  className="rounded-2xl border border-border/70 bg-background/60 p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-mono text-xs">{variable}</p>
                      <p className="text-muted-foreground text-xs">
                        {isOverride ? "Override applied" : "Theme default"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {variableOverrides[variable] && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-xs"
                          onClick={() => resetVariable(variable)}
                        >
                          Reset
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-3 text-xs font-medium">
                      <span className="text-muted-foreground">Color</span>
                      <input
                        type="color"
                        value={hexValue}
                        onChange={(event) => setColorOverride(variable, event.target.value)}
                        className="size-10 cursor-pointer rounded-md border border-border bg-transparent p-0"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setPalettePickerTarget(
                          palettePickerTarget === variable ? null : variable,
                        )
                      }
                      className="rounded-full border border-border px-3 py-1 text-xs font-medium transition hover:border-primary"
                    >
                      Pick from theme
                    </button>
                  </div>
                  {palettePickerTarget === variable && (
                    <div className="mt-3 grid max-h-48 grid-cols-2 gap-2 overflow-y-auto rounded-xl border border-border/70 p-2">
                      {paletteList.map((option) => (
                        <button
                          key={`${variable}-${option.variable}`}
                          type="button"
                          onClick={() => assignVariable(variable, option.variable)}
                          className="flex items-center gap-2 rounded-lg border border-border/70 bg-muted/30 px-2 py-1 text-left text-[11px] font-mono hover:border-primary"
                        >
                          <span
                            className="inline-block size-6 rounded-md border border-border/70"
                            style={{ backgroundColor: option.value || "transparent" }}
                          />
                          <span className="truncate">{option.variable}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <SheetFooter>
          <Button
            variant="secondary"
            onClick={resetAllOverrides}
            disabled={!Object.keys(variableOverrides).length}
          >
            Reset all overrides
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
  const surfaceTonesSheet = (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          className={cn(
            "gap-2 rounded-full bg-background/95 px-5 shadow-lg shadow-primary/20",
            styleVariant === "neomorphism" && "neomorph-dock-button",
          )}
        >
          Surface tones
        </Button>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="flex h-auto flex-col gap-6 border-t border-border/70 bg-background/95 sm:max-h-[70vh]"
      >
        <SheetHeader>
          <SheetTitle>Surface tones</SheetTitle>
          <SheetDescription>
            Quickly apply near-white tints of the current theme colors to background and elevated
            layers.
          </SheetDescription>
        </SheetHeader>

        <div className="grid gap-6 text-xs font-medium text-muted-foreground sm:grid-cols-2">
          {[
            { label: "Surface", setter: setSurfaceColor },
            { label: "Elevated", setter: setSurfaceElevatedColor },
          ].map((section) => (
            <div
              key={section.label}
              className="space-y-3 rounded-2xl border border-border/60 bg-background/80 p-4"
            >
              <p className="text-[11px] uppercase tracking-wider text-foreground">
                {section.label} tones
              </p>
              <div className="space-y-2">
                {SURFACE_SHADE_PRESETS.map((preset) => (
                  <div
                    key={`${section.label}-${preset.key}`}
                    className="flex items-center gap-3 text-[11px]"
                  >
                    <span className="w-16 shrink-0 uppercase tracking-wide text-muted-foreground">
                      {preset.label}
                    </span>
                    <div className="flex gap-2">
                      {preset.values.map((shade, index) => (
                        <button
                          key={`${preset.key}-${section.label}-${index}`}
                          type="button"
                          onClick={() => section.setter(shade)}
                          className="size-8 rounded-full border border-border/70 shadow-inner transition hover:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                          style={{ backgroundColor: shade }}
                          aria-label={`Set ${section.label.toLowerCase()} ${preset.label} shade ${index + 1}`}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <SheetFooter>
          <Button variant="secondary" onClick={resetSurfaceTones}>
            Reset surface colors
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );

  return (
    <div
      className={cn(
        themeClass,
        fontOption.className,
        "min-h-screen bg-background text-foreground transition-colors",
      )}
      data-mode={mode}
      data-theme-lab="true"
      data-style={styleVariant}
      ref={previewRef}
      style={previewStyle}
    >
    <SidebarProvider
      defaultOpen
      style={
        {
          "--sidebar-width": "260px",
          "--sidebar": paletteValues["--sidebar"] || "var(--background)",
          "--sidebar-foreground":
            paletteValues["--sidebar-foreground"] || "var(--foreground)",
          "--sidebar-primary":
            paletteValues["--sidebar-primary"] || "var(--primary)",
          "--sidebar-primary-foreground":
            paletteValues["--sidebar-primary-foreground"] ||
            "var(--primary-foreground)",
          "--sidebar-accent":
            paletteValues["--sidebar-accent"] || "var(--accent)",
          "--sidebar-accent-foreground":
            paletteValues["--sidebar-accent-foreground"] ||
            "var(--accent-foreground)",
          "--sidebar-border":
            paletteValues["--sidebar-border"] || "var(--border)",
          "--sidebar-ring":
            paletteValues["--sidebar-ring"] || "var(--ring)",
        } as CSSProperties
      }
      className="bg-background"
    >
      <Sidebar collapsible="icon" variant="inset">
        <SidebarHeader className="border-border/60 border-b px-4 py-4">
            <div className="flex items-center gap-3">
              <div
                className="flex size-10 items-center justify-center bg-primary/20 text-primary"
                style={{
                  borderRadius: "calc(var(--lab-radius, 18px) * 0.5)",
                }}
              >
                <Sparkles className="size-4" />
              </div>
              <div>
              <p className="text-sm font-semibold">Theme Preview</p>
              <p className="text-xs text-muted-foreground">Workflows & states</p>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent className="px-3 py-4 space-y-4">
          <SidebarGroup>
            <SidebarGroupLabel>Styles</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={styleVariant === "box"}
                    tooltip="Box layout"
                  >
                    <Link href="/theme">
                      <Square />
                      <span>Box</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={styleVariant === "neo-brutalist"}
                    tooltip="Neo Brutalist layout"
                  >
                    <Link href="/theme/neo-brutalist">
                      <Layers />
                      <span>Neo Brutalist</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={styleVariant === "neomorphism"}
                    tooltip="Neomorphism layout"
                  >
                    <Link href="/theme/neomorphism">
                      <SlidersHorizontal />
                      <span>Neomorphism</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarSeparator />
          <SidebarGroup>
            <SidebarGroupLabel>Main</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton isActive tooltip="Overview">
                    <Sparkles className="text-primary" />
                    <span>Overview</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton tooltip="Analytics">
                    <Activity />
                    <span>Analytics</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton tooltip="Automation">
                    <CheckCircle2 />
                    <span>Automation</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton tooltip="Risk center">
                    <AlertTriangle />
                    <span>Risk center</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarSeparator />
          <SidebarGroup>
            <SidebarGroupLabel>Shortcuts</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton tooltip="Launchpad">
                    <Sun />
                    <span>Launchpad</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton tooltip="Reports">
                    <Moon />
                    <span>Reports</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="border-border/60 border-t px-4 py-4 text-xs">
          <p className="text-muted-foreground">Workspace status</p>
          <p className="text-foreground font-medium">All systems go</p>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="bg-background">
        <main className="min-h-screen px-4 py-12 text-foreground transition-colors md:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-10">
        <header className={cn("flex flex-wrap items-center justify-between gap-6", heroWrapperClass)}>
          <div className="space-y-3">
            <div className={cn("flex flex-wrap items-center gap-2", headerBandClass)}>
              <Badge variant="secondary" className="uppercase tracking-widest">
                Theme Lab
              </Badge>
              <Badge variant="outline" className="uppercase tracking-widest">
                {styleLabel} style
              </Badge>
              {activeTheme && (
                <Badge variant="outline" className="font-mono text-xs">
                  {activeTheme.fileName}
                </Badge>
              )}
            </div>
            <h1
              className={cn(
                "mt-3 text-4xl font-semibold",
                styleVariant === "neo-brutalist" && "text-5xl font-black uppercase tracking-tight"
              )}
            >
              Visual Theme Preview
            </h1>
            <p
              className={cn(
                "text-muted-foreground mt-2 max-w-2xl text-base",
                styleVariant === "neo-brutalist" && "font-semibold text-lg"
              )}
            >
              Compare every component against alternative CSS token sets. Currently
              showing{" "}
              <span className="font-medium text-foreground">
                {activeTheme?.label}
              </span>{" "}
              — switch theme files or toggle palette modes to confirm that borders,
              typography, and elevated layers all feel cohesive.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <SidebarTrigger className="size-9 rounded-full border border-border bg-background/80" />
            <div className="flex flex-wrap items-center gap-3 rounded-[calc(var(--lab-radius,18px))] border border-border bg-background/90 p-1 shadow-sm">
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 rounded-full border-none px-4"
                onClick={() => setMode("light")}
                style={
                  mode === "light"
                    ? {
                        backgroundColor: primaryColor,
                        color: primaryOnColor,
                      }
                    : {
                        backgroundColor: "#f4f4f4",
                        color:
                          paletteValues["--color-on-surface"] ||
                          "var(--foreground)",
                      }
                }
              >
                <Sun className="size-4" />
                Light
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 rounded-full border-none px-4"
                onClick={() => setMode("dark")}
                style={
                  mode === "dark"
                    ? {
                        backgroundColor: secondaryColor,
                        color: secondaryOnColor,
                      }
                    : {
                        backgroundColor: "#f4f4f4",
                        color:
                          paletteValues["--color-on-surface"] ||
                          "var(--foreground)",
                      }
                }
              >
                <Moon className="size-4" />
                Dark
              </Button>
            </div>
          </div>
        </header>

        <section className={cn("rounded-3xl border border-dashed border-border bg-background/70 p-6 shadow-sm md:p-8", panelClass)}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">Theme files</h2>
              <p className="text-muted-foreground text-sm">
                Apply any available CSS theme definition to this preview sandbox.
              </p>
            </div>
            {activeTheme && (
              <div className="flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm">
                <span className="text-muted-foreground">Active file</span>
                <span className="font-mono text-xs">{activeTheme.fileName}</span>
              </div>
            )}
          </div>
          <div className="mt-5 flex flex-col gap-4 md:flex-row md:items-start">
            <div className="w-full space-y-2 md:max-w-sm">
              <Label htmlFor="theme-picker" className="text-sm font-medium">
                Theme preset
              </Label>
              <select
                id="theme-picker"
                value={themeClass}
                onChange={(event) => setThemeClass(event.target.value)}
                className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm font-medium shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/40"
              >
                {THEME_FILES.map((theme) => (
                  <option key={theme.id} value={theme.className}>
                    {theme.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1 rounded-2xl border border-border/70 bg-muted/10 p-5 shadow-inner">
              <p className="font-semibold">{activeTheme?.label}</p>
              <p className="text-muted-foreground text-sm">{activeTheme?.description}</p>
              <p className="mt-3 text-xs font-mono text-muted-foreground">
                {activeTheme?.fileName}
              </p>
              <div className="mt-4 flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const idx = THEME_FILES.findIndex((theme) => theme.className === themeClass);
                    const nextIndex = (idx - 1 + THEME_FILES.length) % THEME_FILES.length;
                    setThemeClass(THEME_FILES[nextIndex]?.className ?? themeClass);
                  }}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const idx = THEME_FILES.findIndex((theme) => theme.className === themeClass);
                    const nextIndex = (idx + 1) % THEME_FILES.length;
                    setThemeClass(THEME_FILES[nextIndex]?.className ?? themeClass);
                  }}
                >
                  Next
                </Button>
              </div>
              <div className="mt-4 rounded-2xl border border-border/60 bg-background/70 p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Typeface quick switch
                    </p>
                    <p
                      className="text-base font-semibold"
                      style={{ fontFamily: fontOption.fontFamily }}
                    >
                      {fontOption.label}
                    </p>
                    <p
                      className="text-muted-foreground text-xs"
                      style={{ fontFamily: fontOption.fontFamily }}
                    >
                      The quick brown fox sprints over ideation hurdles.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="rounded-full"
                      onClick={() => cycleFontPreset(-1)}
                      aria-label="Previous font"
                    >
                      <ChevronLeft className="size-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="rounded-full"
                      onClick={() => cycleFontPreset(1)}
                      aria-label="Next font"
                    >
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    toast("Neutral heads up", {
                      description: "This is how a standard notification will appear.",
                    })
                  }
                >
                  Neutral toast
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    toast.success("Success state", {
                      description: "Colors should match the success tokens.",
                      style: successToastStyle,
                    })
                  }
                >
                  Success toast
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    toast.warning("Warning state", {
                      description: "Great for gentle nudges or reminders.",
                      style: warningToastStyle,
                    })
                  }
                >
                  Warning toast
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() =>
                    toast.error("Failure state", {
                      description: "Use this when something needs attention.",
                      style: errorToastStyle,
                    })
                  }
                >
                  Failure toast
                </Button>
              </div>
            </div>
          </div>
        </section>

        <ContextMenu
          modal={false}
          onOpenChange={(open) => {
            if (!open) {
              setActiveSurface(null);
            }
          }}
        >
          <ContextMenuTrigger asChild>
            <section
              className={cn(
                "rounded-3xl border border-border bg-background/80 p-6 shadow-lg backdrop-blur md:p-8",
                panelClass,
                styleVariant === "neomorphism" && "neomorph-panel--flat",
              )}
              data-surface-id="surface-workspace-shell"
              data-surface-label="Workspace shell"
              onContextMenuCapture={handleSurfaceContextMenu}
              style={getSurfaceStyle("surface-workspace-shell")}
            >
          <div className="flex flex-wrap items-center gap-4 border-b border-dashed border-border pb-6">
            <div className="flex flex-col gap-2">
              <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Sparkles className="size-4 text-primary" />
                Theme stress test
              </div>
              <div className="flex flex-wrap items-baseline gap-3">
                <h2 className="text-2xl font-semibold">Creative Workspace Dashboard</h2>
                <Badge>Live preview</Badge>
              </div>
              <p className="text-muted-foreground max-w-2xl text-sm">
                Buttons, tables, tabs, forms, and status badges all reuse our primitives.
                Any mismatch here will show up instantly in product surfaces.
              </p>
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-3">
              <Button
                className="gap-2 px-5 font-semibold text-sm"
                style={{
                  backgroundColor: "var(--color-primary)",
                  color: "var(--color-on-primary)",
                  border: "none",
                }}
              >
                Launch report
                <ArrowUpRight className="size-4" />
              </Button>
              <Button
                variant="outline"
                className="border-none px-5 text-sm font-semibold"
                style={{
                  backgroundColor: "var(--color-secondary)",
                  color: "var(--color-on-secondary)",
                }}
              >
                Share feedback
              </Button>
            </div>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1.8fr_1fr]">
            <div className="space-y-6">
              <Card
                className={cn(panelClass)}
                data-surface-id="surface-card-momentum"
                data-surface-label="Momentum snapshot"
                style={getSurfaceStyle("surface-card-momentum")}
              >
                <CardHeader className="flex flex-col gap-1">
                  <CardTitle>Momentum snapshot</CardTitle>
                  <CardDescription>How the team is trending this week</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-5 md:grid-cols-3">
                    {stats.map((stat, statIndex) => {
                      const statSurfaceId = `surface-stat-${slugify(stat.label)}`;
                      const dotColor =
                        statIndex === 0
                          ? paletteValues["--color-primary"] || "var(--color-primary)"
                          : statIndex === 1
                            ? paletteValues["--color-secondary"] || "var(--color-secondary)"
                            : paletteValues["--color-tertiary"] || "var(--color-tertiary)";
                      return (
                        <div
                          key={stat.label}
                          data-surface-id={statSurfaceId}
                          data-surface-label={stat.label}
                          style={getSurfaceStyle(statSurfaceId)}
                          className="rounded-2xl border border-border/70 p-4"
                        >
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                            {stat.label}
                          </p>
                          <span
                            className="inline-flex size-2.5 rounded-full"
                            style={{ backgroundColor: dotColor }}
                          />
                        </div>
                        <p className="mt-3 text-3xl font-semibold">{stat.value}</p>
                        <p className="text-sm text-primary mt-2 font-medium">{stat.change}</p>
                        <div className="mt-4 h-1.5 rounded-full bg-muted">
                          <div className="h-full rounded-full bg-primary" />
                        </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <Button size="sm">Primary action</Button>
                    <Button size="sm" variant="secondary">
                      Secondary
                    </Button>
                    <Button size="sm" variant="outline">
                      Outline
                    </Button>
                    <Button size="sm" variant="destructive">
                      Destructive
                    </Button>
                    <Button size="sm" variant="ghost">
                      Ghost
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card
                className={cn(panelClass)}
                data-surface-id="surface-card-engagement"
                data-surface-label="Engagement radar"
                style={getSurfaceStyle("surface-card-engagement")}
              >
                <CardHeader className="flex flex-row items-center justify-between gap-4">
                  <div>
                    <CardTitle>Engagement radar</CardTitle>
                    <CardDescription>Compare retention, shipping, and revenue.</CardDescription>
                  </div>
                  <Badge variant="outline" className="gap-1 text-xs uppercase tracking-widest">
                    <Activity className="size-3.5" />
                    synced
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-6">
                  <Tabs defaultValue="revenue" className="w-full">
                    <TabsList>
                      <TabsTrigger value="revenue">Revenue</TabsTrigger>
                      <TabsTrigger value="retention">Retention</TabsTrigger>
                      <TabsTrigger value="shipping">Shipping</TabsTrigger>
                    </TabsList>
                    <TabsContent value="revenue">
                      <div
                        className="mt-5 rounded-2xl border border-dashed border-border bg-gradient-to-tr from-primary/15 via-primary/5 to-transparent p-5"
                        data-surface-id="surface-engagement-revenue"
                        data-surface-label="Revenue forecast"
                        style={getSurfaceStyle("surface-engagement-revenue")}
                      >
                        <p className="text-sm text-muted-foreground">Forecast</p>
                        <p className="text-4xl font-semibold">$184k</p>
                        <p className="text-sm text-primary mt-2">+24.8% vs last sprint</p>
                        <div className="mt-6 h-36 rounded-2xl bg-[radial-gradient(circle,_var(--color-primary)_0%,_transparent_65%)] opacity-80" />
                      </div>
                    </TabsContent>
                    <TabsContent value="retention">
                      <div
                        className="mt-5 rounded-2xl border border-dashed border-border bg-gradient-to-tr from-secondary/20 via-secondary/5 to-transparent p-5"
                        data-surface-id="surface-engagement-retention"
                        data-surface-label="Retention snapshot"
                        style={getSurfaceStyle("surface-engagement-retention")}
                      >
                        <p className="text-sm text-muted-foreground">Daily active</p>
                        <p className="text-4xl font-semibold">86%</p>
                        <p className="text-sm text-secondary-foreground mt-2">Holding steady</p>
                        <div className="mt-6 grid grid-cols-5 gap-2">
                          {Array.from({ length: 25 }).map((_, index) => (
                            <span
                              key={`retention-${index}`}
                              className={cn(
                                "aspect-square rounded-md border",
                                index % 5 === 0
                                  ? "border-primary bg-primary/40"
                                  : "border-border bg-muted",
                              )}
                            />
                          ))}
                        </div>
                      </div>
                    </TabsContent>
                    <TabsContent value="shipping">
                      <div
                        className="mt-5 rounded-2xl border border-dashed border-border bg-gradient-to-tr from-accent/30 via-accent/10 to-transparent p-5"
                        data-surface-id="surface-engagement-shipping"
                        data-surface-label="Shipping velocity"
                        style={getSurfaceStyle("surface-engagement-shipping")}
                      >
                        <p className="text-sm text-muted-foreground">Velocity</p>
                        <p className="text-4xl font-semibold">32 merges</p>
                        <p className="text-sm text-accent-foreground mt-2">+4 urgent fixes</p>
                        <div className="mt-6 grid grid-cols-8 gap-2">
                          {Array.from({ length: 16 }).map((_, index) => (
                            <div
                              key={`shipping-${index}`}
                              className={cn(
                                "h-14 rounded-full border border-border bg-background",
                                index % 2 === 0 ? "shadow-[inset_0_0_0_1px_var(--border)]" : "",
                              )}
                            />
                          ))}
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>

              <Card
                className={cn(panelClass)}
                data-surface-id="surface-card-ledger"
                data-surface-label="Workflow ledger"
                style={getSurfaceStyle("surface-card-ledger")}
              >
                <CardHeader className="flex flex-row items-center justify-between gap-4">
                  <div>
                    <CardTitle>Workflow ledger</CardTitle>
                    <CardDescription>Transactions that need attention</CardDescription>
                  </div>
                  <Button variant="outline" size="sm">
                    Export
                  </Button>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Project</TableHead>
                        <TableHead>Owner</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Budget</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((row) => (
                        <TableRow key={row.name}>
                          <TableCell className="font-medium">{row.name}</TableCell>
                          <TableCell>{row.owner}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                row.status === "Approved"
                                  ? "secondary"
                                  : row.status === "Blocked"
                                    ? "destructive"
                                    : "outline"
                              }
                            >
                              {row.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">{row.amount}</TableCell>
                          <TableCell>{row.date}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
                <CardFooter className="justify-between text-sm text-muted-foreground">
                  <span>{inProgress.length} items still need review</span>
                  <Button variant="ghost" size="sm">
                    View archive
                  </Button>
                </CardFooter>
              </Card>
            </div>

            <div className="space-y-6">
              <Card
                className={cn(panelClass)}
                data-surface-id="surface-card-quick-create"
                data-surface-label="Quick create"
                style={getSurfaceStyle("surface-card-quick-create")}
              >
                <CardHeader>
                  <CardTitle>Quick create</CardTitle>
                  <CardDescription>Generate a themed project on the fly.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="project-name">Project name</Label>
                    <Input id="project-name" placeholder="Island Research Sprint" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="project-owner">Owner email</Label>
                    <Input id="project-owner" placeholder="you@kingstack.com" type="email" />
                  </div>
                  <div className="space-y-2">
                    <Label>Scope</Label>
                    <div className="flex flex-col gap-2 text-sm">
                      <label className="flex items-center gap-3">
                        <Checkbox defaultChecked />
                        Design exploration
                      </label>
                      <label className="flex items-center gap-3">
                        <Checkbox defaultChecked />
                        Research interviews
                      </label>
                      <label className="flex items-center gap-3">
                        <Checkbox />
                        Developer prototyping
                      </label>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex gap-3">
                  <Button
                    className="flex-1 font-semibold"
                    style={{
                      backgroundColor: "var(--color-tertiary)",
                      color: "var(--color-on-tertiary)",
                      border: "none",
                    }}
                  >
                    Create workspace
                  </Button>
                  <Button
                    className="flex-1 font-semibold"
                    style={{
                      backgroundColor: "var(--color-secondary)",
                      color: "var(--color-on-secondary)",
                      border: "none",
                    }}
                  >
                    Save draft
                  </Button>
                </CardFooter>
              </Card>

              <Card
                className={cn(panelClass)}
                data-surface-id="surface-card-signals"
                data-surface-label="Signals"
                style={getSurfaceStyle("surface-card-signals")}
              >
                <CardHeader>
                  <CardTitle>Signals</CardTitle>
                  <CardDescription>System generated alerts and nudges.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {notifications.map((note) => (
                    <div
                      key={note.title}
                      data-surface-id={`surface-signal-${slugify(note.title)}`}
                      data-surface-label={note.title}
                      style={getSurfaceStyle(`surface-signal-${slugify(note.title)}`)}
                      className="flex items-start gap-3 rounded-[calc(var(--lab-radius,18px)*0.7)] border border-border/70 p-3"
                    >
                      {note.tone === "warning" && (
                        <AlertTriangle
                          className="mt-0.5 size-4"
                          style={{ color: "var(--color-warning)" }}
                        />
                      )}
                      {note.tone === "success" && (
                        <CheckCircle2
                          className="mt-0.5 size-4"
                          style={{ color: "var(--color-success)" }}
                        />
                      )}
                      {note.tone === "danger" && (
                        <AlertTriangle className="mt-0.5 size-4 text-destructive" />
                      )}
                      <div>
                        <p className="font-medium">{note.title}</p>
                        <p className="text-muted-foreground text-sm">{note.description}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
                <CardFooter>
                  <Button variant="ghost" size="sm" className="ml-auto">
                    Dismiss all
                  </Button>
                </CardFooter>
              </Card>

              <Card
                className={cn(panelClass)}
                data-surface-id="surface-card-team"
                data-surface-label="Team on deck"
                style={getSurfaceStyle("surface-card-team")}
              >
                <CardHeader>
                  <CardTitle>Team on deck</CardTitle>
                  <CardDescription>Showing ownership and availability.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {team.map((member) => (
                    <div key={member.name} className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="bg-primary/10 text-primary">
                          <AvatarFallback>{member.initials}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium leading-tight">{member.name}</p>
                          <p className="text-muted-foreground text-sm">{member.role}</p>
                        </div>
                      </div>
                      <Badge variant="outline">Available</Badge>
                    </div>
                  ))}
                </CardContent>
                <CardFooter>
                  <Button variant="ghost" size="sm">
                    Manage roster
                  </Button>
                </CardFooter>
              </Card>
            </div>
          </div>
            </section>
          </ContextMenuTrigger>
          <ContextMenuContent className="w-72 space-y-2">
            {activeSurface ? (
              <>
                <ContextMenuLabel className="text-xs uppercase tracking-wide text-muted-foreground">
                  {activeSurface.label}
                </ContextMenuLabel>
                {surfacePaletteOptions.map((option) => {
                  const isActive = resolvedSurfaceColor === option.value;
                  return (
                    <ContextMenuItem
                      key={option.label}
                      onSelect={(event) => {
                        event.preventDefault();
                        applySurfaceColor(option.value);
                      }}
                      className="flex items-center gap-3"
                    >
                      <span
                        className="inline-flex size-4 rounded-full border border-border"
                        style={{ backgroundColor: option.value }}
                      />
                      <span className="text-sm">{option.label}</span>
                      {isActive && (
                        <span className="text-xs text-muted-foreground">(active)</span>
                      )}
                    </ContextMenuItem>
                  );
                })}
                <div className="flex items-center justify-between gap-2 rounded-sm border border-border/60 px-2 py-1.5">
                  <span className="text-xs text-muted-foreground">Custom color</span>
                  <input
                    type="color"
                    value={resolvedSurfaceHex}
                    onChange={(event) => applySurfaceColor(event.target.value)}
                    className="size-8 cursor-pointer rounded-md border border-border bg-transparent p-0"
                  />
                </div>
                <ContextMenuSeparator />
                <ContextMenuItem
                  variant="destructive"
                  disabled={!surfaceOverrides[activeSurface.id]}
                  onSelect={(event) => {
                    event.preventDefault();
                    resetSurfaceColor();
                  }}
                >
                  Reset {activeSurface.label}
                </ContextMenuItem>
              </>
            ) : (
              <ContextMenuLabel className="text-sm text-muted-foreground">
                Right-click any surface to customize its fill.
              </ContextMenuLabel>
            )}
          </ContextMenuContent>
        </ContextMenu>
      </div>

      <style jsx global>{`
        [data-theme-lab="true"] {
          font-family: var(--lab-font, var(--font-geist-sans));
        }
        [data-theme-lab="true"] [data-slot="card"],
        [data-theme-lab="true"] section.rounded-3xl {
          border-radius: var(--lab-radius, 18px);
          box-shadow: var(--lab-shadow, 0 12px 24px -18px rgba(15, 23, 42, 0.2));
        }
        [data-theme-lab="true"] [data-slot="button"],
        [data-theme-lab="true"] button[data-slot="button"] {
          border-radius: calc(var(--lab-radius, 18px) * 0.45);
          box-shadow: var(--lab-shadow, 0 10px 18px -14px rgba(15, 23, 42, 0.2));
        }
        [data-theme-lab="true"] [data-slot="input"],
        [data-theme-lab="true"] [data-slot="badge"],
        [data-theme-lab="true"] select,
        [data-theme-lab="true"] textarea {
          border-radius: calc(var(--lab-radius, 18px) * 0.4);
        }
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
            var(--lab-shadow, 6px 6px 0 rgba(0, 0, 0, 0.3)),
            inset 0 0 0 2px var(--color-outline-variant, rgba(0, 0, 0, 0.18));
        }
        [data-theme-lab="true"][data-style="neo-brutalist"] [data-slot="button"],
        [data-theme-lab="true"][data-style="neo-brutalist"] button[data-slot="button"] {
          border-radius: max(calc(var(--lab-radius, 18px) * 0.08), 2px);
          border-width: 2px;
          border-color: var(--color-outline, rgba(0, 0, 0, 0.85));
          box-shadow: 4px 4px 0 rgba(0, 0, 0, 0.3);
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
          box-shadow: 6px 6px 0 rgba(0, 0, 0, 0.35);
          border-color: var(--color-outline-variant, rgba(0, 0, 0, 0.9));
        }
        [data-theme-lab="true"][data-style="neo-brutalist"] [data-slot="button"]:active,
        [data-style="neo-brutalist"] button[data-slot="button"]:active {
          transform: translate(0, 0);
          box-shadow: 2px 2px 0 rgba(0, 0, 0, 0.3);
        }
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
        .neomorph-panel--flat {
          box-shadow: none !important;
          border: 1px solid rgba(255, 255, 255, 0.65);
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
          transition: box-shadow 200ms var(--default-transition-timing-function),
            transform 200ms var(--default-transition-timing-function);
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
            inset 1px 1px 1px rgba(255, 255, 255, 0.9),
            inset -1px -1px 1px rgba(0, 0, 0, 0.15),
            1px 1px 2px rgba(0, 0, 0, 0.2),
            4px 4px 8px rgba(0, 0, 0, 0.18),
            -2px -2px 6px rgba(255, 255, 255, 0.8);
          transform: translateY(-1px);
        }
        [data-style="neomorphism"] [data-slot="button"]:active,
        [data-style="neomorphism"] button[data-slot="button"]:active {
          box-shadow:
            inset 3px 3px 6px rgba(0, 0, 0, 0.2),
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
        .brutalist-hero {
          border: 5px solid var(--color-outline, rgba(0, 0, 0, 0.8));
          padding: 1.5rem;
          box-shadow: 12px 12px 0 rgba(0, 0, 0, 0.55);
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
          box-shadow: 6px 6px 0 rgba(0, 0, 0, 0.5);
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
          opacity: 0.4;
          pointer-events: none;
        }
        .neomorph-hero {
          border-radius: calc(var(--lab-radius, 18px) + 30px);
          padding: 2rem;
          background: radial-gradient(circle at top left, rgba(255, 255, 255, 0.9), rgba(200, 200, 200, 0.3));
          box-shadow:
            -25px -25px 45px rgba(255, 255, 255, 0.9),
            25px 25px 45px rgba(0, 0, 0, 0.15);
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
            -15px -15px 35px rgba(255, 255, 255, 0.8),
            15px 15px 35px rgba(0, 0, 0, 0.12);
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
            -18px -18px 40px rgba(255, 255, 255, 0.9),
            18px 18px 40px rgba(0, 0, 0, 0.18);
          z-index: 45;
        }
        .neomorph-dock-button {
          border-radius: 4px;
          border: none !important;
          box-shadow:
            -6px -6px 14px rgba(255, 255, 255, 0.7),
            6px 6px 14px rgba(0, 0, 0, 0.12);
          background: #f8f9fb;
          color: var(--foreground);
        }
        .neomorph-dock-button:hover {
          transform: translateY(-1px);
          box-shadow:
            -4px -4px 12px rgba(255, 255, 255, 0.8),
            4px 4px 12px rgba(0, 0, 0, 0.18);
        }
        .neomorph-dock-button:active {
          transform: translateY(0);
          box-shadow:
            inset 2px 2px 6px rgba(0, 0, 0, 0.15),
            inset -2px -2px 6px rgba(255, 255, 255, 0.8);
        }
        [data-theme-lab="true"] [data-sidebar="menu-button"],
        [data-theme-lab="true"] [data-sidebar="menu-sub-button"] {
          border-radius: calc(var(--lab-radius, 18px) * 0.5);
        }
      `}</style>

      {styleVariant === "neomorphism" ? (
        <div className="neomorph-dock">
          {designControlsSheet}
          {themeOverridesSheet}
          {surfaceTonesSheet}
        </div>
      ) : (
        <>
          <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3">
            {designControlsSheet}
            {themeOverridesSheet}
          </div>
          <div className="fixed bottom-4 left-1/2 z-30 -translate-x-1/2">
            {surfaceTonesSheet}
          </div>
        </>
      )}
        </main>
      </SidebarInset>
    </SidebarProvider>
    </div>
  );
}

export default function ThemePage() {
  return <ThemeStylePage variant="box" />;
}
