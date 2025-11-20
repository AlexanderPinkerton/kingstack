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
import { Palette } from "lucide-react";
import { cn } from "@/lib/utils";

import { colorToHex } from "../lib/color-utils";
import type { ColorVariable } from "../data/color-tokens";

type PaletteEntry = {
  variable: ColorVariable;
  value: string;
  isOverride: boolean;
};

type ThemeOverridesSheetProps = {
  paletteList: PaletteEntry[];
  variableOverrides: Partial<Record<ColorVariable, string>>;
  setColorOverride: (target: ColorVariable, value: string) => void;
  resetVariable: (target: ColorVariable) => void;
  palettePickerTarget: ColorVariable | null;
  setPalettePickerTarget: (value: ColorVariable | null) => void;
  assignVariable: (target: ColorVariable, source: ColorVariable) => void;
  resetAllOverrides: () => void;
  dockButtonClass?: string;
};

export function ThemeOverridesSheet({
  paletteList,
  variableOverrides,
  setColorOverride,
  resetVariable,
  palettePickerTarget,
  setPalettePickerTarget,
  assignVariable,
  resetAllOverrides,
  dockButtonClass,
}: ThemeOverridesSheetProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          className={cn(
            "gap-2 rounded-full bg-primary text-primary-foreground px-5 shadow-lg shadow-primary/30",
            dockButtonClass,
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
}

