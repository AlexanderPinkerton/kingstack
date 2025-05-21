import { Button } from "@/components/ui/button";
import { forwardRef } from "react";
import type { ComponentPropsWithoutRef } from "react";

export const ThemedOutlineButton = forwardRef<HTMLButtonElement, ComponentPropsWithoutRef<"button">>((props, ref) => (
  <Button
    ref={ref}
    variant="outline"
    {...props}
    className={
      "w-full border-cyan-400 text-cyan-200 bg-gray-900/60 hover:bg-cyan-900/50 focus:ring-2 focus:ring-cyan-400 " +
      (props.className || "")
    }
  />
));
ThemedOutlineButton.displayName = "ThemedOutlineButton";
