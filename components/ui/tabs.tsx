"use client";

/* eslint-disable react/prop-types */

import * as React from "react";
import { cn } from "./utils";

type TabsVariant = "underline" | "pills";

interface TabsContextValue {
  value: string;
  setValue: (value: string) => void;
  id: string;
  variant: TabsVariant;
}

const TabsContext = React.createContext<TabsContextValue | null>(null);

function useTabsContext(): TabsContextValue {
  const context = React.useContext(TabsContext);
  if (!context) throw new Error("Tabs components must be used inside <Tabs>.");
  return context;
}

export interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  variant?: TabsVariant;
}

export function Tabs({
  value: controlledValue,
  defaultValue = "",
  onValueChange,
  variant = "underline",
  className,
  children,
  ...props
}: TabsProps) {
  const [internalValue, setInternalValue] = React.useState(defaultValue);
  const generatedId = React.useId();
  const value = controlledValue ?? internalValue;

  const setValue = React.useCallback(
    (nextValue: string) => {
      if (controlledValue === undefined) setInternalValue(nextValue);
      onValueChange?.(nextValue);
    },
    [controlledValue, onValueChange],
  );

  return (
    <TabsContext.Provider
      value={{ value, setValue, id: generatedId, variant }}
    >
      <div className={cn("min-w-0", className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export const TabsList = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(function TabsList({ className, onKeyDown, ...props }, ref) {
  const { variant } = useTabsContext();

  const handleKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (event) => {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;

    const tabs = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>(
        '[role="tab"]:not(:disabled)',
      ),
    );
    const currentIndex = tabs.indexOf(document.activeElement as HTMLButtonElement);
    if (currentIndex < 0 || tabs.length === 0) return;

    event.preventDefault();
    let nextIndex = currentIndex;
    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % tabs.length;
    if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = tabs.length - 1;
    tabs[nextIndex]?.focus();
    tabs[nextIndex]?.click();
  };

  return (
    <div
      ref={ref}
      role="tablist"
      tabIndex={-1}
      className={cn(
        "flex max-w-full items-center overflow-x-auto text-[13px]",
        variant === "underline"
          ? "hide-scrollbar gap-5 border-b border-border"
          : "w-fit gap-1 rounded-[10px] bg-surface-subtle p-1",
        className,
      )}
      onKeyDown={handleKeyDown}
      {...props}
    />
  );
});

export interface TabsTriggerProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

export const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
  function TabsTrigger({ value, className, children, onClick, ...props }, ref) {
    const context = useTabsContext();
    const selected = context.value === value;
    const safeValue = encodeURIComponent(value);

    return (
      <button
        ref={ref}
        type="button"
        role="tab"
        id={`${context.id}-tab-${safeValue}`}
        aria-controls={`${context.id}-panel-${safeValue}`}
        aria-selected={selected}
        tabIndex={selected ? 0 : -1}
        className={cn(
          "relative shrink-0 font-medium transition-[color,background-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25",
          context.variant === "underline"
            ? "h-10 rounded-t-md text-text-muted after:absolute after:right-0 after:bottom-[-1px] after:left-0 after:h-0.5 after:origin-center after:scale-x-0 after:rounded-full after:bg-primary after:transition-transform aria-selected:text-text-strong aria-selected:after:scale-x-100"
            : "h-8 rounded-[7px] px-3 text-text-muted hover:text-text-strong aria-selected:bg-surface aria-selected:text-text-strong aria-selected:shadow-[var(--shadow-xs)]",
          className,
        )}
        onClick={(event) => {
          context.setValue(value);
          onClick?.(event);
        }}
        {...props}
      >
        {children}
      </button>
    );
  },
);

export interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  forceMount?: boolean;
}

export const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(
  function TabsContent({ value, forceMount = false, className, ...props }, ref) {
    const context = useTabsContext();
    const selected = context.value === value;
    const safeValue = encodeURIComponent(value);

    if (!selected && !forceMount) return null;

    return (
      <div
        ref={ref}
        role="tabpanel"
        id={`${context.id}-panel-${safeValue}`}
        aria-labelledby={`${context.id}-tab-${safeValue}`}
        hidden={!selected}
        tabIndex={0}
        className={cn(
          "animate-fade-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25",
          className,
        )}
        {...props}
      />
    );
  },
);
