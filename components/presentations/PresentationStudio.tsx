"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  CheckCircle2,
  ChevronRight,
  Copy,
  Download,
  FilePlus2,
  LayoutTemplate,
  Mail,
  LockKeyhole,
  Plus,
  Save,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react";

import { ImageAssetPicker } from "@/components/email-builder/ImageAssetPicker";
import { PageHeader } from "@/components/shared";
import {
  Alert,
  Button,
  FormField,
  Input,
  Modal,
  SearchInput,
  Select,
  Textarea,
} from "@/components/ui";
import { cn } from "@/components/ui/utils";
import {
  defaultPresentationSlides,
  presentationTemplates,
  presentationTheme,
  presentationThemes,
} from "@/data/presentation-templates";
import type {
  ApiError,
  EmailTemplateRecord,
  EmailTemplatesListResponse,
  PresentationAiResponse,
  PresentationMutationResponse,
  PresentationProjectRecord,
  PresentationSlide,
  PresentationSlideLayout,
  PresentationThemeId,
  PresentationsListResponse,
} from "@/types/api";

const layoutLabels: Record<PresentationSlideLayout, string> = {
  title: "Обложка",
  statement: "Главная мысль",
  split: "Две части",
  bullets: "Список",
  quote: "Цитата",
  stats: "Показатели",
  closing: "Финал",
};

const sourceLabels: Record<PresentationProjectRecord["sourceType"], string> = {
  blank: "С нуля",
  template: "Из сценария",
  ai: "Черновик ИИ",
  email: "Из email-шаблона",
};

function apiError(body: unknown, fallback: string) {
  return body && typeof body === "object" && !Array.isArray(body) && "error" in body
    ? String((body as ApiError).error)
    : fallback;
}

async function jsonBody<T>(response: Response): Promise<T | ApiError> {
  return await response.json() as T | ApiError;
}

function cloneSlides(slides: PresentationSlide[]) {
  return slides.map((slide) => ({
    ...slide,
    id: `slide-${crypto.randomUUID()}`,
    bullets: [...slide.bullets],
  }));
}

function emptySlide(layout: PresentationSlideLayout = "statement"): PresentationSlide {
  return {
    id: `slide-${crypto.randomUUID()}`,
    layout,
    eyebrow: "",
    title: layout === "title" ? "Название презентации" : "Заголовок-вывод",
    body: "",
    bullets: [],
    speakerNotes: "",
  };
}

function imageAssetId(url: string) {
  const match = url.match(/\/api\/assets\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : undefined;
}

function safeAssetQueryId(value: string | null) {
  const normalized = value?.trim() ?? "";
  return /^asset-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)
    ? normalized
    : undefined;
}

function slidesWithAsset(assetId?: string) {
  const slides = cloneSlides(defaultPresentationSlides);
  if (!assetId || !slides[0]) return slides;
  slides[0] = {
    ...slides[0],
    assetId,
    imageUrl: `/api/assets/${encodeURIComponent(assetId)}`,
  };
  return slides;
}

