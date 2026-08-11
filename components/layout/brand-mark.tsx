import Link from "next/link";
import { Mail } from "lucide-react";

import { BRAND_NAME } from "@/config/brand";

type BrandMarkProps = {
  compact?: boolean;
  href?: string;
  className?: string;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function BrandMark({
  compact = false,
  href = "/dashboard",
  className,
}: BrandMarkProps) {
  return (
    <Link
      href={href}
      aria-label={`${BRAND_NAME}: обзор`}
      className={cx(
        "inline-flex min-w-0 items-center gap-2.5 rounded-lg outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
        className,
      )}
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-primary text-primary-foreground shadow-[0_1px_2px_rgba(25,22,55,0.2),0_6px_18px_rgba(99,91,255,0.18)]">
        <Mail aria-hidden="true" className="size-[17px]" strokeWidth={2} />
      </span>
      {!compact ? (
        <span className="truncate text-[15px] font-semibold tracking-[0.08em] text-text-strong">
          {BRAND_NAME}
        </span>
      ) : null}
    </Link>
  );
}
