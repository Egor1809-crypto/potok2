"use client";

import { useEditorDraft } from "@/lib/use-editor-draft";

import { confirmAction } from "@/components/ui/confirm-action";

import { presentationChartData, presentationFontFamily, presentationReadableColors, presentationStepText } from "@/lib/presentation-design-quality";
import { estimatedTextLines } from "@/lib/design-readability";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  Copy,
  Download,
  FilePlus2,
  LayoutTemplate,
  Mail,
  Image as ImageIcon,
  PanelLeftClose,
  PanelLeftOpen,
  Palette,
  Plus,
  Save,
  Sparkles,
  Star,
  Trash2,
  Type,
} from "@/components/ui/icons";

import { ImageAssetPicker } from "@/components/email-builder/ImageAssetPicker";
import {
  AiCreationModePicker,
  type AiCreationSource,
} from "@/components/ai/AiCreationModePicker";
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
import { presentationPatternCatalog } from "@/data/presentation-patterns";
import type {
  ApiError,
  EmailTemplateRecord,
  EmailTemplatesListResponse,
  PresentationAiResponse,
  PresentationMutationResponse,
  PresentationProjectRecord,
  PresentationPatternId,
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
  timeline: "Таймлайн",
  process: "Процесс",
  comparison: "Сравнение",
  agenda: "Повестка",
  gallery: "Галерея",
  chart: "Диаграмма",
  table: "Таблица",
  callout: "Акцент",
  closing: "Финал",
};

const sourceLabels: Record<PresentationProjectRecord["sourceType"], string> = {
  blank: "С нуля",
  template: "Из сценария",
  ai: "Черновик ИИ",
  email: "Из email-шаблона",
};

const presentationPatterns = presentationPatternCatalog;

function apiError(body: unknown, fallback: string) {
  return body &&
    typeof body === "object" &&
    !Array.isArray(body) &&
    "error" in body
    ? String((body as ApiError).error)
    : fallback;
}

async function jsonBody<T>(response: Response): Promise<T | ApiError> {
  return (await response.json()) as T | ApiError;
}

function cloneSlides(slides: PresentationSlide[]) {
  return slides.map((slide) => ({
    ...slide,
    id: `slide-${crypto.randomUUID()}`,
    bullets: [...slide.bullets],
  }));
}

function emptySlide(
  layout: PresentationSlideLayout = "statement",
): PresentationSlide {
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
  return /^asset-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    normalized,
  )
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

