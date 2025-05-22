import { Label } from "@/components/ui/label";
import { forwardRef } from "react";
import type { ComponentPropsWithoutRef } from "react";

export const ThemedLabel = forwardRef<HTMLLabelElement, ComponentPropsWithoutRef<"label">>((props, ref) => (
  <Label
    ref={ref}
    {...props}
    className={
      "text-[var(--accent-1-sl)] font-medium " + (props.className || "")
    }
  />
));
ThemedLabel.displayName = "ThemedLabel";
