import { Button } from "@/components/ui/button";
import { forwardRef } from "react";
import type { ComponentPropsWithoutRef } from "react";

export const ThemedOutlineButton = forwardRef<
  HTMLButtonElement,
  ComponentPropsWithoutRef<"button">
>((props, ref) => (
  <Button
    ref={ref}
    variant="outline"
    {...props}
    className={
      "w-full border-[var(--accent-1-d)] via-[var(--accent-mix)] text-[var(--accent-1-l)] bg-gray-900/60 hover:bg-[var(--accent-1-m)] focus:ring-2 focus:ring-[var(--accent-1-d)] " +
      (props.className || "")
    }
  />
));
ThemedOutlineButton.displayName = "ThemedOutlineButton";
