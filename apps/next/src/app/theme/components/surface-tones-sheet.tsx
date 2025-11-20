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
import { cn } from "@/lib/utils";

import type { SurfaceShadePreset } from "../data/surface-presets";

type SurfaceTonesSheetProps = {
  setSurfaceColor: (value: string) => void;
  setSurfaceElevatedColor: (value: string) => void;
  surfaceShadePresets: SurfaceShadePreset[];
  resetSurfaceTones: () => void;
  dockButtonClass?: string;
};

export function SurfaceTonesSheet({
  setSurfaceColor,
  setSurfaceElevatedColor,
  surfaceShadePresets,
  resetSurfaceTones,
  dockButtonClass,
}: SurfaceTonesSheetProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          className={cn(
            "gap-2 rounded-full bg-background/95 px-5 shadow-lg shadow-primary/20",
            dockButtonClass,
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
                {surfaceShadePresets.map((preset) => (
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
}

