import { redactFactoryText } from "../repository.ts";
import { normalizeFactoryError } from "../incidents.ts";

export function sanitizeGlobalExperience(value: string, privateNames: string[] = []): string {
  let text = normalizeFactoryError(redactFactoryText(value)).normalized_error;
  for (const name of privateNames) {
    const trimmed = name.trim();
    if (trimmed.length < 3) continue;
    text = text.replace(new RegExp(trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "<org>");
  }
  text = text.replace(/\b(?:[a-z0-9-]+\.)+[a-z]{2,}\b/gi, "<domain>");
  return text.replace(/\s+/g, " ").trim().slice(0, 2000);
}

export function isGeneralizable(value: string, privateNames: string[] = []): boolean {
  const stripped = sanitizeGlobalExperience(value, privateNames)
    .replace(/<(?:path|url|email|id|time|address|org|domain)>/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (stripped.length < 24) return false;
  const lowered = stripped.toLocaleLowerCase("en-US");
  return privateNames.every((name) => {
    const token = name.trim().toLocaleLowerCase("en-US");
    return token.length < 3 || !lowered.includes(token);
  });
}