function presentationPatternStyle(
  themeId: PresentationThemeId,
  accentColor: string,
  seed = "",
  patternId: PresentationPatternId = "auto",
): CSSProperties {
  const accent = /^#[0-9a-f]{6}$/i.test(accentColor) ? accentColor : "#7C35F2";
  if (patternId === "none") return {};
  if (patternId === "soft-grid")
    return {
      backgroundImage: `linear-gradient(${accent}14 1px, transparent 1px), linear-gradient(90deg, ${accent}14 1px, transparent 1px)`,
      backgroundSize: "48px 48px",
    };
  if (patternId === "editorial-lines")
    return {
      backgroundImage: `linear-gradient(90deg, ${accent}24 1px, transparent 1px), linear-gradient(${accent}18 1px, transparent 1px)`,
      backgroundSize: "100% 100%, 100% 20%",
    };
  if (patternId === "orbit")
    return {
      backgroundImage: `radial-gradient(circle at 86% 22%, transparent 0 10%, ${accent}28 10.3% 10.8%, transparent 11.1% 17%, ${accent}16 17.3% 17.7%, transparent 18%)`,
    };
  if (patternId === "diagonal")
    return {
      backgroundImage: `linear-gradient(145deg, transparent 0 76%, ${accent}1F 76% 77%, transparent 77% 82%, ${accent}12 82% 83%, transparent 83%)`,
    };
  if (patternId === "waves")
    return {
      backgroundImage: `radial-gradient(circle at 100% 100%, transparent 0 18%, ${accent}22 18.4% 18.9%, transparent 19.3% 27%, ${accent}16 27.4% 27.9%, transparent 28.3%)`,
    };
  if (patternId === "gold-frame")
    return {
      backgroundImage: `linear-gradient(${accent} 0 0), linear-gradient(${accent} 0 0), linear-gradient(${accent} 0 0), linear-gradient(${accent} 0 0)`,
      backgroundSize:
        "calc(100% - 10%) 1px, calc(100% - 10%) 1px, 1px calc(100% - 14%), 1px calc(100% - 14%)",
      backgroundPosition: "center 7%, center 93%, 5% center, 95% center",
      backgroundRepeat: "no-repeat",
    };
  if (patternId === "aurora-mesh")
    return {
      backgroundImage: `radial-gradient(circle at 12% 18%, ${accent}3D 0 13%, transparent 38%), radial-gradient(circle at 88% 20%, ${accent}24 0 16%, transparent 44%), radial-gradient(circle at 70% 92%, ${accent}32 0 18%, transparent 46%)`,
      backgroundSize: "100% 100%",
    };
  if (patternId === "topography")
    return {
      backgroundImage: `repeating-radial-gradient(ellipse at 88% 18%, transparent 0 15px, ${accent}1D 16px 17px, transparent 18px 31px), repeating-radial-gradient(ellipse at 4% 110%, transparent 0 22px, ${accent}13 23px 24px, transparent 25px 41px)`,
      backgroundSize: "100% 100%",
    };
  if (patternId === "paper-grain")
    return {
      backgroundImage: `radial-gradient(circle, ${accent}22 0 0.8px, transparent 1px), linear-gradient(135deg, ${accent}08, transparent 42%, ${accent}0B)`,
      backgroundSize: "7px 7px, 100% 100%",
    };
  if (patternId === "archways")
    return {
      backgroundImage: `radial-gradient(ellipse at 50% 100%, transparent 0 38%, ${accent}22 38.5% 40%, transparent 40.5% 53%, ${accent}15 53.5% 55%, transparent 55.5%)`,
      backgroundSize: "28% 88%",
      backgroundPosition: "right bottom",
      backgroundRepeat: "repeat-x",
    };
  if (patternId === "confetti")
    return {
      backgroundImage: `radial-gradient(circle at 14% 18%, ${accent}55 0 2px, transparent 2.5px), radial-gradient(circle at 82% 22%, ${accent}38 0 3px, transparent 3.5px), radial-gradient(circle at 74% 78%, ${accent}42 0 2px, transparent 2.5px), radial-gradient(circle at 22% 86%, ${accent}2E 0 4px, transparent 4.5px), linear-gradient(32deg, transparent 48%, ${accent}2A 49% 51%, transparent 52%)`,
      backgroundSize: "92px 92px, 128px 128px, 104px 104px, 156px 156px, 74px 74px",
    };
  if (patternId === "checker-soft")
    return {
      backgroundImage: `linear-gradient(45deg, ${accent}12 25%, transparent 25% 75%, ${accent}12 75%), linear-gradient(45deg, ${accent}12 25%, transparent 25% 75%, ${accent}12 75%)`,
      backgroundPosition: "0 0, 24px 24px",
      backgroundSize: "48px 48px",
    };
  if (patternId === "sunburst")
    return {
      backgroundImage: `conic-gradient(from 205deg at 92% 16%, transparent 0 8deg, ${accent}24 8deg 13deg, transparent 13deg 22deg, ${accent}18 22deg 27deg, transparent 27deg 38deg, ${accent}12 38deg 42deg, transparent 42deg 360deg)`,
      backgroundSize: "100% 100%",
    };
  if (patternId === "halftone")
    return {
      backgroundImage: `radial-gradient(circle, ${accent}2F 0 1.2px, transparent 1.6px)`,
      backgroundSize: "12px 12px",
      backgroundPosition: "right top",
    };
  if (patternId === "ribbons")
    return {
      backgroundImage: `linear-gradient(128deg, transparent 0 62%, ${accent}12 62% 70%, transparent 70%), linear-gradient(142deg, transparent 0 72%, ${accent}24 72% 79%, transparent 79%), linear-gradient(155deg, transparent 0 82%, ${accent}36 82% 88%, transparent 88%)`,
      backgroundSize: "100% 100%",
    };
  if (patternId === "terrazzo")
    return {
      backgroundImage: `linear-gradient(25deg, transparent 46%, ${accent}2F 47% 52%, transparent 53%), linear-gradient(118deg, transparent 47%, ${accent}1F 48% 53%, transparent 54%), radial-gradient(ellipse, ${accent}29 0 3px, transparent 3.5px)`,
      backgroundSize: "68px 74px, 96px 88px, 58px 62px",
      backgroundPosition: "0 0, 24px 18px, 12px 30px",
    };
  if (patternId === "contour-flow")
    return {
      backgroundImage: `repeating-radial-gradient(ellipse at 110% 50%, transparent 0 18px, ${accent}19 19px 20px, transparent 21px 35px)`,
      backgroundSize: "100% 100%",
    };
  if (patternId === "micro-dots")
    return {
      backgroundImage: `radial-gradient(circle, ${accent}2A 0 0.8px, transparent 1px)`,
      backgroundSize: "9px 9px",
    };
  if (patternId === "isometric-cubes")
    return {
      backgroundImage: `linear-gradient(30deg, ${accent}15 12%, transparent 12.5% 87%, ${accent}15 87.5%), linear-gradient(150deg, ${accent}15 12%, transparent 12.5% 87%, ${accent}15 87.5%), linear-gradient(30deg, ${accent}0D 12%, transparent 12.5% 87%, ${accent}0D 87.5%)`,
      backgroundPosition: "0 0, 0 0, 28px 48px",
      backgroundSize: "56px 96px",
    };
  if (patternId === "herringbone")
    return {
      backgroundImage: `linear-gradient(135deg, ${accent}1B 25%, transparent 25%), linear-gradient(225deg, ${accent}1B 25%, transparent 25%), linear-gradient(45deg, ${accent}12 25%, transparent 25%), linear-gradient(315deg, ${accent}12 25%, transparent 25%)`,
      backgroundPosition: "24px 0, 24px 0, 0 0, 0 0",
      backgroundSize: "48px 48px",
    };
  if (patternId === "japanese-waves")
    return {
      backgroundImage: `radial-gradient(circle at 50% 100%, transparent 0 16px, ${accent}22 17px 18px, transparent 19px 31px, ${accent}16 32px 33px, transparent 34px)`,
      backgroundSize: "68px 34px",
    };
  if (patternId === "flower-lattice")
    return {
      backgroundImage: `radial-gradient(ellipse at 50% 0, ${accent}19 0 20%, transparent 21%), radial-gradient(ellipse at 0 50%, ${accent}19 0 20%, transparent 21%), radial-gradient(ellipse at 100% 50%, ${accent}19 0 20%, transparent 21%), radial-gradient(ellipse at 50% 100%, ${accent}19 0 20%, transparent 21%)`,
      backgroundSize: "52px 52px",
    };
  if (patternId === "hexagon-net")
    return {
      backgroundImage: `linear-gradient(30deg, ${accent}1C 12%, transparent 12.5% 87%, ${accent}1C 87.5%), linear-gradient(150deg, ${accent}1C 12%, transparent 12.5% 87%, ${accent}1C 87.5%), linear-gradient(30deg, ${accent}12 12%, transparent 12.5% 87%, ${accent}12 87.5%)`,
      backgroundPosition: "0 0, 0 0, 31px 54px",
      backgroundSize: "62px 108px",
    };
  if (patternId === "circuit-board")
    return {
      backgroundImage: `radial-gradient(circle, ${accent}45 0 2px, transparent 2.5px), linear-gradient(${accent}1B 1px, transparent 1px), linear-gradient(90deg, ${accent}1B 1px, transparent 1px)`,
      backgroundSize: "64px 64px, 32px 32px, 32px 32px",
      backgroundPosition: "0 0, 0 0, 0 0",
    };
  if (patternId === "star-field")
    return {
      backgroundImage: `radial-gradient(circle at 20% 30%, ${accent}65 0 1.5px, transparent 2px), radial-gradient(circle at 70% 65%, ${accent}42 0 2px, transparent 2.5px), radial-gradient(circle at 85% 20%, ${accent}35 0 1px, transparent 1.5px)`,
      backgroundSize: "84px 84px, 132px 132px, 58px 58px",
    };
  if (patternId === "memphis")
    return {
      backgroundImage: `radial-gradient(circle, ${accent}4D 0 3px, transparent 3.5px), linear-gradient(35deg, transparent 46%, ${accent}28 47% 52%, transparent 53%), linear-gradient(125deg, transparent 47%, ${accent}1C 48% 51%, transparent 52%)`,
      backgroundSize: "86px 86px, 118px 104px, 72px 90px",
      backgroundPosition: "8px 12px, 0 0, 30px 18px",
    };
  if (patternId === "plaid")
    return {
      backgroundImage: `linear-gradient(${accent}19 1px, transparent 1px), linear-gradient(90deg, ${accent}19 1px, transparent 1px), linear-gradient(${accent}0C 5px, transparent 5px), linear-gradient(90deg, ${accent}0C 5px, transparent 5px)`,
      backgroundSize: "42px 42px, 42px 42px, 126px 126px, 126px 126px",
    };
  if (patternId === "scales")
    return {
      backgroundImage: `radial-gradient(circle at 50% 0, transparent 0 18px, ${accent}1D 19px 20px, transparent 21px)`,
      backgroundSize: "40px 22px",
      backgroundPosition: "0 0, 20px 11px",
    };
  if (patternId === "diamond-grid")
    return {
      backgroundImage: `linear-gradient(45deg, transparent 48%, ${accent}20 49% 51%, transparent 52%), linear-gradient(-45deg, transparent 48%, ${accent}20 49% 51%, transparent 52%)`,
      backgroundSize: "42px 42px",
    };
  if (patternId === "crosshatch")
    return {
      backgroundImage: `repeating-linear-gradient(35deg, transparent 0 18px, ${accent}12 19px 20px), repeating-linear-gradient(145deg, transparent 0 24px, ${accent}0E 25px 26px)`,
    };
  if (patternId === "fan-arches")
    return {
      backgroundImage: `repeating-radial-gradient(circle at 100% 100%, transparent 0 18px, ${accent}1B 19px 20px, transparent 21px 34px)`,
      backgroundSize: "72px 72px",
    };
  if (patternId === "barcode")
    return {
      backgroundImage: `repeating-linear-gradient(90deg, ${accent}20 0 1px, transparent 1px 7px, ${accent}12 7px 10px, transparent 10px 18px)`,
      backgroundSize: "180px 100%",
      backgroundPosition: "right top",
      backgroundRepeat: "repeat-y",
    };
  if (patternId === "constellation")
    return {
      backgroundImage: `radial-gradient(circle, ${accent}62 0 2px, transparent 2.5px), linear-gradient(32deg, transparent 49%, ${accent}18 49.5% 50.5%, transparent 51%)`,
      backgroundSize: "94px 72px, 188px 144px",
      backgroundPosition: "12px 8px, 0 0",
    };
  if (patternId === "monogram")
    return {
      backgroundImage: `radial-gradient(circle at 50% 50%, transparent 0 11px, ${accent}1C 12px 13px, transparent 14px), radial-gradient(circle at 0 0, transparent 0 10px, ${accent}14 11px 12px, transparent 13px)`,
      backgroundSize: "58px 58px",
    };
  if (patternId === "bauhaus")
    return {
      backgroundImage: `radial-gradient(circle at 20% 25%, ${accent}35 0 9%, transparent 9.5%), conic-gradient(from 90deg at 80% 70%, ${accent}22 0 25%, transparent 25% 50%, ${accent}12 50% 75%, transparent 75%)`,
      backgroundSize: "180px 180px, 240px 240px",
    };
  if (patternId === "gradient-orbs")
    return {
      backgroundImage: `radial-gradient(circle at 20% 22%, ${accent}38 0 10%, transparent 35%), radial-gradient(circle at 82% 75%, ${accent}2A 0 14%, transparent 42%), radial-gradient(circle at 65% 8%, ${accent}18 0 8%, transparent 30%)`,
    };
  if (patternId === "noise-fade")
    return {
      backgroundImage: `radial-gradient(circle, ${accent}26 0 0.7px, transparent 1px), linear-gradient(110deg, ${accent}10, transparent 52%)`,
      backgroundSize: "6px 6px, 100% 100%",
    };
  if (patternId === "frame-corners")
    return {
      backgroundImage: `linear-gradient(${accent} 0 0), linear-gradient(${accent} 0 0), linear-gradient(${accent} 0 0), linear-gradient(${accent} 0 0), linear-gradient(${accent} 0 0), linear-gradient(${accent} 0 0), linear-gradient(${accent} 0 0), linear-gradient(${accent} 0 0)`,
      backgroundSize: "12% 1px, 1px 16%, 12% 1px, 1px 16%, 12% 1px, 1px 16%, 12% 1px, 1px 16%",
      backgroundPosition: "5% 7%, 5% 7%, 95% 7%, 95% 7%, 5% 93%, 5% 93%, 95% 93%, 95% 93%",
      backgroundRepeat: "no-repeat",
    };
  if (patternId === "data-stream")
    return {
      backgroundImage: `repeating-linear-gradient(90deg, transparent 0 22px, ${accent}13 23px 24px), radial-gradient(circle, ${accent}45 0 1.5px, transparent 2px)`,
      backgroundSize: "100% 100%, 48px 32px",
    };
  if (patternId === "organic-cells")
    return {
      backgroundImage: `radial-gradient(ellipse at 20% 30%, transparent 0 19%, ${accent}18 19.5% 20.5%, transparent 21%), radial-gradient(ellipse at 76% 68%, transparent 0 16%, ${accent}15 16.5% 17.5%, transparent 18%)`,
      backgroundSize: "160px 130px, 190px 150px",
    };
  if (patternId === "tessellated-plus")
    return {
      backgroundImage: `linear-gradient(${accent}1F 0 0), linear-gradient(${accent}1F 0 0)`,
      backgroundSize: "5px 26px, 26px 5px",
      backgroundPosition: "13px 2px, 2px 13px",
    };
  if (patternId === "stair-steps")
    return {
      backgroundImage: `linear-gradient(135deg, ${accent}20 25%, transparent 25% 50%, ${accent}12 50% 75%, transparent 75%)`,
      backgroundSize: "76px 76px",
    };
  if (patternId === "nested-squares")
    return {
      backgroundImage: `linear-gradient(${accent}1A 1px, transparent 1px), linear-gradient(90deg, ${accent}1A 1px, transparent 1px), linear-gradient(${accent}0F 1px, transparent 1px), linear-gradient(90deg, ${accent}0F 1px, transparent 1px)`,
      backgroundSize: "72px 72px, 72px 72px, 24px 24px, 24px 24px",
    };
  if (patternId === "split-circles")
    return {
      backgroundImage: `radial-gradient(circle at 0 50%, ${accent}24 0 18px, transparent 18.5px), radial-gradient(circle at 100% 50%, transparent 0 17px, ${accent}18 17.5px 19px, transparent 19.5px)`,
      backgroundSize: "76px 54px",
      backgroundPosition: "0 0, 0 27px",
    };
  if (patternId === "wave-ribbon")
    return {
      backgroundImage: `radial-gradient(ellipse at 50% 110%, transparent 0 42%, ${accent}26 42.5% 45%, transparent 45.5% 62%, ${accent}14 62.5% 65%, transparent 65.5%)`,
      backgroundSize: "180px 92px",
      backgroundPosition: "right bottom",
      backgroundRepeat: "repeat-x",
    };
  if (patternId === "leaf-canopy")
    return {
      backgroundImage: `radial-gradient(ellipse at 10% 0, ${accent}22 0 16%, transparent 16.5%), radial-gradient(ellipse at 32% 0, ${accent}15 0 13%, transparent 13.5%), radial-gradient(ellipse at 86% 100%, ${accent}1C 0 18%, transparent 18.5%)`,
      backgroundSize: "100% 100%",
    };
  if (patternId === "bubble-chain")
    return {
      backgroundImage: `radial-gradient(circle at 12px 12px, transparent 0 7px, ${accent}25 7.5px 8.5px, transparent 9px), radial-gradient(circle at 34px 34px, ${accent}14 0 5px, transparent 5.5px)`,
      backgroundSize: "46px 46px",
    };
  if (patternId === "pinstripe")
    return {
      backgroundImage: `repeating-linear-gradient(90deg, ${accent}16 0 1px, transparent 1px 18px, ${accent}0B 18px 20px, transparent 20px 42px)`,
    };
  if (patternId === "blueprint-grid")
    return {
      backgroundImage: `linear-gradient(${accent}22 1px, transparent 1px), linear-gradient(90deg, ${accent}22 1px, transparent 1px), linear-gradient(${accent}0C 1px, transparent 1px), linear-gradient(90deg, ${accent}0C 1px, transparent 1px)`,
      backgroundSize: "72px 72px, 72px 72px, 18px 18px, 18px 18px",
    };
  if (patternId === "radar-sweep")
    return {
      backgroundImage: `conic-gradient(from 220deg at 84% 22%, transparent 0 18deg, ${accent}25 18deg 42deg, transparent 42deg), repeating-radial-gradient(circle at 84% 22%, transparent 0 25px, ${accent}18 26px 27px, transparent 28px 50px)`,
    };
  if (patternId === "mosaic-tiles")
    return {
      backgroundImage: `linear-gradient(45deg, ${accent}18 25%, transparent 25% 75%, ${accent}0E 75%), linear-gradient(-45deg, ${accent}10 25%, transparent 25% 75%, ${accent}20 75%)`,
      backgroundSize: "54px 54px",
    };
  if (patternId === "woven-lines")
    return {
      backgroundImage: `repeating-linear-gradient(35deg, transparent 0 9px, ${accent}14 10px 12px, transparent 13px 24px), repeating-linear-gradient(145deg, transparent 0 15px, ${accent}0F 16px 18px, transparent 19px 31px)`,
    };
  if (patternId === "zigzag")
    return {
      backgroundImage: `linear-gradient(135deg, transparent 44%, ${accent}20 45% 52%, transparent 53%), linear-gradient(45deg, transparent 44%, ${accent}14 45% 52%, transparent 53%)`,
      backgroundSize: "54px 54px",
      backgroundPosition: "0 0, 27px 27px",
    };
  if (patternId === "solar-orbit")
    return {
      backgroundImage: `radial-gradient(circle at 82% 20%, ${accent}45 0 2.5%, transparent 3%), radial-gradient(circle at 82% 20%, transparent 0 9%, ${accent}26 9.3% 9.8%, transparent 10.1% 17%, ${accent}16 17.3% 17.8%, transparent 18.1%)`,
    };
  if (patternId === "pixel-grid")
    return {
      backgroundImage: `linear-gradient(${accent}2A 0 0), linear-gradient(${accent}13 0 0), linear-gradient(${accent}1B 0 0)`,
      backgroundSize: "6px 6px, 10px 10px, 4px 4px",
      backgroundPosition: "8px 8px, 34px 20px, 58px 46px",
      backgroundRepeat: "repeat",
    };
  if (patternId === "prism-facets")
    return {
      backgroundImage: `linear-gradient(125deg, transparent 0 58%, ${accent}12 58% 70%, transparent 70%), linear-gradient(35deg, transparent 0 66%, ${accent}20 66% 78%, transparent 78%), linear-gradient(155deg, transparent 0 74%, ${accent}2A 74% 86%, transparent 86%)`,
    };
  if (patternId === "ink-blobs")
    return {
      backgroundImage: `radial-gradient(ellipse at 92% 12%, ${accent}2D 0 12%, transparent 12.7%), radial-gradient(ellipse at 8% 88%, ${accent}1B 0 14%, transparent 14.7%), radial-gradient(ellipse at 76% 92%, ${accent}10 0 9%, transparent 9.7%)`,
    };
  if (patternId === "rope-knot")
    return {
      backgroundImage: `radial-gradient(circle at 50% 50%, transparent 0 12px, ${accent}24 12.5px 14px, transparent 14.5px), radial-gradient(circle at 0 0, transparent 0 9px, ${accent}16 9.5px 11px, transparent 11.5px)`,
      backgroundSize: "54px 54px",
    };
  if (patternId === "snowfall")
    return {
      backgroundImage: `radial-gradient(circle, ${accent}52 0 1.4px, transparent 1.8px), radial-gradient(circle, ${accent}28 0 2.2px, transparent 2.6px), radial-gradient(circle, ${accent}1A 0 1px, transparent 1.4px)`,
      backgroundSize: "48px 48px, 88px 88px, 31px 31px",
      backgroundPosition: "0 0, 17px 29px, 9px 13px",
    };
  if (patternId === "festival-flags")
    return {
      backgroundImage: `linear-gradient(35deg, transparent 44%, ${accent}2C 45% 66%, transparent 67%), linear-gradient(145deg, transparent 44%, ${accent}18 45% 66%, transparent 67%)`,
      backgroundSize: "72px 38px",
      backgroundPosition: "0 0, 36px 0",
    };
  if (patternId === "stacked-arches")
    return {
      backgroundImage: `repeating-radial-gradient(ellipse at 50% 100%, transparent 0 18px, ${accent}1E 19px 21px, transparent 22px 37px)`,
      backgroundSize: "84px 66px",
      backgroundPosition: "right bottom",
    };
  if (patternId === "network-nodes")
    return {
      backgroundImage: `radial-gradient(circle, ${accent}56 0 2px, transparent 2.5px), linear-gradient(28deg, transparent 49%, ${accent}18 49.5% 50.5%, transparent 51%), linear-gradient(152deg, transparent 49%, ${accent}12 49.5% 50.5%, transparent 51%)`,
      backgroundSize: "82px 64px, 164px 128px, 164px 128px",
      backgroundPosition: "11px 8px, 0 0, 41px 32px",
    };
  const variant =
    [...seed].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 4;
  if (seed && variant === 1) {
    return {
      backgroundImage: `linear-gradient(115deg, transparent 0 67%, ${accent}16 67% 68%, transparent 68%), radial-gradient(circle at 83% 23%, transparent 0 8%, ${accent}26 8.4% 8.8%, transparent 9.2% 14%, ${accent}18 14.4% 14.8%, transparent 15.2%)`,
      backgroundSize: "100% 100%",
    };
  }
  if (seed && variant === 2) {
    return {
      backgroundImage: `linear-gradient(${accent}16 1px, transparent 1px), linear-gradient(90deg, ${accent}16 1px, transparent 1px), linear-gradient(145deg, transparent 0 82%, ${accent}20 82% 83%, transparent 83%)`,
      backgroundSize: "42px 42px, 42px 42px, 100% 100%",
    };
  }
  if (seed && variant === 3) {
    return {
      backgroundImage: `repeating-linear-gradient(135deg, transparent 0 52px, ${accent}12 53px 55px, transparent 56px 78px), radial-gradient(circle at 88% 78%, ${accent}22 0 7%, transparent 7.5%)`,
      backgroundSize: "100% 100%",
    };
  }
  switch (themeId) {
    case "neon":
    case "cinematic":
      return {
        backgroundImage: `linear-gradient(90deg, ${accent}1F 1px, transparent 1px), linear-gradient(${accent}17 1px, transparent 1px), linear-gradient(135deg, transparent 0 74%, ${accent}2A 74% 75%, transparent 75%)`,
        backgroundSize: "44px 44px, 44px 44px, 100% 100%",
      };
    case "editorial":
    case "mono":
      return {
        backgroundImage: `linear-gradient(90deg, ${accent}28 1px, transparent 1px), linear-gradient(${accent}18 1px, transparent 1px), linear-gradient(90deg, transparent 0 91%, ${accent}14 91%)`,
        backgroundSize: "25% 100%, 100% 25%, 100% 100%",
      };
    case "botanical":
    case "sage":
      return {
        backgroundImage: `radial-gradient(ellipse at 92% 18%, ${accent}22 0 10%, transparent 10.5%), radial-gradient(ellipse at 84% 31%, ${accent}18 0 8%, transparent 8.5%), radial-gradient(circle at 7% 90%, transparent 0 13%, ${accent}1F 13.3% 13.8%, transparent 14.1%)`,
        backgroundSize: "100% 100%",
      };
    case "glass":
    case "sky":
      return {
        backgroundImage: `radial-gradient(circle at 88% 16%, ${accent}2B 0 13%, transparent 13.5%), radial-gradient(circle at 75% 92%, ${accent}18 0 18%, transparent 18.5%), linear-gradient(125deg, transparent 0 63%, ${accent}10 63% 80%, transparent 80%)`,
        backgroundSize: "100% 100%",
      };
    case "clay":
    case "berry":
    case "playful":
      return {
        backgroundImage: `radial-gradient(circle at 90% 18%, ${accent}2C 0 9%, transparent 9.5%), radial-gradient(circle at 82% 25%, transparent 0 13%, ${accent}20 13.4% 14%, transparent 14.4%), linear-gradient(145deg, transparent 0 78%, ${accent}18 78% 86%, transparent 86%)`,
        backgroundSize: "100% 100%",
      };
    case "cobalt":
      return {
        backgroundImage: `linear-gradient(150deg, transparent 0 70%, ${accent}22 70% 78%, transparent 78%), linear-gradient(90deg, ${accent}18 1px, transparent 1px), radial-gradient(circle at 91% 17%, ${accent}2D 0 7%, transparent 7.5%)`,
        backgroundSize: "100% 100%, 84px 100%, 100% 100%",
      };
    case "modern":
      return {
        backgroundImage: `linear-gradient(90deg, ${accent}14 1px, transparent 1px), linear-gradient(${accent}10 1px, transparent 1px), radial-gradient(circle at 91% 14%, ${accent}20 0 7%, transparent 7.4%)`,
        backgroundSize: "64px 64px, 64px 64px, 100% 100%",
      };
    case "premium":
      return {
        backgroundImage: `linear-gradient(90deg, ${accent}24 1px, transparent 1px), linear-gradient(${accent}18 1px, transparent 1px), radial-gradient(circle at 86% 20%, transparent 0 10%, ${accent}32 10.3% 10.8%, transparent 11.1%)`,
        backgroundSize: "72px 72px, 72px 72px, 100% 100%",
      };
    case "atelier":
      return {
        backgroundImage: `radial-gradient(circle at 88% 18%, ${accent}32 0 2px, transparent 2.5px), linear-gradient(135deg, transparent 0 78%, ${accent}18 78% 79%, transparent 79%), linear-gradient(90deg, transparent 0 94%, ${accent}12 94%)`,
        backgroundSize: "18px 18px, 100% 100%, 100% 100%",
      };
    case "noir":
      return {
        backgroundImage: `linear-gradient(${accent}22 1px, transparent 1px), linear-gradient(90deg, ${accent}22 1px, transparent 1px), radial-gradient(circle at 88% 18%, ${accent}34 0 8%, transparent 8.5%)`,
        backgroundSize: "32px 32px, 32px 32px, 100% 100%",
      };
    case "ocean":
      return {
        backgroundImage: `radial-gradient(circle at 100% 100%, transparent 0 18%, ${accent}24 18.5% 19%, transparent 19.5% 27%, ${accent}18 27.5% 28%, transparent 28.5%), linear-gradient(120deg, transparent 0 68%, ${accent}12 68% 82%, transparent 82%)`,
        backgroundSize: "100% 100%",
      };
    case "sunrise":
      return {
        backgroundImage: `radial-gradient(circle at 86% 18%, ${accent}2E 0 10%, transparent 10.5%), repeating-linear-gradient(145deg, transparent 0 34px, ${accent}12 35px 37px, transparent 38px 56px)`,
        backgroundSize: "100% 100%",
      };
    default:
      return {
        backgroundImage: `radial-gradient(circle at 86% 18%, ${accent}30 0 9%, transparent 9.5%), radial-gradient(circle at 76% 88%, ${accent}18 0 15%, transparent 15.5%), repeating-linear-gradient(135deg, transparent 0 42px, ${accent}12 43px 45px, transparent 46px 66px)`,
        backgroundSize: "100% 100%",
      };
  }
}

