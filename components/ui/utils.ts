export type ClassValue =
  | string
  | number
  | false
  | null
  | undefined
  | ClassValue[]
  | { [className: string]: boolean | null | undefined };

export function cn(...values: ClassValue[]): string {
  const classes: string[] = [];

  const append = (value: ClassValue): void => {
    if (!value) return;
    if (typeof value === "string" || typeof value === "number") {
      classes.push(String(value));
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(append);
      return;
    }
    Object.entries(value).forEach(([className, enabled]) => {
      if (enabled) classes.push(className);
    });
  };

  values.forEach(append);
  return classes.join(" ");
}

export function getInitials(name: string, limit = 2): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, limit)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat("ru-RU", {
    notation: value >= 1_000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}
