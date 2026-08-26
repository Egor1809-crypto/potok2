export type TemplateCategory =
  | "Business"
  | "Events"
  | "Outreach"
  | "Newsletter"
  | "Follow-up"
  | "Transactional";

export type EmailBlockType =
  | "logo"
  | "heading"
  | "text"
  | "image"
  | "button"
  | "columns"
  | "divider"
  | "spacer"
  | "social"
  | "footer"
  | "hero"
  | "quote"
  | "checklist"
  | "stats"
  | "product"
  | "signature"
  | "pattern"
  | "banner"
  | "timeline"
  | "faq"
  | "coupon"
  | "video"
  | "notice"
  | "comparison"
  | "document"
  | "compliance";

export interface EmailBlock {
  id: string;
  type: EmailBlockType;
  content: string;
  alignment?: "left" | "center" | "right";
  href?: string;
  linkHref?: string;
  label?: string;
  paddingTop?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  paddingRight?: number;
  backgroundColor?: string;
  textColor?: string;
  accentColor?: string;
  fontSize?: number;
  borderRadius?: number;
  fontFamily?: "Arial" | "Georgia" | "Verdana" | "Trebuchet MS";
  fontWeight?: 400 | 500 | 600 | 700;
  lineHeight?: number;
  letterSpacing?: number;
  borderWidth?: number;
  borderColor?: string;
  widthPercent?: number;
  buttonStyle?: "solid" | "outline" | "soft";
}

export interface EmailTemplate {
  id: string;
  name: string;
  category: TemplateCategory;
  description: string;
  subject: string;
  previewText: string;
  accentColor: string;
  backgroundColor: string;
  bodyBackground?: string;
  backgroundImageUrl?: string;
  contentWidth?: number;
  frameStyle?: "none" | "hairline" | "accent" | "double" | "dashed" | "top-bottom" | "left-band" | "soft" | "capsule" | "stamp" | "offset" | "inset" | "top-accent" | "bottom-accent" | "right-band" | "editorial" | "ticket" | "window" | "railway" | "archive" | "corner-cut" | "top-ribbon" | "side-lines" | "luxury" | "blueprint" | "poster" | "postcard" | "focus" | "inner-rule" | "editorial-corner" | "spine-double" | "marquee" | "notebook" | "gallery-mat" | "terminal" | "legal-docket" | "festive-thread" | "wave-edge" | "minimalist-lift" | "embossed";
  frameColor?: string;
  frameRadius?: number;
  thumbnailVariant: "editorial" | "minimal" | "bold" | "classic";
  blocks: EmailBlock[];
  isFavorite: boolean;
  updatedAt: string;
}
