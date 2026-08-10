import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "./utils";

export interface SelectOption {
  label: string;
  value: string;
  disabled?: boolean;
}

export interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "children"> {
  options?: SelectOption[];
  placeholder?: string;
  children?: React.ReactNode;
  wrapperClassName?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  function Select(
    { options, placeholder, children, className, wrapperClassName, ...props },
    ref,
  ) {
    return (
      <div className={cn("relative", wrapperClassName)}>
        <select ref={ref} className={cn("input", className)} {...props}>
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {children ??
            options?.map((option) => (
              <option
                key={option.value}
                value={option.value}
                disabled={option.disabled}
              >
                {option.label}
              </option>
            ))}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-text-subtle"
          strokeWidth={1.8}
        />
      </div>
    );
  },
);

export { Select as NativeSelect };
