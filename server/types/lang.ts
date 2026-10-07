export type Lang = "tr" | "ko" | "en" | "ja" | "zh";

export const SUPPORTED_LANGS: readonly Lang[] = ["tr", "ko", "en", "ja", "zh"] as const;

export type LocalizedLines = Record<Exclude<Lang, "tr">, string[]> & { tr?: string[] };

export function isLang(value: unknown): value is Lang {
  return typeof value === "string" && SUPPORTED_LANGS.includes(value as Lang);
}
