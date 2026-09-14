"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { ArrowRight, Copy, Eye, PencilLine, Sparkles, Star, Trash2 } from "@/components/ui/icons";
import type { EmailTemplateRecord } from "@/types/api";
import { Badge, Button, buttonVariants } from "@/components/ui";
import { LetterPreview } from "./LetterPreview";
import { templateCategoryLabels } from "./templateLabels";
import styles from "./Templates.module.css";

export function TemplateCard({
  template, editHref, editLabel = "Редактировать", applyHref,
  onPreview, onDirector, onClone, onDelete, onFavorite, busyAction,
}: {
  template: EmailTemplateRecord;
  editHref: string;
  editLabel?: string;
  applyHref: string;
  onPreview: () => void;
  onDirector?: () => void;
  onClone: () => void;
  onDelete: () => void;
  onFavorite: () => void;
  busyAction?: "clone" | "delete" | "favorite";
}) {
  return (
    <article className={styles.card} aria-label={template.name}>
      <div className={styles.preview}>
        <button type="button" onClick={onFavorite} disabled={Boolean(busyAction)} aria-busy={busyAction === "favorite" || undefined} aria-pressed={template.isFavorite} aria-label={`${template.isFavorite ? "Убрать из избранного" : "Добавить в избранное"}: ${template.name}`} title={template.isFavorite ? "Убрать из избранного" : "Добавить в избранное"} className={styles.favorite}>
          <Star aria-hidden="true" className={`size-6 ${template.isFavorite ? "fill-current" : ""}`} />
        </button>
        <Link href={editHref} aria-label={`${editLabel} шаблон «${template.name}»`} className={styles.previewLink}>
          <TemplateThumbnail template={template} />
        </Link>
        <button type="button" onClick={onPreview} aria-label={`Посмотреть письмо «${template.name}»`} className={styles.previewAction}>
          <Eye aria-hidden="true" className="size-5" />Посмотреть письмо
        </button>
      </div>
      <div className={styles.cardBody}>
        <div className={styles.cardMeta}>
          <span>{templateCategoryLabels[template.category]}</span>
          {!template.isStarter && <Badge variant="accent">Мой шаблон</Badge>}
        </div>
        <h2 className={styles.cardTitle} title={template.name}>{template.name}</h2>
        <p className={styles.description}>{template.description || template.subject}</p>
        <div className={styles.cardActions}>
          <Link href={editHref} className={buttonVariants({ variant: "secondary", size: "sm" })}>
            <PencilLine aria-hidden="true" className="size-5" />{editLabel}
          </Link>
          <Link href={applyHref} className={buttonVariants({ variant: "outline", size: "sm", className: styles.apply })}>
            В кампанию<ArrowRight aria-hidden="true" className="size-5" />
          </Link>
        </div>
        <div className={styles.cardFooter}>
          {onDirector && <Button variant="ghost" size="sm" onClick={onDirector} className={styles.director}><Sparkles aria-hidden className="size-5" />Арт-директор</Button>}
          <div className={styles.utilities}>
            <Button variant="ghost" size="icon" onClick={onClone} loading={busyAction === "clone"} disabled={Boolean(busyAction)} aria-label={`Дублировать шаблон «${template.name}»`} title="Дублировать шаблон">
              <Copy aria-hidden="true" className="size-5" />
            </Button>
            {!template.isStarter && <Button variant="ghost" size="icon" onClick={onDelete} loading={busyAction === "delete"} disabled={Boolean(busyAction)} aria-label={`Удалить шаблон «${template.name}»`} title="Удалить шаблон" className={styles.delete}>
              <Trash2 aria-hidden="true" className="size-5" />
            </Button>}
          </div>
        </div>
      </div>
    </article>
  );
}

/** Use the saved letter instead of approximating its blocks. Frames are only
 * mounted near the viewport so large libraries stay responsive. */
export function TemplateThumbnail({ template }: { template: EmailTemplateRecord }) {
  const container = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [width, setWidth] = useState(0);
  const pageWidth = Math.max(640, template.builderDocument.contentWidth || 640);
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const resize = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    const intersection = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: "240px 0px" });
    resize.observe(element); intersection.observe(element);
    return () => { resize.disconnect(); intersection.disconnect(); };
  }, []);
  return <div className={styles.thumbnail} style={{ "--letter-accent": template.builderDocument.accentColor || "#7c35f2" } as CSSProperties}>
    <div ref={container} className={styles.paper} aria-hidden="true" inert>
      {visible && width > 0 ? <div className={styles.letterFrame} style={{ width: pageWidth, transform: `scale(${width / pageWidth})` }}>
        <LetterPreview html={template.emailBodyHtml} title={`Миниатюра: ${template.name}`} className="h-[1600px]" />
      </div> : <div className={styles.thumbnailPlaceholder} />}
    </div>
  </div>;
}
