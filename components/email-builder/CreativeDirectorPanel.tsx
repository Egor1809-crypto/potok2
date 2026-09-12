"use client";

import { useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  CircleAlert,
  Palette,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  WandSparkles,
} from "lucide-react";

import { Badge, Button, Modal } from "@/components/ui";
import { cn } from "@/components/ui/utils";

import type { BuilderDocument } from "./builder-types";
import {
  analyzeEmailQuality,
  applyEditorialPolish,
  applyEmailDesignSystem,
  applyEmailQualityFix,
  applyNarrativeRecipe,
  emailDesignSystems,
  emailNarrativeRecipes,
  previewNarrativeRecipe,
  type EmailQualitySeverity,
} from "./email-design-director";

type DirectorTab = "audit" | "systems" | "story";

const dimensionLabels = {
  copy: "Текст",
  design: "Дизайн",
  conversion: "Действие",
  trust: "Доверие",
  mobile: "Мобильный",
};

const severityLabels: Record<EmailQualitySeverity, string> = {
  critical: "Критично",
  warning: "Важно",
  suggestion: "Усиление",
};

export function CreativeDirectorPanel({
  open,
  onOpenChange,
  document,
  onApply,
  embedded = false,
}: {
  embedded?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: BuilderDocument;
  onApply: (document: BuilderDocument, message: string) => void;
}) {
  const [tab, setTab] = useState<DirectorTab>("audit");
  const [lastApplied, setLastApplied] = useState("");
  const report = useMemo(() => analyzeEmailQuality(document), [document]);
  const fixableIssues = useMemo(
    () => report.issues.filter((issue) => issue.fixId && issue.fixLabel),
    [report.issues],
  );

  const apply = (next: BuilderDocument, message: string) => {
    onApply(next, message);
    setLastApplied(message);
  };

  const applySafeFixes = () => {
    const next = fixableIssues.reduce(
      (current, issue) =>
        issue.fixId ? applyEmailQualityFix(current, issue.fixId) : current,
      document,
    );
    apply(
      next,
      `Применено улучшений: ${fixableIssues.length}`,
    );
  };

  const content = (
      <div className="director-stage grid min-h-[660px] lg:grid-cols-[318px_minmax(0,1fr)]">
        <aside className="border-b border-white/10 bg-[radial-gradient(circle_at_20%_0%,rgba(124,92,255,.30),transparent_35%),linear-gradient(180deg,#17181f,#101116)] p-5 text-white lg:border-b-0 lg:border-r">
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.055] p-5 shadow-[0_18px_50px_rgba(0,0,0,.22)]">
            <span className="absolute -right-8 -top-8 size-28 rounded-full bg-[#8b7cff]/15 blur-2xl" aria-hidden="true" />
            <div className="flex items-end justify-between gap-4">
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">
                  Качество редакции
                </span>
                <div className="mt-2 flex items-baseline gap-1">
                  <strong className="text-[58px] font-semibold leading-none tracking-[-.07em]">
                    {report.score}
                  </strong>
                  <span className="text-[13px] text-white/45">/ 100</span>
                </div>
              </div>
              <span
                aria-hidden="true"
                className="grid size-14 place-items-center rounded-full"
                style={{
                  background: `radial-gradient(circle at center,#17181d 62%,transparent 64%),conic-gradient(#8b7cff ${report.score * 3.6}deg,#33353c 0deg)`,
                }}
              >
                <ScanSearch className="size-5 text-[#a99fff]" />
              </span>
            </div>
            <p className="mb-0 mt-4 text-[12px] font-medium leading-5 text-white/82">
              {report.verdict}
            </p>
            <p className="mb-0 mt-1 text-[10px] leading-4 text-white/45">
              {report.signals.words} слов · {report.signals.blocks} блоков · {report.signals.actions} действий · {report.signals.colors} цветов
            </p>
          </div>

          <div className="mt-5 grid gap-3">
            {Object.entries(report.dimensions).map(([key, value]) => (
              <div key={key}>
                <div className="mb-1.5 flex items-center justify-between text-[10px]">
                  <span className="text-white/58">
                    {dimensionLabels[key as keyof typeof dimensionLabels]}
                  </span>
                  <span className="font-mono text-white/82">{value}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                  <span
                    className="block h-full rounded-full bg-[linear-gradient(90deg,#8b7cff,#d58cff)] transition-[width] duration-500"
                    style={{ width: `${value}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {fixableIssues.length ? (
            <button
              type="button"
              onClick={applySafeFixes}
              className="mt-5 flex w-full items-center justify-between rounded-xl border border-[#b9b1ff]/30 bg-[linear-gradient(135deg,rgba(139,124,255,.24),rgba(213,140,255,.12))] px-4 py-3 text-left outline-none transition duration-200 hover:-translate-y-0.5 hover:border-[#b9b1ff]/55 hover:bg-[#8b7cff]/25 focus-visible:ring-2 focus-visible:ring-[#8b7cff]"
            >
              <span>
                <strong className="block text-[12px]">
                  Исправить безопасные замечания
                </strong>
                <span className="mt-0.5 block text-[9px] leading-4 text-white/55">
                  {fixableIssues.length} правок без изменения фактов и ссылок
                </span>
              </span>
              <Sparkles aria-hidden="true" className="size-4 text-[#d8d3ff]" />
            </button>
          ) : null}

          <button
            type="button"
            disabled={!document.blocks.length}
            onClick={() =>
              apply(
                applyEditorialPolish(document),
                "Редакционная чистка применена",
              )
            }
            className="mt-3 flex w-full items-center justify-between rounded-xl border border-white/12 bg-white/[0.055] px-4 py-3 text-left outline-none transition duration-200 hover:-translate-y-0.5 hover:bg-white/[0.09] focus-visible:ring-2 focus-visible:ring-[#8b7cff] disabled:cursor-not-allowed disabled:opacity-45"
          >
            <span>
              <strong className="block text-[12px]">Редакционная чистка</strong>
              <span className="mt-0.5 block text-[9px] leading-4 text-white/48">
                Убрать нейроклише и собрать строгий ритм
              </span>
            </span>
            <WandSparkles aria-hidden="true" className="size-4 text-[#bdb6ff]" />
          </button>
          <p className="mb-0 mt-2 text-[9px] leading-4 text-white/38">
            Смысл и факты сохраняются. Меняются только клише, центровка длинного текста, типографика и визуальные токены.
          </p>
        </aside>

        <section className="min-w-0 bg-[linear-gradient(180deg,var(--surface),var(--surface-subtle))]">
          <div className="border-b border-border bg-surface px-4 py-4 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-[8px] font-semibold uppercase tracking-[.16em] text-primary">
                  Режиссёрский пульт
                </span>
                <h3 className="m-0 mt-1 text-[16px] font-semibold tracking-[-.025em] text-text-strong">
                  Один маршрут вместо набора случайных эффектов
                </h3>
              </div>
              <div className="flex items-center gap-1.5 text-[8px] font-semibold text-text-subtle">
                <span className="rounded-full bg-primary-subtle px-2 py-1 text-primary">01 Разбор</span>
                <span>→</span>
                <span className="rounded-full bg-surface-subtle px-2 py-1">02 Стиль</span>
                <span>→</span>
                <span className="rounded-full bg-surface-subtle px-2 py-1">03 Сюжет</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-1 border-b border-border bg-surface/90 px-4 py-2.5 sm:px-6">
            {(
              [
                ["audit", "Разбор", ScanSearch],
                ["systems", "Дизайн-системы", Palette],
                ["story", "Драматургия", Sparkles],
              ] as const
            ).map(([value, label, Icon]) => (
              <button
                key={value}
                type="button"
                aria-pressed={tab === value}
                onClick={() => setTab(value)}
                className="relative inline-flex h-9 items-center gap-2 rounded-lg px-3 text-[11px] font-semibold text-text-muted outline-none transition hover:bg-surface-subtle aria-pressed:bg-primary-subtle aria-pressed:text-primary focus-visible:ring-2 focus-visible:ring-primary/30 after:absolute after:inset-x-3 after:-bottom-[11px] after:h-0.5 after:scale-x-0 after:rounded-full after:bg-primary after:transition-transform aria-pressed:after:scale-x-100"
              >
                <Icon aria-hidden="true" className="size-3.5" />
                {label}
                {value === "audit" && report.issues.length ? (
                  <span className="rounded-full bg-current/10 px-1.5 py-0.5 text-[9px]">
                    {report.issues.length}
                  </span>
                ) : null}
              </button>
            ))}
          </div>

          <div className="max-h-[540px] overflow-y-auto p-4 scrollbar-subtle sm:p-6">
            {tab === "audit" ? (
              <AuditTab
                report={report}
                onFix={(fixId, label) =>
                  apply(applyEmailQualityFix(document, fixId), label)
                }
              />
            ) : null}
            {tab === "systems" ? (
              <div>
                <div className="max-w-2xl">
                  <h3 className="m-0 text-[18px] font-semibold tracking-[-.025em] text-text-strong">
                    Один характер — на всё письмо
                  </h3>
                  <p className="mt-1.5 text-[11px] leading-5 text-text-muted">
                    Система одновременно меняет палитру, типографику, отступы, радиусы, карточки и рамку. Контент остаётся прежним.
                  </p>
                </div>
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  {emailDesignSystems.map((system) => (
                    <article
                      key={system.id}
                      className="group overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-xs)] transition duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[var(--shadow-md)]"
                    >
                      <div
                        className="grid min-h-28 content-between p-4"
                        style={{ backgroundColor: system.bodyBackground }}
                      >
                        <div className="flex gap-1.5">
                          {system.palette.map((color) => (
                            <span
                              key={color}
                              className="size-5 rounded-full border border-black/10"
                              style={{ backgroundColor: color }}
                              title={color}
                            />
                          ))}
                        </div>
                        <span
                          className="mt-5 text-[19px] font-bold leading-tight"
                          style={{
                            color: system.textColor,
                            fontFamily: system.headingFont,
                          }}
                        >
                          {system.name}
                        </span>
                      </div>
                      <div className="p-4">
                        <span className="text-[9px] font-semibold uppercase tracking-[.12em] text-primary">
                          {system.eyebrow}
                        </span>
                        <p className="mb-0 mt-2 text-[11px] leading-5 text-text-muted">
                          {system.description}
                        </p>
                        <p className="mb-0 mt-2 text-[9px] leading-4 text-text-subtle">
                          {system.bestFor}
                        </p>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="mt-4 w-full"
                          disabled={!document.blocks.length}
                          onClick={() =>
                            apply(
                              applyEmailDesignSystem(document, system.id),
                              `Применена система «${system.name}»`,
                            )
                          }
                        >
                          Применить ко всему письму
                        </Button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}
            {tab === "story" ? (
              <div>
                <div className="max-w-2xl">
                  <h3 className="m-0 text-[18px] font-semibold tracking-[-.025em] text-text-strong">
                    Письмо как аргумент, а не стопка блоков
                  </h3>
                  <p className="mt-1.5 text-[11px] leading-5 text-text-muted">
                    Режиссёр определит роль каждого существующего блока и изменит только порядок. Текст, ссылки, изображения и дизайн останутся прежними; недостающие роли будут отмечены, но не заменены заглушками.
                  </p>
                </div>
                <div className="mt-5 grid gap-3 xl:grid-cols-2">
                  {emailNarrativeRecipes.map((recipe) => {
                    const preview = previewNarrativeRecipe(document, recipe.id);
                    const missing = [
                      !preview.hasOpener ? "нет сильного входа" : "",
                      !preview.hasProof ? "нет доказательства" : "",
                      !preview.hasAction ? "нет действия" : "",
                    ].filter(Boolean);
                    return (
                      <article
                        key={recipe.id}
                        className="group rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow-xs)] transition duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[var(--shadow-md)]"
                      >
                      <span className="text-[9px] font-semibold uppercase tracking-[.12em] text-primary">
                        {recipe.eyebrow}
                      </span>
                      <h4 className="mb-0 mt-2 text-[15px] font-semibold text-text-strong">
                        {recipe.name}
                      </h4>
                      <p className="mb-0 mt-1.5 text-[10px] leading-5 text-text-muted">
                        {recipe.description}
                      </p>
                      <div className="mt-4 flex flex-wrap items-center gap-1.5">
                        {recipe.sequence.map((step, index) => (
                          <span key={step} className="contents">
                            <span className="rounded-md border border-border bg-surface-subtle px-2 py-1 text-[9px] font-medium text-text-muted">
                              {step}
                            </span>
                            {index < recipe.sequence.length - 1 ? (
                              <ArrowRight aria-hidden="true" className="size-3 text-text-subtle" />
                            ) : null}
                          </span>
                        ))}
                      </div>
                      <div className="mt-4 rounded-lg bg-surface-subtle px-3 py-2.5 text-[9px] leading-4 text-text-muted">
                        <strong className="font-semibold text-text-strong">
                          {preview.movedBlocks
                            ? `Изменит позиции ${preview.movedBlocks} из ${preview.totalBlocks} блоков.`
                            : "Композиция уже соответствует этому сценарию."}
                        </strong>
                        {missing.length ? (
                          <span className="mt-0.5 block text-warning">
                            Не хватает: {missing.join(", ")}.
                          </span>
                        ) : (
                          <span className="mt-0.5 block">
                            Все ключевые роли уже есть в письме.
                          </span>
                        )}
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="mt-4 w-full"
                        disabled={!preview.movedBlocks}
                        onClick={() =>
                          apply(
                            applyNarrativeRecipe(document, recipe.id),
                            `Сценарий «${recipe.name}»: переставлено ${preview.movedBlocks} блоков`,
                          )
                        }
                      >
                        {preview.movedBlocks
                          ? "Перестроить только порядок"
                          : "Порядок уже выстроен"}
                      </Button>
                      </article>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </section>
      </div>
  );
  if (embedded) return content;
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Арт-директор · редактура целиком"
      description="Разбор → дизайн-система → драматургия. Каждый шаг объясняет, что изменится, и сохраняет факты, ссылки и изображения."
      size="full"
      contentClassName="!p-0"
      footer={
        <>
          {lastApplied ? (
            <span className="mr-auto inline-flex items-center gap-1.5 text-[11px] font-medium text-success">
              <Check aria-hidden="true" className="size-3.5" />
              {lastApplied}
            </span>
          ) : null}
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Вернуться к письму
          </Button>
        </>
      }
    >
      {content}
    </Modal>
  );
}

function AuditTab({
  report,
  onFix,
}: {
  report: ReturnType<typeof analyzeEmailQuality>;
  onFix: (
    fixId: NonNullable<(typeof report.issues)[number]["fixId"]>,
    message: string,
  ) => void;
}) {
  if (!report.issues.length) {
    return (
      <div className="grid min-h-96 place-items-center text-center">
        <div className="max-w-sm">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-success-subtle text-success">
            <ShieldCheck aria-hidden="true" className="size-5" />
          </span>
          <h3 className="mt-4 text-[17px] font-semibold text-text-strong">
            Сильная редакция
          </h3>
          <p className="mt-2 text-[11px] leading-5 text-text-muted">
            Критичных шаблонных сигналов, визуального дрейфа и технических рисков не найдено.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="m-0 text-[18px] font-semibold tracking-[-.025em] text-text-strong">
            Что мешает письму выглядеть сильным
          </h3>
          <p className="mt-1.5 text-[11px] leading-5 text-text-muted">
            Сначала доверие и смысл, затем композиция и декоративные детали.
          </p>
        </div>
        <Badge variant="neutral">{report.issues.length} наблюдений</Badge>
      </div>
      <div className="mt-5 grid gap-2.5">
        {report.issues.map((issue) => (
          <article
            key={issue.id}
            className={cn(
              "grid gap-3 rounded-xl border p-3.5 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center",
              issue.severity === "critical"
                ? "border-danger/20 bg-danger-subtle/45"
                : issue.severity === "warning"
                  ? "border-warning/20 bg-warning-subtle/35"
                  : "border-border bg-surface-subtle/50",
            )}
          >
            <span
              className={cn(
                "grid size-8 place-items-center rounded-lg",
                issue.severity === "critical"
                  ? "bg-danger-subtle text-danger"
                  : issue.severity === "warning"
                    ? "bg-warning-subtle text-warning"
                    : "bg-primary-subtle text-primary",
              )}
            >
              <CircleAlert aria-hidden="true" className="size-4" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <strong className="text-[12px] text-text-strong">
                  {issue.title}
                </strong>
                <span className="text-[8px] font-semibold uppercase tracking-[.1em] text-text-subtle">
                  {severityLabels[issue.severity]} · {dimensionLabels[issue.dimension]}
                </span>
              </div>
              <p className="mb-0 mt-1 text-[10px] leading-4 text-text-muted">
                {issue.description}
              </p>
            </div>
            {issue.fixId && issue.fixLabel ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onFix(issue.fixId!, issue.fixLabel!)}
              >
                {issue.fixLabel}
              </Button>
            ) : (
              <span className="hidden size-8 place-items-center rounded-lg border border-border bg-surface text-text-subtle sm:grid">
                <ArrowRight aria-hidden="true" className="size-3.5" />
              </span>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
