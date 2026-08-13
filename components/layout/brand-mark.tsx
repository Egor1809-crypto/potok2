import Link from "next/link";
import Image from "next/image";

import { BRAND_NAME, brandConfig } from "@/config/brand";

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
      <Image
        src={brandConfig.logoPath}
        alt=""
        width={32}
        height={32}
        className="size-8 shrink-0 rounded-[10px] object-cover shadow-[0_1px_2px_rgba(25,22,55,0.2),0_6px_18px_rgba(99,91,255,0.18)]"
      />
      {!compact ? (
        <span className="truncate text-[15px] font-semibold tracking-[0.08em] text-text-strong">
          {BRAND_NAME}
        </span>
      ) : null}
    </Link>
  );
}
