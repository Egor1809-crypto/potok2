"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { TemplateDirector } from "@/components/templates/TemplateDirector";
import { PresentationDirector } from "@/components/presentations/PresentationDirector";
import { SlidePreview } from "@/components/presentations/PresentationStudio";
import { PhotoDirector } from "./PhotoDirector";
import { Alert, Button } from "@/components/ui";
import { Mail, Presentation, Image as ImageIcon } from "@/components/ui/icons";
import type { EmailTemplateRecord, PresentationProjectRecord, EmailAssetRecord } from "@/types/api";
import styles from "./Director.module.css";

const formats = [
  { id: "emails", label: "Письма", icon: Mail },
  { id: "presentations", label: "Презентации", icon: Presentation },
  { id: "photos", label: "Фотографии", icon: ImageIcon },
] as const;
type Format = typeof formats[number]["id"];
const endpoint: Record<Format, string> = { emails: "/api/templates", presentations: "/api/presentations", photos: "/api/image-studio" };

export function ArtDirectorView() {
  const router = useRouter(), params = useSearchParams();
  const type: Format = params.get("type") === "presentations" ? "presentations" : params.get("type") === "photos" ? "photos" : "emails";
  // Keep each opened workspace mounted when changing format: edits and running reviews survive.
  const [visited, setVisited] = useState<Format[]>([type]);
  const initialSelection = useRef({ type, id: params.get("id") });
  const [templates, setTemplates] = useState<EmailTemplateRecord[]>([]);
  const [projects, setProjects] = useState<PresentationProjectRecord[]>([]);
  const [assets, setAssets] = useState<EmailAssetRecord[]>([]);
  const [states, setStates] = useState<Record<Format, "loading" | "ready" | "error">>({ emails: "loading", presentations: "loading", photos: "loading" });
  const [errors, setErrors] = useState<Partial<Record<Format, string>>>({});
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    for (const format of formats) void (async () => {
      try {
        const response = await fetch(endpoint[format.id], { signal: controller.signal, cache: "no-store" });
        const body = await response.json() as { error?: string; templates?: EmailTemplateRecord[]; presentations?: PresentationProjectRecord[]; assets?: EmailAssetRecord[] };
        if (!response.ok) throw new Error(body.error || "Не удалось загрузить библиотеку.");
        const rows = body[format.id === "emails" ? "templates" : format.id === "photos" ? "assets" : "presentations"];
        if (!Array.isArray(rows)) throw new Error("Не удалось прочитать библиотеку.");
        if (format.id === "emails") setTemplates(rows as EmailTemplateRecord[]);
        else if (format.id === "presentations") setProjects(rows as PresentationProjectRecord[]);
        else setAssets(rows as EmailAssetRecord[]);
        setStates(s => ({ ...s, [format.id]: "ready" }));
      } catch (error) {
        if (controller.signal.aborted) return;
        setStates(s => ({ ...s, [format.id]: "error" }));
        setErrors(e => ({ ...e, [format.id]: error instanceof Error ? error.message : "Не удалось загрузить библиотеку." }));
      }
    })();
    return () => controller.abort();
  }, [retry]);
  const changeFormat = (next: Format) => {
    setVisited(items => items.includes(next) ? items : [...items, next]);
    router.replace(`/art-director?type=${next}`, { scroll: false });
  };
  return <AppShell title="Арт-директор" contentWidth="full" viewportLocked desktopSidebarCollapsible contentClassName="!p-3 sm:!px-5">
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>Арт-директор</h1>
        <div className={styles.switcher} role="group" aria-label="Формат материала">
          {formats.map(({ id, label, icon: Icon }) => <button key={id} type="button" aria-pressed={type === id} onClick={() => changeFormat(id)}><Icon aria-hidden className="size-6" />{label}</button>)}
        </div>
      </header>
      {formats.filter(format => visited.includes(format.id) || type === format.id).map(format => <div key={format.id} hidden={type !== format.id} className={styles.panel}>
        {states[format.id] === "loading" ? <p role="status">Загружаем материалы…</p> : states[format.id] === "error" ? <div><Alert tone="danger">{errors[format.id]}</Alert><Button variant="secondary" onClick={() => { setStates(s => ({ ...s, [format.id]: "loading" })); setRetry(n => n + 1); }}>Повторить загрузку</Button></div> : format.id === "emails" ?
          <TemplateDirector embedded open onOpenChange={open => { if (!open) router.push("/templates"); }} templates={templates} initialTemplate={initialSelection.current.type === "emails" ? templates.find(t => t.id === initialSelection.current.id) ?? null : null} onSaved={template => setTemplates(items => [template, ...items.filter(t => t.id !== template.id)])} /> : format.id === "presentations" ?
          <PresentationDirector embedded projects={projects} initial={initialSelection.current.type === "presentations" ? projects.find(p => p.id === initialSelection.current.id) : undefined} onClose={() => router.push("/presentations")} onSaved={project => setProjects(items => items.map(p => p.id === project.id ? project : p))} renderSlide={(p, slide) => <SlidePreview project={p} slide={slide} />} /> :
          <PhotoDirector assets={assets} initialId={initialSelection.current.type === "photos" ? initialSelection.current.id : null} />}
      </div>)}
    </div>
  </AppShell>;
}
