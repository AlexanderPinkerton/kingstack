import { Input } from "@/components/ui/input";
import { forwardRef } from "react";
import type { ComponentPropsWithoutRef } from "react";

export const ThemedInput = forwardRef<HTMLInputElement, ComponentPropsWithoutRef<"input">>((props, ref) => (
  <Input
    ref={ref}
    {...props}
    className={
      "bg-gray-900/80 border border-[var(--accent-1-d)] text-cyan-100 placeholder:text-cyan-400/60 focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 rounded-md " +
      (props.className || "")
    }
  />
));
ThemedInput.displayName = "ThemedInput";
