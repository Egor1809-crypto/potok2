export type PresentationPatternFamily =
  | "smart"
  | "clean"
  | "gradient"
  | "organic"
  | "architecture"
  | "geometry"
  | "editorial"
  | "premium"
  | "texture"
  | "playful"
  | "technology"
  | "celebration";

export const presentationPatternCatalog = [
  { id: "auto", label: "По композиции", category: "Умный", family: "smart" },
  { id: "none", label: "Без узора", category: "Чистый", family: "clean" },
  { id: "aurora-mesh", label: "Аврора", category: "Градиент", family: "gradient" },
  { id: "gradient-orbs", label: "Градиентные сферы", category: "Градиент", family: "gradient" },
  { id: "ribbons", label: "Ленты", category: "Градиент", family: "gradient" },
  { id: "waves", label: "Волны", category: "Органика", family: "organic" },
  { id: "topography", label: "Топография", category: "Органика", family: "organic" },
  { id: "contour-flow", label: "Контурный поток", category: "Органика", family: "organic" },
  { id: "japanese-waves", label: "Японская волна", category: "Органика", family: "organic" },
  { id: "flower-lattice", label: "Цветочная решётка", category: "Органика", family: "organic" },
  { id: "scales", label: "Чешуя", category: "Органика", family: "organic" },
  { id: "organic-cells", label: "Органические ячейки", category: "Органика", family: "organic" },
  { id: "archways", label: "Арки", category: "Архитектура", family: "architecture" },
  { id: "fan-arches", label: "Веерные арки", category: "Архитектура", family: "architecture" },
  { id: "orbit", label: "Орбита", category: "Геометрия", family: "geometry" },
  { id: "soft-grid", label: "Мягкая сетка", category: "Геометрия", family: "geometry" },
  { id: "checker-soft", label: "Шахматный ритм", category: "Геометрия", family: "geometry" },
  { id: "diagonal", label: "Диагональ", category: "Геометрия", family: "geometry" },
  { id: "isometric-cubes", label: "Изометрические кубы", category: "Геометрия", family: "geometry" },
  { id: "herringbone", label: "Ёлочка", category: "Геометрия", family: "geometry" },
  { id: "hexagon-net", label: "Сотовая сеть", category: "Геометрия", family: "geometry" },
  { id: "diamond-grid", label: "Ромбическая сетка", category: "Геометрия", family: "geometry" },
  { id: "bauhaus", label: "Баухаус", category: "Геометрия", family: "geometry" },
  { id: "sunburst", label: "Солнечные лучи", category: "Акцент", family: "celebration" },
  { id: "star-field", label: "Звёздное поле", category: "Акцент", family: "celebration" },
  { id: "editorial-lines", label: "Редакционные линии", category: "Деловой", family: "editorial" },
  { id: "plaid", label: "Тонкая клетка", category: "Деловой", family: "editorial" },
  { id: "barcode", label: "Штриховой ритм", category: "Деловой", family: "editorial" },
  { id: "gold-frame", label: "Тонкая рамка", category: "Премиум", family: "premium" },
  { id: "frame-corners", label: "Угловая рамка", category: "Премиум", family: "premium" },
  { id: "monogram", label: "Монограммный ритм", category: "Премиум", family: "premium" },
  { id: "paper-grain", label: "Бумага", category: "Фактура", family: "texture" },
  { id: "halftone", label: "Полутон", category: "Фактура", family: "texture" },
  { id: "micro-dots", label: "Микроточки", category: "Фактура", family: "texture" },
  { id: "crosshatch", label: "Перекрёстная штриховка", category: "Фактура", family: "texture" },
  { id: "noise-fade", label: "Мягкое зерно", category: "Фактура", family: "texture" },
  { id: "confetti", label: "Конфетти", category: "Игривый", family: "playful" },
  { id: "terrazzo", label: "Терраццо", category: "Игривый", family: "playful" },
  { id: "memphis", label: "Мемфис", category: "Игривый", family: "playful" },
  { id: "circuit-board", label: "Печатная плата", category: "Технологии", family: "technology" },
  { id: "constellation", label: "Созвездие данных", category: "Технологии", family: "technology" },
  { id: "data-stream", label: "Поток данных", category: "Технологии", family: "technology" },
  { id: "tessellated-plus", label: "Мозаика плюсов", category: "Геометрия", family: "geometry" },
  { id: "stair-steps", label: "Ступени роста", category: "Геометрия", family: "geometry" },
  { id: "nested-squares", label: "Вложенные квадраты", category: "Геометрия", family: "geometry" },
  { id: "split-circles", label: "Разделённые круги", category: "Геометрия", family: "geometry" },
  { id: "wave-ribbon", label: "Волновая лента", category: "Органика", family: "organic" },
  { id: "leaf-canopy", label: "Крона листьев", category: "Органика", family: "organic" },
  { id: "bubble-chain", label: "Цепочка сфер", category: "Органика", family: "organic" },
  { id: "pinstripe", label: "Тонкая полоска", category: "Деловой", family: "editorial" },
  { id: "blueprint-grid", label: "Чертёжная сетка", category: "Технологии", family: "technology" },
  { id: "radar-sweep", label: "Радар", category: "Технологии", family: "technology" },
  { id: "mosaic-tiles", label: "Мозаичная плитка", category: "Фактура", family: "texture" },
  { id: "woven-lines", label: "Тканые линии", category: "Фактура", family: "texture" },
  { id: "zigzag", label: "Зигзаг", category: "Геометрия", family: "geometry" },
  { id: "solar-orbit", label: "Солнечная орбита", category: "Акцент", family: "celebration" },
  { id: "pixel-grid", label: "Пиксельная матрица", category: "Технологии", family: "technology" },
  { id: "prism-facets", label: "Грани призмы", category: "Градиент", family: "gradient" },
  { id: "ink-blobs", label: "Чернильные пятна", category: "Органика", family: "organic" },
  { id: "rope-knot", label: "Связующий узел", category: "Премиум", family: "premium" },
  { id: "snowfall", label: "Снежный ритм", category: "Акцент", family: "celebration" },
  { id: "festival-flags", label: "Фестивальные флаги", category: "Игривый", family: "playful" },
  { id: "stacked-arches", label: "Каскад арок", category: "Архитектура", family: "architecture" },
  { id: "network-nodes", label: "Сеть узлов", category: "Технологии", family: "technology" },
] as const satisfies ReadonlyArray<{
  id: string;
  label: string;
  category: string;
  family: PresentationPatternFamily;
}>;

export type PresentationPatternId =
  (typeof presentationPatternCatalog)[number]["id"];

export function presentationPatternDefinition(id: PresentationPatternId) {
  return presentationPatternCatalog.find((pattern) => pattern.id === id)!;
}

export const presentationPatternIds = presentationPatternCatalog.map(
  (pattern) => pattern.id,
) as PresentationPatternId[];
