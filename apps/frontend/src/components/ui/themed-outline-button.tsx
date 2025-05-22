import { Button } from "@/components/ui/button";
import { forwardRef } from "react";
import type { ComponentPropsWithoutRef } from "react";

export const ThemedOutlineButton = forwardRef<HTMLButtonElement, ComponentPropsWithoutRef<"button">>((props, ref) => (
  <Button
    ref={ref}
    variant="outline"
    {...props}
    className={
      "w-full border-[var(--gradient-from)] text-[var(--gradient-to)] bg-gray-900/60 hover:bg-[var(--gradient-from)]/50 focus:ring-2 focus:ring-[var(--gradient-from)] " +
      (props.className || "")
    }
  />
));
ThemedOutlineButton.displayName = "ThemedOutlineButton";
