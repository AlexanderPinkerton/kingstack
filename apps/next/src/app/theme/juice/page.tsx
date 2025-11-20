"use client";

import { useState } from "react";
import { Volume2, VolumeX, Sparkles, Check, Trash2, Loader2, Heart, Zap, AlertCircle } from "lucide-react";
import { JuiceButton, JuiceProvider, useJuice } from "@/components/ui/juice-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function AudioControls() {
  const { globalMute, toggleMute, volume, setVolume } = useJuice();

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-border bg-background/80 px-4 py-3 shadow-sm">
      <button
        onClick={toggleMute}
        className="flex items-center gap-2 text-sm font-medium transition-colors hover:text-primary"
      >
        {globalMute ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
        {globalMute ? "Unmuted" : "Muted"}
      </button>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Volume</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={volume}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          className="h-2 w-24 cursor-pointer appearance-none rounded-full bg-muted [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
        />
        <span className="text-xs font-mono text-muted-foreground">{Math.round(volume * 100)}%</span>
      </div>
    </div>
  );
}

function JuiceLevelDemo() {
  const [clickCounts, setClickCounts] = useState({ 0: 0, 1: 0, 2: 0, 3: 0 });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Juice Levels</CardTitle>
        <CardDescription>
          Compare all juice levels from 0 (no enhancement) to 3 (maximum juice)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {([0, 1, 2, 3] as const).map((level) => (
            <div key={level} className="space-y-3 rounded-2xl border border-border/70 p-4">
              <div className="flex items-center justify-between">
                <Badge variant={level === 0 ? "outline" : "default"}>Level {level}</Badge>
                <span className="text-xs text-muted-foreground">
                  {clickCounts[level]} clicks
                </span>
              </div>
              <JuiceButton
                juice={level}
                className="w-full"
                onClick={() => setClickCounts((prev) => ({ ...prev, [level]: prev[level] + 1 }))}
              >
                Click me!
              </JuiceButton>
              <p className="text-xs text-muted-foreground">
                {level === 0 && "No enhancements"}
                {level === 1 && "Subtle scale + haptic"}
                {level === 2 && "Enhanced + ripple + sound"}
                {level === 3 && "Maximum + confetti"}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function VariantShowcase() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Variant Showcase</CardTitle>
        <CardDescription>
          All button variants work with juice levels. Try different combinations.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Default variants */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Standard Variants
          </h3>
          <div className="flex flex-wrap gap-3">
            <JuiceButton juice={2} variant="default">Default</JuiceButton>
            <JuiceButton juice={2} variant="secondary">Secondary</JuiceButton>
            <JuiceButton juice={2} variant="outline">Outline</JuiceButton>
            <JuiceButton juice={2} variant="ghost">Ghost</JuiceButton>
            <JuiceButton juice={2} variant="link">Link</JuiceButton>
          </div>
        </div>

        {/* Juice variants */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Juice Variants
          </h3>
          <div className="flex flex-wrap gap-3">
            <JuiceButton juice={3} variant="success">
              <Check className="size-4" />
              Success
            </JuiceButton>
            <JuiceButton juice={2} variant="destructive">
              <Trash2 className="size-4" />
              Destructive
            </JuiceButton>
          </div>
        </div>

        {/* With icons */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            With Icons (Juice Level 3)
          </h3>
          <div className="flex flex-wrap gap-3">
            <JuiceButton juice={3}>
              <Sparkles className="size-4" />
              Magic
            </JuiceButton>
            <JuiceButton juice={3} variant="secondary">
              <Heart className="size-4" />
              Like
            </JuiceButton>
            <JuiceButton juice={3} variant="outline">
              <Zap className="size-4" />
              Power
            </JuiceButton>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LoadingStates() {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleAsyncAction = async () => {
    setIsLoading(true);
    setProgress(0);

    // Simulate progress
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsLoading(false);
          return 0;
        }
        return prev + 10;
      });
    }, 200);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Loading States</CardTitle>
        <CardDescription>
          Juice level 3 shows progress percentage and particle effects while loading
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Juice Level 1</p>
            <JuiceButton juice={1} isLoading={isLoading} onClick={handleAsyncAction} className="w-full">
              {isLoading ? "Loading..." : "Load Data"}
            </JuiceButton>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Juice Level 2</p>
            <JuiceButton juice={2} isLoading={isLoading} onClick={handleAsyncAction} className="w-full">
              {isLoading ? "Processing..." : "Process"}
            </JuiceButton>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Juice Level 3 (with progress)</p>
            <JuiceButton
              juice={3}
              isLoading={isLoading}
              loadingProgress={progress}
              onClick={handleAsyncAction}
              className="w-full"
            >
              {isLoading ? "Working..." : "Start Task"}
            </JuiceButton>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DestructiveDemo() {
  const [deleted, setDeleted] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Hold-to-Confirm (Destructive Actions)</CardTitle>
        <CardDescription>
          At juice level 2+, destructive buttons require holding to confirm. Watch the progress bar.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3 rounded-2xl border border-border/70 bg-muted/30 p-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="size-4 text-destructive" />
              <p className="text-sm font-medium">Juice Level 2</p>
            </div>
            <JuiceButton
              juice={2}
              variant="destructive"
              holdDuration={1500}
              onHoldComplete={() => alert("Deleted (1.5s hold)!")}
              className="w-full"
            >
              <Trash2 className="size-4" />
              Hold to Delete
            </JuiceButton>
            <p className="text-xs text-muted-foreground">
              Hold for 1.5 seconds to confirm deletion
            </p>
          </div>

          <div className="space-y-3 rounded-2xl border border-border/70 bg-muted/30 p-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="size-4 text-destructive" />
              <p className="text-sm font-medium">Juice Level 3</p>
            </div>
            <JuiceButton
              juice={3}
              variant="destructive"
              holdDuration={2000}
              onHoldComplete={() => {
                setDeleted(true);
                setTimeout(() => setDeleted(false), 2000);
              }}
              className="w-full"
            >
              {deleted ? (
                <>
                  <Check className="size-4" />
                  Deleted!
                </>
              ) : (
                <>
                  <Trash2 className="size-4" />
                  Hold 2s to Confirm
                </>
              )}
            </JuiceButton>
            <p className="text-xs text-muted-foreground">
              Hold for 2 seconds, includes shake animation and warning particles
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SizeShowcase() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sizes</CardTitle>
        <CardDescription>All button sizes work with juice effects</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-4">
          <JuiceButton juice={2} size="sm">Small</JuiceButton>
          <JuiceButton juice={2} size="default">Default</JuiceButton>
          <JuiceButton juice={2} size="lg">Large</JuiceButton>
          <JuiceButton juice={2} size="icon">
            <Sparkles className="size-4" />
          </JuiceButton>
        </div>
      </CardContent>
    </Card>
  );
}

function ControlsDemo() {
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [confettiEnabled, setConfettiEnabled] = useState(true);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Controls & Overrides</CardTitle>
        <CardDescription>
          Per-button controls for audio and confetti effects
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={audioEnabled}
              onChange={(e) => setAudioEnabled(e.target.checked)}
              className="size-4 cursor-pointer"
            />
            Audio Enabled
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={confettiEnabled}
              onChange={(e) => setConfettiEnabled(e.target.checked)}
              className="size-4 cursor-pointer"
            />
            Confetti Enabled
          </label>
        </div>
        <div className="flex flex-wrap gap-3">
          <JuiceButton
            juice={3}
            variant="success"
            audioEnabled={audioEnabled}
            confettiEnabled={confettiEnabled}
          >
            <Check className="size-4" />
            Success (Controlled)
          </JuiceButton>
          <JuiceButton juice={3} audioEnabled={audioEnabled} confettiEnabled={confettiEnabled}>
            Click Me (Controlled)
          </JuiceButton>
        </div>
      </CardContent>
    </Card>
  );
}

export default function JuiceButtonsPage() {
  return (
    <JuiceProvider>
      <div className="min-h-screen bg-background px-4 py-12 md:px-8">
        <div className="mx-auto max-w-6xl space-y-10">
          {/* Header */}
          <header className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="uppercase tracking-widest">
                Interactive Demo
              </Badge>
              <Badge variant="outline" className="uppercase tracking-widest">
                Juice Buttons
              </Badge>
            </div>
            <h1 className="text-4xl font-semibold">Juice Button System</h1>
            <p className="max-w-2xl text-base text-muted-foreground">
              Progressive enhancement for buttons with configurable &quot;juice levels&quot; (0-3).
              Automatically adapts to your theme style with audio, confetti, and animation effects.
            </p>
          </header>

          {/* Audio Controls */}
          <AudioControls />

          {/* Demos */}
          <JuiceLevelDemo />
          <VariantShowcase />
          <LoadingStates />
          <DestructiveDemo />
          <SizeShowcase />
          <ControlsDemo />

          {/* Info Section */}
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="size-5 text-primary" />
                How It Works
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                <strong className="text-foreground">Juice Level 0:</strong> Standard button with no enhancements
              </p>
              <p>
                <strong className="text-foreground">Juice Level 1:</strong> Subtle hover scale (1.02x) and haptic-style feedback
              </p>
              <p>
                <strong className="text-foreground">Juice Level 2:</strong> Enhanced scale (1.05x), ripple effect, and click sounds
              </p>
              <p>
                <strong className="text-foreground">Juice Level 3:</strong> Maximum effects with confetti, complex animations, and audio
              </p>
              <p className="pt-2 border-t border-border/50">
                <strong className="text-foreground">Theme Aware:</strong> Automatically detects and adapts to
                box, neo-brutalist, neomorphism, and glassmorphism styles with different sounds and animations.
              </p>
              <p>
                <strong className="text-foreground">Accessibility:</strong> Respects prefers-reduced-motion
                and includes global mute controls. All effects can be overridden per-button.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </JuiceProvider>
  );
}
