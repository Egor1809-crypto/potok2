export type EmailPatternCategory = "geometry" | "corners" | "lines" | "editorial";

export type EmailPatternPreset = {
  id: string;
  name: string;
  category: EmailPatternCategory;
  content: string;
  fontSize: number;
  letterSpacing: number;
};

export const emailPatternCategoryLabels: Record<EmailPatternCategory, string> = {
  geometry: "Геометрия",
  corners: "Углы и рамки",
  lines: "Линии и ритм",
  editorial: "Редакционные",
};

export const emailPatternPresets: EmailPatternPreset[] = [
  { id: "sparkles", name: "Искры", category: "geometry", content: "✦  ·  ✧  ·  ✦  ·  ✧  ·  ✦\n·  ✧  ·  ✦  ·  ✧  ·  ✦  ·", fontSize: 18, letterSpacing: 3 },
  { id: "dots", name: "Точки", category: "geometry", content: "•  ·  •  ·  •  ·  •  ·  •\n·  •  ·  •  ·  •  ·  •  ·", fontSize: 18, letterSpacing: 4 },
  { id: "grid", name: "Сетка", category: "geometry", content: "＋  ·  ＋  ·  ＋  ·  ＋\n·  ＋  ·  ＋  ·  ＋  ·", fontSize: 18, letterSpacing: 3 },
  { id: "diamonds", name: "Ромбы", category: "geometry", content: "◆  ◇  ◆  ◇  ◆  ◇  ◆\n◇  ◆  ◇  ◆  ◇  ◆  ◇", fontSize: 16, letterSpacing: 3 },
  { id: "checker", name: "Шахматы", category: "geometry", content: "■  □  ■  □  ■  □  ■\n□  ■  □  ■  □  ■  □", fontSize: 14, letterSpacing: 3 },
  { id: "rings", name: "Кольца", category: "geometry", content: "○  ◌  ○  ◌  ○  ◌  ○\n◌  ○  ◌  ○  ◌  ○  ◌", fontSize: 18, letterSpacing: 4 },
  { id: "orbit", name: "Орбиты", category: "geometry", content: "◜  ○  ◝    ◜  ○  ◝\n◟  ●  ◞    ◟  ●  ◞", fontSize: 18, letterSpacing: 3 },
  { id: "tiles", name: "Плитка", category: "geometry", content: "▣  ▢  ▣  ▢  ▣  ▢\n▢  ▣  ▢  ▣  ▢  ▣", fontSize: 16, letterSpacing: 4 },

  { id: "art-deco-corners", name: "Арт-деко", category: "corners", content: "┏━━ ◇ ━━━━━━━ ◇ ━━┓\n┗━━ ◇ ━━━━━━━ ◇ ━━┛", fontSize: 14, letterSpacing: 1 },
  { id: "soft-corners", name: "Мягкие углы", category: "corners", content: "╭─── · ───────── · ───╮\n╰─── · ───────── · ───╯", fontSize: 15, letterSpacing: 1 },
  { id: "brackets", name: "Скобки", category: "corners", content: "⌜          ✦          ⌝\n⌞          ✦          ⌟", fontSize: 20, letterSpacing: 2 },
  { id: "double-corners", name: "Двойные углы", category: "corners", content: "╔═══╗             ╔═══╗\n╚═══╝             ╚═══╝", fontSize: 14, letterSpacing: 1 },
  { id: "legal-corners", name: "Классика", category: "corners", content: "┌─ § ───────────── § ─┐\n└─ § ───────────── § ─┘", fontSize: 14, letterSpacing: 1 },
  { id: "petal-corners", name: "Лепестки", category: "corners", content: "❧                      ❧\n❧                      ❧", fontSize: 22, letterSpacing: 2 },
  { id: "tech-corners", name: "Техноуглы", category: "corners", content: "◩━╸                  ╺━◪\n◫━╸                  ╺━◧", fontSize: 17, letterSpacing: 2 },
  { id: "stamp-corners", name: "Марки", category: "corners", content: "◈ · · · · · · · · · ◈\n◈ · · · · · · · · · ◈", fontSize: 15, letterSpacing: 2 },

  { id: "waves", name: "Волны", category: "lines", content: "∿  ∿  ∿  ∿  ∿  ∿  ∿\n  ∿  ∿  ∿  ∿  ∿  ∿", fontSize: 20, letterSpacing: 5 },
  { id: "diagonal", name: "Диагонали", category: "lines", content: "╱  ╱  ╱  ╱  ╱  ╱  ╱\n  ╱  ╱  ╱  ╱  ╱  ╱", fontSize: 20, letterSpacing: 6 },
  { id: "dashes", name: "Штрихи", category: "lines", content: "—  ·  —  ·  —  ·  —\n·  —  ·  —  ·  —  ·", fontSize: 16, letterSpacing: 4 },
  { id: "zigzag", name: "Зигзаг", category: "lines", content: "⌁  ⌁  ⌁  ⌁  ⌁  ⌁  ⌁\n  ⌁  ⌁  ⌁  ⌁  ⌁  ⌁", fontSize: 21, letterSpacing: 5 },
  { id: "rail", name: "Рельсы", category: "lines", content: "━╋━╋━╋━╋━╋━╋━╋━\n─┿─┿─┿─┿─┿─┿─┿─", fontSize: 15, letterSpacing: 2 },
  { id: "steps", name: "Ступени", category: "lines", content: "▁ ▂ ▃ ▄ ▅ ▆ ▇ █\n█ ▇ ▆ ▅ ▄ ▃ ▂ ▁", fontSize: 14, letterSpacing: 3 },
  { id: "pulse", name: "Импульс", category: "lines", content: "──╮ ╭────╮ ╭────╮ ╭──\n  ╰─╯    ╰─╯    ╰─╯", fontSize: 16, letterSpacing: 1 },
  { id: "ribbon", name: "Лента", category: "lines", content: "━━━━━━ ◆ ━━━━━━ ◆ ━━━━━━\n      ◇       ◇", fontSize: 13, letterSpacing: 2 },

  { id: "petals", name: "Ботаника", category: "editorial", content: "✣  ✤  ✣  ✤  ✣  ✤  ✣\n✤  ✣  ✤  ✣  ✤  ✣  ✤", fontSize: 17, letterSpacing: 3 },
  { id: "confetti", name: "Конфетти", category: "editorial", content: "•  ✦  ╱  ◆  ·  ✧  ╲  •\n◆  ·  ╲  ✦  •  ╱  ✧  ·", fontSize: 16, letterSpacing: 3 },
  { id: "stars", name: "Созвездие", category: "editorial", content: "⋆       ✦    ·      ⋆\n   ·       ✧     ⋆", fontSize: 19, letterSpacing: 4 },
  { id: "quote-marks", name: "Кавычки", category: "editorial", content: "“  ”    ‘  ’    “  ”\n  ‘  ’    “  ”    ‘  ’", fontSize: 22, letterSpacing: 5 },
  { id: "paragraph", name: "Параграф", category: "editorial", content: "§   ·   ¶   ·   §   ·   ¶\n·   ¶   ·   §   ·   ¶   ·", fontSize: 18, letterSpacing: 4 },
  { id: "laurel", name: "Лавр", category: "editorial", content: "❮ ❮ ❮    ◇    ❯ ❯ ❯\n❮ ❮ ❮    ◇    ❯ ❯ ❯", fontSize: 16, letterSpacing: 3 },
  { id: "signal", name: "Сигнал", category: "editorial", content: "●  ◐  ◑  ○  ◐  ◑  ●\n○  ◑  ◐  ●  ◑  ◐  ○", fontSize: 17, letterSpacing: 3 },
  { id: "microprint", name: "Микропечать", category: "editorial", content: "MAIL · FLOW · MAIL · FLOW\nFLOW · MAIL · FLOW · MAIL", fontSize: 9, letterSpacing: 4 },
];
