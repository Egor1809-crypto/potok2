"use client";

import {
  AlignJustify,
  Columns3,
  GalleryHorizontal,
  Heading2,
  Image as ImageIcon,
  Link2,
  Minus,
  MousePointerClick,
  PanelBottom,
  Share2,
  Space,
  Type,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { EmailBlockType } from "@/types";
import { cn } from "@/components/ui/utils";

export type BlockLibraryItem = {
  type: EmailBlockType;
  label: string;
  description: string;
  icon: LucideIcon;
};

export const blockLibrary: BlockLibraryItem[] = [
  { type: "text", label: "Text", description: "Paragraph copy", icon: Type },
  { type: "heading", label: "Heading", description: "Section title", icon: Heading2 },
  { type: "image", label: "Image", description: "Visual or photo", icon: ImageIcon },
  { type: "button", label: "Button", description: "Primary action", icon: MousePointerClick },
  { type: "columns", label: "Columns", description: "Two-up content", icon: Columns3 },
  { type: "divider", label: "Divider", description: "Visual separator", icon: Minus },
  { type: "spacer", label: "Spacer", description: "Vertical rhythm", icon: Space },
  { type: "social", label: "Social", description: "Social links", icon: Share2 },
  { type: "logo", label: "Logo", description: "Brand mark", icon: GalleryHorizontal },
  { type: "footer", label: "Footer", description: "Compliance copy", icon: PanelBottom },
];

export function BlockLibrary({
  onAdd,
  className,
}: {
  onAdd: (type: EmailBlockType) => void;
  className?: string;
}) {
  return (
    <aside
      aria-label="Content blocks"
      className={cn("flex min-h-0 flex-col bg-surface", className)}
    >
      <div className="border-b border-border/70 px-4 py-4">
        <div className="flex items-center gap-2">
          <AlignJustify aria-hidden="true" className="size-4 text-primary" />
          <h2 className="m-0 text-[13px] font-semibold text-text-strong">Content blocks</h2>
        </div>
        <p className="mt-1 text-[11px] leading-4 text-text-muted">
          Add a block beneath the current selection.
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3 scrollbar-subtle">
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-1 xl:grid-cols-2">
          {blockLibrary.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.type}
                type="button"
                onClick={() => onAdd(item.type)}
                className="group min-w-0 rounded-[11px] border border-border bg-surface p-2.5 text-left shadow-[var(--shadow-xs)] outline-none transition-[border-color,background-color,transform,box-shadow] hover:-translate-y-0.5 hover:border-primary/30 hover:bg-primary-subtle/35 hover:shadow-[var(--shadow-sm)] focus-visible:ring-2 focus-visible:ring-primary/30"
              >
                <span className="grid size-8 place-items-center rounded-[9px] bg-surface-subtle text-text-muted transition-colors group-hover:bg-primary-subtle group-hover:text-primary">
                  <Icon aria-hidden="true" className="size-4" strokeWidth={1.8} />
                </span>
                <span className="mt-2 block truncate text-[11px] font-semibold text-text-strong">
                  {item.label}
                </span>
                <span className="mt-0.5 block truncate text-[9px] text-text-subtle">
                  {item.description}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-4 rounded-[11px] border border-primary/15 bg-primary-subtle/55 p-3">
          <div className="flex items-center gap-2 text-[11px] font-semibold text-primary">
            <Link2 aria-hidden="true" className="size-3.5" />
            Personalization ready
          </div>
          <p className="mt-1.5 text-[10px] leading-4 text-text-muted">
            Insert contact fields from the properties panel to make every message feel direct.
          </p>
        </div>
      </div>
    </aside>
  );
}
