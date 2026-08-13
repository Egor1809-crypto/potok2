export type EmailPatternCategory = "geometry" | "corners" | "lines" | "editorial" | "botanical" | "retro" | "digital" | "celebration";

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
  botanical: "Ботанические",
  retro: "Ретро и печать",
  digital: "Цифровые",
  celebration: "Праздничные",
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

  { id: "vine", name: "Вьюнок", category: "botanical", content: "❦───❧     ❦───❧     ❦\n  ❧───❦     ❧───❦", fontSize: 18, letterSpacing: 2 },
  { id: "olive", name: "Олива", category: "botanical", content: "❮❮  ❮❮  ◇  ❯❯  ❯❯\n❮❮  ❮❮  ◇  ❯❯  ❯❯", fontSize: 17, letterSpacing: 2 },
  { id: "fern", name: "Папоротник", category: "botanical", content: "⌇❧⌇❧⌇❧⌇❧⌇\n❧⌇❧⌇❧⌇❧⌇❧", fontSize: 17, letterSpacing: 3 },
  { id: "meadow", name: "Луг", category: "botanical", content: "⚘  ·  ⚘  ✿  ⚘  ·  ⚘\n  ✿  ⚘  ·  ⚘  ✿", fontSize: 18, letterSpacing: 3 },
  { id: "seeds", name: "Семена", category: "botanical", content: "˙  °  ·  ˚  °  ·  ˙  ˚\n  ·  ˚  ˙  °  ·  ˚", fontSize: 20, letterSpacing: 5 },
  { id: "branches", name: "Ветви", category: "botanical", content: "╱❯╱❯╱❯    ❮╲❮╲❮╲\n❮╲❮╲❮╲    ╱❯╱❯╱❯", fontSize: 16, letterSpacing: 2 },
  { id: "herbarium", name: "Гербарий", category: "botanical", content: "№ 01  ❧  № 02  ❧  № 03\nFOLIA  ·  HERBARIUM", fontSize: 11, letterSpacing: 3 },
  { id: "garden-gate", name: "Садовая арка", category: "botanical", content: "❦ ╭────────────╮ ❦\n❧ ╰────────────╯ ❧", fontSize: 15, letterSpacing: 1 },

  { id: "sunburst", name: "Солнечные лучи", category: "retro", content: "╲  │  ╱   ●   ╲  │  ╱\n╱  │  ╲   ●   ╱  │  ╲", fontSize: 18, letterSpacing: 3 },
  { id: "pop-art", name: "Поп-арт", category: "retro", content: "●!  ◆!  ★!  ●!  ◆!\n★!  ●!  ◆!  ★!  ●!", fontSize: 17, letterSpacing: 3 },
  { id: "postage", name: "Почтовые марки", category: "retro", content: "▥  ·  ▥  ·  ▥  ·  ▥\nAIR MAIL  /  PRIORITY", fontSize: 12, letterSpacing: 3 },
  { id: "typewriter", name: "Печатная машинка", category: "retro", content: "x x x  FILE 026  x x x\n---------------------", fontSize: 11, letterSpacing: 2 },
  { id: "film-strip", name: "Киноплёнка", category: "retro", content: "▣ ▣ ▣ ▣ ▣ ▣ ▣ ▣ ▣\n■  FRAME 026  TAKE 01  ■", fontSize: 11, letterSpacing: 2 },
  { id: "disco", name: "Диско", category: "retro", content: "◩  ◪  ◫  ◧  ◩  ◪\n  ✦  ◫  ✦  ◧  ✦", fontSize: 18, letterSpacing: 4 },
  { id: "western", name: "Вестерн", category: "retro", content: "★━━━━━━  WANTED  ━━━━━★\n◆       EST. 2026       ◆", fontSize: 12, letterSpacing: 2 },
  { id: "mid-century", name: "Мид-сенчури", category: "retro", content: "◒  ◓  ◐  ◑  ◒  ◓\n◆  ▰  ●  ◆  ▰  ●", fontSize: 18, letterSpacing: 4 },

  { id: "binary", name: "Двоичный код", category: "digital", content: "0101  1100  0011  1010\n1010  0011  1100  0101", fontSize: 10, letterSpacing: 3 },
  { id: "terminal", name: "Терминал", category: "digital", content: "> SIGNAL_READY_\n[██████████] 100%", fontSize: 11, letterSpacing: 2 },
  { id: "circuit", name: "Микросхема", category: "digital", content: "○─┬─●──┬──○─┬─●\n  └─○  └─●  └─○", fontSize: 16, letterSpacing: 2 },
  { id: "pixel", name: "Пиксели", category: "digital", content: "▪▪  ▫▫  ▪▫  ▫▪  ▪▪\n▫▪  ▪▫  ▫▫  ▪▪  ▫▪", fontSize: 16, letterSpacing: 3 },
  { id: "radar", name: "Радар", category: "digital", content: "◉  ◌  ◎  ◌  ◉\nSCAN  ·  LOCK  ·  LIVE", fontSize: 14, letterSpacing: 4 },
  { id: "data-stream", name: "Поток данных", category: "digital", content: "A01→B02→C03→D04\nD04←C03←B02←A01", fontSize: 11, letterSpacing: 2 },
  { id: "code-brackets", name: "Кодовые скобки", category: "digital", content: "{  [  <  /  >  ]  }\n</>  {}  []  </>", fontSize: 17, letterSpacing: 4 },
  { id: "matrix", name: "Матрица", category: "digital", content: "01 · 10 · 11 · 00 · 01\n10 · 01 · 00 · 11 · 10", fontSize: 11, letterSpacing: 3 },

  { id: "fireworks", name: "Фейерверк", category: "celebration", content: "✦ ＊ ✧ ＊ ✦ ＊ ✧\n  ✧ ＊ ✦ ＊ ✧ ＊", fontSize: 20, letterSpacing: 4 },
  { id: "streamers", name: "Серпантин", category: "celebration", content: "⌁╲⌁╱⌁╲⌁╱⌁╲⌁\n╱⌁╲⌁╱⌁╲⌁╱⌁", fontSize: 19, letterSpacing: 3 },
  { id: "medals", name: "Медали", category: "celebration", content: "◎  ★  ◎  ★  ◎  ★\nWINNER  ·  2026", fontSize: 15, letterSpacing: 4 },
  { id: "gift-ribbon", name: "Подарочная лента", category: "celebration", content: "━━━━━━╋━━━━━━╋━━━━━━\n      ◇      ◇", fontSize: 14, letterSpacing: 2 },
  { id: "champagne", name: "Брызги", category: "celebration", content: "°  ˚  ✦  °  ·  ˚  ✧\n  ✧  ·  °  ✦  ˚", fontSize: 20, letterSpacing: 5 },
  { id: "spotlight", name: "Софиты", category: "celebration", content: "╲   ╲   ★   ╱   ╱\n  ╲   WINNER   ╱", fontSize: 17, letterSpacing: 3 },
  { id: "laurel-award", name: "Награда", category: "celebration", content: "❮❮❮   ★   ❯❯❯\n   AWARD  /  026", fontSize: 15, letterSpacing: 3 },
  { id: "party-grid", name: "Праздничная сетка", category: "celebration", content: "▲  ●  ■  ✦  ▲  ●\n✦  ■  ●  ▲  ✦  ■", fontSize: 17, letterSpacing: 4 },
];
