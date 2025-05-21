import { Button } from "@/components/ui/button";
import { forwardRef } from "react";
import type { ComponentPropsWithoutRef } from "react";

export const ThemedButton = forwardRef<HTMLButtonElement, ComponentPropsWithoutRef<"button">>((props, ref) => (
  <Button
    ref={ref}
    {...props}
    className={
      "w-full bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-semibold shadow-lg hover:from-cyan-400 hover:to-purple-500 focus:ring-2 focus:ring-cyan-400 focus:outline-none border-0 " +
      (props.className || "")
    }
  />
));
ThemedButton.displayName = "ThemedButton";
