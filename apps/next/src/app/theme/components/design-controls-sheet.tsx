import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

import { FONT_OPTIONS } from "../data/fonts";
import { SHADOW_PRESETS } from "../data/shadow-presets";

type DesignControlsSheetProps = {
  radius: number;
  setRadius: (value: number) => void;
  fontPreset: string;
  setFontPreset: (id: string) => void;
  shadowPreset: string;
  setShadowPreset: (id: string) => void;
  resetLayoutControls: () => void;
  isLayoutDefault: boolean;
  dockButtonClass?: string;
};

export function DesignControlsSheet({
  radius,
  setRadius,
  fontPreset,
  setFontPreset,
  shadowPreset,
  setShadowPreset,
  resetLayoutControls,
  isLayoutDefault,
  dockButtonClass,
}: DesignControlsSheetProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          className={cn(
            "gap-2 rounded-full bg-background/90 px-5 shadow-lg shadow-primary/20",
            dockButtonClass,
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
}

