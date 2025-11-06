import { Input } from "@/components/ui/input";
import { forwardRef } from "react";
import type { ComponentPropsWithoutRef } from "react";

export const ThemedInput = forwardRef<
  HTMLInputElement,
  ComponentPropsWithoutRef<"input">
>((props, ref) => (
  <Input
    ref={ref}
    {...props}
    className={
      "bg-gray-900/80 border border-[var(--accent-1-d)] text-[var(--accent-1-m)] placeholder:text-[var(--accent-1-d)] focus:ring-2 focus:ring-[var(--accent-1-l)] focus:border-[var(--accent-1-l)] rounded-md " +
      (props.className || "")
    }
  />
));
ThemedInput.displayName = "ThemedInput";
