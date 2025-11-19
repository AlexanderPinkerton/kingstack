"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        style: {
          background: "var(--popover)",
          color: "var(--popover-foreground)",
          border: "1px solid var(--border)",
          boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
        },
        success: {
          style: {
            background: "var(--color-success)",
            color: "var(--color-on-success)",
            border: "1px solid var(--color-success-contrast)",
          },
        },
        error: {
          style: {
            background: "var(--color-error)",
            color: "var(--color-on-error)",
            border: "1px solid var(--color-error-contrast)",
          },
        },
        warning: {
          style: {
            background: "var(--color-warning)",
            color: "var(--color-on-warning)",
            border: "1px solid var(--color-warning-contrast)",
          },
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