function SlidePreview({
  project,
  slide,
  compact = false,
  editable = false,
  onChange,
  onPickImage,
}: {
  project: Pick<PresentationProjectRecord, "accentColor" | "backgroundColor" | "textColor">;
  slide: PresentationSlide;
  compact?: boolean;
  editable?: boolean;
  onChange?: (patch: Partial<PresentationSlide>) => void;
  onPickImage?: () => void;
}) {
  const inverse = project.backgroundColor.toLowerCase() === "#101113" ? "#F5F1E8" : project.textColor;
  const metrics = slide.bullets.slice(0, 3).map((item) => {
    const [value, label] = item.split("|").map((part) => part.trim());
    return { value: value || "—", label: label || "показатель" };
  });
  const titleClass = compact ? "text-[9px] leading-[1.08]" : "text-[clamp(24px,3.2vw,52px)] leading-[1.02]";
  const bodyClass = compact ? "text-[4px] leading-[1.3]" : "text-[clamp(11px,1.15vw,18px)] leading-[1.45]";
  const image = slide.imageUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={slide.imageUrl} alt="" className="h-full min-h-0 w-full rounded-[inherit] object-cover" />
  ) : null;
  const editableTitle = (className: string) => editable ? (
    <textarea aria-label="Заголовок слайда" value={slide.title} onChange={(event) => onChange?.({ title: event.target.value })} className={cn("m-0 w-full resize-none overflow-hidden border-0 bg-transparent p-0 font-semibold tracking-[-0.045em] text-inherit outline-none ring-0 focus:ring-2 focus:ring-primary/30", className)} rows={3} />
  ) : <h2 className={cn("m-0 font-semibold tracking-[-0.045em]", className)}>{slide.title}</h2>;
  const editableBody = (className: string) => editable ? (
    <textarea aria-label="Текст слайда" value={slide.body} onChange={(event) => onChange?.({ body: event.target.value })} className={cn("m-0 w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-inherit outline-none ring-0 focus:ring-2 focus:ring-primary/30", className)} rows={4} placeholder="Добавьте пояснение" />
  ) : slide.body ? <p className={cn("mb-0", className)}>{slide.body}</p> : null;
  const imageArea = image ? (
    <button type="button" onClick={editable ? onPickImage : undefined} className="h-full w-full overflow-hidden rounded-[inherit] text-left" aria-label={editable ? "Заменить изображение" : undefined}>{image}</button>
  ) : editable ? (
    <button type="button" onClick={onPickImage} className="grid h-full w-full place-items-center rounded-[inherit] border border-dashed border-current/25 bg-black/5 text-[12px] font-semibold opacity-65 hover:opacity-100">+ Добавить фотографию</button>
  ) : null;

  return (
    <div
      className="relative aspect-video w-full overflow-hidden rounded-[inherit]"
      style={{ backgroundColor: project.backgroundColor, color: inverse }}
    >
      <div className={cn("absolute rounded-full", compact ? "left-[6%] top-[7%] h-[2px] w-[8%]" : "left-[6.2%] top-[7.5%] h-1.5 w-[7%]")} style={{ backgroundColor: project.accentColor }} />
      {slide.layout === "closing" ? (
        <div className="absolute inset-[5%] grid place-items-center rounded-[5%] px-[9%] text-center" style={{ backgroundColor: project.accentColor, color: "#fff" }}>
          <div>
            {slide.eyebrow ? <p className={cn("m-0 font-bold uppercase tracking-[0.16em]", compact ? "text-[3px]" : "text-[10px]")}>{slide.eyebrow}</p> : null}
            <h2 className={cn("m-0 mt-[4%] font-semibold tracking-[-0.045em]", titleClass)}>{slide.title}</h2>
            {slide.body ? <p className={cn("mx-auto mb-0 mt-[5%] max-w-[80%]", bodyClass)}>{slide.body}</p> : null}
          </div>
        </div>
      ) : slide.layout === "title" ? (
        <div className="absolute inset-x-[6.2%] inset-y-[13%] flex items-center gap-[5%]">
          <div className={cn("min-w-0", image ? "w-[56%]" : "w-full")}>
            {slide.eyebrow ? <p className={cn("m-0 font-bold uppercase tracking-[0.15em]", compact ? "text-[3px]" : "text-[10px]")} style={{ color: project.accentColor }}>{slide.eyebrow}</p> : null}
            {editableTitle(cn("mt-[6%] max-w-[95%] tracking-[-0.05em]", titleClass))}
            {editableBody(cn("mt-[7%] max-w-[86%] opacity-70", bodyClass))}
          </div>
          {(imageArea || editable) ? <div className="h-[80%] w-[39%] overflow-hidden rounded-[9%]">{imageArea}</div> : null}
        </div>
      ) : slide.layout === "statement" ? (
        <div className="absolute inset-x-[6.2%] inset-y-[13%] flex gap-[5%]">
          <div className={cn("flex min-w-0 flex-col justify-center", image ? "w-[57%]" : "w-full")}>
            {slide.eyebrow ? <p className={cn("m-0 font-bold uppercase tracking-[0.15em]", compact ? "text-[3px]" : "text-[10px]")} style={{ color: project.accentColor }}>{slide.eyebrow}</p> : null}
            {editableTitle(cn("mt-[4%] max-w-[96%]", compact ? titleClass : "text-[clamp(23px,2.8vw,46px)] leading-[1.08]"))}
            {editableBody(cn("mt-[7%] max-w-[88%] opacity-70", bodyClass))}
          </div>
          {(imageArea || editable) ? <div className="h-full w-[38%] overflow-hidden rounded-[8%]">{imageArea}</div> : null}
        </div>
      ) : slide.layout === "split" ? (
        <div className="absolute inset-x-[6.2%] inset-y-[14%] grid grid-cols-2 gap-[6%]">
          <div className="flex min-w-0 flex-col justify-center">
            {slide.eyebrow ? <p className={cn("m-0 font-bold uppercase tracking-[0.15em]", compact ? "text-[3px]" : "text-[10px]")} style={{ color: project.accentColor }}>{slide.eyebrow}</p> : null}
            {editableTitle(cn("mt-[5%]", compact ? titleClass : "text-[clamp(20px,2.2vw,36px)] leading-[1.08]"))}
            {editableBody(cn("mt-[7%] opacity-70", bodyClass))}
          </div>
          <div className="min-h-0 overflow-hidden rounded-[8%] p-[9%]" style={{ backgroundColor: `${project.accentColor}18` }}>
            {imageArea ?? <ul className={cn("m-0 grid list-none gap-[8%] p-0", bodyClass)}>{(slide.bullets.length ? slide.bullets : ["Первый аргумент", "Второй аргумент", "Вывод"]).slice(0, 5).map((item, index) => <li key={`${item}-${index}`} className="flex gap-[5%]"><span className="font-bold" style={{ color: project.accentColor }}>0{index + 1}</span><span>{item}</span></li>)}</ul>}
          </div>
        </div>
      ) : slide.layout === "quote" ? (
        <div className="absolute inset-x-[8%] inset-y-[14%] flex items-center">
          <div>
            <span className={cn("font-serif leading-none", compact ? "text-[13px]" : "text-[72px]")} style={{ color: project.accentColor }}>“</span>
            {editableTitle(cn("-mt-[4%] font-serif", compact ? "text-[8px] leading-[1.1]" : "text-[clamp(22px,2.6vw,43px)] leading-[1.14]"))}
            {editableBody(cn("mt-[6%] opacity-65", bodyClass))}
          </div>
        </div>
      ) : slide.layout === "stats" ? (
        <div className="absolute inset-x-[6.2%] inset-y-[13%]">
          {editableTitle(cn("max-w-[75%]", compact ? titleClass : "text-[clamp(20px,2.2vw,36px)] leading-[1.08]"))}
          <div className="mt-[8%] grid grid-cols-3 gap-[3%]">
            {(metrics.length ? metrics : [{ value: "—", label: "показатель" }, { value: "—", label: "показатель" }, { value: "—", label: "показатель" }]).map((metric, index) => <div key={`${metric.value}-${index}`} className="rounded-[10%] p-[9%]" style={{ backgroundColor: `${project.accentColor}18` }}><strong className={cn("block tracking-[-0.05em]", compact ? "text-[8px]" : "text-[clamp(22px,2.5vw,42px)]")} style={{ color: project.accentColor }}>{metric.value}</strong><span className={cn("mt-[5%] block opacity-70", bodyClass)}>{metric.label}</span></div>)}
          </div>
        </div>
      ) : (
        <div className="absolute inset-x-[6.2%] inset-y-[13%] flex gap-[5%]">
          <div className={cn("min-w-0", image ? "w-[58%]" : "w-full")}>
            {slide.eyebrow ? <p className={cn("m-0 font-bold uppercase tracking-[0.15em]", compact ? "text-[3px]" : "text-[10px]")} style={{ color: project.accentColor }}>{slide.eyebrow}</p> : null}
            {editableTitle(cn("mt-[4%]", compact ? titleClass : "text-[clamp(20px,2.2vw,36px)] leading-[1.08]"))}
            {editableBody(cn("mt-[5%] opacity-70", bodyClass))}
            <ul className={cn("m-0 mt-[6%] grid gap-[3%] p-0", compact ? "text-[4px]" : "text-[clamp(11px,1.2vw,18px)]")}>{(slide.bullets.length ? slide.bullets : ["Добавьте аргумент", "Добавьте доказательство", "Сформулируйте вывод"]).slice(0, 6).map((item, index) => <li key={`${item}-${index}`} className="ml-[4%] pl-[2%] marker:text-[color:var(--primary)]">{item}</li>)}</ul>
          </div>
          {(imageArea || editable) ? <div className="h-full w-[37%] overflow-hidden rounded-[8%]">{imageArea}</div> : null}
        </div>
      )}
    </div>
  );
}

function ThemeStrip({ value, onChange }: { value: PresentationThemeId; onChange: (theme: PresentationThemeId) => void }) {
  return (
    <div className="grid grid-cols-5 gap-1.5">
      {presentationThemes.map((theme) => (
        <button key={theme.id} type="button" onClick={() => onChange(theme.id)} aria-label={`Тема ${theme.name}`} aria-pressed={value === theme.id} className="group rounded-lg border border-border bg-surface p-1.5 text-left transition hover:border-primary/40 aria-pressed:border-primary aria-pressed:ring-2 aria-pressed:ring-primary/15">
          <span className="block aspect-[4/3] rounded-md" style={{ backgroundColor: theme.backgroundColor }}><span className="ml-[12%] mt-[12%] block h-1 w-[35%] rounded-full" style={{ backgroundColor: theme.accentColor }} /></span>
          <span className="mt-1 block truncate text-[9px] font-medium text-text-muted group-aria-pressed:text-primary">{theme.name}</span>
        </button>
      ))}
    </div>
  );
}

