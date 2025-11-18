"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  SlidersHorizontal,
  Moon,
  Palette,
  Sparkles,
  Sun,
} from "lucide-react";

import "./adonis_rose_yellow.css";
import "./british_phone_booth.css";
import "./island_light.css";
import "./yellow.css";
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

const stats = [
  { label: "Active Workspaces", value: "38", change: "+6 this week" },
  { label: "In-flight Projects", value: "124", change: "+18% MoM" },
  { label: "Open Approvals", value: "9", change: "3 urgent" },
];

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
  "--color-on-warning",
] as const;

type ColorVariable = (typeof COLOR_VARIABLES)[number];

const FONT_OPTIONS = [
  {
    id: "geist",
    label: "Geist Sans",
    value: "var(--font-geist-sans), 'Geist Sans', sans-serif",
    sample: "Modern productivity",
  },
  {
    id: "geist-mono",
    label: "Geist Mono",
    value: "var(--font-geist-mono), 'Geist Mono', monospace",
    sample: "System monitor",
  },
  {
    id: "inter",
    label: "Inter",
    value: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    sample: "Friendly dashboards",
  },
  {
    id: "serif",
    label: "Serif Display",
    value: "'Playfair Display', Georgia, serif",
    sample: "Editorial tone",
  },
];

const SHADOW_PRESETS = [
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
  {
    id: "flat",
    label: "No shadow",
    value: "none",
  },
];

const DEFAULT_RADIUS = 18;

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
    id: "yellow",
    className: "theme-yellow",
    label: "Sunburst Yellow",
    fileName: "yellow.css",
    description: "Bold citrus primaries paired with electric violets.",
  },
];

