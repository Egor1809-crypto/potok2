import { Check } from "lucide-react";
import { cn } from "./utils";

export interface StepItem {
  label: string;
  description?: string;
}

export function Stepper({
  steps,
  currentStep,
  className,
  "aria-label": ariaLabel = "Ход выполнения",
}: {
  steps: StepItem[];
  currentStep: number;
  className?: string;
  "aria-label"?: string;
}) {
  const safeCurrent = Math.min(Math.max(0, currentStep), Math.max(0, steps.length - 1));
  return (
    <ol
      aria-label={ariaLabel}
      className={cn("flex w-full items-start", className)}
    >
      {steps.map((step, index) => {
        const complete = index < safeCurrent;
        const current = index === safeCurrent;
        return (
          <li
            key={`${step.label}-${index}`}
            aria-current={current ? "step" : undefined}
            className={cn(
              "relative flex min-w-0 flex-1 flex-col items-center text-center",
              index < steps.length - 1 &&
                "after:absolute after:top-[15px] after:left-[calc(50%+22px)] after:h-px after:w-[calc(100%-44px)] after:bg-border",
              complete && index < steps.length - 1 && "after:!bg-primary-muted",
            )}
          >
            <span
              className={cn(
                "relative z-10 grid size-8 place-items-center rounded-full border bg-surface text-[11px] font-semibold transition-colors",
                current && "border-primary bg-primary text-white shadow-[0_0_0_4px_var(--primary-subtle)]",
                complete && "border-primary bg-primary-subtle text-primary",
                !current && !complete && "border-border-strong text-text-subtle",
              )}
            >
              {complete ? <Check aria-hidden="true" className="size-3.5" /> : index + 1}
            </span>
            <span
              className={cn(
                "mt-2 block truncate text-[11px] font-medium text-text-muted",
                current && "text-text-strong",
                complete && "text-primary",
              )}
            >
              {step.label}
            </span>
            {step.description && (
              <span className="mt-0.5 hidden max-w-36 text-[10px] leading-4 text-text-subtle sm:block">
                {step.description}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
