"use client";

import { useState } from "react";
import { Check, Trash2, Sparkles, Heart, Zap, Loader2 } from "lucide-react";
import { JuiceButton } from "@/components/ui/juice-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ThemeStyleVariant } from "@/components/ui/juice-button/types";

interface JuiceButtonShowcaseProps {
  themeStyle?: ThemeStyleVariant;
  panelClass?: string;
}

export function JuiceButtonShowcase({ themeStyle = "auto", panelClass }: JuiceButtonShowcaseProps) {
  const [clickCounts, setClickCounts] = useState({ 0: 0, 1: 0, 2: 0, 3: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleAsyncAction = async () => {
    setIsLoading(true);
    setProgress(0);

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
    <section className="space-y-6">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="uppercase tracking-widest">
            Interactive
          </Badge>
          <Badge variant="outline" className="uppercase tracking-widest">
            Juice Buttons
          </Badge>
        </div>
        <h2 className="text-3xl font-semibold">Enhanced Button Interactions</h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Progressive enhancement system with configurable &quot;juice levels&quot; (0-3).
          Automatically adapts to the current theme style with appropriate sounds and animations.
        </p>
      </div>

      {/* Juice Levels Demo */}
      <Card className={cn(panelClass)}>
        <CardHeader>
          <CardTitle>Juice Levels</CardTitle>
          <CardDescription>
            Compare all juice levels from 0 (no enhancement) to 3 (maximum juice)
          </CardDescription>
        </CardHeader>
        <CardContent>
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
                  themeStyle={themeStyle}
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

      {/* Variants Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Standard Variants */}
        <Card className={cn(panelClass)}>
          <CardHeader>
            <CardTitle>Standard Variants</CardTitle>
            <CardDescription>All button variants with juice level 2</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <JuiceButton juice={2} themeStyle={themeStyle} variant="default">
                Default
              </JuiceButton>
              <JuiceButton juice={2} themeStyle={themeStyle} variant="secondary">
                Secondary
              </JuiceButton>
              <JuiceButton juice={2} themeStyle={themeStyle} variant="outline">
                Outline
              </JuiceButton>
              <JuiceButton juice={2} themeStyle={themeStyle} variant="ghost">
                Ghost
              </JuiceButton>
            </div>
          </CardContent>
        </Card>

        {/* Special Variants */}
        <Card className={cn(panelClass)}>
          <CardHeader>
            <CardTitle>Special Variants</CardTitle>
            <CardDescription>Success and destructive with juice level 3</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <JuiceButton juice={3} themeStyle={themeStyle} variant="success">
                <Check className="size-4" />
                Success
              </JuiceButton>
              <JuiceButton
                juice={3}
                themeStyle={themeStyle}
                variant="destructive"
                holdDuration={1500}
                onHoldComplete={() => alert("Confirmed!")}
              >
                <Trash2 className="size-4" />
                Hold to Delete
              </JuiceButton>
            </div>
            <p className="text-xs text-muted-foreground">
              Hold the destructive button for 1.5s to confirm
            </p>
          </CardContent>
        </Card>

        {/* With Icons */}
        <Card className={cn(panelClass)}>
          <CardHeader>
            <CardTitle>With Icons</CardTitle>
            <CardDescription>Juice level 3 with various icons</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <JuiceButton juice={3} themeStyle={themeStyle}>
                <Sparkles className="size-4" />
                Magic
              </JuiceButton>
              <JuiceButton juice={3} themeStyle={themeStyle} variant="secondary">
                <Heart className="size-4" />
                Like
              </JuiceButton>
              <JuiceButton juice={3} themeStyle={themeStyle} variant="outline">
                <Zap className="size-4" />
                Power
              </JuiceButton>
            </div>
          </CardContent>
        </Card>

        {/* Loading States */}
        <Card className={cn(panelClass)}>
          <CardHeader>
            <CardTitle>Loading States</CardTitle>
            <CardDescription>
              Level 3 shows progress and particle effects
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <JuiceButton
                juice={3}
                themeStyle={themeStyle}
                isLoading={isLoading}
                loadingProgress={progress}
                onClick={handleAsyncAction}
              >
                {isLoading ? "Processing..." : "Start Task"}
              </JuiceButton>
              <JuiceButton
                juice={2}
                themeStyle={themeStyle}
                variant="secondary"
                isLoading={isLoading}
                onClick={handleAsyncAction}
              >
                {isLoading ? "Loading..." : "Load Data"}
              </JuiceButton>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Info Box */}
      <Card className={cn("border-primary/20 bg-primary/5", panelClass)}>
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Sparkles className="size-5 text-primary mt-0.5" />
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                <strong className="text-foreground">Theme Adaptive:</strong> These buttons automatically
                detect the current theme style and adjust their sounds, animations, and visual effects
                accordingly.
              </p>
              <p>
                <strong className="text-foreground">Current Theme:</strong> {themeStyle === "auto" ? "Auto-detected" : themeStyle}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
