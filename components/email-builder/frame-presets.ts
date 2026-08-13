export type EmailFrameStyle =
  | "none"
  | "hairline"
  | "accent"
  | "double"
  | "dashed"
  | "top-bottom"
  | "left-band"
  | "soft"
  | "capsule"
  | "stamp"
  | "offset"
  | "inset"
  | "top-accent"
  | "bottom-accent"
  | "right-band"
  | "editorial"
  | "ticket"
  | "window"
  | "railway"
  | "archive"
  | "corner-cut"
  | "top-ribbon"
  | "side-lines"
  | "luxury"
  | "blueprint"
  | "poster"
  | "postcard"
  | "focus";

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
  { id: "capsule", name: "Капсула", description: "Очень мягкие углы", radius: 32 },
  { id: "stamp", name: "Штамп", description: "Контур с отрывным краем", radius: 2 },
  { id: "offset", name: "Смещение", description: "Графическая тень-конверт", radius: 14 },
  { id: "inset", name: "Внутренний контур", description: "Рамка внутри рамки", radius: 18 },
  { id: "top-accent", name: "Шапка", description: "Акцент только сверху", radius: 14 },
  { id: "bottom-accent", name: "Финальная линия", description: "Акцент внизу письма", radius: 14 },
  { id: "right-band", name: "Полоса справа", description: "Асимметричный контур", radius: 4 },
  { id: "editorial", name: "Редакционная", description: "Тонкий контур и акцент", radius: 0 },
  { id: "ticket", name: "Билет", description: "Пунктир и боковые метки", radius: 12 },
  { id: "window", name: "Окно", description: "Двойной внутренний край", radius: 18 },
  { id: "railway", name: "Рельсы", description: "Две боковые полосы", radius: 0 },
  { id: "archive", name: "Архив", description: "Карточка с корешком", radius: 2 },
  { id: "corner-cut", name: "Срезанные углы", description: "Графичный внешний контур", radius: 0 },
  { id: "top-ribbon", name: "Лента сверху", description: "Акцент и нижняя линия", radius: 16 },
  { id: "side-lines", name: "Боковые линии", description: "Вертикальная симметрия", radius: 0 },
  { id: "luxury", name: "Премиальная", description: "Двойной тонкий кант", radius: 10 },
  { id: "blueprint", name: "Чертёж", description: "Технический пунктир", radius: 0 },
  { id: "poster", name: "Постер", description: "Толстый контрастный край", radius: 0 },
  { id: "postcard", name: "Открытка", description: "Мягкий край и смещение", radius: 22 },
  { id: "focus", name: "Фокус", description: "Акцентные верх и низ", radius: 8 },
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
  if (style === "capsule") return { ...base, border: `2px solid ${color}`, boxShadow: `inset 0 0 0 5px ${color}12` };
  if (style === "stamp") return { ...base, border: `3px dotted ${color}`, outline: `1px solid ${color}` };
  if (style === "offset") return { ...base, border: `2px solid ${color}`, boxShadow: `9px 9px 0 ${color}` };
  if (style === "inset") return { ...base, border: `1px solid ${color}`, boxShadow: `inset 0 0 0 6px ${color}18` };
  if (style === "top-accent") return { ...base, border: `1px solid ${color}55`, borderTop: `10px solid ${color}` };
  if (style === "bottom-accent") return { ...base, border: `1px solid ${color}55`, borderBottom: `10px solid ${color}` };
  if (style === "right-band") return { ...base, borderRight: `8px solid ${color}` };
  if (style === "editorial") return { ...base, border: `1px solid ${color}`, borderTop: `5px double ${color}`, borderBottom: `5px double ${color}` };
  if (style === "ticket") return { ...base, border: `2px dashed ${color}`, borderLeft: `7px dotted ${color}`, borderRight: `7px dotted ${color}` };
  if (style === "window") return { ...base, border: `2px solid ${color}`, outline: `5px solid ${color}20`, outlineOffset: `-10px` };
  if (style === "railway") return { ...base, borderLeft: `4px double ${color}`, borderRight: `4px double ${color}` };
  if (style === "archive") return { ...base, border: `1px solid ${color}`, borderLeft: `14px solid ${color}`, boxShadow: `inset 5px 0 0 ${color}22` };
  if (style === "corner-cut") return { ...base, border: `3px solid ${color}`, boxShadow: `6px 6px 0 ${color}33` };
  if (style === "top-ribbon") return { ...base, border: `1px solid ${color}55`, borderTop: `14px solid ${color}`, borderBottom: `3px solid ${color}` };
  if (style === "side-lines") return { ...base, borderLeft: `2px solid ${color}`, borderRight: `2px solid ${color}` };
  if (style === "luxury") return { ...base, border: `3px double ${color}`, boxShadow: `inset 0 0 0 3px ${color}1F` };
  if (style === "blueprint") return { ...base, border: `1px dashed ${color}`, boxShadow: `inset 0 0 0 4px ${color}18` };
  if (style === "poster") return { ...base, border: `6px solid ${color}` };
  if (style === "postcard") return { ...base, border: `1px solid ${color}`, boxShadow: `7px 9px 0 ${color}24` };
  if (style === "focus") return { ...base, borderTop: `8px solid ${color}`, borderBottom: `8px solid ${color}`, boxShadow: `inset 0 0 0 1px ${color}44` };
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
  if (style === "capsule") return `${base}border:2px solid ${color};box-shadow:inset 0 0 0 5px ${color}12;`;
  if (style === "stamp") return `${base}border:3px dotted ${color};outline:1px solid ${color};`;
  if (style === "offset") return `${base}border:2px solid ${color};box-shadow:9px 9px 0 ${color};`;
  if (style === "inset") return `${base}border:1px solid ${color};box-shadow:inset 0 0 0 6px ${color}18;`;
  if (style === "top-accent") return `${base}border:1px solid ${color}55;border-top:10px solid ${color};`;
  if (style === "bottom-accent") return `${base}border:1px solid ${color}55;border-bottom:10px solid ${color};`;
  if (style === "right-band") return `${base}border-right:8px solid ${color};`;
  if (style === "editorial") return `${base}border:1px solid ${color};border-top:5px double ${color};border-bottom:5px double ${color};`;
  if (style === "ticket") return `${base}border:2px dashed ${color};border-left:7px dotted ${color};border-right:7px dotted ${color};`;
  if (style === "window") return `${base}border:7px double ${color};`;
  if (style === "railway") return `${base}border-left:4px double ${color};border-right:4px double ${color};`;
  if (style === "archive") return `${base}border:1px solid ${color};border-left:14px solid ${color};`;
  if (style === "corner-cut") return `${base}border:3px solid ${color};box-shadow:6px 6px 0 ${color}33;`;
  if (style === "top-ribbon") return `${base}border:1px solid ${color}55;border-top:14px solid ${color};border-bottom:3px solid ${color};`;
  if (style === "side-lines") return `${base}border-left:2px solid ${color};border-right:2px solid ${color};`;
  if (style === "luxury") return `${base}border:3px double ${color};`;
  if (style === "blueprint") return `${base}border:1px dashed ${color};`;
  if (style === "poster") return `${base}border:6px solid ${color};`;
  if (style === "postcard") return `${base}border:1px solid ${color};box-shadow:7px 9px 0 ${color}24;`;
  if (style === "focus") return `${base}border-top:8px solid ${color};border-bottom:8px solid ${color};`;
  return base;
}
