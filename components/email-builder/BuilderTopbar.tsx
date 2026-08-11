"use client";

import Link from "next/link";
import {
  ArrowRight,
  Check,
  Cloud,
  Monitor,
  Redo2,
  Save,
  Smartphone,
  Undo2,
} from "lucide-react";

import { Button, IconButton, Tooltip, buttonVariants } from "@/components/ui";
import { cn } from "@/components/ui/utils";

import type { PreviewMode } from "./builder-types";

type BuilderTopbarProps = {
  campaignName: string;
  onCampaignNameChange: (name: string) => void;
  previewMode: PreviewMode;
  onPreviewModeChange: (mode: PreviewMode) => void;
  canUndo: boolean;
  canRedo: boolean;
  dirty: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onContinue: () => void;
  continueHref: string;
};

export function BuilderTopbar({
  campaignName,
  onCampaignNameChange,
  previewMode,
  onPreviewModeChange,
  canUndo,
  canRedo,
  dirty,
  onUndo,
  onRedo,
  onSave,
  onContinue,
  continueHref,
}: BuilderTopbarProps) {
  return (
    <div className="flex min-h-[60px] shrink-0 items-center justify-between gap-3 border-b border-border bg-surface px-3 sm:px-4">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <div className="min-w-0">
          <label htmlFor="builder-campaign-name" className="sr-only">
            Название кампании
          </label>
          <input
            id="builder-campaign-name"
            value={campaignName}
            onChange={(event) => onCampaignNameChange(event.target.value)}
            className="block h-7 w-[150px] min-w-0 truncate rounded-md border-0 bg-transparent px-1 text-[12px] font-semibold text-text-strong outline-none transition hover:bg-surface-subtle focus:bg-surface-subtle focus:ring-2 focus:ring-primary/25 sm:w-[210px] sm:text-[13px]"
          />
          <span className="hidden items-center gap-1.5 px-1 text-[9px] text-text-subtle sm:flex">
            {dirty ? (
              <>
                <Cloud aria-hidden="true" className="size-2.5" />
                Есть несохранённые изменения
              </>
            ) : (
              <>
                <Check aria-hidden="true" className="size-2.5 text-success" />
                Все изменения сохранены
              </>
            )}
          </span>
        </div>

        <div className="hidden h-5 w-px bg-border sm:block" />
        <div className="hidden items-center gap-0.5 sm:flex">
          <Tooltip content="Отменить · ⌘Z">
            <IconButton label="Отменить" variant="ghost" size="sm" disabled={!canUndo} onClick={onUndo}>
              <Undo2 aria-hidden="true" className="size-3.5" />
            </IconButton>
          </Tooltip>
          <Tooltip content="Повторить · ⇧⌘Z">
            <IconButton label="Повторить" variant="ghost" size="sm" disabled={!canRedo} onClick={onRedo}>
              <Redo2 aria-hidden="true" className="size-3.5" />
            </IconButton>
          </Tooltip>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <div className="hidden items-center rounded-[9px] bg-surface-subtle p-1 md:flex" aria-label="Размер предпросмотра">
          <button
            type="button"
            aria-label="Предпросмотр на компьютере"
            aria-pressed={previewMode === "desktop"}
            onClick={() => onPreviewModeChange("desktop")}
            className="grid size-7 place-items-center rounded-[7px] text-text-subtle outline-none transition hover:text-text aria-pressed:bg-surface aria-pressed:text-primary aria-pressed:shadow-[var(--shadow-xs)] focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            <Monitor aria-hidden="true" className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label="Предпросмотр на смартфоне"
            aria-pressed={previewMode === "mobile"}
            onClick={() => onPreviewModeChange("mobile")}
            className="grid size-7 place-items-center rounded-[7px] text-text-subtle outline-none transition hover:text-text aria-pressed:bg-surface aria-pressed:text-primary aria-pressed:shadow-[var(--shadow-xs)] focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            <Smartphone aria-hidden="true" className="size-3.5" />
          </button>
        </div>

        <Button
          variant="secondary"
          size="sm"
          aria-label="Сохранить письмо"
          onClick={onSave}
          className="px-2 sm:px-3"
        >
          <Save aria-hidden="true" className="size-3.5" />
          <span className="hidden lg:inline">Сохранить</span>
        </Button>
        <Link
          href={continueHref}
          onClick={onContinue}
          className={buttonVariants({
            variant: "primary",
            size: "sm",
            className: "px-2.5 sm:px-3",
          })}
        >
          <span className="hidden sm:inline">Продолжить</span>
          <ArrowRight aria-hidden="true" className="size-3.5" />
        </Link>
      </div>
    </div>
  );
}

export function MobilePreviewToggle({
  value,
  onChange,
  className,
}: {
  value: PreviewMode;
  onChange: (value: PreviewMode) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center rounded-[9px] bg-surface-subtle p-1", className)}>
      {(["desktop", "mobile"] as const).map((mode) => (
        <button
          key={mode}
          type="button"
          aria-pressed={value === mode}
          onClick={() => onChange(mode)}
          className="flex h-7 items-center gap-1.5 rounded-[7px] px-2.5 text-[10px] font-medium capitalize text-text-muted outline-none transition aria-pressed:bg-surface aria-pressed:text-primary aria-pressed:shadow-[var(--shadow-xs)] focus-visible:ring-2 focus-visible:ring-primary/30"
        >
          {mode === "desktop" ? <Monitor aria-hidden="true" className="size-3" /> : <Smartphone aria-hidden="true" className="size-3" />}
          {mode === "desktop" ? "Компьютер" : "Смартфон"}
        </button>
      ))}
    </div>
  );
}