function SlidePreview({
  project: baseProject,
  slide,
  compact = false,
  editable = false,
  onChange,
  onPickImage,
  onOpenQuickEdit,
}: {
  project: Pick<
    PresentationProjectRecord,
    "themeId" | "accentColor" | "backgroundColor" | "textColor"
  >;
  slide: PresentationSlide;
  compact?: boolean;
  editable?: boolean;
  onChange?: (patch: Partial<PresentationSlide>) => void;
  onPickImage?: () => void;
  onOpenQuickEdit?: () => void;
}) {
  const slideTheme = slide.themeId
    ? presentationTheme(slide.themeId)
    : undefined;
  const project = {
    ...baseProject,
    themeId: slide.themeId ?? baseProject.themeId,
    accentColor:
      slide.accentColor ?? slideTheme?.accentColor ?? baseProject.accentColor,
    backgroundColor:
      slide.backgroundColor ??
      slideTheme?.backgroundColor ??
      baseProject.backgroundColor,
    textColor:
      slide.textColor ?? slideTheme?.textColor ?? baseProject.textColor,
  };
  const colors = presentationReadableColors(project.backgroundColor, project.textColor, project.accentColor);
  const inverse = colors.text;
  const metrics = slide.bullets.slice(0, 3).map((item) => {
    const [value, label] = item.split("|").map((part) => part.trim());
    return { value: value || "—", label: label || "показатель" };
  });
  const titleClass = "text-[5.2cqw] leading-[1.02]";
  const bodyClass = "text-[1.8cqw] leading-[1.45]";
  const image = slide.imageUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={slide.imageUrl}
      alt=""
      className="h-full min-h-0 w-full rounded-[inherit] object-cover"
    />
  ) : null;
  const editableTitle = (className: string) =>
    editable ? (
      <textarea
        aria-label="Заголовок слайда"
        style={{ fontFamily: presentationFontFamily(project.themeId) }}
        value={slide.title}
        onChange={(event) => onChange?.({ title: event.target.value })}
        className={cn(
          "m-0 w-full resize-none overflow-hidden border-0 bg-transparent p-0 font-semibold tracking-[-0.025em] text-inherit outline-none ring-0 focus:ring-2 focus:ring-primary/30",
          className,
        )}
        rows={Math.max(1, estimatedTextLines(slide.title, image || ["split", "gallery", "table", "agenda"].includes(slide.layout) ? 500 : 900, slide.layout === "title" ? 52 : 38))}
      />
    ) : (
      <h2 style={{ fontFamily: presentationFontFamily(project.themeId) }} className={cn("m-0 font-semibold tracking-[-0.025em]", className)}>
        {slide.title}
      </h2>
    );
  const editableBody = (className: string) =>
    editable ? (
      <textarea
        aria-label="Текст слайда"
        value={slide.body}
        onChange={(event) => onChange?.({ body: event.target.value })}
        className={cn(
          "m-0 w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-inherit outline-none ring-0 focus:ring-2 focus:ring-primary/30",
          className,
        )}
        rows={Math.max(1, estimatedTextLines(slide.body, image || ["split", "gallery", "table", "agenda"].includes(slide.layout) ? 500 : 900, 18))}
        placeholder="Добавьте пояснение"
      />
    ) : slide.body ? (
      <p className={cn("mb-0", className)}>{slide.body}</p>
    ) : null;
  const imageArea =
    image && editable ? (
      <button
        type="button"
        onClick={onPickImage}
        className="h-full w-full overflow-hidden rounded-[inherit] text-left"
        aria-label="Заменить изображение"
      >
        {image}
      </button>
    ) : image ? (
      <div className="h-full w-full overflow-hidden rounded-[inherit]">
        {image}
      </div>
    ) : editable ? (
      <button
        type="button"
        onClick={onPickImage}
        className="grid h-full w-full place-items-center rounded-[inherit] border border-dashed border-current/25 bg-black/5 text-[1.2cqw] font-semibold opacity-65 hover:opacity-100"
      >
        + Добавить фотографию
      </button>
    ) : null;

  return (
    <div
      className="relative aspect-video w-full overflow-hidden rounded-[inherit]"
      onDoubleClick={(event) => {
        if (!editable || !onOpenQuickEdit) return;
        const target = event.target as HTMLElement;
        if (target.closest("textarea,input,button,a,select")) return;
        event.preventDefault();
        onOpenQuickEdit();
      }}
      style={{
        containerType: "inline-size",
        fontFamily: "Arial, sans-serif",
        backgroundColor: project.backgroundColor,
        color: inverse,
        ...presentationPatternStyle(
          project.themeId,
          project.accentColor,
          slide.id,
          slide.patternId ?? "auto",
        ),
      }}
    >
      {slide.fullBleedImage && image ? (
        editable ? (
          <button
            type="button"
            onClick={onPickImage}
            className="absolute inset-0 z-20 h-full w-full overflow-hidden text-left"
            aria-label="Заменить изображение слайда"
          >
            {image}
          </button>
        ) : (
          <div className="absolute inset-0 z-20 h-full w-full overflow-hidden">
            {image}
          </div>
        )
      ) : null}
      <div
        className={cn(
          "absolute rounded-full",
          compact
            ? "left-[6%] top-[7%] h-[2px] w-[8%]"
            : "left-[6.2%] top-[7.5%] h-1.5 w-[7%]",
        )}
        style={{ backgroundColor: project.accentColor }}
      />
      {slide.layout === "closing" ? (
        <div
          className="absolute inset-[5%] grid place-items-center px-[9%] text-center"
          style={{ backgroundColor: project.accentColor, color: colors.inverse }}
        >
          <div>
            {slide.eyebrow ? (
              <p
                className={cn(
                  "m-0 font-bold uppercase tracking-[0.16em]",
                  "text-[1.0cqw]",
                )}
              >
                {slide.eyebrow}
              </p>
            ) : null}
            <h2
              className={cn(
                "m-0 mt-[4%] font-semibold tracking-[-0.025em]",
                titleClass,
              )}
            >
              {slide.title}
            </h2>
            {slide.body ? (
              <p className={cn("mx-auto mb-0 mt-[5%] max-w-[80%]", bodyClass)}>
                {slide.body}
              </p>
            ) : null}
          </div>
        </div>
      ) : slide.layout === "title" ? (
        <div className="absolute inset-x-[6.2%] inset-y-[13%] flex items-center gap-[5%]">
          <div className={cn("min-w-0", image ? "w-[56%]" : "w-full")}>
            {slide.eyebrow ? (
              <p
                className={cn(
                  "m-0 font-bold uppercase tracking-[0.15em]",
                  "text-[1.0cqw]",
                )}
                style={{ color: colors.accent }}
              >
                {slide.eyebrow}
              </p>
            ) : null}
            {editableTitle(
              cn("mt-[6%] max-w-[95%] tracking-[-0.05em]", titleClass),
            )}
            {editableBody(cn("mt-[7%] max-w-[86%] opacity-70", bodyClass))}
          </div>
          {imageArea || editable ? (
            <div className="h-[80%] w-[39%] overflow-hidden rounded-[9%]">
              {imageArea}
            </div>
          ) : null}
        </div>
      ) : slide.layout === "statement" ? (
        <div className="absolute inset-x-[6.2%] inset-y-[13%] flex gap-[5%]">
          <div
            className={cn(
              "flex min-w-0 flex-col justify-center",
              image ? "w-[57%]" : "w-full",
            )}
          >
            {slide.eyebrow ? (
              <p
                className={cn(
                  "m-0 font-bold uppercase tracking-[0.15em]",
                  "text-[1.0cqw]",
                )}
                style={{ color: colors.accent }}
              >
                {slide.eyebrow}
              </p>
            ) : null}
            {editableTitle(
              cn(
                "mt-[4%] max-w-[96%]",
                "text-[4.6cqw] leading-[1.08]",
              ),
            )}
            {editableBody(cn("mt-[7%] max-w-[88%] opacity-70", bodyClass))}
          </div>
          {imageArea || editable ? (
            <div className="h-full w-[38%] overflow-hidden rounded-[8%]">
              {imageArea}
            </div>
          ) : null}
        </div>
      ) : slide.layout === "split" ? (
        <div className="absolute inset-x-[6.2%] inset-y-[14%] grid grid-cols-2 gap-[6%]">
          <div className="flex min-w-0 flex-col justify-center">
            {slide.eyebrow ? (
              <p
                className={cn(
                  "m-0 font-bold uppercase tracking-[0.15em]",
                  "text-[1.0cqw]",
                )}
                style={{ color: colors.accent }}
              >
                {slide.eyebrow}
              </p>
            ) : null}
            {editableTitle(
              cn(
                "mt-[5%]",
                "text-[3.6cqw] leading-[1.08]",
              ),
            )}
            {editableBody(cn("mt-[7%] opacity-70", bodyClass))}
          </div>
          <div
            className="min-h-0 overflow-hidden border-l border-current/15 p-[6%]"
            style={{ backgroundColor: `${project.accentColor}18` }}
          >
            {imageArea ?? (
              <ul className={cn("m-0 grid list-none gap-[8%] p-0", bodyClass)}>
                {(slide.bullets.length
                  ? slide.bullets
                  : ["Первый аргумент", "Второй аргумент", "Вывод"]
                )
                  .slice(0, 5)
                  .map((item, index) => (
                    <li key={`${item}-${index}`} className="flex gap-[5%]">
                      <span
                        className="font-bold"
                        style={{ color: colors.accent }}
                      >
                        0{index + 1}
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        </div>
      ) : slide.layout === "timeline" || slide.layout === "process" ? (
        <div className="absolute inset-x-[6.2%] inset-y-[12%]">
          {slide.eyebrow ? (
            <p
              className={cn(
                "m-0 font-bold uppercase tracking-[0.15em]",
                "text-[1.0cqw]",
              )}
              style={{ color: colors.accent }}
            >
              {slide.eyebrow}
            </p>
          ) : null}
          {editableTitle(
            cn(
              "mt-[3%] max-w-[82%]",
              "text-[3.6cqw] leading-[1.08]",
            ),
          )}
          <div className="relative mt-[8%] grid grid-cols-3 gap-[3%]">
            <span
              className="absolute left-[8%] right-[8%] top-[16%] h-px"
              style={{ backgroundColor: `${project.accentColor}55` }}
            />
            {(slide.bullets.length
              ? slide.bullets
              : ["Первый этап", "Второй этап", "Третий этап"]
            )
              .slice(0, 3)
              .map((item, index) => (
                <div
                  key={`${item}-${index}`}
                  className="relative border-t border-current/20 px-[3%] py-[6%]"
                >
                  <span
                    className={cn(
                      "relative z-10 grid rounded-full font-bold text-white",
                      "size-[3.2cqw] place-items-center text-[1.1cqw]",
                    )}
                    style={{ backgroundColor: project.accentColor }}
                  >
                    {index + 1}
                  </span>
                  <p className={cn("mb-0 mt-[9%] font-semibold", bodyClass)}>
                    {presentationStepText(item, index)}
                  </p>
                </div>
              ))}
          </div>
        </div>
      ) : slide.layout === "comparison" ? (
        <div className="absolute inset-x-[6.2%] inset-y-[12%]">
          {editableTitle(
            cn(
              "max-w-[80%]",
              "text-[3.6cqw] leading-[1.08]",
            ),
          )}
          <div className="mt-[7%] grid grid-cols-2 gap-[4%]">
            {[0, 1].map((column) => (
              <div
                key={column}
                className="border-t-2 border-current/20 px-[3%] py-[5%]"
                style={{
                  backgroundColor: column
                    ? `${project.accentColor}20`
                    : "transparent",
                }}
              >
                <strong
                  className={cn(
                    "block",
                    "text-[1.6cqw]",
                  )}
                >
                  {column ? "Целевое состояние" : "Сейчас"}
                </strong>
                <ul
                  className={cn(
                    "mb-0 mt-[7%] grid gap-[5%] pl-[8%]",
                    bodyClass,
                  )}
                >
                  {(slide.bullets.length
                    ? slide.bullets
                    : ["Первый критерий", "Второй критерий", "Третий критерий"]
                  )
                    .filter((_, index) => index % 2 === column)
                    .slice(0, 3)
                    .map((item, index) => (
                      <li key={`${item}-${index}`}>{item}</li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ) : slide.layout === "agenda" || slide.layout === "table" ? (
        <div className="absolute inset-x-[6.2%] inset-y-[12%] grid grid-cols-[38%_1fr] gap-[7%]">
          <div>
            {slide.eyebrow ? (
              <p
                className={cn(
                  "m-0 font-bold uppercase tracking-[0.15em]",
                  "text-[1.0cqw]",
                )}
                style={{ color: colors.accent }}
              >
                {slide.eyebrow}
              </p>
            ) : null}
            {editableTitle(
              cn(
                "mt-[5%]",
                "text-[3.6cqw] leading-[1.08]",
              ),
            )}
            {editableBody(cn("mt-[7%] opacity-65", bodyClass))}
          </div>
          <div className="grid content-center gap-[3%]">
            {(slide.bullets.length
              ? slide.bullets
              : [
                  "Первый раздел",
                  "Второй раздел",
                  "Третий раздел",
                  "Четвёртый раздел",
                ]
            )
              .slice(0, 6)
              .map((item, index) => (
                <div
                  key={`${item}-${index}`}
                  className="grid grid-cols-[12%_1fr] items-center border-b border-current/15 py-[3%]"
                >
                  <strong
                    className={cn("text-[1.3cqw]")}
                    style={{ color: colors.accent }}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </strong>
                  <span className={bodyClass}>{item}</span>
                </div>
              ))}
          </div>
        </div>
      ) : slide.layout === "gallery" ? (
        <div className="absolute inset-x-[6.2%] inset-y-[11%] grid grid-cols-[38%_1fr] gap-[5%]">
          <div className="flex min-w-0 flex-col justify-end pb-[4%]">
            {editableTitle(
              cn(
                "text-[3.8cqw] leading-[1.06]",
              ),
            )}
            {editableBody(cn("mt-[7%] opacity-65", bodyClass))}
          </div>
          <div className="overflow-hidden rounded-[6%] bg-black/5">
            {imageArea}
          </div>
        </div>
      ) : slide.layout === "chart" ? (
        <div className="absolute inset-x-[6.2%] inset-y-[12%]">
          {editableTitle(
            cn(
              "max-w-[80%]",
              "text-[3.6cqw] leading-[1.08]",
            ),
          )}
          {editableBody(cn("mt-[2%]", bodyClass))}
          <div className="mt-[5%] grid h-[42%] items-end gap-[4%] border-b border-current/20" style={{ gridTemplateColumns: `repeat(${Math.max(1, Math.min(4, slide.bullets.length))}, minmax(0, 1fr))` }}>
            {presentationChartData(slide.bullets).map((item, index) => {
                const { raw: rawValue, label, fraction } = item;
                return (
                  <div
                    key={`${item}-${index}`}
                    className="flex h-full flex-col justify-end text-center"
                  >
                    <strong
                      className={cn(
                        "mb-[4%]",
                        "text-[1.2cqw]",
                      )}
                    >
                      {rawValue}
                    </strong>
                    <span
                      className="mx-auto block w-[64%] rounded-t-md"
                      style={{
                        height: `${fraction * 100}%`,
                        backgroundColor: project.accentColor,
                      }}
                    />
                    <span
                      className={cn(
                        "mt-[5%] opacity-65",
                        "text-[1.0cqw]",
                      )}
                    >
                      {label}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      ) : slide.layout === "callout" ? (
        <div className="absolute inset-[8%] grid place-items-center rounded-[5%] border border-current/10 px-[10%] text-center">
          <div>
            {slide.eyebrow ? (
              <p
                className={cn(
                  "m-0 font-bold uppercase tracking-[0.16em]",
                  "text-[1.0cqw]",
                )}
                style={{ color: colors.accent }}
              >
                {slide.eyebrow}
              </p>
            ) : null}
            {editableTitle(
              cn(
                "mt-[5%]",
                "text-[4.8cqw] leading-[1.08]",
              ),
            )}
            {editableBody(
              cn("mx-auto mt-[6%] max-w-[78%] opacity-70", bodyClass),
            )}
          </div>
        </div>
      ) : slide.layout === "quote" ? (
        <div className="absolute inset-x-[8%] inset-y-[14%] flex items-center">
          <div>
            <span
              className={cn(
                "font-serif leading-none",
                "text-[7.2cqw]",
              )}
              style={{ color: colors.accent }}
            >
              “
            </span>
            {editableTitle(
              cn(
                "-mt-[4%] font-serif",
                "text-[4.3cqw] leading-[1.14]",
              ),
            )}
            {editableBody(cn("mt-[6%] opacity-65", bodyClass))}
          </div>
        </div>
      ) : slide.layout === "stats" ? (
        <div className="absolute inset-x-[6.2%] inset-y-[13%]">
          {editableTitle(
            cn(
              "max-w-[75%]",
              "text-[3.6cqw] leading-[1.08]",
            ),
          )}
          <div className="mt-[8%] grid grid-cols-3 gap-[3%]">
            {(metrics.length
              ? metrics
              : [
                  { value: "—", label: "показатель" },
                  { value: "—", label: "показатель" },
                  { value: "—", label: "показатель" },
                ]
            ).map((metric, index) => (
              <div
                key={`${metric.value}-${index}`}
                className="rounded-[10%] p-[9%]"
                style={{ backgroundColor: `${project.accentColor}18` }}
              >
                <strong
                  className={cn(
                    "block tracking-[-0.05em]",
                    "text-[4.2cqw]",
                  )}
                  style={{ color: colors.accent }}
                >
                  {metric.value}
                </strong>
                <span className={cn("mt-[5%] block opacity-70", bodyClass)}>
                  {metric.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="absolute inset-x-[6.2%] inset-y-[13%] flex gap-[5%]">
          <div className={cn("min-w-0", image ? "w-[58%]" : "w-full")}>
            {slide.eyebrow ? (
              <p
                className={cn(
                  "m-0 font-bold uppercase tracking-[0.15em]",
                  "text-[1.0cqw]",
                )}
                style={{ color: colors.accent }}
              >
                {slide.eyebrow}
              </p>
            ) : null}
            {editableTitle(
              cn(
                "mt-[4%]",
                "text-[3.6cqw] leading-[1.08]",
              ),
            )}
            {editableBody(cn("mt-[5%] opacity-70", bodyClass))}
            <ul
              className={cn(
                "m-0 mt-[6%] grid gap-[3%] p-0",
                "text-[1.8cqw]",
              )}
            >
              {(slide.bullets.length
                ? slide.bullets
                : [
                    "Добавьте аргумент",
                    "Добавьте доказательство",
                    "Сформулируйте вывод",
                  ]
              )
                .slice(0, 6)
                .map((item, index) => (
                  <li
                    key={`${item}-${index}`}
                    className="ml-[4%] pl-[2%] marker:text-[color:var(--primary)]"
                  >
                    {item}
                  </li>
                ))}
            </ul>
          </div>
          {imageArea || editable ? (
            <div className="h-full w-[37%] overflow-hidden rounded-[8%]">
              {imageArea}
            </div>
          ) : null}
        </div>
      )}
      {!compact && (slide.ctaUrl || slide.socialLinks?.length) ? (
        <div className="absolute inset-x-[6.2%] bottom-[4.5%] z-10 flex items-center justify-between gap-3">
          {slide.ctaUrl ? (
            <a
              href={slide.ctaUrl}
              target="_blank"
              rel="noreferrer"
              onClick={(event) => event.stopPropagation()}
              className="inline-flex rounded-lg px-4 py-2 text-[1.1cqw] font-semibold text-white no-underline shadow-sm"
              style={{
                backgroundColor:
                  slide.layout === "closing" ? "#FFFFFF" : project.accentColor,
                color:
                  slide.layout === "closing" ? project.accentColor : "#FFFFFF",
              }}
            >
              {slide.ctaLabel || "Узнать подробнее"}
            </a>
          ) : (
            <span />
          )}
          {slide.socialLinks?.length ? (
            <div className="flex flex-wrap justify-end gap-2">
              {slide.socialLinks.map((link) => (
                <a
                  key={`${link.label}-${link.url}`}
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(event) => event.stopPropagation()}
                  className="text-[1.0cqw] font-semibold underline underline-offset-2"
                  style={{
                    color:
                      slide.layout === "closing"
                        ? "#FFFFFF"
                        : project.accentColor,
                  }}
                >
                  {link.label}
                </a>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ThemeStrip({
  value,
  onChange,
}: {
  value: PresentationThemeId;
  onChange: (theme: PresentationThemeId) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {presentationThemes.map((theme) => (
        <button
          key={theme.id}
          type="button"
          onClick={() => onChange(theme.id)}
          aria-label={`Тема ${theme.name}`}
          aria-pressed={value === theme.id}
          className="group rounded-lg border border-border bg-surface p-1.5 text-left transition hover:border-primary/40 aria-pressed:border-primary aria-pressed:ring-2 aria-pressed:ring-primary/15"
        >
          <span
            className="block aspect-[4/3] rounded-md"
            style={{
              backgroundColor: theme.backgroundColor,
              ...presentationPatternStyle(theme.id, theme.accentColor),
            }}
          >
            <span
              className="ml-[12%] mt-[12%] block h-1 w-[35%] rounded-full"
              style={{ backgroundColor: theme.accentColor }}
            />
          </span>
          <span className="mt-1 block truncate text-[9px] font-medium text-text-muted group-aria-pressed:text-primary">
            {theme.name}
          </span>
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
  const quickCreateKey =
    searchParams.get("new") === "1" ? `new:${requestedAssetId ?? ""}` : "";
  const requestedView = searchParams.get("view");
  const [presentations, setPresentations] = useState<
    PresentationProjectRecord[]
  >([]);
  const [project, setProject] = useState<PresentationProjectRecord | null>(
    null,
  );
  const [selectedSlideId, setSelectedSlideId] = useState<string | null>(null);
  const [favoriteProjectIds, setFavoriteProjectIds] = useState<string[]>([]);
  const [favoriteTemplateIds, setFavoriteTemplateIds] = useState<string[]>([]);
  const [libraryView, setLibraryView] = useState<
    "presentations" | "templates" | "favorites"
  >(
    requestedView === "templates" || requestedView === "favorites"
      ? requestedView
      : "presentations",
  );
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
  const [quickSlideOpen, setQuickSlideOpen] = useState(false);
  const [slidesPanelOpen, setSlidesPanelOpen] = useState(true);
  const [aiGoal, setAiGoal] = useState("");
  const [aiCreativeSource, setAiCreativeSource] =
    useState<AiCreationSource>("original");
  const [aiTemplateId, setAiTemplateId] = useState(
    presentationTemplates[0]?.id ?? "",
  );
  const [aiAudience, setAiAudience] = useState("");
  const [aiSlideCount, setAiSlideCount] = useState(7);
  const [aiTheme, setAiTheme] = useState<PresentationThemeId>("atelier");
  const [aiStatus, setAiStatus] = useState<PresentationAiResponse | null>(null);
  const [aiError, setAiError] = useState("");
  const [aiContext, setAiContext] = useState("");
  const [aiAction, setAiAction] = useState("");
  const [aiTone, setAiTone] = useState<
    "executive" | "persuasive" | "educational" | "visual"
  >("executive");
  const [aiCtaLabel, setAiCtaLabel] = useState("Узнать подробнее");
  const [aiCtaUrl, setAiCtaUrl] = useState("");
  const [aiDesignBrief, setAiDesignBrief] = useState("");
  const [aiSocialLinks, setAiSocialLinks] = useState<
    Record<"telegram" | "vk" | "website", string>
  >({ telegram: "", vk: "", website: "" });
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplateRecord[]>(
    [],
  );
  const [emailQuery, setEmailQuery] = useState("");
  const [selectedEmailId, setSelectedEmailId] = useState("");
  const editRevisionRef = useRef(0);
  const quickCreateStartedRef = useRef("");
  const aiIdempotencyKeyRef = useRef("");

  useEffect(() => {
    if (projectId || searchParams.get("create") !== "ai") return;
    const frame = window.requestAnimationFrame(() => setAiOpen(true));
    return () => window.cancelAnimationFrame(frame);
  }, [projectId, searchParams]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        projectId
          ? `/api/presentations?id=${encodeURIComponent(projectId)}`
          : "/api/presentations",
        { cache: "no-store" },
      );
      const body = (await response.json()) as
        PresentationMutationResponse | PresentationsListResponse | ApiError;
      if (!response.ok)
        throw new Error(apiError(body, "Презентации не загружены."));
      if ("presentation" in body) {
        setProject(body.presentation);
        setSelectedSlideId(body.presentation.slides[0]?.id ?? null);
        try {
          const generationNotice = window.sessionStorage.getItem(
            `potok:presentation-notice:${body.presentation.id}`,
          );
          if (generationNotice) {
            setNotice(generationNotice);
            window.sessionStorage.removeItem(
              `potok:presentation-notice:${body.presentation.id}`,
            );
          } else {
            setNotice("");
          }
        } catch {
          setNotice("");
        }
        setDirty(false);
        editRevisionRef.current = 0;
      } else if ("presentations" in body) {
        setPresentations(body.presentations);
        setFavoriteProjectIds(body.favoriteProjectIds);
        setFavoriteTemplateIds(body.favoriteTemplateIds);
        setProject(null);
      }
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Презентации не загружены.",
      );
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
    void fetch("/api/ai/presentations", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = await jsonBody<PresentationAiResponse>(response);
        if (!response.ok || !("configured" in body))
          throw new Error(apiError(body, "Статус ИИ не загружен."));
        setAiStatus(body);
      })
      .catch((caught) => {
        if (caught instanceof Error && caught.name === "AbortError") return;
        setAiStatus({ configured: false });
      });
    return () => controller.abort();
  }, []);


  useEditorDraft({
    storageKey: project && !loading ? `potok:presentation-draft:${project.id}` : null,
    value: project, dirty, revision: project?.updatedAt ?? null,
    onRestore: (draft, stale) => {
      if (!draft || !Array.isArray(draft.slides)) return;
      setProject(draft); setSelectedSlideId(draft.slides[0]?.id ?? null); setDirty(true);
      setNotice(stale ? "Черновик восстановлен. На сервере есть более новая версия; сохранение защищено от перезаписи чужих правок." : "Черновик восстановлен в этой вкладке. Сохраните изменения, чтобы записать их на сервер.");
    },
    onError: setError,
  });

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
            body: JSON.stringify({
              name: "Новая презентация",
              sourceType: "blank",
              slides: slidesWithAsset(requestedAssetId),
            }),
          });
          const body = await jsonBody<PresentationMutationResponse>(response);
          if (!response.ok || !("presentation" in body))
            throw new Error(apiError(body, "Презентация не создана."));
          router.replace(
            `/presentations?id=${encodeURIComponent(body.presentation.id)}`,
          );
        } catch (caught) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Презентация не создана.",
          );
          router.replace("/presentations");
        } finally {
          setBusy("");
        }
      })();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [projectId, quickCreateKey, requestedAssetId, router]);

  const navigateTo = (id?: string) => {
    router.push(
      id ? `/presentations?id=${encodeURIComponent(id)}` : "/presentations",
    );
  };

  const createProject = async (
    payload: Record<string, unknown>,
    action: string,
  ) => {
    setBusy(action);
    setError("");
    try {
      const response = await fetch("/api/presentations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await jsonBody<PresentationMutationResponse>(response);
      if (!response.ok || !("presentation" in body))
        throw new Error(apiError(body, "Презентация не создана."));
      navigateTo(body.presentation.id);
      return body.presentation;
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Презентация не создана.",
      );
      return null;
    } finally {
      setBusy("");
    }
  };

  const createBlank = () =>
    void createProject(
      {
        name: "Новая презентация",
        sourceType: "blank",
        slides: cloneSlides(defaultPresentationSlides),
      },
      "blank",
    );

  const createFromScenario = (
    template: (typeof presentationTemplates)[number],
  ) =>
    void createProject(
      {
        name: template.name,
        description: template.description,
        themeId: template.themeId,
        accentColor: template.accentColor,
        backgroundColor: template.backgroundColor,
        textColor: template.textColor,
        slides: cloneSlides(template.slides),
        sourceType: "template",
      },
      template.id,
    );

  const generateWithAi = async () => {
    if (aiGoal.trim().length < 12) {
      setAiError("Опишите задачу презентации хотя бы одним предложением.");
      return;
    }
    if (!aiStatus?.configured) {
      setAiError(
        "ИИ-провайдер не подключён. Откройте настройки подключения или создайте презентацию из шаблона.",
      );
      return;
    }
    if (!aiIdempotencyKeyRef.current)
      aiIdempotencyKeyRef.current = crypto.randomUUID();
    setBusy("ai");
    setError("");
    setAiError("");
    try {
      const response = await fetch("/api/ai/presentations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": aiIdempotencyKeyRef.current,
        },
        body: JSON.stringify({
          goal: aiGoal,
          creativeSource: aiCreativeSource,
          templateId:
            aiCreativeSource === "library" ? aiTemplateId : undefined,
          audience: aiAudience,
          context: aiContext,
          desiredAction: aiAction,
          tone: aiTone,
          slideCount: aiSlideCount,
          themeId: aiTheme,
          ctaLabel: aiCtaLabel,
          ctaUrl: aiCtaUrl,
          designBrief: aiDesignBrief,
          socialLinks: [
            ["Telegram", aiSocialLinks.telegram],
            ["ВКонтакте", aiSocialLinks.vk],
            ["Сайт", aiSocialLinks.website],
          ].flatMap(([label, url]) =>
            url.trim() ? [{ label, url: url.trim() }] : [],
          ),
        }),
      });
      const body = await jsonBody<PresentationAiResponse>(response);
      if (!response.ok || !("outline" in body) || !body.outline)
        throw new Error(apiError(body, "ИИ не подготовил презентацию."));
      const created = await createProject(
        { ...body.outline, sourceType: "ai" },
        "ai-save",
      );
      if (created) {
        if (body.generationNotice) {
          window.sessionStorage.setItem(
            `potok:presentation-notice:${created.id}`,
            body.generationNotice,
          );
        }
        aiIdempotencyKeyRef.current = "";
        setAiOpen(false);
      }
    } catch (caught) {
      aiIdempotencyKeyRef.current = "";
      setAiError(
        caught instanceof Error
          ? caught.message
          : "ИИ не подготовил презентацию.",
      );
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
      if (!response.ok || !("templates" in body))
        throw new Error(apiError(body, "Шаблоны писем не загружены."));
      setEmailTemplates(body.templates);
      setSelectedEmailId(body.templates[0]?.id ?? "");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Шаблоны писем не загружены.",
      );
    } finally {
      setBusy("");
    }
  };

  const createFromEmail = async () => {
    const template = emailTemplates.find((item) => item.id === selectedEmailId);
    if (!template) {
      setError("Выберите письмо для преобразования.");
      return;
    }
    const created = await createProject(
      {
        name: `Презентация · ${template.name}`,
        sourceEmailTemplateId: template.id,
        sourceType: "email",
      },
      "email-create",
    );
    if (created) setEmailOpen(false);
  };

  const deleteProject = async (item: PresentationProjectRecord) => {
    if (!await confirmAction(`Удалить презентацию «${item.name}»?`)) return;
    setBusy(`delete-${item.id}`);
    try {
      const response = await fetch(
        `/api/presentations?id=${encodeURIComponent(item.id)}`,
        { method: "DELETE" },
      );
      const body = (await response.json()) as { deletedId?: string } | ApiError;
      if (!response.ok || !("deletedId" in body))
        throw new Error(apiError(body, "Презентация не удалена."));
      setPresentations((current) =>
        current.filter((presentation) => presentation.id !== item.id),
      );
      setFavoriteProjectIds((current) =>
        current.filter((id) => id !== item.id),
      );
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Презентация не удалена.",
      );
    } finally {
      setBusy("");
    }
  };

  const toggleFavorite = async (
    itemType: "project" | "template",
    itemId: string,
  ) => {
    const ids = itemType === "project" ? favoriteProjectIds : favoriteTemplateIds;
    const isFavorite = !ids.includes(itemId);
    setBusy(`favorite-${itemType}-${itemId}`);
    setError("");
    try {
      const response = await fetch("/api/presentations/favorites", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemType, itemId, isFavorite }),
      });
      const body = await jsonBody<{ isFavorite: boolean }>(response);
      if (!response.ok || !("isFavorite" in body))
        throw new Error(apiError(body, "Избранное не обновлено."));
      const update = (current: string[]) =>
        body.isFavorite
          ? Array.from(new Set([...current, itemId]))
          : current.filter((id) => id !== itemId);
      if (itemType === "project") setFavoriteProjectIds(update);
      else setFavoriteTemplateIds(update);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Избранное не обновлено.",
      );
    } finally {
      setBusy("");
    }
  };

  const updateProject = (patch: Partial<PresentationProjectRecord>) => {
    editRevisionRef.current += 1;
    setProject((current) => (current ? { ...current, ...patch } : current));
    setDirty(true);
    setNotice("");
  };

  const updateSlide = (patch: Partial<PresentationSlide>) => {
    if (!project || !selectedSlideId) return;
    updateProject({
      slides: project.slides.map((slide) =>
        slide.id === selectedSlideId ? { ...slide, ...patch } : slide,
      ),
    });
  };

  const selectedSlide =
    project?.slides.find((slide) => slide.id === selectedSlideId) ??
    project?.slides[0];
  const selectedSlideIndex =
    project && selectedSlide
      ? project.slides.findIndex((slide) => slide.id === selectedSlide.id)
      : 0;

  const saveProject = async () => {
    if (!project) return false;
    const savingRevision = editRevisionRef.current;
    setBusy("save");
    setError("");
    try {
      const response = await fetch("/api/presentations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: project.id,
          expectedUpdatedAt: project.updatedAt,
          name: project.name,
          description: project.description,
          themeId: project.themeId,
          accentColor: project.accentColor,
          backgroundColor: project.backgroundColor,
          textColor: project.textColor,
          slides: project.slides,
        }),
      });
      const body = await jsonBody<PresentationMutationResponse>(response);
      if (!response.ok || !("presentation" in body))
        throw new Error(apiError(body, "Презентация не сохранена."));
      const unchangedDuringSave = editRevisionRef.current === savingRevision;
      setProject((current) =>
        unchangedDuringSave
          ? body.presentation
          : current
            ? { ...current, updatedAt: body.presentation.updatedAt }
            : body.presentation,
      );
      setDirty(!unchangedDuringSave);
      setNotice(
        unchangedDuringSave
          ? "Все изменения сохранены."
          : "Сохранена предыдущая редакция. Новые изменения ожидают сохранения.",
      );
      return unchangedDuringSave;
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Презентация не сохранена.",
      );
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
    const url = new URL(
      `/presentations?id=${encodeURIComponent(project.id)}`,
      window.location.origin,
    ).toString();
    try {
      await navigator.clipboard.writeText(url);
      setNotice(
        "Ссылка на редактирование скопирована. Доступ к ней остаётся внутри вашего рабочего пространства.",
      );
    } catch {
      setNotice(`Скопируйте ссылку на презентацию: ${url}`);
    }
  };

  const moveSlide = (direction: -1 | 1) => {
    if (!project || !selectedSlide) return;
    const index = project.slides.findIndex(
      (slide) => slide.id === selectedSlide.id,
    );
    const target = index + direction;
    if (target < 0 || target >= project.slides.length) return;
    const slides = [...project.slides];
    [slides[index], slides[target]] = [slides[target], slides[index]];
    updateProject({ slides });
  };

  const duplicateSlide = () => {
    if (!project || !selectedSlide) return;
    const index = project.slides.findIndex(
      (slide) => slide.id === selectedSlide.id,
    );
    const duplicate = {
      ...selectedSlide,
      id: `slide-${crypto.randomUUID()}`,
      bullets: [...selectedSlide.bullets],
      title: `${selectedSlide.title} — копия`,
    };
    const slides = [...project.slides];
    slides.splice(index + 1, 0, duplicate);
    updateProject({ slides });
    setSelectedSlideId(duplicate.id);
  };

  const removeSlide = () => {
    if (!project || !selectedSlide || project.slides.length <= 1) return;
    const index = project.slides.findIndex(
      (slide) => slide.id === selectedSlide.id,
    );
    const slides = project.slides.filter(
      (slide) => slide.id !== selectedSlide.id,
    );
    updateProject({ slides });
    setSelectedSlideId(slides[Math.min(index, slides.length - 1)]?.id ?? null);
  };

  const changeSlideTheme = (themeId: PresentationThemeId) => {
    const theme = presentationTheme(themeId);
    updateSlide({
      themeId,
      accentColor: theme.accentColor,
      backgroundColor: theme.backgroundColor,
      textColor: theme.textColor,
      patternId: "auto",
    });
  };

  const openEmailCampaign = async () => {
    if (!project) return;
    if (dirty && !(await saveProject())) return;
    router.push(
      `/campaigns/new?step=message&presentation=${encodeURIComponent(project.id)}`,
    );
  };

  const openAiCreator = async () => {
    if (dirty && !(await saveProject())) return;
    router.push("/presentations?create=ai");
  };

  const filteredProjects = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("ru-RU");
    return presentations.filter(
      (item) =>
        !normalized ||
        `${item.name} ${item.description}`
          .toLocaleLowerCase("ru-RU")
          .includes(normalized),
    );
  }, [presentations, query]);
  const visibleProjects = useMemo(
    () =>
      libraryView === "favorites"
        ? filteredProjects.filter((item) => favoriteProjectIds.includes(item.id))
        : filteredProjects,
    [favoriteProjectIds, filteredProjects, libraryView],
  );
  const filteredEmailTemplates = useMemo(() => {
    const normalized = emailQuery.trim().toLocaleLowerCase("ru-RU");
    return emailTemplates
      .filter(
        (item) =>
          !normalized ||
          `${item.name} ${item.subject}`
            .toLocaleLowerCase("ru-RU")
            .includes(normalized),
      )
      .slice(0, 80);
  }, [emailQuery, emailTemplates]);
  const templateUseCases = useMemo(
    () => [
      "Все задачи",
      ...new Set(presentationTemplates.map((item) => item.useCase)),
    ],
    [],
  );
  const filteredPresentationTemplates = useMemo(() => {
    const normalized = templateQuery.trim().toLocaleLowerCase("ru-RU");
    return presentationTemplates.filter(
      (item) =>
        (templateUseCase === "Все задачи" ||
          item.useCase === templateUseCase) &&
        (!normalized ||
          `${item.name} ${item.description} ${item.useCase}`
            .toLocaleLowerCase("ru-RU")
            .includes(normalized)),
    );
  }, [templateQuery, templateUseCase]);
  const visiblePresentationTemplates = useMemo(
    () =>
      libraryView === "favorites"
        ? filteredPresentationTemplates.filter((item) =>
            favoriteTemplateIds.includes(item.id),
          )
        : filteredPresentationTemplates,
    [favoriteTemplateIds, filteredPresentationTemplates, libraryView],
  );

  if (loading)
    return (
      <div className="grid min-h-[420px] place-items-center text-sm text-text-muted">
        Загружаем студию презентаций…
      </div>
    );
  if (busy === "quick-new")
    return (
      <div className="grid min-h-[420px] place-items-center text-sm text-text-muted">
        Создаём пустую презентацию…
      </div>
    );

  if (projectId && project && selectedSlide) {
    return (
      <div className="studio-shell flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-[22px] border border-white/70 bg-surface/80 p-2 shadow-[0_20px_70px_rgba(25,20,45,.10)]">
        <div className="mb-2 flex flex-wrap items-center gap-2 rounded-2xl border border-border/80 bg-surface/95 px-3 py-2 shadow-[var(--shadow-xs)] backdrop-blur-xl">
          <Button
            variant="ghost"
            size="sm"
            leadingIcon={<ArrowLeft className="size-6" />}
            onClick={() => navigateTo()}
          >
            Презентации
          </Button>
          <div className="h-5 w-px bg-border" />
          <span className="rounded-full bg-primary-subtle px-2.5 py-1 text-[10px] font-semibold text-primary">
            {sourceLabels[project.sourceType]}
          </span>
          <Input
            aria-label="Название презентации"
            value={project.name}
            onChange={(event) => updateProject({ name: event.target.value })}
            className="min-w-[220px] flex-1 border-0 bg-transparent font-semibold shadow-none focus:shadow-none"
          />
          <span
            className={cn(
              "text-[11px]",
              dirty ? "text-warning" : "text-text-subtle",
            )}
          >
            {dirty ? "Есть несохранённые изменения" : notice || "Сохранено"}
          </span>
          <Button
            variant="outline"
            size="sm"
            leadingIcon={<Sparkles className="size-5" />}
            onClick={() => void openAiCreator()}
          >
            Новая с ИИ
          </Button>
          <Button
            variant="outline"
            size="sm"
            leadingIcon={<Copy className="size-5" />}
            onClick={() => void copyProjectLink()}
          >
            Ссылка
          </Button>
          <Button
            variant="outline"
            size="sm"
            leadingIcon={<Download className="size-5" />}
            onClick={() => void downloadPptx()}
            loading={busy === "save"}
          >
            PPTX
          </Button>
          <Button
            variant="outline"
            size="sm"
            leadingIcon={<Mail className="size-5" />}
            onClick={() => void openEmailCampaign()}
          >
            В письмо
          </Button>
          <Button
            size="sm"
            leadingIcon={<Save className="size-5" />}
            onClick={() => void saveProject()}
            loading={busy === "save"}
            loadingText="Сохраняем"
          >
            Сохранить
          </Button>
        </div>
        {error ? (
          <Alert tone="danger" className="mb-4">
            {error}
          </Alert>
        ) : null}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border/80 bg-surface shadow-[var(--shadow-sm)]">
          <div
            className={cn(
              "grid min-h-0 flex-1 grid-cols-1",
              slidesPanelOpen
                ? "lg:grid-cols-[148px_minmax(0,1fr)] xl:grid-cols-[148px_minmax(0,1fr)_272px]"
                : "lg:grid-cols-[minmax(0,1fr)] xl:grid-cols-[minmax(0,1fr)_272px]",
            )}
          >
            {slidesPanelOpen ? (
              <aside className="flex min-h-0 flex-col border-b border-border bg-[linear-gradient(180deg,var(--surface-subtle),var(--surface))] p-2.5 lg:border-b-0 lg:border-r">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <strong className="block text-[12px]">Слайды</strong>
                  <span className="text-[9px] text-text-subtle">
                    {project.slides.length} доступны для редактирования
                  </span>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Добавить слайд"
                  onClick={() => {
                    const slide = emptySlide();
                    updateProject({ slides: [...project.slides, slide] });
                    setSelectedSlideId(slide.id);
                  }}
                >
                  <Plus className="size-6" />
                </Button>
              </div>
              <div className="flex max-h-48 gap-2 overflow-x-auto pb-1 lg:grid lg:max-h-none lg:min-h-0 lg:flex-1 lg:grid-cols-1 lg:overflow-x-hidden lg:overflow-y-auto lg:pr-1">
                {project.slides.map((slide, index) => {
                  return (
                    <button
                      key={slide.id}
                      type="button"
                      onClick={() => setSelectedSlideId(slide.id)}
                      aria-pressed={slide.id === selectedSlide.id}
                      aria-label={`Слайд ${index + 1}: ${slide.title || layoutLabels[slide.layout]}`}
                      className="w-36 shrink-0 rounded-xl border border-border bg-surface p-1.5 text-left shadow-[var(--shadow-xs)] transition duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[var(--shadow-sm)] aria-pressed:border-primary aria-pressed:ring-2 aria-pressed:ring-primary/20 lg:w-auto"
                    >
                      <span className="mb-1 flex items-center justify-between px-0.5 text-[9px] text-text-subtle">
                        <span>{index + 1}</span>
                        <span>{layoutLabels[slide.layout]}</span>
                      </span>
                      <div className="overflow-hidden rounded-md">
                        <SlidePreview project={project} slide={slide} compact />
                      </div>
                    </button>
                  );
                })}
              </div>
              </aside>
            ) : null}
            <section className="flex min-w-0 min-h-0 flex-col bg-[radial-gradient(circle_at_50%_18%,rgba(124,53,242,.07),transparent_28%),#eef0f4]">
              <div className="flex min-h-11 items-center justify-between gap-2 border-b border-border bg-surface/90 px-2.5 py-1.5">
                <div className="flex min-w-0 items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0"
                    aria-label={
                      slidesPanelOpen
                        ? "Скрыть панель слайдов"
                        : "Показать панель слайдов"
                    }
                    title={
                      slidesPanelOpen
                        ? "Скрыть панель слайдов"
                        : "Показать панель слайдов"
                    }
                    onClick={() => setSlidesPanelOpen((current) => !current)}
                  >
                    {slidesPanelOpen ? (
                      <PanelLeftClose className="size-6" />
                    ) : (
                      <PanelLeftOpen className="size-6" />
                    )}
                  </Button>
                  <span className="shrink-0 rounded-md bg-primary-subtle px-2 py-1 text-[9px] font-semibold text-primary">
                    {selectedSlideIndex + 1} / {project.slides.length}
                  </span>
                  <span
                    className="hidden truncate text-[10px] font-medium text-text-muted md:block"
                    title="Двойной клик по свободной области — быстро изменить слайд"
                  >
                    Все слайды доступны · двойной клик — быстрые настройки
                  </span>
                </div>
                <div className="flex items-center gap-0.5">
                  <div className="hidden items-center gap-0.5 sm:flex">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label="Переместить слайд выше"
                    title="Выше"
                    onClick={() => moveSlide(-1)}
                  >
                    <ArrowUp className="size-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label="Переместить слайд ниже"
                    title="Ниже"
                    onClick={() => moveSlide(1)}
                  >
                    <ArrowDown className="size-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label="Дублировать слайд"
                    title="Дублировать"
                    onClick={duplicateSlide}
                  >
                    <Copy className="size-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label="Удалить слайд"
                    title="Удалить"
                    disabled={project.slides.length <= 1}
                    onClick={removeSlide}
                  >
                    <Trash2 className="size-5" />
                  </Button>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-2.5 xl:hidden"
                    leadingIcon={<Palette className="size-5" />}
                    onClick={() => setQuickSlideOpen(true)}
                  >
                    Инструменты
                  </Button>
                </div>
              </div>
              <div className="grid min-h-0 flex-1 place-items-center overflow-hidden p-4 sm:p-5 xl:p-6">
                <div className="w-full max-w-[1080px] overflow-hidden rounded-xl border border-border/80 bg-surface shadow-[0_22px_65px_rgb(17_24_39/0.16)]">
                  <SlidePreview
                    project={project}
                    slide={selectedSlide}
                    editable
                    onChange={updateSlide}
                    onPickImage={() => setSlideImageOpen(true)}
                    onOpenQuickEdit={() => setQuickSlideOpen(true)}
                  />
                </div>
              </div>
            </section>
            <aside className="hidden min-h-0 overflow-hidden border-l border-border bg-surface-subtle/55 p-2.5 xl:block">
              <div className="grid h-full min-h-0 gap-2.5 overflow-y-auto pr-0.5 [&>section]:rounded-xl [&>section]:border [&>section]:border-border/80 [&>section]:bg-surface [&>section]:p-3 [&>section]:shadow-[var(--shadow-xs)]">
                <div className="sticky top-0 z-10 -mx-3 -mt-3 border-b border-border bg-surface px-3 py-2">
                  <strong className="block text-[12px]">
                    Инструменты слайда
                  </strong>
                  <span className="text-[9px] text-text-subtle">
                    Контент, композиция и оформление
                  </span>
                </div>
                <section>
                  <h3 className="mb-1.5 mt-0 text-[11px] font-semibold">
                    Добавить на слайд
                  </h3>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      ["Текст", "statement"],
                      ["Список", "bullets"],
                      ["Фото", "split"],
                      ["Цифры", "stats"],
                      ["Цитата", "quote"],
                      ["Кнопка", "closing"],
                      ["Таймлайн", "timeline"],
                      ["Процесс", "process"],
                      ["Сравнение", "comparison"],
                      ["Повестка", "agenda"],
                      ["Галерея", "gallery"],
                      ["Диаграмма", "chart"],
                      ["Таблица", "table"],
                      ["Акцент", "callout"],
                    ].map(([label, layout]) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => {
                          if (label === "Фото" || label === "Галерея")
                            setSlideImageOpen(true);
                          updateSlide({
                            layout: layout as PresentationSlideLayout,
                            ...([
                              "Список",
                              "Таймлайн",
                              "Процесс",
                              "Сравнение",
                              "Повестка",
                              "Таблица",
                            ].includes(label) && !selectedSlide.bullets.length
                              ? {
                                  bullets: [
                                    "Первый пункт",
                                    "Второй пункт",
                                    "Третий пункт",
                                  ],
                                }
                              : {}),
                            ...(["Цифры", "Диаграмма"].includes(label) &&
                            !selectedSlide.bullets.length
                              ? { bullets: ["24% | рост", "3× | быстрее"] }
                              : {}),
                            ...(label === "Кнопка" && !selectedSlide.ctaLabel
                              ? { ctaLabel: "Узнать подробнее" }
                              : {}),
                          });
                        }}
                  className="rounded-lg border border-border bg-surface px-1.5 py-2 text-[9px] font-semibold transition hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary-subtle hover:shadow-[var(--shadow-xs)]"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </section>
                <section>
                  <h3 className="mb-2 mt-0 text-[12px] font-semibold">
                    Композиция
                  </h3>
                  <Select
                    value={selectedSlide.layout}
                    onChange={(event) =>
                      updateSlide({
                        layout: event.target.value as PresentationSlideLayout,
                      })
                    }
                    options={Object.entries(layoutLabels).map(
                      ([value, label]) => ({ value, label }),
                    )}
                  />
                </section>
                <section className="grid gap-3">
                  <h3 className="m-0 text-[12px] font-semibold">Содержание</h3>
                  <FormField label="Надзаголовок" htmlFor="slide-eyebrow">
                    <Input
                      id="slide-eyebrow"
                      value={selectedSlide.eyebrow}
                      onChange={(event) =>
                        updateSlide({ eyebrow: event.target.value })
                      }
                      placeholder="Например: ИССЛЕДОВАНИЕ"
                    />
                  </FormField>
                  <FormField label="Заголовок-вывод" htmlFor="slide-title">
                    <Textarea
                      id="slide-title"
                      value={selectedSlide.title}
                      onChange={(event) =>
                        updateSlide({ title: event.target.value })
                      }
                      rows={3}
                    />
                  </FormField>
                  <FormField label="Пояснение" htmlFor="slide-body">
                    <Textarea
                      id="slide-body"
                      value={selectedSlide.body}
                      onChange={(event) =>
                        updateSlide({ body: event.target.value })
                      }
                      rows={4}
                    />
                  </FormField>
                  <FormField
                    label={
                      selectedSlide.layout === "stats"
                        ? "Показатели: число | подпись"
                        : "Пункты — один на строку"
                    }
                    htmlFor="slide-bullets"
                  >
                    <Textarea
                      id="slide-bullets"
                      value={selectedSlide.bullets.join("\n")}
                      onChange={(event) =>
                        updateSlide({
                          bullets: event.target.value.split("\n").slice(0, 8),
                        })
                      }
                      rows={5}
                    />
                  </FormField>
                </section>
                <section className="grid gap-3 rounded-xl border border-primary/15 bg-primary-subtle/20 p-3">
                  <h3 className="m-0 text-[12px] font-semibold">
                    Кнопка и социальные сети
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    <FormField label="Текст кнопки" htmlFor="slide-cta-label">
                      <Input
                        id="slide-cta-label"
                        value={selectedSlide.ctaLabel ?? ""}
                        onChange={(event) =>
                          updateSlide({ ctaLabel: event.target.value })
                        }
                        placeholder="Узнать подробнее"
                      />
                    </FormField>
                    <FormField label="HTTPS-ссылка" htmlFor="slide-cta-url">
                      <Input
                        id="slide-cta-url"
                        type="url"
                        value={selectedSlide.ctaUrl ?? ""}
                        onChange={(event) =>
                          updateSlide({ ctaUrl: event.target.value })
                        }
                        placeholder="https://…"
                      />
                    </FormField>
                  </div>
                  {(
                    [
                      ["Telegram", "telegram"],
                      ["ВКонтакте", "vk"],
                      ["Сайт", "website"],
                    ] as const
                  ).map(([label, key]) => {
                    const link = selectedSlide.socialLinks?.find(
                      (item) => item.label === label,
                    );
                    return (
                      <FormField
                        key={key}
                        label={label}
                        htmlFor={`slide-social-${key}`}
                      >
                        <Input
                          id={`slide-social-${key}`}
                          type="url"
                          value={link?.url ?? ""}
                          onChange={(event) => {
                            const rest = (
                              selectedSlide.socialLinks ?? []
                            ).filter((item) => item.label !== label);
                            updateSlide({
                              socialLinks: event.target.value.trim()
                                ? [...rest, { label, url: event.target.value }]
                                : rest,
                            });
                          }}
                          placeholder="https://…"
                        />
                      </FormField>
                    );
                  })}
                </section>
                <section>
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="m-0 text-[12px] font-semibold">
                      Изображение
                    </h3>
                    {selectedSlide.imageUrl ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          updateSlide({
                            imageUrl: undefined,
                            assetId: undefined,
                          })
                        }
                      >
                        Убрать
                      </Button>
                    ) : null}
                  </div>
                  <ImageAssetPicker
                    kind="photo"
                    value={selectedSlide.imageUrl}
                    destinationLabel="презентации"
                    onSelect={(url) =>
                      updateSlide({ imageUrl: url, assetId: imageAssetId(url) })
                    }
                  />
                </section>
                <section>
                  <h3 className="mb-2 mt-0 text-[12px] font-semibold">
                    Стиль текущего слайда
                  </h3>
                  <p className="mb-3 mt-0 text-[10px] leading-4 text-text-muted">
                    Выбранная тема, палитра и узор применяются только к этому
                    слайду. Остальные слайды не изменятся.
                  </p>
                  <ThemeStrip
                    value={selectedSlide.themeId ?? project.themeId}
                    onChange={changeSlideTheme}
                  />
                  <div className="mt-3">
                    <p className="mb-0 mt-0 text-[11px] font-semibold">
                      Библиотека фонов и узоров
                    </p>
                    <p className="mb-2 mt-0.5 text-[9px] leading-3 text-text-subtle">
                      64 адаптивных мотива в цветах текущего слайда
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {presentationPatterns.map((pattern) => (
                        <button
                          key={pattern.id}
                          type="button"
                          aria-pressed={
                            (selectedSlide.patternId ?? "auto") === pattern.id
                          }
                          onClick={() => updateSlide({ patternId: pattern.id })}
                          className="rounded-lg border border-border bg-surface p-2 text-left text-[10px] font-medium transition hover:border-primary/40 aria-pressed:border-primary aria-pressed:bg-primary-subtle"
                        >
                          <span
                            className="mb-1.5 block aspect-[3/1] rounded border border-border"
                            style={{
                              backgroundColor:
                                selectedSlide.backgroundColor ??
                                project.backgroundColor,
                              ...presentationPatternStyle(
                                selectedSlide.themeId ?? project.themeId,
                                selectedSlide.accentColor ??
                                  project.accentColor,
                                "preview",
                                pattern.id,
                              ),
                            }}
                          />
                          <span className="block truncate">{pattern.label}</span>
                          <span className="mt-0.5 block text-[8px] font-normal text-text-subtle">
                            {pattern.category}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <FormField label="Акцент">
                      <Input
                        type="color"
                        value={selectedSlide.accentColor ?? project.accentColor}
                        onChange={(event) =>
                          updateSlide({
                            accentColor: event.target.value.toUpperCase(),
                          })
                        }
                        className="h-10 p-1"
                      />
                    </FormField>
                    <FormField label="Фон слайда">
                      <Input
                        type="color"
                        value={
                          selectedSlide.backgroundColor ??
                          project.backgroundColor
                        }
                        onChange={(event) =>
                          updateSlide({
                            backgroundColor: event.target.value.toUpperCase(),
                          })
                        }
                        className="h-10 p-1"
                      />
                    </FormField>
                    <FormField label="Текст">
                      <Input
                        type="color"
                        value={selectedSlide.textColor ?? project.textColor}
                        onChange={(event) =>
                          updateSlide({
                            textColor: event.target.value.toUpperCase(),
                          })
                        }
                        className="h-10 p-1"
                      />
                    </FormField>
                  </div>
                  {selectedSlide.themeId ||
                  selectedSlide.accentColor ||
                  selectedSlide.backgroundColor ||
                  selectedSlide.textColor ||
                  selectedSlide.patternId ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2"
                      onClick={() =>
                        updateSlide({
                          themeId: undefined,
                          accentColor: undefined,
                          backgroundColor: undefined,
                          textColor: undefined,
                          patternId: undefined,
                        })
                      }
                    >
                      Вернуть стиль презентации
                    </Button>
                  ) : null}
                </section>
                <section>
                  <FormField
                    label="Заметки выступающего"
                    hint="Факты и внешние источники указывайте здесь. Они сохраняются в проекте."
                    htmlFor="slide-notes"
                  >
                    <Textarea
                      id="slide-notes"
                      value={selectedSlide.speakerNotes}
                      onChange={(event) =>
                        updateSlide({ speakerNotes: event.target.value })
                      }
                      rows={5}
                    />
                  </FormField>
                </section>
              </div>
            </aside>
          </div>
        </div>
        <Modal
          open={quickSlideOpen}
          onOpenChange={setQuickSlideOpen}
          title="Быстро изменить слайд"
          description="Текст, изображение и фон меняются здесь и сразу видны на холсте."
          size="lg"
          footer={
            <Button onClick={() => setQuickSlideOpen(false)}>Готово</Button>
          }
        >
          <div className="grid gap-5">
            <section className="grid gap-3 rounded-xl border border-border bg-surface-subtle/45 p-4">
              <div className="flex items-center gap-2">
                <Type className="size-6 text-primary" aria-hidden="true" />
                <strong className="text-[13px]">Надписи</strong>
              </div>
              <FormField label="Заголовок-вывод" htmlFor="quick-slide-title">
                <Textarea
                  id="quick-slide-title"
                  value={selectedSlide.title}
                  onChange={(event) =>
                    updateSlide({ title: event.target.value })
                  }
                  rows={2}
                  data-autofocus
                />
              </FormField>
              <FormField label="Пояснение" htmlFor="quick-slide-body">
                <Textarea
                  id="quick-slide-body"
                  value={selectedSlide.body}
                  onChange={(event) =>
                    updateSlide({ body: event.target.value })
                  }
                  rows={3}
                  placeholder="Добавьте короткое пояснение"
                />
              </FormField>
              <FormField
                label="Пункты — один на строку"
                htmlFor="quick-slide-bullets"
              >
                <Textarea
                  id="quick-slide-bullets"
                  value={selectedSlide.bullets.join("\n")}
                  onChange={(event) =>
                    updateSlide({
                      bullets: event.target.value.split("\n").slice(0, 8),
                    })
                  }
                  rows={3}
                />
              </FormField>
            </section>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  setQuickSlideOpen(false);
                  setSlideImageOpen(true);
                }}
                className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 text-left transition hover:border-primary/40 hover:bg-primary-subtle/20"
              >
                <span className="grid size-9 place-items-center rounded-lg bg-primary-subtle text-primary">
                  <ImageIcon className="size-6" aria-hidden="true" />
                </span>
                <span>
                  <strong className="block text-[12px]">
                    Добавить изображение
                  </strong>
                  <span className="text-[10px] text-text-muted">
                    Загрузить или выбрать из медиатеки
                  </span>
                </span>
              </button>
              <div className="rounded-xl border border-border bg-surface p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Palette className="size-6 text-primary" aria-hidden="true" />
                  <strong className="text-[12px]">Фон и узор</strong>
                </div>
                <ThemeStrip
                  value={selectedSlide.themeId ?? project.themeId}
                  onChange={changeSlideTheme}
                />
                <div className="mt-3">
                  <Select
                    aria-label="Узор активного слайда"
                    value={selectedSlide.patternId ?? "auto"}
                    onChange={(event) =>
                      updateSlide({
                        patternId: event.target.value as PresentationPatternId,
                      })
                    }
                    options={presentationPatterns.map((pattern) => ({
                      value: pattern.id,
                      label: `${pattern.label} · ${pattern.category}`,
                    }))}
                  />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <Input
                    aria-label="Акцент активного слайда"
                    type="color"
                    value={selectedSlide.accentColor ?? project.accentColor}
                    onChange={(event) =>
                      updateSlide({
                        accentColor: event.target.value.toUpperCase(),
                      })
                    }
                    className="h-9 p-1"
                  />
                  <Input
                    aria-label="Фон активного слайда"
                    type="color"
                    value={
                      selectedSlide.backgroundColor ?? project.backgroundColor
                    }
                    onChange={(event) =>
                      updateSlide({
                        backgroundColor: event.target.value.toUpperCase(),
                      })
                    }
                    className="h-9 p-1"
                  />
                  <Input
                    aria-label="Текст активного слайда"
                    type="color"
                    value={selectedSlide.textColor ?? project.textColor}
                    onChange={(event) =>
                      updateSlide({
                        textColor: event.target.value.toUpperCase(),
                      })
                    }
                    className="h-9 p-1"
                  />
                </div>
              </div>
            </div>
          </div>
        </Modal>
        <Modal
          open={slideImageOpen}
          onOpenChange={setSlideImageOpen}
          title="Изображение слайда"
          description="Выберите файл из медиатеки или загрузите новый. Изображение сразу появится на активном слайде."
          size="lg"
          footer={
            <Button variant="ghost" onClick={() => setSlideImageOpen(false)}>
              Закрыть
            </Button>
          }
        >
          <ImageAssetPicker
            kind="photo"
            value={selectedSlide.imageUrl}
            destinationLabel="активного слайда"
            onSelect={(url) => {
              updateSlide({ imageUrl: url, assetId: imageAssetId(url) });
              setSlideImageOpen(false);
            }}
          />
        </Modal>
      </div>
    );
  }

  return (
    <div className="presentation-studio-home grid h-full min-h-0 auto-rows-max content-start gap-7 overflow-y-auto overscroll-contain pr-1">
      <PageHeader
        title="Презентации"
        action={
          <>
            <Button
              variant="outline"
              leadingIcon={<Mail className="size-6" />}
              onClick={() => void openEmailImport()}
            >
              Из письма
            </Button>
            <Button
              variant="outline"
              leadingIcon={<Sparkles className="size-6" />}
              onClick={() => setAiOpen(true)}
            >
              Создать с ИИ
            </Button>
            <Button
              leadingIcon={<FilePlus2 className="size-6" />}
              onClick={createBlank}
              loading={busy === "blank"}
            >
              Новая презентация
            </Button>
          </>
        }
      />
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <div className="min-h-[50px] w-full shrink-0 overflow-x-auto pb-1">
        <nav
          className="flex min-h-12 w-max items-center gap-1 rounded-xl border border-border bg-surface p-1"
          aria-label="Разделы библиотеки презентаций"
        >
          {[
            {
              id: "presentations" as const,
              label: "Презентации",
              count: presentations.length,
            },
            {
              id: "templates" as const,
              label: "Шаблоны",
              count: presentationTemplates.length,
            },
            {
              id: "favorites" as const,
              label: "Избранное",
              count: favoriteProjectIds.length + favoriteTemplateIds.length,
            },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={libraryView === item.id}
              onClick={() => setLibraryView(item.id)}
              className="group flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-[12px] font-semibold text-text-muted transition hover:bg-surface-subtle aria-pressed:bg-primary aria-pressed:text-white"
            >
              {item.label}
              <span className="rounded-full bg-black/5 px-1.5 py-0.5 text-[9px] group-aria-pressed:bg-white/15">
                {item.count}
              </span>
            </button>
          ))}
        </nav>
      </div>
      {libraryView !== "templates" ? (
      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className={libraryView === "favorites" ? "m-0 text-[18px] font-semibold" : "sr-only"}>
              {libraryView === "favorites"
                ? "Избранные презентации"
                : "Ваши презентации"}
            </h2>
          </div>
          <SearchInput
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onClear={() => setQuery("")}
            placeholder="Найти презентацию"
            wrapperClassName="w-full sm:w-72"
          />
        </div>
        {visibleProjects.length ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visibleProjects.map((item) => (
              <article
                key={item.id}
                className="group overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--shadow-xs)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]"
              >
                <button
                  type="button"
                  className="block w-full p-3 text-left"
                  onClick={() => navigateTo(item.id)}
                >
                  <div className="overflow-hidden rounded-lg">
                    <SlidePreview
                      project={item}
                      slide={item.slides[0] ?? emptySlide("title")}
                      compact
                    />
                  </div>
                  <div className="px-1 pb-1 pt-3">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="m-0 text-[14px] font-semibold text-text-strong">
                        {item.name}
                      </h3>
                      <span className="shrink-0 text-[10px] text-text-subtle">
                        {item.slides.length} сл.
                      </span>
                    </div>
                    <p className="mb-0 mt-1 line-clamp-2 text-[11px] leading-4 text-text-muted">
                      {item.description || "Без описания"}
                    </p>
                  </div>
                </button>
                <div className="flex items-center justify-between border-t border-border px-4 py-2.5">
                  <span className="text-[10px] text-text-subtle">
                    {sourceLabels[item.sourceType]} ·{" "}
                    {new Date(item.updatedAt).toLocaleDateString("ru-RU")}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => void toggleFavorite("project", item.id)}
                      disabled={busy === `favorite-project-${item.id}`}
                      aria-pressed={favoriteProjectIds.includes(item.id)}
                      className="rounded-md p-1.5 text-text-subtle transition hover:bg-warning-subtle hover:text-warning aria-pressed:text-warning"
                      aria-label={`${favoriteProjectIds.includes(item.id) ? "Убрать из избранного" : "Добавить в избранное"}: ${item.name}`}
                    >
                      <Star
                        className="size-5"
                        fill={
                          favoriteProjectIds.includes(item.id)
                            ? "currentColor"
                            : "none"
                        }
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteProject(item)}
                      disabled={busy === `delete-${item.id}`}
                      className="rounded-md p-1.5 text-text-subtle hover:bg-danger-subtle hover:text-danger"
                      aria-label={`Удалить ${item.name}`}
                    >
                      <Trash2 className="size-5" />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border-strong bg-surface px-6 py-10 text-center">
            <LayoutTemplate className="mx-auto size-9 text-primary" />
            <h3 className="mb-0 mt-3 text-[14px] font-semibold">
              {query
                ? "Ничего не найдено"
                : libraryView === "favorites"
                  ? "Нет избранных презентаций"
                  : "Начните с подходящего сценария"}
            </h3>
            <p className="mx-auto mb-0 mt-1 max-w-md text-[12px] text-text-muted">
              {query
                ? "Измените запрос или очистите поиск."
                : libraryView === "favorites"
                  ? "Нажмите на звезду у презентации, чтобы она появилась здесь."
                : "Выберите шаблон ниже, перенесите письмо или начните с пустой презентации."}
            </p>
          </div>
        )}
      </section>
      ) : null}
      {libraryView !== "presentations" ? (
      <section id="presentation-template-library" className="scroll-mt-6">
        <div className="mb-4 flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
          <div>
            <h2 className={libraryView === "favorites" ? "m-0 text-[18px] font-semibold" : "sr-only"}>
              {libraryView === "favorites"
                ? "Избранные шаблоны"
                : "Шаблоны презентаций"}
            </h2>
          </div>
          <div className="grid gap-2 sm:grid-cols-[240px_210px]">
            <SearchInput
              value={templateQuery}
              onChange={(event) => setTemplateQuery(event.target.value)}
              onClear={() => setTemplateQuery("")}
              placeholder="Найти шаблон"
            />
            <Select
              value={templateUseCase}
              onChange={(event) => setTemplateUseCase(event.target.value)}
              options={templateUseCases.map((value) => ({
                value,
                label: value,
              }))}
            />
          </div>
        </div>
        <p className="mb-3 mt-0 text-[10px] text-text-subtle">
          Найдено: {visiblePresentationTemplates.length} из{" "}
          {presentationTemplates.length}
        </p>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visiblePresentationTemplates.map((template) => (
            <article
              key={template.id}
              className="group overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--shadow-xs)] transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[var(--shadow-md)]"
            >
              <div className="p-3">
                <div className="overflow-hidden rounded-lg">
                  <SlidePreview
                    project={template}
                    slide={template.slides[0]}
                    compact
                  />
                </div>
                <div className="px-1 pt-3">
                  <span className="text-[11px] text-text-muted">
                    {template.useCase}
                  </span>
                  <h3 className="mb-0 mt-1 text-[14px] font-semibold">
                    {template.name}
                  </h3>
                  <p className="mb-0 mt-1 min-h-8 text-[11px] leading-4 text-text-muted">
                    {template.description}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-border px-4 py-3">
                <span className="text-[10px] text-text-subtle">
                  {template.slides.length} слайдов ·{" "}
                  {presentationTheme(template.themeId).name}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => void toggleFavorite("template", template.id)}
                    disabled={busy === `favorite-template-${template.id}`}
                    aria-pressed={favoriteTemplateIds.includes(template.id)}
                    className="rounded-md p-2 text-text-subtle transition hover:bg-warning-subtle hover:text-warning aria-pressed:text-warning"
                    aria-label={`${favoriteTemplateIds.includes(template.id) ? "Убрать из избранного" : "Добавить в избранное"}: ${template.name}`}
                  >
                    <Star
                      className="size-5"
                      fill={
                        favoriteTemplateIds.includes(template.id)
                          ? "currentColor"
                          : "none"
                      }
                    />
                  </button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => createFromScenario(template)}
                    loading={busy === template.id}
                  >
                    Использовать
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
        {!visiblePresentationTemplates.length ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-[12px] text-text-muted">
            {libraryView === "favorites" && !templateQuery
              ? "Добавьте шаблоны в избранное — они появятся здесь."
              : "По этим условиям шаблонов нет. Сбросьте поиск или выберите другую задачу."}
          </div>
        ) : null}
      </section>
      ) : null}

      <Modal
        open={aiOpen}
        onOpenChange={(open) => {
          setAiOpen(open);
          setAiError("");
          if (!open) aiIdempotencyKeyRef.current = "";
        }}
        title="Создать презентацию с ИИ"
        description="Опишите задачу и факты — Поток соберёт связную историю, которую можно полностью редактировать."
        size="lg"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                aiIdempotencyKeyRef.current = "";
                setAiOpen(false);
              }}
            >
              Отмена
            </Button>
            <Button
              onClick={() => void generateWithAi()}
              disabled={
                aiStatus?.configured !== true || aiGoal.trim().length < 12
              }
              loading={busy === "ai" || busy === "ai-save"}
              loadingText="Проектируем сюжет и слайды"
              leadingIcon={<Sparkles className="size-6" />}
            >
              Создать презентацию
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          {aiStatus === null ? (
            <Alert tone="info">Проверяем подключение ИИ…</Alert>
          ) : aiStatus.configured ? (
            <Alert tone="success" title="ИИ готов">
              Сначала будет создана структура, затем проект автоматически
              откроется в редакторе.
            </Alert>
          ) : (
            <Alert tone="warning" title="ИИ не подключён">
              Создание с ИИ сейчас недоступно. Выберите шаблон ниже или
              подключите провайдера в настройках платформы.
            </Alert>
          )}
          {aiError ? (
            <Alert tone="danger" title="Презентация не создана">
              {aiError}
            </Alert>
          ) : null}
          <AiCreationModePicker
            value={aiCreativeSource}
            onChange={(value) => {
              aiIdempotencyKeyRef.current = "";
              setAiCreativeSource(value);
              if (value === "library") {
                const template =
                  presentationTemplates.find(
                    (item) => item.id === aiTemplateId,
                  ) ?? presentationTemplates[0];
                if (template) {
                  setAiTemplateId(template.id);
                  setAiSlideCount(template.slides.length);
                  setAiTheme(template.themeId);
                }
              }
            }}
            libraryCount={presentationTemplates.length}
            artifact="презентацию"
          />
          {aiCreativeSource === "library" ? (
            <section className="grid gap-3 rounded-2xl border border-border bg-surface-subtle/55 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <strong className="block text-[12px] text-text-strong">
                    Сценарий и визуальная система
                  </strong>
                  <span className="mt-0.5 block text-[9px] leading-4 text-text-muted">
                    Структура и ритм сохранятся, а заголовки, аргументы,
                    изображения и заметки AI соберёт заново.
                  </span>
                </div>
                <span className="rounded-full bg-primary-subtle px-2.5 py-1 text-[8px] font-semibold text-primary">
                  Управляемая адаптация
                </span>
              </div>
              <Select
                aria-label="Шаблон-основа презентации"
                value={aiTemplateId}
                onChange={(event) => {
                  aiIdempotencyKeyRef.current = "";
                  const template = presentationTemplates.find(
                    (item) => item.id === event.target.value,
                  );
                  setAiTemplateId(event.target.value);
                  if (template) {
                    setAiSlideCount(template.slides.length);
                    setAiTheme(template.themeId);
                  }
                }}
                options={presentationTemplates.map((template) => ({
                  value: template.id,
                  label: `${template.name} · ${template.useCase}`,
                }))}
              />
              {(() => {
                const template = presentationTemplates.find(
                  (item) => item.id === aiTemplateId,
                );
                return template ? (
                  <div className="grid gap-3 rounded-xl border border-border bg-surface p-3 sm:grid-cols-[132px_minmax(0,1fr)_auto] sm:items-center">
                    <div className="overflow-hidden rounded-lg border border-border">
                      <SlidePreview
                        project={template}
                        slide={template.slides[0]}
                        compact
                      />
                    </div>
                    <div className="min-w-0">
                      <strong className="block text-[11px] text-text-strong">
                        {template.name}
                      </strong>
                      <span className="mt-0.5 block text-[9px] leading-4 text-text-muted">
                        {template.description}
                      </span>
                    </div>
                    <span className="text-[9px] text-text-subtle">
                      {template.slides.length} слайдов
                    </span>
                  </div>
                ) : null;
              })()}
            </section>
          ) : null}
          <FormField
            label="Задача презентации"
            required
            htmlFor="ai-presentation-goal"
            hint="Что аудитория должна понять и почему это важно?"
          >
            <Textarea
              id="ai-presentation-goal"
              data-autofocus
              value={aiGoal}
              onChange={(event) => {
                aiIdempotencyKeyRef.current = "";
                setAiError("");
                setAiGoal(event.target.value);
              }}
              rows={5}
              placeholder="Например: представить платформу Поток управляющим партнёрам юридических фирм и показать сценарий пилота."
            />
          </FormField>
          <section className="grid gap-3 rounded-xl border border-primary/20 bg-primary-subtle/20 p-4">
            <strong className="text-[13px]">
              Дизайн, кнопка и социальные сети
            </strong>
            <FormField
              label="Как должна выглядеть презентация"
              htmlFor="ai-presentation-design"
              hint="Опишите узоры, настроение, плотность и визуальные ограничения."
            >
              <Textarea
                id="ai-presentation-design"
                value={aiDesignBrief}
                onChange={(event) => {
                  aiIdempotencyKeyRef.current = "";
                  setAiDesignBrief(event.target.value);
                }}
                rows={3}
                placeholder="Например: сиреневая технологичная тема, тонкая сетка, контурные круги и много воздуха."
              />
            </FormField>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField
                label="Текст кнопки"
                htmlFor="ai-presentation-cta-label"
              >
                <Input
                  id="ai-presentation-cta-label"
                  value={aiCtaLabel}
                  onChange={(event) => {
                    aiIdempotencyKeyRef.current = "";
                    setAiCtaLabel(event.target.value);
                  }}
                />
              </FormField>
              <FormField
                label="HTTPS-ссылка кнопки"
                htmlFor="ai-presentation-cta-url"
              >
                <Input
                  id="ai-presentation-cta-url"
                  type="url"
                  value={aiCtaUrl}
                  onChange={(event) => {
                    aiIdempotencyKeyRef.current = "";
                    setAiCtaUrl(event.target.value);
                  }}
                  placeholder="https://…"
                />
              </FormField>
              {(
                [
                  ["telegram", "Telegram"],
                  ["vk", "ВКонтакте"],
                  ["website", "Сайт"],
                ] as const
              ).map(([key, label]) => (
                <FormField
                  key={key}
                  label={label}
                  htmlFor={`ai-presentation-social-${key}`}
                >
                  <Input
                    id={`ai-presentation-social-${key}`}
                    type="url"
                    value={aiSocialLinks[key]}
                    onChange={(event) => {
                      aiIdempotencyKeyRef.current = "";
                      setAiSocialLinks((current) => ({
                        ...current,
                        [key]: event.target.value,
                      }));
                    }}
                    placeholder="https://…"
                  />
                </FormField>
              ))}
            </div>
          </section>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Для кого" htmlFor="ai-presentation-audience">
              <Input
                id="ai-presentation-audience"
                value={aiAudience}
                onChange={(event) => {
                  aiIdempotencyKeyRef.current = "";
                  setAiAudience(event.target.value);
                }}
                placeholder="Управляющие партнёры, знакомы с темой поверхностно"
              />
            </FormField>
            <FormField
              label="Действие после презентации"
              htmlFor="ai-presentation-action"
            >
              <Input
                id="ai-presentation-action"
                value={aiAction}
                onChange={(event) => {
                  aiIdempotencyKeyRef.current = "";
                  setAiAction(event.target.value);
                }}
                placeholder="Согласовать пилот или назначить встречу"
              />
            </FormField>
          </div>
          <FormField
            label="Факты и исходные данные"
            htmlFor="ai-presentation-context"
            hint="Только эти данные ИИ сможет использовать как подтверждённые факты."
          >
            <Textarea
              id="ai-presentation-context"
              value={aiContext}
              onChange={(event) => {
                aiIdempotencyKeyRef.current = "";
                setAiContext(event.target.value);
              }}
              rows={3}
              placeholder="Цифры, даты, продуктовые возможности, цитаты и ограничения. Можно оставить пустым."
            />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Подача">
              <Select
                value={aiTone}
                onChange={(event) => {
                  aiIdempotencyKeyRef.current = "";
                  setAiTone(event.target.value as typeof aiTone);
                }}
                options={[
                  { value: "executive", label: "Для руководителей · кратко" },
                  { value: "persuasive", label: "Убедительная · к решению" },
                  { value: "educational", label: "Объясняющая · от основ" },
                  { value: "visual", label: "Визуальная · минимум текста" },
                ]}
              />
            </FormField>
            <FormField label="Количество слайдов">
              <Select
                value={String(aiSlideCount)}
                disabled={aiCreativeSource === "library"}
                onChange={(event) => {
                  aiIdempotencyKeyRef.current = "";
                  setAiSlideCount(Number(event.target.value));
                }}
                options={[5, 6, 7, 8, 10, 12, 15].map((count) => ({
                  value: String(count),
                  label: `${count} слайдов`,
                }))}
              />
            </FormField>
          </div>
            <FormField label="Визуальная тема">
            {aiCreativeSource === "library" ? (
              <div className="rounded-xl border border-border bg-surface-subtle px-3 py-2.5 text-[10px] text-text-muted">
                Тема закреплена выбранным шаблоном. После создания её можно
                менять отдельно на каждом слайде.
              </div>
            ) : (
              <ThemeStrip
                value={aiTheme}
                onChange={(theme) => {
                  aiIdempotencyKeyRef.current = "";
                  setAiTheme(theme);
                }}
              />
            )}
          </FormField>
        </div>
      </Modal>

      <Modal
        open={emailOpen}
        onOpenChange={setEmailOpen}
        title="Превратить письмо в презентацию"
        description="Поток перенесёт тему, ключевые блоки, CTA и изображения в отдельную слайдовую историю. Исходное письмо не изменится."
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEmailOpen(false)}>
              Отмена
            </Button>
            <Button
              onClick={() => void createFromEmail()}
              loading={busy === "email-create"}
              disabled={!selectedEmailId}
              leadingIcon={<Mail className="size-6" />}
            >
              Создать из письма
            </Button>
          </>
        }
      >
        <div className="grid gap-3">
          <SearchInput
            value={emailQuery}
            onChange={(event) => setEmailQuery(event.target.value)}
            onClear={() => setEmailQuery("")}
            placeholder="Найти письмо или шаблон"
          />
          {busy === "email-list" ? (
            <p className="text-[12px] text-text-muted">Загружаем шаблоны…</p>
          ) : (
            <div className="grid max-h-80 gap-2 overflow-y-auto">
              {filteredEmailTemplates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => setSelectedEmailId(template.id)}
                  aria-pressed={selectedEmailId === template.id}
                  className="flex items-start gap-3 rounded-lg border border-border bg-surface p-3 text-left transition hover:border-primary/40 aria-pressed:border-primary aria-pressed:bg-primary-subtle/30"
                >
                  <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-surface-subtle text-text-muted">
                    <Mail className="size-6" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-[12px]">
                      {template.name}
                    </strong>
                    <span className="mt-0.5 block truncate text-[11px] text-text-muted">
                      {template.subject}
                    </span>
                  </span>
                  {selectedEmailId === template.id ? (
                    <Check className="mt-1 size-6 shrink-0 text-primary" />
                  ) : null}
                </button>
              ))}
              {!filteredEmailTemplates.length ? (
                <p className="rounded-lg border border-dashed border-border p-5 text-center text-[12px] text-text-muted">
                  Шаблоны не найдены.
                </p>
              ) : null}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
