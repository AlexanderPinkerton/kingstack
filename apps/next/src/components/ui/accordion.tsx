"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type AccordionContextValue = {
  value: string[];
  onValueChange: (value: string[]) => void;
  type: "single" | "multiple";
};

const AccordionContext = React.createContext<AccordionContextValue | null>(
  null,
);

function useAccordion() {
  const context = React.useContext(AccordionContext);
  if (!context) {
    throw new Error("Accordion components must be used within an Accordion");
  }
  return context;
}

interface AccordionProps {
  type: "single" | "multiple";
  defaultValue?: string | string[];
  children: React.ReactNode;
  className?: string;
  collapsible?: boolean;
}

const Accordion = React.forwardRef<HTMLDivElement, AccordionProps>(
  ({ type, defaultValue, children, className, collapsible, ...props }, ref) => {
    const [value, setValue] = React.useState<string[]>(() => {
      if (defaultValue) {
        return Array.isArray(defaultValue) ? defaultValue : [defaultValue];
      }
      return [];
    });

    const onValueChange = React.useCallback((newValue: string[]) => {
      setValue(newValue);
    }, []);

    return (
      <AccordionContext.Provider value={{ value, onValueChange, type }}>
        <div ref={ref} className={cn("space-y-2", className)} {...props}>
          {children}
        </div>
      </AccordionContext.Provider>
    );
  },
);
Accordion.displayName = "Accordion";

interface AccordionItemProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

const AccordionItem = React.forwardRef<HTMLDivElement, AccordionItemProps>(
  ({ value: itemValue, children, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("border-b", className)}
        data-value={itemValue}
        {...props}
      >
        {children}
      </div>
    );
  },
);
AccordionItem.displayName = "AccordionItem";

interface AccordionTriggerProps {
  children: React.ReactNode;
  className?: string;
}

const AccordionTrigger = React.forwardRef<
  HTMLButtonElement,
  AccordionTriggerProps
>(({ className, children, ...props }, ref) => {
  const { value, onValueChange, type } = useAccordion();
  const itemValue = React.useContext(AccordionItemContext);

  if (!itemValue) {
    throw new Error("AccordionTrigger must be used within an AccordionItem");
  }

  const isOpen = value.includes(itemValue);

  const handleClick = () => {
    if (type === "single") {
      onValueChange(isOpen ? [] : [itemValue]);
    } else {
      onValueChange(
        isOpen ? value.filter((v) => v !== itemValue) : [...value, itemValue],
      );
    }
  };

  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        "flex w-full flex-1 items-center justify-between py-4 font-medium transition-all hover:underline text-left",
        className,
      )}
      onClick={handleClick}
      aria-expanded={isOpen}
      {...props}
    >
      {children}
      <svg
        className={cn(
          "h-4 w-4 shrink-0 transition-transform duration-200",
          isOpen && "rotate-180",
        )}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 9l-7 7-7-7"
        />
      </svg>
    </button>
  );
});
AccordionTrigger.displayName = "AccordionTrigger";

const AccordionItemContext = React.createContext<string | null>(null);

const AccordionItemWithContext = React.forwardRef<
  HTMLDivElement,
  AccordionItemProps
>(({ value, children, ...props }, ref) => {
  return (
    <AccordionItemContext.Provider value={value}>
      <AccordionItem ref={ref} value={value} {...props}>
        {children}
      </AccordionItem>
    </AccordionItemContext.Provider>
  );
});
AccordionItemWithContext.displayName = "AccordionItem";

interface AccordionContentProps {
  children: React.ReactNode;
  className?: string;
}

const AccordionContent = React.forwardRef<
  HTMLDivElement,
  AccordionContentProps
>(({ className, children, ...props }, ref) => {
  const { value } = useAccordion();
  const itemValue = React.useContext(AccordionItemContext);

  if (!itemValue) {
    throw new Error("AccordionContent must be used within an AccordionItem");
  }

  const isOpen = value.includes(itemValue);

  return (
    <div
      ref={ref}
      className={cn(
        "overflow-hidden text-sm transition-all",
        isOpen ? "animate-accordion-down" : "animate-accordion-up hidden",
      )}
      {...props}
    >
      {isOpen && <div className={cn("pb-4 pt-0", className)}>{children}</div>}
    </div>
  );
});
AccordionContent.displayName = "AccordionContent";

export {
  Accordion,
  AccordionItemWithContext as AccordionItem,
  AccordionTrigger,
  AccordionContent,
};
