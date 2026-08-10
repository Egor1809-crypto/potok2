"use client";

import * as React from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
} from "lucide-react";
import { cn } from "./utils";

export type ToastTone = "success" | "error" | "warning" | "info";

export interface ToastOptions {
  id?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  tone?: ToastTone;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastRecord extends ToastOptions {
  id: string;
}

interface ToastContextValue {
  toast: (options: ToastOptions) => string;
  dismiss: (id: string) => void;
  success: (title: React.ReactNode, description?: React.ReactNode) => string;
  error: (title: React.ReactNode, description?: React.ReactNode) => string;
  info: (title: React.ReactNode, description?: React.ReactNode) => string;
  warning: (title: React.ReactNode, description?: React.ReactNode) => string;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);
let toastSequence = 0;

const toneConfig: Record<
  ToastTone,
  { icon: React.ComponentType<{ className?: string }>; iconClass: string }
> = {
  success: { icon: CheckCircle2, iconClass: "bg-success-subtle text-success" },
  error: { icon: AlertCircle, iconClass: "bg-danger-subtle text-danger" },
  warning: { icon: AlertTriangle, iconClass: "bg-warning-subtle text-warning" },
  info: { icon: Info, iconClass: "bg-info-subtle text-info" },
};

export interface ToastSurfaceProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title: React.ReactNode;
  description?: React.ReactNode;
  tone?: ToastTone;
  action?: ToastOptions["action"];
  onDismiss?: () => void;
}

export function ToastSurface({
  title,
  description,
  tone = "info",
  action,
  onDismiss,
  className,
  ...props
}: ToastSurfaceProps) {
  const config = toneConfig[tone];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "pointer-events-auto flex w-full items-start gap-3 rounded-[13px] border border-border bg-surface-raised p-3.5 shadow-[var(--shadow-md)] animate-[mf-slide-up_220ms_var(--ease-out)]",
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-[9px]",
          config.iconClass,
        )}
      >
        <Icon aria-hidden="true" className="size-4" />
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="m-0 text-[13px] leading-5 font-semibold text-text-strong">
          {title}
        </p>
        {description && (
          <p className="mt-0.5 mb-0 text-[12px] leading-4.5 text-text-muted">
            {description}
          </p>
        )}
        {action && (
          <button
            type="button"
            className="mt-2 rounded text-[12px] font-semibold text-primary hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
            onClick={action.onClick}
          >
            {action.label}
          </button>
        )}
      </div>
      {onDismiss && (
        <button
          type="button"
          aria-label="Dismiss notification"
          onClick={onDismiss}
          className="grid size-7 shrink-0 place-items-center rounded-[7px] text-text-subtle transition-colors hover:bg-surface-subtle hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
        >
          <X aria-hidden="true" className="size-3.5" />
        </button>
      )}
    </div>
  );
}

export function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: ToastRecord[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div
      className="pointer-events-none fixed right-4 bottom-4 z-[160] flex w-[min(380px,calc(100vw-32px))] flex-col gap-2.5"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((item) => (
        <ToastSurface
          key={item.id}
          role={item.tone === "error" ? "alert" : "status"}
          title={item.title}
          description={item.description}
          tone={item.tone}
          action={item.action}
          onDismiss={() => onDismiss(item.id)}
        />
      ))}
    </div>
  );
}

export function ToastProvider({
  children,
  duration = 3800,
  limit = 4,
}: {
  children: React.ReactNode;
  duration?: number;
  limit?: number;
}) {
  const [toasts, setToasts] = React.useState<ToastRecord[]>([]);
  const timers = React.useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = React.useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = React.useCallback(
    (options: ToastOptions) => {
      const id = options.id ?? `mf-toast-${++toastSequence}`;
      setToasts((current) => [
        ...current.filter((item) => item.id !== id),
        { ...options, id },
      ].slice(-limit));

      const existingTimer = timers.current.get(id);
      if (existingTimer) clearTimeout(existingTimer);
      const toastDuration = options.duration ?? duration;
      if (toastDuration > 0) {
        timers.current.set(id, setTimeout(() => dismiss(id), toastDuration));
      }
      return id;
    },
    [dismiss, duration, limit],
  );

  React.useEffect(
    () => () => {
      timers.current.forEach((timer) => clearTimeout(timer));
      timers.current.clear();
    },
    [],
  );

  const value = React.useMemo<ToastContextValue>(
    () => ({
      toast,
      dismiss,
      success: (title, description) => toast({ title, description, tone: "success" }),
      error: (title, description) => toast({ title, description, tone: "error" }),
      info: (title, description) => toast({ title, description, tone: "info" }),
      warning: (title, description) => toast({ title, description, tone: "warning" }),
    }),
    [dismiss, toast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = React.useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside <ToastProvider>.");
  return context;
}

export const Toaster = ToastProvider;