export default function ThemePage() {
  const [mode, setMode] = useState<"light" | "dark">("light");
  const [themeClass, setThemeClass] = useState(THEME_FILES[0].className);
  const [variableOverrides, setVariableOverrides] =
    useState<Partial<Record<ColorVariable, string>>>({});
  const [selectedVariable, setSelectedVariable] = useState<ColorVariable>(
    COLOR_VARIABLES[0],
  );
  const [paletteValues, setPaletteValues] =
    useState<Partial<Record<ColorVariable, string>>>({});
  const [radius, setRadius] = useState(DEFAULT_RADIUS);
  const [fontPreset, setFontPreset] = useState(FONT_OPTIONS[0].id);
  const [shadowPreset, setShadowPreset] = useState(SHADOW_PRESETS[0].id);
  const previewRef = useRef<HTMLElement | null>(null);
  const inProgress = transactions
    .filter((item) => item.status === "In review")
    .map((item) => item.name);
  const activeTheme = THEME_FILES.find((theme) => theme.className === themeClass);
  const fontOption = useMemo(
    () => FONT_OPTIONS.find((option) => option.id === fontPreset) ?? FONT_OPTIONS[0],
    [fontPreset],
  );
  const shadowOption = useMemo(
    () =>
      SHADOW_PRESETS.find((option) => option.id === shadowPreset) ??
      SHADOW_PRESETS[0],
    [shadowPreset],
  );

  useEffect(() => {
    if (!previewRef.current) return;
    const element = previewRef.current;
    const raf = window.requestAnimationFrame(() => {
      const computed = getComputedStyle(element);
      const nextValues: Partial<Record<ColorVariable, string>> = {};
      COLOR_VARIABLES.forEach((variable) => {
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

  const layoutStyle = useMemo<CSSProperties>(
    () => ({
      ["--lab-radius" as keyof CSSProperties]: `${radius}px`,
      ["--lab-font" as keyof CSSProperties]: fontOption.value,
      ["--lab-shadow" as keyof CSSProperties]: shadowOption.value,
    }),
    [radius, fontOption, shadowOption],
  );

  const previewStyle = useMemo<CSSProperties>(
    () => ({
      ...layoutStyle,
      ...colorStyle,
    }),
    [layoutStyle, colorStyle],
  );

  const assignVariable = (target: ColorVariable, source: ColorVariable) => {
    const sourceValue = paletteValues[source];
    if (!sourceValue) return;
    setVariableOverrides((prev) => ({
      ...prev,
      [target]: sourceValue,
    }));
  };

  const cycleVariable = (target: ColorVariable) => {
    const currentIndex = COLOR_VARIABLES.indexOf(target);
    const nextVar =
      COLOR_VARIABLES[(currentIndex + 1) % COLOR_VARIABLES.length] ?? target;
    assignVariable(target, nextVar);
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

  const resetLayoutControls = () => {
    setRadius(DEFAULT_RADIUS);
    setFontPreset(FONT_OPTIONS[0].id);
    setShadowPreset(SHADOW_PRESETS[0].id);
  };

  const isLayoutDefault =
    radius === DEFAULT_RADIUS &&
    fontPreset === FONT_OPTIONS[0].id &&
    shadowPreset === SHADOW_PRESETS[0].id;

  return (
    <main
      className={cn(
        themeClass,
        "min-h-screen px-4 py-12 text-foreground transition-colors md:px-8",
      )}
      data-mode={mode}
      data-theme-lab="true"
      ref={previewRef}
      style={previewStyle}
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-10">
        <header className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="uppercase tracking-widest">
                Theme Lab
              </Badge>
              {activeTheme && (
                <Badge variant="outline" className="font-mono text-xs">
                  {activeTheme.fileName}
                </Badge>
              )}
            </div>
            <h1 className="mt-3 text-4xl font-semibold">Visual Theme Preview</h1>
            <p className="text-muted-foreground mt-2 max-w-2xl text-base">
              Compare every component against alternative CSS token sets. Currently
              showing{" "}
              <span className="font-medium text-foreground">
                {activeTheme?.label}
              </span>{" "}
              — switch theme files or toggle palette modes to confirm that borders,
              typography, and elevated layers all feel cohesive.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 rounded-full border border-border bg-background/90 p-1 shadow-sm">
            <Button
              variant={mode === "light" ? "default" : "ghost"}
              size="sm"
              className="gap-1.5 rounded-full"
              onClick={() => setMode("light")}
            >
              <Sun className="size-4" />
              Light
            </Button>
            <Button
              variant={mode === "dark" ? "default" : "ghost"}
              size="sm"
              className="gap-1.5 rounded-full"
              onClick={() => setMode("dark")}
            >
              <Moon className="size-4" />
              Dark
            </Button>
          </div>
        </header>

        <section className="rounded-3xl border border-dashed border-border bg-background/70 p-6 shadow-sm md:p-8">
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
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {THEME_FILES.map((theme) => {
              const isActive = theme.className === themeClass;
              return (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => setThemeClass(theme.className)}
                  className={cn(
                    "rounded-2xl border p-4 text-left transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                    isActive
                      ? "border-primary bg-primary/10 shadow-lg"
                      : "border-border bg-muted/20 hover:border-primary/40",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm uppercase tracking-wider text-muted-foreground">
                        {theme.fileName}
                      </p>
                      <p className="text-lg font-semibold text-foreground">
                        {theme.label}
                      </p>
                    </div>
                    {isActive && <Badge>Active</Badge>}
                  </div>
                  <p className="text-muted-foreground mt-2 text-sm">
                    {theme.description}
                  </p>
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-3xl border border-border bg-background/80 p-6 shadow-lg backdrop-blur md:p-8">
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
              <Button className="gap-2">
                Launch report
                <ArrowUpRight className="size-4" />
              </Button>
              <Button variant="outline">Share feedback</Button>
            </div>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1.8fr_1fr]">
            <div className="space-y-6">
              <Card>
                <CardHeader className="flex flex-col gap-1">
                  <CardTitle>Momentum snapshot</CardTitle>
                  <CardDescription>How the team is trending this week</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-5 md:grid-cols-3">
                    {stats.map((stat) => (
                      <div key={stat.label} className="rounded-2xl border border-border/70 p-4">
                        <p className="text-sm text-muted-foreground">{stat.label}</p>
                        <p className="mt-3 text-3xl font-semibold">{stat.value}</p>
                        <p className="text-sm text-primary mt-2 font-medium">{stat.change}</p>
                        <div className="mt-4 h-1.5 rounded-full bg-muted">
                          <div className="h-full rounded-full bg-primary" />
                        </div>
                      </div>
                    ))}
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

              <Card>
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
                      <div className="mt-5 rounded-2xl border border-dashed border-border bg-gradient-to-tr from-primary/15 via-primary/5 to-transparent p-5">
                        <p className="text-sm text-muted-foreground">Forecast</p>
                        <p className="text-4xl font-semibold">$184k</p>
                        <p className="text-sm text-primary mt-2">+24.8% vs last sprint</p>
                        <div className="mt-6 h-36 rounded-2xl bg-[radial-gradient(circle,_var(--color-primary)_0%,_transparent_65%)] opacity-80" />
                      </div>
                    </TabsContent>
                    <TabsContent value="retention">
                      <div className="mt-5 rounded-2xl border border-dashed border-border bg-gradient-to-tr from-secondary/20 via-secondary/5 to-transparent p-5">
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
                      <div className="mt-5 rounded-2xl border border-dashed border-border bg-gradient-to-tr from-accent/30 via-accent/10 to-transparent p-5">
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

              <Card>
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
              <Card>
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
                  <Button className="flex-1">Create workspace</Button>
                  <Button className="flex-1" variant="outline">
                    Save draft
                  </Button>
                </CardFooter>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Signals</CardTitle>
                  <CardDescription>System generated alerts and nudges.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {notifications.map((note) => (
                    <div
                      key={note.title}
                      className="flex items-start gap-3 rounded-2xl border border-border/70 p-3"
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

              <Card>
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
      </div>

      <style jsx global>{`
        [data-theme-lab="true"] {
          font-family: var(--lab-font, var(--font-geist-sans));
        }
        [data-theme-lab="true"] [data-slot="card"],
        [data-theme-lab="true"] section.rounded-3xl {
          border-radius: var(--lab-radius, 18px);
          box-shadow: var(--lab-shadow, 0 35px 60px -30px rgba(15, 23, 42, 0.4));
        }
        [data-theme-lab="true"] [data-slot="button"],
        [data-theme-lab="true"] button[data-slot="button"] {
          border-radius: calc(var(--lab-radius, 18px) * 0.45);
          box-shadow: var(--lab-shadow, 0 25px 45px -25px rgba(15, 23, 42, 0.4));
        }
        [data-theme-lab="true"] [data-slot="input"],
        [data-theme-lab="true"] [data-slot="badge"],
        [data-theme-lab="true"] select,
        [data-theme-lab="true"] textarea {
          border-radius: calc(var(--lab-radius, 18px) * 0.4);
        }
      `}</style>

      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3">
        <Sheet>
          <SheetTrigger asChild>
            <Button className="gap-2 rounded-full bg-background/90 px-5 shadow-lg shadow-primary/20">
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
                <div className="grid gap-3">
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
                        style={{ fontFamily: option.value }}
                      >
                        {option.sample}
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

        <Sheet>
          <SheetTrigger asChild>
            <Button className="gap-2 rounded-full bg-primary text-primary-foreground px-5 shadow-lg shadow-primary/30">
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
                Reassign CSS variables to any palette color to stress-test extreme
                combinations.
              </SheetDescription>
            </SheetHeader>

            <div className="flex flex-col gap-6 px-4 pb-6">
              <div className="space-y-2">
                <Label htmlFor="variable-select" className="text-sm font-medium">
                  Target variable
                </Label>
                <select
                  id="variable-select"
                  value={selectedVariable}
                  onChange={(event) => setSelectedVariable(event.target.value as ColorVariable)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 font-mono text-xs"
                >
                  {COLOR_VARIABLES.map((variable) => (
                    <option key={variable} value={variable}>
                      {variable}
                    </option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => cycleVariable(selectedVariable)}>
                    Cycle color
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => resetVariable(selectedVariable)}
                    disabled={!variableOverrides[selectedVariable]}
                  >
                    Reset
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-semibold">Assign from palette</p>
                <div className="grid grid-cols-2 gap-3">
                  {paletteList.map(({ variable, value, isOverride }) => (
                    <button
                      key={variable}
                      type="button"
                      onClick={() => assignVariable(selectedVariable, variable)}
                      className={cn(
                        "rounded-2xl border p-3 text-left text-xs font-mono transition hover:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring",
                        isOverride ? "border-primary/70 bg-primary/10" : "border-border",
                      )}
                    >
                      <span className="text-muted-foreground block">{variable}</span>
                      <span className="mt-2 inline-flex items-center gap-2">
                        <span
                          className="inline-block size-6 rounded-md border"
                          style={{ backgroundColor: value || "transparent" }}
                        />
                        <span className="truncate text-[11px] text-foreground">{value || "—"}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-semibold">Quick swap buttons</p>
                <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                  {paletteList.map(({ variable, value }) => (
                    <div
                      key={`swap-${variable}`}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 px-3 py-2"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className="inline-block size-8 rounded-lg border"
                          style={{ backgroundColor: value || "transparent" }}
                        />
                        <div>
                          <p className="font-mono text-xs">{variable}</p>
                          <p className="text-muted-foreground text-[11px]">{value || "—"}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs"
                          onClick={() => cycleVariable(variable)}
                        >
                          Change color
                        </Button>
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
                  ))}
                </div>
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
      </div>
    </main>
  );
}
