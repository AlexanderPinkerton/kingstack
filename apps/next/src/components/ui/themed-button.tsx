import { Button } from "@/components/ui/button";
import { forwardRef } from "react";
import type { ComponentPropsWithoutRef } from "react";

export const ThemedButton = forwardRef<
  HTMLButtonElement,
  ComponentPropsWithoutRef<"button">
>((props, ref) => (
  <Button
    ref={ref}
    {...props}
    className={
      "w-full bg-gradient-to-r from-[var(--gradient-from)] via-[var(--accent-mix)] to-[var(--gradient-to)] text-white font-semibold shadow-lg hover:from-[var(--accent-1-d)] hover:to-[var(--accent-2-d)] focus:ring-2 focus:ring-[var(--accent-1-d)] focus:outline-none border-0 " +
      (props.className || "")
    }
  />
));
ThemedButton.displayName = "ThemedButton";
