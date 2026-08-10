"use client";

import * as React from "react";
import { Check, Minus } from "lucide-react";
import { cn } from "./utils";

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  indeterminate?: boolean;
  label?: React.ReactNode;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  function Checkbox(
    { className, indeterminate = false, label, id, ...props },
    forwardedRef,
  ) {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;
    const localRef = React.useRef<HTMLInputElement>(null);

    React.useImperativeHandle(forwardedRef, () => localRef.current!);
    React.useEffect(() => {
      if (localRef.current) localRef.current.indeterminate = indeterminate;
    }, [indeterminate]);

    const input = (
      <span className="relative inline-grid size-4 shrink-0 place-items-center">
        <input
          ref={localRef}
          id={inputId}
          type="checkbox"
          className={cn(
            "peer size-4 appearance-none rounded-[5px] border border-border-strong bg-surface shadow-[var(--shadow-xs)] transition-colors checked:border-primary checked:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
          {...props}
        />
        {indeterminate ? (
          <Minus
            aria-hidden="true"
            className="pointer-events-none absolute size-3 text-white opacity-0 peer-checked:opacity-100 peer-indeterminate:opacity-100"
            strokeWidth={3}
          />
        ) : (
          <Check
            aria-hidden="true"
            className="pointer-events-none absolute size-3 text-white opacity-0 peer-checked:opacity-100"
            strokeWidth={3}
          />
        )}
      </span>
    );

    if (!label) return input;

    return (
      <label
        htmlFor={inputId}
        className="inline-flex items-start gap-2.5 text-[13px] leading-5 text-text"
      >
        <span className="mt-0.5">{input}</span>
        <span>{label}</span>
      </label>
    );
  },
);

export interface SwitchProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  label?: string;
}

export const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  function Switch(
    {
      checked: controlledChecked,
      defaultChecked = false,
      onCheckedChange,
      label,
      className,
      disabled,
      onClick,
      ...props
    },
    ref,
  ) {
    const [internalChecked, setInternalChecked] = React.useState(defaultChecked);
    const checked = controlledChecked ?? internalChecked;

    return (
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        className={cn(
          "relative inline-flex h-[22px] w-10 shrink-0 items-center rounded-full border border-transparent bg-border-strong p-0.5 transition-colors aria-checked:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        onClick={(event) => {
          if (controlledChecked === undefined) setInternalChecked(!checked);
          onCheckedChange?.(!checked);
          onClick?.(event);
        }}
        {...props}
      >
        <span
          aria-hidden="true"
          className={cn(
            "size-4 rounded-full bg-white shadow-sm transition-transform duration-200",
            checked ? "translate-x-[18px]" : "translate-x-0",
          )}
        />
      </button>
    );
  },
);

export function ToggleRow({
  title,
  description,
  checked,
  onCheckedChange,
  disabled,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}) {
  const label = typeof title === "string" ? title : undefined;
  return (
    <div className={cn("flex items-start justify-between gap-5", className)}>
      <div className="min-w-0">
        <p className="m-0 text-[13px] font-medium text-text-strong">{title}</p>
        {description && (
          <p className="mt-1 mb-0 text-[12px] leading-5 text-text-muted">
            {description}
          </p>
        )}
      </div>
      <Switch
        className="mt-0.5"
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        label={label}
      />
    </div>
  );
}
