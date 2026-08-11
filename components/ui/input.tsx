"use client";

/* eslint-disable react/prop-types */

import * as React from "react";
import { Search, X } from "lucide-react";
import { cn } from "./utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  function Input({ className, invalid, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn("input", className)}
        aria-invalid={invalid || props["aria-invalid"] || undefined}
        {...props}
      />
    );
  },
);

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn("input", className)} {...props} />;
});

export interface SearchInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  wrapperClassName?: string;
  onClear?: () => void;
}

export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  function SearchInput(
    { className, wrapperClassName, onClear, value, defaultValue, ...props },
    ref,
  ) {
    const hasValue = value != null ? String(value).length > 0 : Boolean(defaultValue);

    return (
      <div className={cn("relative", wrapperClassName)}>
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-subtle"
          strokeWidth={1.8}
        />
        <Input
          ref={ref}
          type="search"
          value={value}
          defaultValue={defaultValue}
          className={cn("pr-9 pl-9 [&::-webkit-search-cancel-button]:hidden", className)}
          {...props}
        />
        {onClear && hasValue && (
          <button
            type="button"
            onClick={onClear}
            aria-label="Очистить поиск"
            className="absolute top-1/2 right-2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-text-subtle transition-colors hover:bg-surface-subtle hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            <X aria-hidden="true" className="size-3.5" />
          </button>
        )}
      </div>
    );
  },
);

export interface FormFieldProps {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}

export function FormField({
  label,
  hint,
  error,
  required,
  htmlFor,
  children,
  className,
}: FormFieldProps) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      {label && (
        <label
          htmlFor={htmlFor}
          className="text-[12px] leading-5 font-medium text-text-strong"
        >
          {label}
          {required && (
            <span className="ml-0.5 text-danger" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      {children}
      {(error || hint) && (
        <p
          className={cn(
            "m-0 text-[11px] leading-4",
            error ? "text-danger" : "text-text-muted",
          )}
          role={error ? "alert" : undefined}
        >
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

export function InputGroup({
  prefix,
  suffix,
  children,
  className,
}: {
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-10 items-center overflow-hidden rounded-[var(--radius-md)] border border-border-strong bg-surface shadow-[var(--shadow-xs)] transition-[border-color,box-shadow] focus-within:border-[var(--border-focus)] focus-within:shadow-[var(--shadow-focus)]",
        className,
      )}
    >
      {prefix && (
        <span className="flex shrink-0 items-center pl-3 text-[12px] text-text-muted">
          {prefix}
        </span>
      )}
      <div className="min-w-0 flex-1 [&_.input]:border-0 [&_.input]:shadow-none [&_.input]:focus:shadow-none">
        {children}
      </div>
      {suffix && (
        <span className="flex shrink-0 items-center pr-3 text-[12px] text-text-muted">
          {suffix}
        </span>
      )}
    </div>
  );
}
