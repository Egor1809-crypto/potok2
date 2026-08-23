"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  ImagePlus,
  LoaderCircle,
  Sparkles,
  Upload,
  WandSparkles,
} from "lucide-react";

import {
  Alert,
  Badge,
  Button,
  FormField,
  Input,
  Modal,
  Select,
  Textarea,
} from "@/components/ui";
import {
  AiCreationModePicker,
  type AiCreationSource,
} from "@/components/ai/AiCreationModePicker";
import type {
  ApiError,
  EmailAiResponse,
  EmailAiSuggestion,
  EmailAssetMutationResponse,
  EmailAssetRecord,
  EmailTemplateRecord,
  EmailTemplatesListResponse,
} from "@/types/api";
import type { BuilderDocument } from "./builder-types";

type Stage = "prompt" | "questions";
type ComparisonView = "ai" | "current" | "split";
type BriefQuestion = NonNullable<EmailAiSuggestion["questions"]>[number];

function nextPromptSuggestion(value: string) {
  if (!value.trim()) return "";
  const normalized = value.toLocaleLowerCase("ru-RU");
  if (value.trim().length < 12)
    return " для конкретной аудитории и с одним главным действием";
  if (
    !/(для кого|аудитор|юрист|руководител|клиент|партн[её]р|участник)/.test(
      normalized,
    )
  )
    return ". Получатели — укажите должности или тип компаний";
  if (
    !/(цель|регистрац|купить|заказ|ответ|встреч|скачать|перейти|приглас)/.test(
      normalized,
    )
  )
    return ". Цель письма — укажите одно действие читателя";
  if (
    !/(до \d|срок|дат|сентябр|октябр|ноябр|декабр|январ|феврал|март|апрел|ма[йя]|июн|июл|август)/.test(
      normalized,
    )
  )
    return ". Срок или дата — укажите, если они важны";
  if (!/https:\/\//.test(normalized))
    return ". Ссылка главной кнопки — https://…";
  return ". Выберите арт-направление ниже — ИИ не будет смешивать стили";
}

function fallbackBriefQuestions(goal: string): BriefQuestion[] {
  const normalized = goal.toLocaleLowerCase("ru-RU");
  const isEvent = /конференц|вебинар|мероприят|форум|встреч/.test(normalized);
  const isLegal = /юрист|прав|legal|комплаенс|договор/.test(normalized);
  return [
    {
      id: "audience_role",
      question: "Кого приглашаем?",
      placeholder: "Другая роль или отрасль",
      required: true,
      options: isLegal
        ? ["Юристы in-house", "Юридические фирмы", "Комплаенс", "Legal ops", "Госорганы"]
        : ["Действующие клиенты", "Потенциальные клиенты", "Руководители", "Специалисты", "Партнёры"],
      multiple: true,
    },
    {
      id: "audience_level",
      question: "Какой уровень должности?",
      placeholder: "Уточните уровень",
      required: true,
      options: ["Руководители", "Специалисты", "Смешанная аудитория"],
      multiple: false,
    },
    {
      id: "offer",
      question: "Что человек должен получить?",
      placeholder: "Сформулируйте свой результат",
      required: true,
      options: isEvent
        ? ["Готовые сценарии", "Разбор рисков", "Практические кейсы", "Новые контакты"]
        : ["Понять пользу", "Получить предложение", "Решить задачу", "Узнать об изменениях"],
      multiple: true,
    },
    ...(isEvent
      ? [
          {
            id: "program",
            question: "Какие темы важнее?",
            placeholder: "Добавьте тему программы",
            required: false,
            options: isLegal
              ? ["Внедрение ИИ", "Риски и комплаенс", "Автоматизация договоров", "Legal ops", "Судебная практика"]
              : ["Практические кейсы", "Стратегия", "Инструменты", "Разбор ошибок", "Вопросы экспертам"],
            multiple: true,
          },
          {
            id: "format",
            question: "Как пройдёт событие?",
            placeholder: "Другой формат",
            required: false,
            options: ["Очно", "Онлайн", "Гибрид"],
            multiple: false,
          },
          {
            id: "participation",
            question: "Какие условия участия?",
            placeholder: "Укажите стоимость или условие",
            required: false,
            options: ["Бесплатно", "Платно", "По приглашению", "По регистрации"],
            multiple: false,
          },
        ] satisfies BriefQuestion[]
      : []),
    {
      id: "proof",
      question: "Чем подтвердить обещание?",
      placeholder: "Добавьте точный факт",
      required: false,
      options: isEvent
        ? ["Спикеры", "Программа", "Кейсы", "Партнёры", "Цифры прошлых лет"]
        : ["Кейс", "Цифра", "Отзыв", "Демонстрация", "Гарантия"],
      multiple: true,
    },
    {
      id: "timing",
      question: "Насколько срочно действовать?",
      placeholder: "Укажите точную дату или срок",
      required: false,
      options: ["Сегодня", "В течение недели", "До конкретной даты", "Без срочности"],
      multiple: false,
    },
    {
      id: "action",
      question: "Какое главное действие?",
      placeholder: "Другое действие",
      required: true,
      options: isEvent
        ? ["Зарегистрироваться", "Получить билет", "Запросить приглашение", "Ответить на письмо"]
        : ["Перейти на сайт", "Ответить", "Оставить заявку", "Купить", "Скачать"],
      multiple: false,
    },
  ];
}

export function AiEmailAssistant({
  document,
  onApply,
}: {
  document: BuilderDocument;
  onApply: (document: BuilderDocument) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>("prompt");
  const [creativeSource, setCreativeSource] =
    useState<AiCreationSource>("original");
  const [templates, setTemplates] = useState<EmailTemplateRecord[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatesError, setTemplatesError] = useState("");
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [provider, setProvider] = useState<EmailAiResponse["provider"]>();
  const [goal, setGoal] = useState("");
  const [useLinkedContext, setUseLinkedContext] = useState(true);
  const [questions, setQuestions] = useState<BriefQuestion[]>([]);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [answerChoices, setAnswerChoices] = useState<Record<string, string[]>>(
    {},
  );
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [ctaLabel, setCtaLabel] = useState("Узнать подробнее");
  const [ctaUrl, setCtaUrl] = useState("");
  const [designBrief, setDesignBrief] = useState("");
  const [visualStyle, setVisualStyle] = useState<
    "minimal" | "editorial" | "bold" | "premium"
  >("minimal");
  const [socialLinks, setSocialLinks] = useState<
    Record<"telegram" | "vk" | "linkedin" | "website", string>
  >({ telegram: "", vk: "", linkedin: "", website: "" });
  const [assetKind, setAssetKind] = useState<"photo" | "logo">("photo");
  const [assets, setAssets] = useState<EmailAssetRecord[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [suggestion, setSuggestion] = useState<EmailAiSuggestion | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [comparisonView, setComparisonView] = useState<ComparisonView>("ai");
  const [previewHtml, setPreviewHtml] = useState<{
    current: string;
    ai: string;
  } | null>(null);
  const detectedUrl = goal.match(/https:\/\/[^\s]+/)?.[0] ?? "";
  const promptSuggestion = nextPromptSuggestion(goal);
  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId),
    [selectedTemplateId, templates],
  );
  const activeQuestion = questions[activeQuestionIndex];
  const answerForQuestion = (question: BriefQuestion) =>
    [...(answerChoices[question.id] ?? []), answers[question.id]?.trim() ?? ""]
      .filter(Boolean)
      .join(", ");
  const answeredQuestions = questions.filter((question) =>
    answerForQuestion(question),
  ).length;

  useEffect(() => {
    let active = true;
    void fetch("/api/ai/email-assistant", { cache: "no-store" })
      .then((response) => response.json() as Promise<EmailAiResponse>)
      .then((body) => {
        if (active) {
          setConfigured(body.configured);
          setProvider(body.provider);
        }
      })
      .catch(() => {
        if (active) setConfigured(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (creativeSource !== "library" || templates.length) return;
    let active = true;
    void fetch("/api/templates", { cache: "no-store" })
      .then(async (response) => {
        const body = (await response.json()) as
          | EmailTemplatesListResponse
          | ApiError;
        if (!response.ok || !("templates" in body))
          throw new Error(
            "error" in body ? body.error : "Библиотека не загрузилась.",
          );
        if (!active) return;
        const ordered = [...body.templates].sort(
          (left, right) =>
            Number(right.isFavorite) - Number(left.isFavorite) ||
            Number(right.isStarter) - Number(left.isStarter) ||
            left.name.localeCompare(right.name, "ru"),
        );
        setTemplates(ordered);
        setSelectedTemplateId((current) => current || ordered[0]?.id || "");
      })
      .catch((caught) => {
        if (active)
          setTemplatesError(
            caught instanceof Error
              ? caught.message
              : "Библиотека не загрузилась.",
          );
      })
      .finally(() => {
        if (active) setTemplatesLoading(false);
      });
    return () => {
      active = false;
    };
  }, [creativeSource, templates.length]);

  const upload = async (file: File) => {
    setUploading(true);
    setError("");
    try {
      const preparedFile = await prepareImageFile(file);
      const form = new FormData();
      form.set("file", preparedFile);
      form.set("kind", assetKind);
      const response = await fetch("/api/assets", {
        method: "POST",
        body: form,
      });
      const raw = await response.text();
      const body = (() => {
        try {
          return JSON.parse(raw) as EmailAssetMutationResponse | ApiError;
        } catch {
          return {
            error:
              response.status === 413
                ? "Файл слишком большой. Выберите изображение до 4 МБ."
                : "Сервер не принял изображение.",
          };
        }
      })();
      if (!response.ok || !("asset" in body))
        throw new Error("error" in body ? body.error : "Файл не загружен.");
      setAssets((current) => [...current, body.asset]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Файл не загружен.");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const prepareQuestions = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/ai/email-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "brief",
          goal: useLinkedContext ? goal : goal.replace(/https:\/\/[^\s]+/g, ""),
          tone: "expert",
        }),
      });
      const body = (await response.json()) as EmailAiResponse | ApiError;
      if (!response.ok || !("suggestion" in body))
        throw new Error(
          "error" in body ? body.error : "Не удалось подготовить вопросы.",
        );
      setQuestions(body.suggestion?.questions ?? []);
      setAnswers({});
      setAnswerChoices({});
      setActiveQuestionIndex(0);
      setStage("questions");
    } catch {
      // Уточнения не должны зависеть от доступности внешнего ИИ: если провайдер
      // временно не отвечает, пользователь всё равно продолжает сценарий.
      setQuestions(fallbackBriefQuestions(goal));
      setAnswers({});
      setAnswerChoices({});
      setActiveQuestionIndex(0);
      setStage("questions");
      setError("");
    } finally {
      setBusy(false);
    }
  };

  const generate = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/ai/email-assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          action: "design",
          creativeSource,
          templateReference:
            creativeSource === "library" && selectedTemplate
              ? {
                  id: selectedTemplate.id,
                  isStarter: selectedTemplate.isStarter,
                  name: selectedTemplate.name,
                  category: selectedTemplate.category,
                  description: selectedTemplate.description,
                  document: selectedTemplate.builderDocument,
                }
              : undefined,
          goal: useLinkedContext ? goal : goal.replace(/https:\/\/[^\s]+/g, ""),
          tone: "expert",
          websiteUrl:
            ctaUrl.trim() ||
            [...goal.matchAll(/https:\/\/[^\s]+/g)].map((item) => item[0])[0],
          ctaLabel: ctaLabel.trim() || "Узнать подробнее",
          designBrief: designBrief.trim(),
          visualStyle,
          visualContent: "image-and-pattern",
          socialLinks: [
            ["Telegram", socialLinks.telegram],
            ["ВКонтакте", socialLinks.vk],
            ["LinkedIn", socialLinks.linkedin],
            ["Сайт", socialLinks.website],
          ].flatMap(([label, url]) =>
            url.trim() ? [{ label, url: url.trim() }] : [],
          ),
          includeLogo: assets.some((asset) => asset.kind === "logo"),
          imageSource: assets.some((asset) => asset.kind === "photo")
            ? "none"
            : "generate",
          availableAssets: assets.map(({ id, filename, kind, url }) => ({
            id,
            filename,
            kind,
            url,
          })),
          briefAnswers: questions
            .map((question) => ({
              question: question.question,
              answer: answerForQuestion(question),
            }))
            .filter((item) => item.answer),
        }),
      });
      const body = (await response.json()) as EmailAiResponse | ApiError;
      if (!response.ok || !("suggestion" in body) || !body.suggestion?.document)
        throw new Error(
          "error" in body ? body.error : "Дизайн не подготовлен.",
        );
      setSuggestion(body.suggestion);
      const [currentPreview, aiPreview] = await Promise.all(
        [document, body.suggestion.document].map(async (value) => {
          const result = await fetch("/api/email-export", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(value),
          });
          return ((await result.json()) as { html: string }).html;
        }),
      );
      setPreviewHtml({ current: currentPreview, ai: aiPreview });
      setConfigured(true);
      setProvider(body.provider);
      setComparisonView("ai");
      setComparisonOpen(true);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Дизайн не подготовлен.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mx-auto grid min-h-0 w-full max-w-4xl flex-1 auto-rows-max content-start gap-6 overflow-y-auto overscroll-contain p-5 pb-24 scrollbar-subtle [scrollbar-gutter:stable] sm:p-8 sm:pb-24">
      <Modal
        open={comparisonOpen}
        onOpenChange={setComparisonOpen}
        title="Сравнение редакций"
        description="Проверяйте письмо целиком или переключайтесь между версиями. Ваш макет не изменится без подтверждения."
        size="full"
        contentClassName="!p-4 sm:!p-5"
        footer={
          <>
            <Button variant="ghost" onClick={() => setComparisonOpen(false)}>
              Продолжить с моим
            </Button>
            <Button
              variant="primary"
              disabled={!suggestion?.document}
              onClick={() => {
                if (suggestion?.document)
                  onApply(suggestion.document as BuilderDocument);
                setComparisonOpen(false);
              }}
            >
              Заменить на вариант ИИ
            </Button>
          </>
        }
      >
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface-subtle p-2">
          {(
            [
              ["ai", "Вариант ИИ"],
              ["current", "Мой макет"],
              ["split", "Рядом"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={comparisonView === value}
              onClick={() => setComparisonView(value)}
              className="rounded-lg px-3 py-2 text-[11px] font-semibold text-text-muted outline-none transition hover:bg-surface aria-pressed:bg-surface aria-pressed:text-primary aria-pressed:shadow-sm focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              {label}
            </button>
          ))}
          <span className="ml-auto text-[10px] text-text-subtle">
            Предпросмотр настоящего HTML · 640 пикс.
          </span>
        </div>
        <details
          className="mb-4 rounded-xl border border-border bg-surface"
          open
        >
          <summary className="cursor-pointer px-4 py-3 text-[11px] font-semibold text-text-strong">
            Что изменил ИИ и какой контекст использовал
          </summary>
          <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-3 text-[10px] text-text-muted">
            <Badge
              variant={
                suggestion?.creationMode === "original" ? "success" : "neutral"
              }
            >
              {suggestion?.creationMode === "original"
                ? "Создано с нуля · библиотека не использовалась"
                : "Адаптация выбранного шаблона"}
            </Badge>
            <span>
              Режим подтверждён сервером после сборки письма.
            </span>
          </div>
          <div className="grid gap-3 border-t border-border p-3 lg:grid-cols-2">
            <DesignReport title="Моя редакция" document={document} />
            <DesignReport
              title="Редакция ИИ"
              document={suggestion?.document as BuilderDocument | undefined}
              accent
              artDirection={suggestion?.artDirection}
              strategy={suggestion?.contentStrategy}
            />
          </div>
          <div className="border-t border-border px-4 py-3">
            <strong className="text-[10px] uppercase tracking-wide text-text-subtle">
              Исходная задача
            </strong>
            <p className="mb-0 mt-1 whitespace-pre-wrap text-[11px] leading-5 text-text-strong">
              {goal}
            </p>
            {questions.some((question) => answerForQuestion(question)) ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {questions
                  .filter((question) => answerForQuestion(question))
                  .map((question) => (
                    <Badge
                      key={question.id}
                      variant="neutral"
                      title={question.question}
                    >
                      {answerForQuestion(question)}
                    </Badge>
                  ))}
              </div>
            ) : null}
          </div>
        </details>
        <div
          className={
            comparisonView === "split"
              ? "grid gap-4 xl:grid-cols-2"
              : "mx-auto max-w-[760px]"
          }
        >
          {comparisonView === "current" || comparisonView === "split" ? (
            <EmailPreview label="Мой макет" html={previewHtml?.current} />
          ) : null}
          {comparisonView === "ai" || comparisonView === "split" ? (
            <EmailPreview label="Вариант ИИ" html={previewHtml?.ai} accent />
          ) : null}
        </div>
      </Modal>

      <header className="text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-primary text-white shadow-lg">
          <Sparkles aria-hidden="true" className="size-5" />
        </span>
        <h2 className="mt-4 text-[28px] font-semibold tracking-[-0.04em] text-text-strong">
          {stage === "prompt" ? "Что нужно создать?" : "Уточним детали"}
        </h2>
        <p className="mx-auto mt-2 max-w-2xl text-[13px] leading-6 text-text-muted">
          {stage === "prompt"
            ? "Одним запросом задайте смысл и визуальный характер. Поток сам подготовит текст, палитру, композицию, тематическое изображение и узор."
            : "Ответьте только на вопросы о недостающих фактах. Дизайн-задача уже зафиксирована и не потеряется."}
        </p>
        <span className="mt-3 inline-flex rounded-full border border-border bg-surface px-3 py-1 text-[10px] font-medium text-text-muted">
          {configured === null
            ? "Проверяем подключение"
            : configured
              ? `${provider === "navyai" ? "NavyAI" : "OpenAI"} подключён`
              : "ИИ не подключён"}
        </span>
      </header>

      {stage === "prompt" ? (
        <div className="card grid gap-5 overflow-hidden border-primary/10 p-5 shadow-[var(--shadow-sm)] sm:p-7">
          <AiCreationModePicker
            value={creativeSource}
            onChange={(value) => {
              setCreativeSource(value);
              if (value === "original") {
                setSelectedTemplateId("");
              } else if (!templates.length) {
                setTemplatesLoading(true);
                setTemplatesError("");
              }
              setError("");
            }}
            libraryCount={templates.length || 364}
            artifact="письмо"
          />
          {creativeSource === "library" ? (
            <section className="grid gap-3 rounded-2xl border border-border bg-surface-subtle/55 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <strong className="block text-[12px] text-text-strong">
                    Базовый макет
                  </strong>
                  <span className="mt-0.5 block text-[9px] leading-4 text-text-muted">
                    AI сохранит его композиционную логику, но заменит текст,
                    изображение и детали оформления под новую задачу.
                  </span>
                </div>
                <span className="rounded-full bg-primary-subtle px-2.5 py-1 text-[8px] font-semibold text-primary">
                  Не копия, а адаптация
                </span>
              </div>
              {templatesError ? (
                <Alert tone="danger">{templatesError}</Alert>
              ) : (
                <Select
                  aria-label="Шаблон-основа письма"
                  value={selectedTemplateId}
                  disabled={templatesLoading || !templates.length}
                  onChange={(event) =>
                    setSelectedTemplateId(event.target.value)
                  }
                  options={
                    templates.length
                      ? templates.map((template) => ({
                          value: template.id,
                          label: `${template.isFavorite ? "★ " : ""}${template.name} · ${template.category}`,
                        }))
                      : [
                          {
                            value: "",
                            label: templatesLoading
                              ? "Загружаем библиотеку…"
                              : "Шаблоны не найдены",
                          },
                        ]
                  }
                />
              )}
              {selectedTemplate ? (
                <div className="grid gap-2 rounded-xl border border-border bg-surface px-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <div className="min-w-0">
                    <strong className="block truncate text-[11px] text-text-strong">
                      {selectedTemplate.name}
                    </strong>
                    <span className="mt-0.5 block line-clamp-2 text-[9px] leading-4 text-text-muted">
                      {selectedTemplate.description || selectedTemplate.subject}
                    </span>
                  </div>
                  <span className="text-[9px] text-text-subtle">
                    {selectedTemplate.builderDocument.blocks.length} блоков
                  </span>
                </div>
              ) : null}
            </section>
          ) : null}
          <div className="relative overflow-hidden rounded-xl">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words px-4 py-3 text-[16px] font-medium leading-7"
            >
              <span className="text-transparent">{goal}</span>
              <span className="text-text-subtle/70">{promptSuggestion}</span>
            </div>
            <Textarea
              aria-describedby="ai-inline-suggestion-help"
              rows={9}
              maxLength={2000}
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
              onKeyDown={(event) => {
                if (
                  (event.key === "Enter" || event.key === "Tab") &&
                  !event.shiftKey &&
                  promptSuggestion
                ) {
                  event.preventDefault();
                  setGoal((value) => `${value}${promptSuggestion}`);
                }
              }}
              placeholder="Например: письмо о запуске нового продукта для действующих клиентов. Коротко объяснить пользу и привести к странице продукта…"
              className="relative z-10 resize-y !bg-transparent font-medium text-text-strong caret-primary"
              style={{
                fontSize: 16,
                lineHeight: "28px",
                color: "var(--text-strong)",
              }}
            />
            <span id="ai-inline-suggestion-help" className="sr-only">
              Серый текст рядом с курсором — предлагаемое продолжение. Нажмите
              Enter или Tab, чтобы принять его.
            </span>
          </div>
          <FormField
            label="Стиль и визуальное направление"
            htmlFor="ai-email-design-brief"
            hint="Пишите свободно: цвета, настроение, фактуры, степень минимализма и что точно не использовать."
          >
            <Textarea
              id="ai-email-design-brief"
              value={designBrief}
              onChange={(event) => setDesignBrief(event.target.value)}
              rows={4}
              placeholder="Например: лёгкий минимализм, тёплая природная палитра, тонкий ботанический узор, атмосферное фото по теме, без типичных AI-градиентов."
            />
          </FormField>
          {creativeSource === "library" ? (
            <FormField
              label="Характер адаптации"
              hint="Выбранный шаблон сохранит композицию, а это направление задаст характер новой редакции."
            >
              <div
                className="grid gap-2 sm:grid-cols-2"
                role="radiogroup"
                aria-label="Характер адаптации письма"
              >
                {(
                  [
                    ["minimal", "Чистый минимализм", "Спокойный ритм, точная типографика, одно действие"],
                    ["editorial", "Редакционная колонка", "Живой голос, строгая верстка, меньше карточек"],
                    ["premium", "Тихая премиальность", "Глубокий контраст, тонкие линии и дорогие пропорции"],
                    ["bold", "Выразительный выпуск", "Сильный контраст для запуска или события"],
                  ] as const
                ).map(([value, label, description]) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={visualStyle === value}
                    onClick={() => setVisualStyle(value)}
                    className="rounded-xl border border-border bg-surface p-3 text-left outline-none transition hover:border-primary/35 focus-visible:ring-2 focus-visible:ring-primary/30 aria-checked:border-primary aria-checked:bg-primary-subtle/60"
                  >
                    <strong className="block text-[11px] text-text-strong">
                      {label}
                    </strong>
                    <span className="mt-1 block text-[9px] leading-4 text-text-muted">
                      {description}
                    </span>
                  </button>
                ))}
              </div>
            </FormField>
          ) : (
            <div className="rounded-xl border border-success/25 bg-success-subtle px-4 py-3 text-[11px] leading-5 text-text-muted">
              <strong className="block text-text-strong">
                Режим «с нуля»: библиотека физически не передаётся ИИ
              </strong>
              Модель сама определит композицию, шрифтовую пару, размеры,
              интервалы, рамку, изображение и создаст отдельный авторский узор
              из вашего запроса.
            </div>
          )}
          {detectedUrl ? (
            <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary-subtle/40 px-3 py-2.5 text-[11px]">
              <input
                id="ai-use-linked-context"
                type="checkbox"
                checked={useLinkedContext}
                onChange={(event) => setUseLinkedContext(event.target.checked)}
                className="accent-primary"
              />
              <label htmlFor="ai-use-linked-context" className="min-w-0">
                <strong className="block">Изучить страницу по ссылке</strong>
                <span className="block truncate text-text-muted">
                  {detectedUrl}
                </span>
              </label>
            </div>
          ) : null}
          <Button
            type="button"
            variant="primary"
            size="lg"
            disabled={
              busy ||
              goal.trim().length < 8 ||
              (creativeSource === "library" && !selectedTemplate)
            }
            onClick={() => void prepareQuestions()}
          >
            {busy ? (
              <LoaderCircle
                aria-hidden="true"
                className="size-4 animate-spin"
              />
            ) : (
              <Sparkles aria-hidden="true" className="size-4" />
            )}
            {busy
              ? "Анализируем задачу…"
              : creativeSource === "library"
                ? "Адаптировать выбранный шаблон"
                : "Спроектировать письмо с нуля"}
          </Button>
        </div>
      ) : (
        <div className="card grid gap-5 p-5 sm:p-7">
          <nav className="flex flex-wrap items-center gap-2 text-[10px] font-semibold text-text-muted">
            <span className="rounded-full bg-primary px-2.5 py-1 text-white">
              1 · Идея
            </span>
            <span>→</span>
            <span className="rounded-full bg-primary px-2.5 py-1 text-white">
              2 · Уточнения
            </span>
            <span>→</span>
            <span className="rounded-full bg-surface-subtle px-2.5 py-1">
              3 · Вариант
            </span>
            {detectedUrl ? (
              <span className="ml-auto inline-flex items-center gap-1 text-success">
                <Check className="size-3" />
                {useLinkedContext
                  ? "Ссылка учитывается"
                  : "Ссылка не учитывается"}
              </span>
            ) : null}
          </nav>
          {activeQuestion ? (
            <section className="grid gap-5 rounded-2xl border border-primary/20 bg-[linear-gradient(145deg,rgba(124,53,242,.08),rgba(255,255,255,.98)_48%,rgba(40,120,199,.06))] p-4 sm:p-6">
              <header className="grid gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-text-muted">
                  <span className="font-semibold text-primary">
                    Вопрос {activeQuestionIndex + 1} из {questions.length}
                  </span>
                  <span>
                    Готово {answeredQuestions} из {questions.length}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-subtle">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{
                      width: `${Math.max(6, ((activeQuestionIndex + 1) / questions.length) * 100)}%`,
                    }}
                  />
                </div>
                <div
                  className="flex flex-wrap gap-1.5"
                  aria-label="Навигация по уточнениям"
                >
                  {questions.map((question, index) => {
                    const complete = Boolean(answerForQuestion(question));
                    return (
                      <button
                        key={question.id}
                        type="button"
                        aria-label={`Вопрос ${index + 1}: ${question.question}`}
                        aria-current={
                          index === activeQuestionIndex ? "step" : undefined
                        }
                        onClick={() => setActiveQuestionIndex(index)}
                        className="grid size-7 place-items-center rounded-full border border-border bg-surface text-[9px] font-semibold text-text-muted outline-none transition hover:border-primary/40 hover:text-primary aria-[current=step]:border-primary aria-[current=step]:bg-primary aria-[current=step]:text-white"
                      >
                        {complete ? <Check className="size-3" /> : index + 1}
                      </button>
                    );
                  })}
                </div>
              </header>

              <div>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="m-0 text-[18px] font-semibold leading-7 text-text-strong sm:text-[20px]">
                    {activeQuestion.question}
                  </h3>
                  <Badge
                    variant={activeQuestion.required ? "accent" : "neutral"}
                  >
                    {activeQuestion.required
                      ? "Нужен ответ"
                      : "Можно пропустить"}
                  </Badge>
                </div>
                {activeQuestion.multiple ? (
                  <p className="mb-0 mt-1 text-[10px] text-text-muted">
                    Можно выбрать несколько вариантов
                  </p>
                ) : null}
              </div>

              {activeQuestion.options?.length ? (
                <div
                  className="flex flex-wrap gap-2"
                  role="group"
                  aria-label={`Варианты ответа: ${activeQuestion.question}`}
                >
                  {activeQuestion.options.map((option) => {
                    const selected = (
                      answerChoices[activeQuestion.id] ?? []
                    ).includes(option);
                    return (
                      <button
                        key={option}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => {
                          setAnswerChoices((current) => {
                            const selectedOptions =
                              current[activeQuestion.id] ?? [];
                            return {
                              ...current,
                              [activeQuestion.id]: activeQuestion.multiple
                                ? selected
                                  ? selectedOptions.filter(
                                      (item) => item !== option,
                                    )
                                  : [...selectedOptions, option]
                                : [option],
                            };
                          });
                          if (!activeQuestion.multiple) {
                            if (/action|cta/i.test(activeQuestion.id))
                              setCtaLabel(option);
                            setAnswers((current) => ({
                              ...current,
                              [activeQuestion.id]: "",
                            }));
                            setActiveQuestionIndex((current) =>
                              Math.min(questions.length - 1, current + 1),
                            );
                          }
                        }}
                        className="rounded-full border border-border bg-surface px-3.5 py-2 text-[11px] font-medium text-text-muted outline-none transition hover:border-primary/40 hover:text-primary aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-white focus-visible:ring-2 focus-visible:ring-primary/25"
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
              ) : null}

              <FormField
                label="Свой ответ"
                htmlFor={`ai-brief-${activeQuestion.id}`}
                hint="Необязательно, если подходящий вариант уже выбран."
              >
                <Input
                  id={`ai-brief-${activeQuestion.id}`}
                  value={answers[activeQuestion.id] ?? ""}
                  onChange={(event) => {
                    const value = event.target.value;
                    setAnswers((current) => ({
                      ...current,
                      [activeQuestion.id]: value,
                    }));
                    if (value && !activeQuestion.multiple) {
                      setAnswerChoices((current) => ({
                        ...current,
                        [activeQuestion.id]: [],
                      }));
                    }
                    if (/action|cta/i.test(activeQuestion.id) && value)
                      setCtaLabel(value);
                  }}
                  placeholder={activeQuestion.placeholder}
                />
              </FormField>

              <div className="flex items-center justify-between gap-2 border-t border-border pt-4">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={activeQuestionIndex === 0}
                  onClick={() =>
                    setActiveQuestionIndex((current) =>
                      Math.max(0, current - 1),
                    )
                  }
                >
                  Назад
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={activeQuestionIndex === questions.length - 1}
                  onClick={() =>
                    setActiveQuestionIndex((current) =>
                      Math.min(questions.length - 1, current + 1),
                    )
                  }
                >
                  Следующий вопрос
                </Button>
              </div>
            </section>
          ) : null}

          <section className="grid gap-4 rounded-2xl border border-primary/20 bg-primary-subtle/25 p-4 sm:p-5">
            <div>
              <strong className="text-[13px] text-text-strong">
                Кнопка и социальные сети
              </strong>
              <p className="mb-0 mt-1 text-[10px] leading-4 text-text-muted">
                Стиль уже зафиксирован на первом шаге. Здесь нужны только точные ссылки для готового письма.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                label="Текст основной кнопки"
                htmlFor="ai-email-cta-label"
              >
                <Input
                  id="ai-email-cta-label"
                  value={ctaLabel}
                  onChange={(event) => setCtaLabel(event.target.value)}
                  placeholder="Узнать подробнее"
                />
              </FormField>
              <FormField label="HTTPS-ссылка кнопки" htmlFor="ai-email-cta-url">
                <Input
                  id="ai-email-cta-url"
                  type="url"
                  value={ctaUrl}
                  onChange={(event) => setCtaUrl(event.target.value)}
                  placeholder={detectedUrl || "https://example.ru/page"}
                />
              </FormField>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {(
                [
                  ["telegram", "Telegram"],
                  ["vk", "ВКонтакте"],
                  ["linkedin", "LinkedIn"],
                  ["website", "Сайт"],
                ] as const
              ).map(([key, label]) => (
                <FormField
                  key={key}
                  label={label}
                  htmlFor={`ai-email-social-${key}`}
                >
                  <Input
                    id={`ai-email-social-${key}`}
                    type="url"
                    value={socialLinks[key]}
                    onChange={(event) =>
                      setSocialLinks((current) => ({
                        ...current,
                        [key]: event.target.value,
                      }))
                    }
                    placeholder="https://…"
                  />
                </FormField>
              ))}
            </div>
          </section>

          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <strong className="text-[13px]">Свои изображения</strong>
              <Select
                aria-label="Тип загружаемого изображения"
                value={assetKind}
                onChange={(event) =>
                  setAssetKind(event.target.value as "photo" | "logo")
                }
                options={[
                  { value: "photo", label: "Фотография" },
                  { value: "logo", label: "Логотип" },
                ]}
                className="max-w-44"
              />
            </div>
            <input
              ref={fileInput}
              type="file"
              accept="image/png,image/jpeg,image/gif"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void upload(file);
              }}
            />
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              onDragEnter={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                const file = event.dataTransfer.files[0];
                if (file) void upload(file);
              }}
              className={`grid min-h-32 w-full place-items-center rounded-2xl border-2 border-dashed p-5 text-center outline-none transition focus-visible:ring-2 focus-visible:ring-primary/30 ${dragging ? "border-primary bg-primary-subtle" : "border-border-strong bg-surface-subtle hover:border-primary/45"}`}
            >
              <span>
                <span className="mx-auto grid size-10 place-items-center rounded-xl bg-surface text-primary shadow-sm">
                  {uploading ? (
                    <LoaderCircle
                      aria-hidden="true"
                      className="size-5 animate-spin"
                    />
                  ) : (
                    <Upload aria-hidden="true" className="size-5" />
                  )}
                </span>
                <strong className="mt-3 block text-[13px] text-text-strong">
                  Перетащите изображение сюда
                </strong>
                <span className="mt-1 block text-[11px] text-text-muted">
                  или нажмите и выберите файл с компьютера · PNG, JPEG, GIF до 4
                  МБ
                </span>
              </span>
            </button>
            {assets.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {assets.map((asset) => (
                  <span
                    key={asset.id}
                    className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-2 py-1.5 text-[10px]"
                  >
                    <ImagePlus
                      aria-hidden="true"
                      className="size-3 text-primary"
                    />
                    {asset.filename}
                    <span className="text-text-subtle">
                      · {asset.kind === "logo" ? "логотип" : "фото"}
                    </span>
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-[10px] text-text-subtle">
                Необязательно. Без загрузки Поток сам создаст тематическое
                изображение через NavyAI и поместит его в письмо.
              </p>
            )}
          </div>

          {error ? (
            <p
              role="alert"
              className="m-0 rounded-xl bg-danger-subtle px-4 py-3 text-[12px] text-danger"
            >
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setStage("prompt")}
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
              Изменить описание
            </Button>
            <Button
              type="button"
              variant="primary"
              size="lg"
              className="min-w-52 flex-1"
              disabled={
                busy ||
                uploading ||
                questions.some(
                  (question) =>
                    question.required && !answerForQuestion(question),
                )
              }
              onClick={() => void generate()}
            >
              {busy ? (
                <LoaderCircle
                  aria-hidden="true"
                  className="size-4 animate-spin"
                />
              ) : (
                <WandSparkles aria-hidden="true" className="size-4" />
              )}
              {busy
                ? "ИИ редактирует текст, строит дизайн и создаёт визуалы…"
                : "Создать дизайнерскую редакцию"}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

function DesignReport({
  title,
  document,
  accent = false,
  artDirection,
  strategy,
}: {
  title: string;
  document?: BuilderDocument;
  accent?: boolean;
  artDirection?: string;
  strategy?: string;
}) {
  const expressive =
    document?.blocks
      .filter((block) =>
        [
          "hero",
          "image",
          "banner",
          "pattern",
          "quote",
          "columns",
          "stats",
          "coupon",
          "notice",
          "comparison",
          "document",
          "compliance",
        ].includes(block.type),
      )
      .map((block) => block.type) ?? [];
  const actions =
    document?.blocks.filter((block) => block.type === "button").length ?? 0;
  const personalized = new Set(
    document?.blocks.flatMap(
      (block) => block.content.match(/{{[^}]+}}/g) ?? [],
    ) ?? [],
  ).size;
  return (
    <section
      className={`rounded-xl border p-4 ${accent ? "border-primary/30 bg-primary-subtle/30" : "border-border bg-surface-subtle"}`}
    >
      <div className="flex items-center justify-between gap-3">
        <strong className="text-[13px] text-text-strong">{title}</strong>
        <div className="flex gap-1">
          <span
            className="size-4 rounded-full border border-black/10"
            style={{ backgroundColor: document?.accentColor }}
          />
          <span
            className="size-4 rounded-full border border-black/10"
            style={{ backgroundColor: document?.bodyBackground }}
          />
          <span
            className="size-4 rounded-full border border-black/10"
            style={{ backgroundColor: document?.workspaceBackground }}
          />
        </div>
      </div>
      <p className="mb-0 mt-2 text-[10px] leading-4 text-text-muted">
        {artDirection ??
          (expressive.length
            ? `Композиция: ${[...new Set(expressive)].join(", ")}`
            : "Базовая линейная композиция без выраженного арт-направления.")}
      </p>
      {strategy ? (
        <p className="mb-0 mt-1 text-[10px] leading-4 text-text-muted">
          {strategy}
        </p>
      ) : null}
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <MetricValue label="Акценты" value={String(new Set(expressive).size)} />
        <MetricValue label="Действия" value={String(actions)} />
        <MetricValue label="Персонализация" value={String(personalized)} />
      </div>
      <p className="mb-0 mt-3 line-clamp-2 text-[10px] font-medium text-text-strong">
        {document?.subject ?? "Версия не готова"}
      </p>
    </section>
  );
}

function MetricValue({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-lg border border-border/70 bg-surface/70 px-2 py-1.5">
      <strong className="block text-[12px] text-text-strong">{value}</strong>
      <span className="text-[8px] uppercase tracking-wide text-text-subtle">
        {label}
      </span>
    </span>
  );
}

function EmailPreview({
  label,
  html,
  accent = false,
}: {
  label: string;
  html?: string;
  accent?: boolean;
}) {
  return (
    <section
      className={`overflow-hidden rounded-2xl border ${accent ? "border-primary/40 ring-2 ring-primary/10" : "border-border"}`}
    >
      <div className="flex items-center justify-between border-b border-border bg-surface-subtle px-4 py-3">
        <strong className="text-[13px]">{label}</strong>
        <span className="text-[9px] text-text-subtle">
          Реальный HTML письма
        </span>
      </div>
      {html ? (
        <iframe
          title={label}
          srcDoc={html}
          sandbox="allow-same-origin"
          className="h-[520px] w-full bg-white"
        />
      ) : (
        <div className="grid h-[520px] place-items-center text-[11px] text-text-muted">
          Готовим предпросмотр…
        </div>
      )}
    </section>
  );
}

async function prepareImageFile(file: File) {
  if (!["image/png", "image/jpeg", "image/gif"].includes(file.type))
    throw new Error("Поддерживаются PNG, JPEG и GIF.");
  if (file.size <= 900_000 || file.type === "image/gif") return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
  const canvas = window.document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Браузер не смог подготовить изображение.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.84),
  );
  if (!blob) throw new Error("Браузер не смог уменьшить изображение.");
  return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", {
    type: "image/jpeg",
  });
}
