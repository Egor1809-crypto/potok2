export type EmailFrameStyle =
  | "none"
  | "hairline"
  | "accent"
  | "double"
  | "dashed"
  | "top-bottom"
  | "left-band"
  | "soft";

export type EmailFramePreset = {
  id: EmailFrameStyle;
  name: string;
  description: string;
  radius: number;
};

export const emailFramePresets: EmailFramePreset[] = [
  { id: "none", name: "Без рамки", description: "Чистый край", radius: 0 },
  { id: "hairline", name: "Тонкая", description: "Лёгкий контур", radius: 6 },
  { id: "accent", name: "Акцент", description: "Выразительная рамка", radius: 12 },
  { id: "double", name: "Двойная", description: "Классическая окантовка", radius: 8 },
  { id: "dashed", name: "Пунктир", description: "Живая графика", radius: 14 },
  { id: "top-bottom", name: "Линии", description: "Сверху и снизу", radius: 0 },
  { id: "left-band", name: "Корешок", description: "Цветная полоса слева", radius: 4 },
  { id: "soft", name: "Мягкая", description: "Тонкая округлая рамка", radius: 20 },
];

export function emailFrameCss(style: EmailFrameStyle, color: string, radius: number) {
  const base = { borderRadius: `${radius}px` };
  if (style === "hairline") return { ...base, border: `1px solid ${color}` };
  if (style === "accent") return { ...base, border: `3px solid ${color}` };
  if (style === "double") return { ...base, border: `4px double ${color}` };
  if (style === "dashed") return { ...base, border: `2px dashed ${color}` };
  if (style === "top-bottom") return { ...base, borderTop: `4px solid ${color}`, borderBottom: `4px solid ${color}` };
  if (style === "left-band") return { ...base, borderLeft: `8px solid ${color}` };
  if (style === "soft") return { ...base, border: `1px solid ${color}`, boxShadow: `0 10px 30px ${color}20` };
  return base;
}

export function emailFrameInlineCss(style: EmailFrameStyle, color: string, radius: number) {
  const base = `border-radius:${radius}px;`;
  if (style === "hairline") return `${base}border:1px solid ${color};`;
  if (style === "accent") return `${base}border:3px solid ${color};`;
  if (style === "double") return `${base}border:4px double ${color};`;
  if (style === "dashed") return `${base}border:2px dashed ${color};`;
  if (style === "top-bottom") return `${base}border-top:4px solid ${color};border-bottom:4px solid ${color};`;
  if (style === "left-band") return `${base}border-left:8px solid ${color};`;
  if (style === "soft") return `${base}border:1px solid ${color};box-shadow:0 10px 30px ${color}20;`;
  return base;
}
