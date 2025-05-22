import { Input } from "@/components/ui/input";
import { forwardRef } from "react";
import type { ComponentPropsWithoutRef } from "react";

export const ThemedInput = forwardRef<HTMLInputElement, ComponentPropsWithoutRef<"input">>((props, ref) => (
  <Input
    ref={ref}
    {...props}
    className={
      "bg-gray-900/80 border border-[var(--gradient-from)] text-[var(--gradient-to)] placeholder:text-[var(--gradient-from)]/60 focus:ring-2 focus:ring-[var(--gradient-from)] focus:border-[var(--gradient-from)] rounded-md " +
      (props.className || "")
    }
  />
));
ThemedInput.displayName = "ThemedInput";
