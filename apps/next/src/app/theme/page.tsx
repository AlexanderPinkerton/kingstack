"use client";

import { useState, type CSSProperties } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Droplet,
  Layers,
  SlidersHorizontal,
  Moon,
  Palette,
  Sparkles,
  Square,
  Sun,
} from "lucide-react";
import Link from "next/link";
import { ThemeStyleVariant } from "./styles";
import { colorToHex } from "./lib/color-utils";
import { slugify } from "./lib/slugify";
import { useThemeLabController } from "./hooks/use-theme-lab-controller";

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
import { DesignControlsSheet } from "./components/design-controls-sheet";
import { ThemeOverridesSheet } from "./components/theme-overrides-sheet";
import { SurfaceTonesSheet } from "./components/surface-tones-sheet";

type ThemeStylePageProps = {
  variant?: ThemeStyleVariant;
};

export function ThemeStylePage({ variant = "box" }: ThemeStylePageProps) {
  const controller = useThemeLabController(variant);
  const {
    variant: styleVariant,
    styleLabel,
    heroWrapperClass = "",
    headerBandClass = "",
    panelClass = "",
    heroPanelClass = "",
    dockWrapperClass = "",
    dockButtonClass = "",
    extraCss = "",
    mode,
    setMode,
    themeFiles,
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
    fontOption,
    fontPreset,
    setFontPreset,
    cycleFontPreset,
    shadowPreset,
    setShadowPreset,
    shadowOption,
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
    surfacePaletteOptions,
    resolvedSurfaceColor,
    resolvedSurfaceHex,
    applySurfaceColor,
    resetSurfaceColor,
    setSurfaceColor,
    setSurfaceElevatedColor,
    resetSurfaceTones,
    surfaceOverrides,
    getSurfaceStyle,
    handleSurfaceContextMenu,
    activeSurface,
    setActiveSurface,
    surfaceShadePresets,
    resolvedPrimaryColor,
    resolvedPrimaryOnColor,
    resolvedSecondaryColor,
    resolvedSecondaryOnColor,
  } = controller;
  const [showGlassBackground, setShowGlassBackground] = useState(true);
  const isGlass = styleVariant === "glassmorphism";
  const headerWrapperClass = cn(
    "flex flex-wrap items-center justify-between gap-6",
    !isGlass && heroWrapperClass,
  );
  const headerBandClasses = cn(
    "flex flex-wrap items-center gap-2",
    !isGlass && headerBandClass,
  );
  const workspaceSectionClass = cn(
    "relative overflow-hidden p-6 md:p-8",
    isGlass
      ? "border-none bg-transparent shadow-none backdrop-blur-0"
      : cn("rounded-3xl border border-border bg-background/80 shadow-lg backdrop-blur", panelClass, heroPanelClass),
  );
  const designControlsSheet = (
    <DesignControlsSheet
      radius={radius}
      setRadius={setRadius}
      fontPreset={fontPreset}
      setFontPreset={setFontPreset}
      shadowPreset={shadowPreset}
      setShadowPreset={setShadowPreset}
      resetLayoutControls={resetLayoutControls}
      isLayoutDefault={isLayoutDefault}
      dockButtonClass={dockButtonClass}
    />
  );
  const themeOverridesSheet = (
    <ThemeOverridesSheet
      paletteList={paletteList}
      variableOverrides={variableOverrides}
      setColorOverride={setColorOverride}
      resetVariable={resetVariable}
      palettePickerTarget={palettePickerTarget}
      setPalettePickerTarget={setPalettePickerTarget}
      assignVariable={assignVariable}
      resetAllOverrides={resetAllOverrides}
      dockButtonClass={dockButtonClass}
    />
  );
  const surfaceTonesSheet = (
    <SurfaceTonesSheet
      setSurfaceColor={setSurfaceColor}
      setSurfaceElevatedColor={setSurfaceElevatedColor}
      surfaceShadePresets={surfaceShadePresets}
      resetSurfaceTones={resetSurfaceTones}
      dockButtonClass={dockButtonClass}
    />
  );

  return (
    <div
      className={cn(
        themeClass,
        fontOption.className,
        "relative min-h-screen text-foreground transition-colors",
        isGlass ? "bg-transparent" : "bg-background",
      )}
      data-mode={mode}
      data-theme-lab="true"
      data-style={styleVariant}
      ref={previewRef}
      style={{
        ...previewStyle,
        ...(isGlass && showGlassBackground
          ? {
              ["--glass-backdrop" as keyof CSSProperties]:
                'linear-gradient(160deg, rgba(0, 0, 0, 0.35), rgba(0, 0, 0, 0.65)), url("/photos/plant.jpeg")',
            }
          : {}),
      }}
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
      className={isGlass ? "bg-transparent" : "bg-background"}
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
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={styleVariant === "glassmorphism"}
                    tooltip="Glassmorphism layout"
                  >
                    <Link href="/theme/glassmorphism">
                      <Droplet />
                      <span>Glassmorphism</span>
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
      <SidebarInset className={isGlass ? "bg-transparent" : "bg-background"}>
        <main
          className={cn(
            "min-h-screen px-4 py-12 text-foreground transition-colors md:px-8",
            isGlass ? "bg-transparent" : "bg-background",
          )}
        >
      <div className="mx-auto flex max-w-6xl flex-col gap-10">
        <header className={headerWrapperClass}>
          <div className="space-y-3">
            <div className={headerBandClasses}>
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
                        backgroundColor: resolvedPrimaryColor,
                        color: resolvedPrimaryOnColor,
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
                        backgroundColor: resolvedSecondaryColor,
                        color: resolvedSecondaryOnColor,
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
              {styleVariant === "glassmorphism" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 rounded-full border border-border/80 px-4 text-xs"
                  onClick={() => setShowGlassBackground((prev) => !prev)}
                >
                  {showGlassBackground ? "Hide photo" : "Show photo"}
                </Button>
              )}
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
                {themeFiles.map((theme) => (
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
                    const idx = themeFiles.findIndex((theme) => theme.className === themeClass);
                    const nextIndex = (idx - 1 + themeFiles.length) % themeFiles.length;
                    setThemeClass(themeFiles[nextIndex]?.className ?? themeClass);
                  }}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const idx = themeFiles.findIndex((theme) => theme.className === themeClass);
                    const nextIndex = (idx + 1) % themeFiles.length;
                    setThemeClass(themeFiles[nextIndex]?.className ?? themeClass);
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
              className={workspaceSectionClass}
              data-surface-id="surface-workspace-shell"
              data-surface-label="Workspace shell"
              onContextMenuCapture={handleSurfaceContextMenu}
              style={{
                ...getSurfaceStyle("surface-workspace-shell"),
                ...(isGlass && showGlassBackground
                  ? {
                      backgroundImage: 'url("/photos/plant.jpeg")',
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }
                  : {}),
              }}
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
        ${extraCss}
        [data-theme-lab="true"] [data-sidebar="menu-button"],
        [data-theme-lab="true"] [data-sidebar="menu-sub-button"] {
          border-radius: calc(var(--lab-radius, 18px) * 0.5);
        }
      `}</style>

      {dockWrapperClass ? (
        <div className={dockWrapperClass}>
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