export function PresentationStudio() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("id");
  const requestedAssetId = safeAssetQueryId(searchParams.get("asset"));
  const quickCreateKey = searchParams.get("new") === "1" ? `new:${requestedAssetId ?? ""}` : "";
  const requestedView = searchParams.get("view");
  const [presentations, setPresentations] = useState<PresentationProjectRecord[]>([]);
  const [project, setProject] = useState<PresentationProjectRecord | null>(null);
  const [selectedSlideId, setSelectedSlideId] = useState<string | null>(null);
  const [reviewedSlideIds, setReviewedSlideIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dirty, setDirty] = useState(false);
  const [query, setQuery] = useState("");
  const [templateQuery, setTemplateQuery] = useState("");
  const [templateUseCase, setTemplateUseCase] = useState("Все задачи");
  const [aiOpen, setAiOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [slideImageOpen, setSlideImageOpen] = useState(false);
  const [aiGoal, setAiGoal] = useState("");
  const [aiAudience, setAiAudience] = useState("");
  const [aiSlideCount, setAiSlideCount] = useState(7);
  const [aiTheme, setAiTheme] = useState<PresentationThemeId>("atelier");
  const [aiStatus, setAiStatus] = useState<PresentationAiResponse | null>(null);
  const [aiError, setAiError] = useState("");
  const [aiContext, setAiContext] = useState("");
  const [aiAction, setAiAction] = useState("");
  const [aiTone, setAiTone] = useState<"executive" | "persuasive" | "educational" | "visual">("executive");
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplateRecord[]>([]);
  const [emailQuery, setEmailQuery] = useState("");
  const [selectedEmailId, setSelectedEmailId] = useState("");
  const editRevisionRef = useRef(0);
  const quickCreateStartedRef = useRef("");
  const aiIdempotencyKeyRef = useRef("");

  useEffect(() => {
    if (projectId || requestedView !== "templates") return;
    const frame = window.requestAnimationFrame(() => document.getElementById("presentation-template-library")?.scrollIntoView({ block: "start" }));
    return () => window.cancelAnimationFrame(frame);
  }, [projectId, requestedView]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(projectId ? `/api/presentations?id=${encodeURIComponent(projectId)}` : "/api/presentations", { cache: "no-store" });
      const body = await response.json() as PresentationMutationResponse | PresentationsListResponse | ApiError;
      if (!response.ok) throw new Error(apiError(body, "Презентации не загружены."));
      if ("presentation" in body) {
        setProject(body.presentation);
        setSelectedSlideId(body.presentation.slides[0]?.id ?? null);
        try {
          const stored = window.localStorage.getItem(`potok:presentation-review:${body.presentation.id}`);
          const parsed = stored ? JSON.parse(stored) : [];
          const knownIds = new Set(body.presentation.slides.map((slide) => slide.id));
          setReviewedSlideIds(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string" && knownIds.has(id)) : []);
        } catch {
          setReviewedSlideIds([]);
        }
        setDirty(false);
        editRevisionRef.current = 0;
      } else if ("presentations" in body) {
        setPresentations(body.presentations);
        setProject(null);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Презентации не загружены.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => void load());
    return () => window.cancelAnimationFrame(frame);
  }, [load]);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/ai/presentations", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const body = await jsonBody<PresentationAiResponse>(response);
        if (!response.ok || !("configured" in body)) throw new Error(apiError(body, "Статус ИИ не загружен."));
        setAiStatus(body);
      })
      .catch((caught) => {
        if (caught instanceof Error && caught.name === "AbortError") return;
        setAiStatus({ configured: false });
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const guardInternalNavigation = (event: MouseEvent) => {
      const target = event.target instanceof HTMLElement ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!target || target.target === "_blank") return;
      if (!window.confirm("В презентации есть несохранённые изменения. Покинуть редактор без сохранения?")) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", guardInternalNavigation, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", guardInternalNavigation, true);
    };
  }, [dirty]);

  useEffect(() => {
    if (!quickCreateKey) {
      quickCreateStartedRef.current = "";
      return;
    }
    if (projectId || quickCreateStartedRef.current === quickCreateKey) return;
    quickCreateStartedRef.current = quickCreateKey;
    const frame = window.requestAnimationFrame(() => {
      void (async () => {
        setBusy("quick-new");
        setError("");
        try {
          const response = await fetch("/api/presentations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: "Новая презентация", sourceType: "blank", slides: slidesWithAsset(requestedAssetId) }),
          });
          const body = await jsonBody<PresentationMutationResponse>(response);
          if (!response.ok || !("presentation" in body)) throw new Error(apiError(body, "Презентация не создана."));
          router.replace(`/presentations?id=${encodeURIComponent(body.presentation.id)}`);
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : "Презентация не создана.");
          router.replace("/presentations");
        } finally {
          setBusy("");
        }
      })();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [projectId, quickCreateKey, requestedAssetId, router]);

  const navigateTo = (id?: string) => {
    if (dirty && projectId && !window.confirm("В презентации есть несохранённые изменения. Покинуть редактор без сохранения?")) return;
    router.push(id ? `/presentations?id=${encodeURIComponent(id)}` : "/presentations");
  };

  const createProject = async (payload: Record<string, unknown>, action: string) => {
    setBusy(action);
    setError("");
    try {
      const response = await fetch("/api/presentations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const body = await jsonBody<PresentationMutationResponse>(response);
      if (!response.ok || !("presentation" in body)) throw new Error(apiError(body, "Презентация не создана."));
      navigateTo(body.presentation.id);
      return body.presentation;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Презентация не создана.");
      return null;
    } finally {
      setBusy("");
    }
  };

  const createBlank = () => void createProject({ name: "Новая презентация", sourceType: "blank", slides: cloneSlides(defaultPresentationSlides) }, "blank");

  const createFromScenario = (template: (typeof presentationTemplates)[number]) => void createProject({
    name: template.name,
    description: template.description,
    themeId: template.themeId,
    accentColor: template.accentColor,
    backgroundColor: template.backgroundColor,
    textColor: template.textColor,
    slides: cloneSlides(template.slides),
    sourceType: "template",
  }, template.id);

  const generateWithAi = async () => {
    if (aiGoal.trim().length < 12) { setAiError("Опишите задачу презентации хотя бы одним предложением."); return; }
    if (!aiStatus?.configured) { setAiError("ИИ-провайдер не подключён. Откройте настройки подключения или создайте презентацию из шаблона."); return; }
    if (!aiIdempotencyKeyRef.current) aiIdempotencyKeyRef.current = crypto.randomUUID();
    setBusy("ai");
    setError("");
    setAiError("");
    try {
      const response = await fetch("/api/ai/presentations", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": aiIdempotencyKeyRef.current }, body: JSON.stringify({ goal: aiGoal, audience: aiAudience, context: aiContext, desiredAction: aiAction, tone: aiTone, slideCount: aiSlideCount, themeId: aiTheme }) });
      const body = await jsonBody<PresentationAiResponse>(response);
      if (!response.ok || !("outline" in body) || !body.outline) throw new Error(apiError(body, "ИИ не подготовил презентацию."));
      const created = await createProject({ ...body.outline, sourceType: "ai" }, "ai-save");
      if (created) {
        aiIdempotencyKeyRef.current = "";
        setAiOpen(false);
      }
    } catch (caught) {
      aiIdempotencyKeyRef.current = "";
      setAiError(caught instanceof Error ? caught.message : "ИИ не подготовил презентацию.");
    } finally {
      setBusy("");
    }
  };

  const openEmailImport = async () => {
    setEmailOpen(true);
    if (emailTemplates.length) return;
    setBusy("email-list");
    setError("");
    try {
      const response = await fetch("/api/templates", { cache: "no-store" });
      const body = await jsonBody<EmailTemplatesListResponse>(response);
      if (!response.ok || !("templates" in body)) throw new Error(apiError(body, "Шаблоны писем не загружены."));
      setEmailTemplates(body.templates);
      setSelectedEmailId(body.templates[0]?.id ?? "");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Шаблоны писем не загружены.");
    } finally {
      setBusy("");
    }
  };

  const createFromEmail = async () => {
    const template = emailTemplates.find((item) => item.id === selectedEmailId);
    if (!template) { setError("Выберите письмо для преобразования."); return; }
    const created = await createProject({ name: `Презентация · ${template.name}`, sourceEmailTemplateId: template.id, sourceType: "email" }, "email-create");
    if (created) setEmailOpen(false);
  };

  const deleteProject = async (item: PresentationProjectRecord) => {
    if (!window.confirm(`Удалить презентацию «${item.name}»?`)) return;
    setBusy(`delete-${item.id}`);
    try {
      const response = await fetch(`/api/presentations?id=${encodeURIComponent(item.id)}`, { method: "DELETE" });
      const body = await response.json() as { deletedId?: string } | ApiError;
      if (!response.ok || !("deletedId" in body)) throw new Error(apiError(body, "Презентация не удалена."));
      setPresentations((current) => current.filter((presentation) => presentation.id !== item.id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Презентация не удалена.");
    } finally {
      setBusy("");
    }
  };

  const updateProject = (patch: Partial<PresentationProjectRecord>) => {
    editRevisionRef.current += 1;
    setProject((current) => current ? { ...current, ...patch } : current);
    setDirty(true);
    setNotice("");
  };

  const updateSlide = (patch: Partial<PresentationSlide>) => {
    if (!project || !selectedSlideId) return;
    const changedIndex = project.slides.findIndex((slide) => slide.id === selectedSlideId);
    setReviewedSlideIds((current) => {
      const next = current.filter((id) => project.slides.findIndex((slide) => slide.id === id) < changedIndex);
      try { window.localStorage.setItem(`potok:presentation-review:${project.id}`, JSON.stringify(next)); } catch { /* review state is optional */ }
      return next;
    });
    updateProject({ slides: project.slides.map((slide) => slide.id === selectedSlideId ? { ...slide, ...patch } : slide) });
  };

  const selectedSlide = project?.slides.find((slide) => slide.id === selectedSlideId) ?? project?.slides[0];
  const selectedSlideIndex = project && selectedSlide
    ? project.slides.findIndex((slide) => slide.id === selectedSlide.id)
    : 0;
  const firstUnreviewedIndex = project
    ? project.slides.findIndex((slide) => !reviewedSlideIds.includes(slide.id))
    : 0;
  const unlockedSlideIndex = project
    ? firstUnreviewedIndex === -1 ? project.slides.length - 1 : firstUnreviewedIndex
    : 0;

  const saveProject = async () => {
    if (!project) return false;
    const savingRevision = editRevisionRef.current;
    setBusy("save");
    setError("");
    try {
      const response = await fetch("/api/presentations", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: project.id, expectedUpdatedAt: project.updatedAt, name: project.name, description: project.description, themeId: project.themeId, accentColor: project.accentColor, backgroundColor: project.backgroundColor, textColor: project.textColor, slides: project.slides }) });
      const body = await jsonBody<PresentationMutationResponse>(response);
      if (!response.ok || !("presentation" in body)) throw new Error(apiError(body, "Презентация не сохранена."));
      const unchangedDuringSave = editRevisionRef.current === savingRevision;
      setProject((current) => unchangedDuringSave
        ? body.presentation
        : current
          ? { ...current, updatedAt: body.presentation.updatedAt }
          : body.presentation);
      setDirty(!unchangedDuringSave);
      setNotice(unchangedDuringSave ? "Все изменения сохранены." : "Сохранена предыдущая редакция. Новые изменения ожидают сохранения.");
      return unchangedDuringSave;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Презентация не сохранена.");
      return false;
    } finally {
      setBusy("");
    }
  };

  const downloadPptx = async () => {
    if (!project) return;
    if (dirty && !(await saveProject())) return;
    const link = document.createElement("a");
    link.href = `/api/presentations/export?id=${encodeURIComponent(project.id)}`;
    link.download = `${project.name || "presentation"}.pptx`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const copyProjectLink = async () => {
    if (!project) return;
    const url = new URL(`/presentations?id=${encodeURIComponent(project.id)}`, window.location.origin).toString();
    try {
      await navigator.clipboard.writeText(url);
      setNotice("Ссылка на редактирование скопирована. Доступ к ней остаётся внутри вашего рабочего пространства.");
    } catch {
      window.prompt("Скопируйте ссылку на презентацию", url);
    }
  };

  const moveSlide = (direction: -1 | 1) => {
    if (!project || !selectedSlide) return;
    const index = project.slides.findIndex((slide) => slide.id === selectedSlide.id);
    const target = index + direction;
    if (target < 0 || target >= project.slides.length) return;
    const slides = [...project.slides];
    [slides[index], slides[target]] = [slides[target], slides[index]];
    updateProject({ slides });
  };

  const duplicateSlide = () => {
    if (!project || !selectedSlide) return;
    const index = project.slides.findIndex((slide) => slide.id === selectedSlide.id);
    const duplicate = { ...selectedSlide, id: `slide-${crypto.randomUUID()}`, bullets: [...selectedSlide.bullets], title: `${selectedSlide.title} — копия` };
    const slides = [...project.slides];
    slides.splice(index + 1, 0, duplicate);
    updateProject({ slides });
    setSelectedSlideId(duplicate.id);
  };

  const removeSlide = () => {
    if (!project || !selectedSlide || project.slides.length <= 1) return;
    const index = project.slides.findIndex((slide) => slide.id === selectedSlide.id);
    const slides = project.slides.filter((slide) => slide.id !== selectedSlide.id);
    updateProject({ slides });
    setSelectedSlideId(slides[Math.min(index, slides.length - 1)]?.id ?? null);
  };

  const changeTheme = (themeId: PresentationThemeId) => {
    const theme = presentationTheme(themeId);
    updateProject({ themeId, accentColor: theme.accentColor, backgroundColor: theme.backgroundColor, textColor: theme.textColor });
  };

  const confirmCurrentSlide = async () => {
    if (!project || !selectedSlide) return;
    if (!selectedSlide.title.trim()) {
      setError("Добавьте заголовок-вывод: без него слайд нельзя подтвердить.");
      return;
    }
    if (dirty && !(await saveProject())) return;
    const index = project.slides.findIndex((slide) => slide.id === selectedSlide.id);
    const nextReviewed = Array.from(new Set([...reviewedSlideIds, selectedSlide.id]));
    setReviewedSlideIds(nextReviewed);
    try { window.localStorage.setItem(`potok:presentation-review:${project.id}`, JSON.stringify(nextReviewed)); } catch { /* review state is optional */ }
    setError("");
    if (index < project.slides.length - 1) {
      setSelectedSlideId(project.slides[index + 1].id);
      setNotice(`Слайд ${index + 1} подтверждён. Теперь проверьте слайд ${index + 2}.`);
    } else {
      setNotice("Все слайды подтверждены. Презентацию можно скачать или приложить к письму.");
    }
  };

  const openEmailCampaign = async () => {
    if (!project) return;
    if (dirty && !(await saveProject())) return;
    router.push(`/campaigns/new?step=message&presentation=${encodeURIComponent(project.id)}`);
  };

  const filteredProjects = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("ru-RU");
    return presentations.filter((item) => !normalized || `${item.name} ${item.description}`.toLocaleLowerCase("ru-RU").includes(normalized));
  }, [presentations, query]);
  const filteredEmailTemplates = useMemo(() => {
    const normalized = emailQuery.trim().toLocaleLowerCase("ru-RU");
    return emailTemplates.filter((item) => !normalized || `${item.name} ${item.subject}`.toLocaleLowerCase("ru-RU").includes(normalized)).slice(0, 80);
  }, [emailQuery, emailTemplates]);
  const templateUseCases = useMemo(() => ["Все задачи", ...new Set(presentationTemplates.map((item) => item.useCase))], []);
  const filteredPresentationTemplates = useMemo(() => {
    const normalized = templateQuery.trim().toLocaleLowerCase("ru-RU");
    return presentationTemplates.filter((item) =>
      (templateUseCase === "Все задачи" || item.useCase === templateUseCase) &&
      (!normalized || `${item.name} ${item.description} ${item.useCase}`.toLocaleLowerCase("ru-RU").includes(normalized)),
    );
  }, [templateQuery, templateUseCase]);

  if (loading) return <div className="grid min-h-[420px] place-items-center text-sm text-text-muted">Загружаем студию презентаций…</div>;
  if (busy === "quick-new") return <div className="grid min-h-[420px] place-items-center text-sm text-text-muted">Создаём пустую презентацию…</div>;

  if (projectId && project && selectedSlide) {
    return (
      <div className="min-w-0">
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 shadow-[var(--shadow-xs)]">
          <Button variant="ghost" size="sm" leadingIcon={<ArrowLeft className="size-4" />} onClick={() => navigateTo()}>Презентации</Button>
          <div className="h-5 w-px bg-border" />
          <span className="rounded-full bg-primary-subtle px-2.5 py-1 text-[10px] font-semibold text-primary">{sourceLabels[project.sourceType]}</span>
          <Input aria-label="Название презентации" value={project.name} onChange={(event) => updateProject({ name: event.target.value })} className="min-w-[220px] flex-1 border-0 bg-transparent font-semibold shadow-none focus:shadow-none" />
          <span className={cn("text-[11px]", dirty ? "text-warning" : "text-text-subtle")}>{dirty ? "Есть несохранённые изменения" : notice || "Сохранено"}</span>
          <Button variant="outline" size="sm" leadingIcon={<Copy className="size-3.5" />} onClick={() => void copyProjectLink()}>Ссылка</Button>
          <Button variant="outline" size="sm" leadingIcon={<Download className="size-3.5" />} onClick={() => void downloadPptx()} loading={busy === "save"}>PPTX</Button>
          <Button size="sm" leadingIcon={<Save className="size-3.5" />} onClick={() => void saveProject()} loading={busy === "save"} loadingText="Сохраняем">Сохранить</Button>
        </div>
        {error ? <Alert tone="danger" className="mb-4">{error}</Alert> : null}
        <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--shadow-sm)]">
          <div className="grid min-h-[calc(100dvh-220px)] grid-cols-1 lg:grid-cols-[176px_minmax(0,1fr)] 2xl:grid-cols-[176px_minmax(0,1fr)_340px]">
          <aside className="border-b border-border bg-[#F2E9DF]/60 p-3 lg:border-b-0 lg:border-r">
            <div className="mb-3 flex items-center justify-between"><div><strong className="block text-[12px]">Слайды</strong><span className="text-[9px] text-text-subtle">{reviewedSlideIds.length} из {project.slides.length} подтверждено</span></div><Button size="icon" variant="ghost" aria-label="Добавить слайд" onClick={() => { const slide = emptySlide(); updateProject({ slides: [...project.slides, slide] }); setSelectedSlideId(slide.id); }}><Plus className="size-4" /></Button></div>
            <div className="flex max-h-48 gap-2 overflow-x-auto pb-1 lg:grid lg:max-h-[calc(100dvh-290px)] lg:grid-cols-1 lg:overflow-x-hidden lg:overflow-y-auto lg:pr-1">
              {project.slides.map((slide, index) => {
                const reviewed = reviewedSlideIds.includes(slide.id);
                const locked = index > unlockedSlideIndex;
                return <button key={slide.id} type="button" disabled={locked} onClick={() => setSelectedSlideId(slide.id)} aria-pressed={slide.id === selectedSlide.id} aria-label={`${reviewed ? "Подтверждён" : locked ? "Заблокирован" : "Редактируется"}: слайд ${index + 1}, ${slide.title || layoutLabels[slide.layout]}`} className="w-36 shrink-0 rounded-lg border border-border bg-surface p-1.5 text-left transition enabled:hover:border-primary/40 disabled:cursor-not-allowed disabled:opacity-45 aria-pressed:border-primary aria-pressed:ring-2 aria-pressed:ring-primary/20 lg:w-auto"><span className="mb-1 flex items-center justify-between px-0.5 text-[9px] text-text-subtle"><span className="flex items-center gap-1">{index + 1}{reviewed ? <CheckCircle2 className="size-2.5 text-success" /> : locked ? <LockKeyhole className="size-2.5" /> : null}</span><span>{layoutLabels[slide.layout]}</span></span><div className="overflow-hidden rounded-md"><SlidePreview project={project} slide={slide} compact /></div></button>;
              })}
            </div>
          </aside>
          <section className="flex min-w-0 flex-col bg-[#E9E2DE]/65">
            <div className="flex items-center justify-between border-b border-border bg-surface/85 px-4 py-2.5">
              <div><span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-primary">Слайд {selectedSlideIndex + 1} из {project.slides.length}</span><p className="m-0 text-[12px] font-semibold text-text-strong">{reviewedSlideIds.includes(selectedSlide.id) ? "Подтверждён — можно уточнить" : "Проверьте содержание и оформление"}</p></div>
              <div className="hidden items-center gap-1 sm:flex"><Button variant="ghost" size="sm" onClick={() => moveSlide(-1)} leadingIcon={<ArrowUp className="size-3.5" />}>Выше</Button><Button variant="ghost" size="sm" onClick={() => moveSlide(1)} leadingIcon={<ArrowDown className="size-3.5" />}>Ниже</Button><Button variant="ghost" size="sm" onClick={duplicateSlide} leadingIcon={<Copy className="size-3.5" />}>Дублировать</Button><Button variant="ghost" size="sm" disabled={project.slides.length <= 1} onClick={removeSlide} leadingIcon={<Trash2 className="size-3.5" />}>Удалить</Button></div>
            </div>
            <div className="grid flex-1 place-items-center p-4 sm:p-6 xl:p-8">
              <div className="w-full max-w-[1180px] overflow-hidden rounded-[14px] border border-border bg-surface shadow-[0_30px_90px_rgb(48_25_43/0.18)]"><SlidePreview project={project} slide={selectedSlide} editable onChange={updateSlide} onPickImage={() => setSlideImageOpen(true)} /></div>
            </div>
            <div className="sticky bottom-0 z-10 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur sm:px-6">
              <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-4"><div className="min-w-0 flex-1"><div className="h-1.5 overflow-hidden rounded-full bg-surface-inset"><div className="h-full rounded-full bg-success transition-all" style={{ width: `${Math.round(reviewedSlideIds.length / project.slides.length * 100)}%` }} /></div><p className="mb-0 mt-1 text-[10px] text-text-subtle">Следующий слайд откроется после подтверждения текущего.</p></div><Button onClick={() => void confirmCurrentSlide()} loading={busy === "save"} trailingIcon={selectedSlideIndex < project.slides.length - 1 ? <ChevronRight className="size-4" /> : <Check className="size-4" />}>{selectedSlideIndex < project.slides.length - 1 ? "Готово — следующий слайд" : "Подтвердить презентацию"}</Button></div>
            </div>
          </section>
          <aside className="border-t border-border bg-surface p-4 lg:col-start-2 2xl:col-start-auto 2xl:border-l 2xl:border-t-0">
            <div className="grid max-h-[calc(100dvh-220px)] gap-5 overflow-y-auto pr-1">
              <section><h3 className="mb-2 mt-0 text-[12px] font-semibold">Композиция</h3><Select value={selectedSlide.layout} onChange={(event) => updateSlide({ layout: event.target.value as PresentationSlideLayout })} options={Object.entries(layoutLabels).map(([value, label]) => ({ value, label }))} /></section>
              <section className="grid gap-3"><h3 className="m-0 text-[12px] font-semibold">Содержание</h3><FormField label="Надзаголовок" htmlFor="slide-eyebrow"><Input id="slide-eyebrow" value={selectedSlide.eyebrow} onChange={(event) => updateSlide({ eyebrow: event.target.value })} placeholder="Например: ИССЛЕДОВАНИЕ" /></FormField><FormField label="Заголовок-вывод" htmlFor="slide-title"><Textarea id="slide-title" value={selectedSlide.title} onChange={(event) => updateSlide({ title: event.target.value })} rows={3} /></FormField><FormField label="Пояснение" htmlFor="slide-body"><Textarea id="slide-body" value={selectedSlide.body} onChange={(event) => updateSlide({ body: event.target.value })} rows={4} /></FormField><FormField label={selectedSlide.layout === "stats" ? "Показатели: число | подпись" : "Пункты — один на строку"} htmlFor="slide-bullets"><Textarea id="slide-bullets" value={selectedSlide.bullets.join("\n")} onChange={(event) => updateSlide({ bullets: event.target.value.split("\n").slice(0, 8) })} rows={5} /></FormField></section>
              <section><div className="mb-2 flex items-center justify-between"><h3 className="m-0 text-[12px] font-semibold">Изображение</h3>{selectedSlide.imageUrl ? <Button variant="ghost" size="sm" onClick={() => updateSlide({ imageUrl: undefined, assetId: undefined })}>Убрать</Button> : null}</div><ImageAssetPicker kind="photo" value={selectedSlide.imageUrl} destinationLabel="презентации" onSelect={(url) => updateSlide({ imageUrl: url, assetId: imageAssetId(url) })} /></section>
              <section><h3 className="mb-2 mt-0 text-[12px] font-semibold">Фон и цвета текущей презентации</h3><p className="mb-3 mt-0 text-[10px] leading-4 text-text-muted">Изменения сразу видны на большом слайде. Тема применяет согласованную палитру ко всей презентации.</p><ThemeStrip value={project.themeId} onChange={changeTheme} /><div className="mt-3 grid grid-cols-3 gap-2"><FormField label="Акцент"><Input type="color" value={project.accentColor} onChange={(event) => updateProject({ accentColor: event.target.value.toUpperCase() })} className="h-10 p-1" /></FormField><FormField label="Фон слайда"><Input type="color" value={project.backgroundColor} onChange={(event) => updateProject({ backgroundColor: event.target.value.toUpperCase() })} className="h-10 p-1" /></FormField><FormField label="Текст"><Input type="color" value={project.textColor} onChange={(event) => updateProject({ textColor: event.target.value.toUpperCase() })} className="h-10 p-1" /></FormField></div></section>
              <section><FormField label="Заметки выступающего" hint="Факты и внешние источники указывайте здесь. Они сохраняются в проекте." htmlFor="slide-notes"><Textarea id="slide-notes" value={selectedSlide.speakerNotes} onChange={(event) => updateSlide({ speakerNotes: event.target.value })} rows={5} /></FormField></section>
            </div>
          </aside>
          </div>
          <div className="flex flex-col gap-3 border-t border-border bg-[#1C171B] px-4 py-4 text-white sm:flex-row sm:items-center sm:justify-between sm:px-6"><div><p className="m-0 text-[12px] font-semibold">Презентация готова для письма</p><p className="mb-0 mt-1 text-[10px] text-white/60">В кампании выберите UniSender: Поток приложит сохранённый PPTX к email.</p></div><Button onClick={() => void openEmailCampaign()} leadingIcon={<Send className="size-4" />}>Отправить вместе с письмом</Button></div>
        </div>
        <Modal open={slideImageOpen} onOpenChange={setSlideImageOpen} title="Изображение слайда" description="Выберите файл из медиатеки или загрузите новый. Изображение сразу появится на активном слайде." size="lg" footer={<Button variant="ghost" onClick={() => setSlideImageOpen(false)}>Закрыть</Button>}><ImageAssetPicker kind="photo" value={selectedSlide.imageUrl} destinationLabel="активного слайда" onSelect={(url) => { updateSlide({ imageUrl: url, assetId: imageAssetId(url) }); setSlideImageOpen(false); }} /></Modal>
      </div>
    );
  }

  return (
    <div className="grid gap-8">
      <PageHeader eyebrow="ПРЕЗЕНТАЦИИ «ПОТОК»" title="Студия презентаций" description="Соберите историю вручную, превратите готовое письмо в слайды или получите связный черновик от ИИ. Каждый проект сохраняется в рабочем пространстве и скачивается настоящим файлом PowerPoint." action={<><Button variant="outline" leadingIcon={<Mail className="size-4" />} onClick={() => void openEmailImport()}>Из письма</Button><Button variant="outline" leadingIcon={<Sparkles className="size-4" />} onClick={() => setAiOpen(true)}>Создать с ИИ</Button><Button leadingIcon={<FilePlus2 className="size-4" />} onClick={createBlank} loading={busy === "blank"}>Новая презентация</Button></>} />
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <div className="grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-3">
        {[{ icon: Mail, title: "1. Возьмите основу", text: "Создайте с нуля, выберите сценарий или перенесите структуру email-шаблона." }, { icon: LayoutTemplate, title: "2. Соберите историю", text: "Меняйте порядок, композицию, текст, тему и изображения для каждого слайда." }, { icon: Download, title: "3. Используйте результат", text: "Сохраните проект, поделитесь внутренней ссылкой или скачайте редактируемый PPTX." }].map(({ icon: Icon, title, text }) => <div key={title} className="flex gap-3 rounded-lg bg-surface-subtle/55 p-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-subtle text-primary"><Icon className="size-4" /></span><div><p className="m-0 text-[12px] font-semibold text-text-strong">{title}</p><p className="mb-0 mt-1 text-[11px] leading-4 text-text-muted">{text}</p></div></div>)}
      </div>
      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><h2 className="m-0 text-[18px] font-semibold tracking-[-0.025em]">Ваши презентации</h2><p className="mb-0 mt-1 text-[12px] text-text-muted">{presentations.length ? `${presentations.length} ${presentations.length % 10 === 1 && presentations.length % 100 !== 11 ? "проект" : presentations.length % 10 >= 2 && presentations.length % 10 <= 4 && (presentations.length % 100 < 12 || presentations.length % 100 > 14) ? "проекта" : "проектов"} в рабочем пространстве` : "Созданные проекты появятся здесь"}</p></div><SearchInput value={query} onChange={(event) => setQuery(event.target.value)} onClear={() => setQuery("")} placeholder="Найти презентацию" wrapperClassName="w-full sm:w-72" /></div>
        {filteredProjects.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{filteredProjects.map((item) => <article key={item.id} className="group overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--shadow-xs)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]"><button type="button" className="block w-full p-3 text-left" onClick={() => navigateTo(item.id)}><div className="overflow-hidden rounded-lg"><SlidePreview project={item} slide={item.slides[0] ?? emptySlide("title")} compact /></div><div className="px-1 pb-1 pt-3"><div className="flex items-start justify-between gap-2"><h3 className="m-0 text-[14px] font-semibold text-text-strong">{item.name}</h3><span className="shrink-0 text-[10px] text-text-subtle">{item.slides.length} сл.</span></div><p className="mb-0 mt-1 line-clamp-2 text-[11px] leading-4 text-text-muted">{item.description || "Без описания"}</p></div></button><div className="flex items-center justify-between border-t border-border px-4 py-2.5"><span className="text-[10px] text-text-subtle">{sourceLabels[item.sourceType]} · {new Date(item.updatedAt).toLocaleDateString("ru-RU")}</span><button type="button" onClick={() => void deleteProject(item)} disabled={busy === `delete-${item.id}`} className="rounded-md p-1.5 text-text-subtle hover:bg-danger-subtle hover:text-danger" aria-label={`Удалить ${item.name}`}><Trash2 className="size-3.5" /></button></div></article>)}</div> : <div className="rounded-xl border border-dashed border-border-strong bg-surface px-6 py-10 text-center"><LayoutTemplate className="mx-auto size-7 text-primary" /><h3 className="mb-0 mt-3 text-[14px] font-semibold">{query ? "Ничего не найдено" : "Начните с подходящего сценария"}</h3><p className="mx-auto mb-0 mt-1 max-w-md text-[12px] text-text-muted">{query ? "Измените запрос или очистите поиск." : "Выберите шаблон ниже, перенесите письмо или начните с пустой презентации."}</p></div>}
      </section>
      <section id="presentation-template-library" className="scroll-mt-6"><div className="mb-4 flex flex-col justify-between gap-3 lg:flex-row lg:items-end"><div><h2 className="m-0 text-[18px] font-semibold tracking-[-0.025em]">Шаблоны презентаций</h2><p className="mb-0 mt-1 text-[12px] text-text-muted">Разные сценарии, композиции и визуальные темы — от строгого отчёта до яркого выступления.</p></div><div className="grid gap-2 sm:grid-cols-[240px_210px]"><SearchInput value={templateQuery} onChange={(event) => setTemplateQuery(event.target.value)} onClear={() => setTemplateQuery("")} placeholder="Найти шаблон" /><Select value={templateUseCase} onChange={(event) => setTemplateUseCase(event.target.value)} options={templateUseCases.map((value) => ({ value, label: value }))} /></div></div><p className="mb-3 mt-0 text-[10px] text-text-subtle">Найдено: {filteredPresentationTemplates.length} из {presentationTemplates.length}</p><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{filteredPresentationTemplates.map((template) => <article key={template.id} className="group overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--shadow-xs)] transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[var(--shadow-md)]"><div className="p-3"><div className="overflow-hidden rounded-lg"><SlidePreview project={template} slide={template.slides[0]} compact /></div><div className="px-1 pt-3"><span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-primary">{template.useCase}</span><h3 className="mb-0 mt-1 text-[14px] font-semibold">{template.name}</h3><p className="mb-0 mt-1 min-h-8 text-[11px] leading-4 text-text-muted">{template.description}</p></div></div><div className="flex items-center justify-between border-t border-border px-4 py-3"><span className="text-[10px] text-text-subtle">{template.slides.length} слайдов · {presentationTheme(template.themeId).name}</span><Button size="sm" variant="outline" onClick={() => createFromScenario(template)} loading={busy === template.id}>Использовать</Button></div></article>)}</div>{!filteredPresentationTemplates.length ? <div className="rounded-xl border border-dashed border-border p-8 text-center text-[12px] text-text-muted">По этим условиям шаблонов нет. Сбросьте поиск или выберите другую задачу.</div> : null}</section>

      <Modal open={aiOpen} onOpenChange={(open) => { setAiOpen(open); setAiError(""); if (!open) aiIdempotencyKeyRef.current = ""; }} title="Создать презентацию с ИИ" description="Опишите задачу и факты — Поток соберёт связную историю, которую можно полностью редактировать." size="lg" footer={<><Button variant="ghost" onClick={() => { aiIdempotencyKeyRef.current = ""; setAiOpen(false); }}>Отмена</Button><Button onClick={() => void generateWithAi()} disabled={aiStatus?.configured !== true || aiGoal.trim().length < 12} loading={busy === "ai" || busy === "ai-save"} loadingText="Проектируем сюжет и слайды" leadingIcon={<Sparkles className="size-4" />}>Создать презентацию</Button></>}><div className="grid gap-4">{aiStatus === null ? <Alert tone="info">Проверяем подключение ИИ…</Alert> : aiStatus.configured ? <Alert tone="success" title="ИИ готов">Сначала будет создана структура, затем проект автоматически откроется в редакторе.</Alert> : <Alert tone="warning" title="ИИ не подключён">Создание с ИИ сейчас недоступно. Выберите шаблон ниже или подключите провайдера в настройках платформы.</Alert>}{aiError ? <Alert tone="danger" title="Презентация не создана">{aiError}</Alert> : null}<FormField label="Задача презентации" required htmlFor="ai-presentation-goal" hint="Что аудитория должна понять и почему это важно?"><Textarea id="ai-presentation-goal" data-autofocus value={aiGoal} onChange={(event) => { aiIdempotencyKeyRef.current = ""; setAiError(""); setAiGoal(event.target.value); }} rows={5} placeholder="Например: представить платформу Поток управляющим партнёрам юридических фирм и показать сценарий пилота." /></FormField><div className="grid gap-4 sm:grid-cols-2"><FormField label="Для кого" htmlFor="ai-presentation-audience"><Input id="ai-presentation-audience" value={aiAudience} onChange={(event) => { aiIdempotencyKeyRef.current = ""; setAiAudience(event.target.value); }} placeholder="Управляющие партнёры, знакомы с темой поверхностно" /></FormField><FormField label="Действие после презентации" htmlFor="ai-presentation-action"><Input id="ai-presentation-action" value={aiAction} onChange={(event) => { aiIdempotencyKeyRef.current = ""; setAiAction(event.target.value); }} placeholder="Согласовать пилот или назначить встречу" /></FormField></div><FormField label="Факты и исходные данные" htmlFor="ai-presentation-context" hint="Только эти данные ИИ сможет использовать как подтверждённые факты."><Textarea id="ai-presentation-context" value={aiContext} onChange={(event) => { aiIdempotencyKeyRef.current = ""; setAiContext(event.target.value); }} rows={3} placeholder="Цифры, даты, продуктовые возможности, цитаты и ограничения. Можно оставить пустым." /></FormField><div className="grid gap-4 sm:grid-cols-2"><FormField label="Подача"><Select value={aiTone} onChange={(event) => { aiIdempotencyKeyRef.current = ""; setAiTone(event.target.value as typeof aiTone); }} options={[{value:"executive",label:"Для руководителей · кратко"},{value:"persuasive",label:"Убедительная · к решению"},{value:"educational",label:"Объясняющая · от основ"},{value:"visual",label:"Визуальная · минимум текста"}]} /></FormField><FormField label="Количество слайдов"><Select value={String(aiSlideCount)} onChange={(event) => { aiIdempotencyKeyRef.current = ""; setAiSlideCount(Number(event.target.value)); }} options={[5, 6, 7, 8, 10, 12, 15].map((count) => ({ value: String(count), label: `${count} слайдов` }))} /></FormField></div><FormField label="Визуальная тема"><ThemeStrip value={aiTheme} onChange={(theme) => { aiIdempotencyKeyRef.current = ""; setAiTheme(theme); }} /></FormField></div></Modal>

      <Modal open={emailOpen} onOpenChange={setEmailOpen} title="Превратить письмо в презентацию" description="Поток перенесёт тему, ключевые блоки, CTA и изображения в отдельную слайдовую историю. Исходное письмо не изменится." size="lg" footer={<><Button variant="ghost" onClick={() => setEmailOpen(false)}>Отмена</Button><Button onClick={() => void createFromEmail()} loading={busy === "email-create"} disabled={!selectedEmailId} leadingIcon={<Mail className="size-4" />}>Создать из письма</Button></>}><div className="grid gap-3"><SearchInput value={emailQuery} onChange={(event) => setEmailQuery(event.target.value)} onClear={() => setEmailQuery("")} placeholder="Найти письмо или шаблон" />{busy === "email-list" ? <p className="text-[12px] text-text-muted">Загружаем шаблоны…</p> : <div className="grid max-h-80 gap-2 overflow-y-auto">{filteredEmailTemplates.map((template) => <button key={template.id} type="button" onClick={() => setSelectedEmailId(template.id)} aria-pressed={selectedEmailId === template.id} className="flex items-start gap-3 rounded-lg border border-border bg-surface p-3 text-left transition hover:border-primary/40 aria-pressed:border-primary aria-pressed:bg-primary-subtle/30"><span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-surface-subtle text-text-muted"><Mail className="size-4" /></span><span className="min-w-0 flex-1"><strong className="block truncate text-[12px]">{template.name}</strong><span className="mt-0.5 block truncate text-[11px] text-text-muted">{template.subject}</span></span>{selectedEmailId === template.id ? <Check className="mt-1 size-4 shrink-0 text-primary" /> : null}</button>)}{!filteredEmailTemplates.length ? <p className="rounded-lg border border-dashed border-border p-5 text-center text-[12px] text-text-muted">Шаблоны не найдены.</p> : null}</div>}</div></Modal>
    </div>
  );
}
