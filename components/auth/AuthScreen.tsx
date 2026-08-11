"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";

import { Avatar } from "@/components/ui/avatar";
import { BrandMark } from "@/components/layout/brand-mark";
import { demoUser, workspaceConfig } from "@/config/brand";

/**
 * MAILFLOW currently has one ready-to-use account. Login and registration
 * routes share this hand-off instead of pretending to manage credentials or
 * permissions that do not exist in the MVP.
 */
export function AuthScreen() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 py-10 text-text-strong">
      <section
        aria-labelledby="workspace-entry-title"
        aria-live="polite"
        className="w-full max-w-[430px] rounded-2xl border border-border bg-surface p-6 shadow-[0_18px_55px_rgba(15,23,42,0.08)] sm:p-8"
      >
        <BrandMark href="/" />
        <p className="mt-8 text-[10px] font-semibold uppercase tracking-[0.13em] text-primary">
          Единый аккаунт
        </p>
        <h1
          id="workspace-entry-title"
          className="mt-2 text-[26px] font-semibold tracking-[-0.035em]"
        >
          Открываем рабочее пространство
        </h1>
        <p className="mt-2 text-[13px] leading-6 text-text-muted">
          В MVP нет выбора ролей и отдельных способов входа. Участнику доступны
          все функции продукта.
        </p>

        <div className="mt-6 flex items-center gap-3 rounded-xl border border-border bg-surface-subtle/70 p-3">
          <Avatar name={demoUser.name} size="md" status="online" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold">
              {demoUser.name}
            </span>
            <span className="block truncate text-[11px] text-text-muted">
              {workspaceConfig.name} · {demoUser.role}
            </span>
          </span>
        </div>

        <Link
          href="/dashboard"
          className="mt-6 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground outline-none transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
        >
          Перейти в MAILFLOW
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </section>
    </main>
  );
}
