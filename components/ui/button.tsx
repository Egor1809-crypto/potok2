"use client";

import * as React from "react";
import { LoaderCircle } from "lucide-react";
import { cn } from "./utils";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "danger";

export type ButtonSize = "sm" | "md" | "lg" | "icon";

const variantClasses: Record<ButtonVariant, string> = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  outline: "btn-outline",
  ghost: "btn-ghost",
  danger: "btn-danger",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "btn-sm",
  md: "",
  lg: "btn-lg",
  icon: "btn-icon",
};

export function buttonVariants({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}): string {
  return cn("btn", variantClasses[variant], sizeClasses[size], className);
}

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  loadingText?: string;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      className,
      variant = "primary",
      size = "md",
      loading = false,
      loadingText,
      leadingIcon,
      trailingIcon,
      children,
      disabled,
      type = "button",
      ...props
    },
    ref,
  ) {
    const content = loading && loadingText ? loadingText : children;

    return (
      <button
        ref={ref}
        type={type}
        className={buttonVariants({ variant, size, className })}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? (
          <LoaderCircle
            aria-hidden="true"
            className="size-4 animate-[mf-spin_700ms_linear_infinite]"
          />
        ) : (
          leadingIcon
        )}
        {content}
        {!loading && trailingIcon}
      </button>
    );
  },
);

export interface IconButtonProps extends Omit<ButtonProps, "size"> {
  label: string;
  size?: "sm" | "md";
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton({ label, children, size = "md", className, ...props }, ref) {
    return (
      <Button
        ref={ref}
        size="icon"
        className={cn(size === "sm" && "!size-8 !min-h-8 !min-w-8", className)}
        aria-label={label}
        title={props.title ?? label}
        {...props}
      >
        {children}
      </Button>
    );
  },
);
