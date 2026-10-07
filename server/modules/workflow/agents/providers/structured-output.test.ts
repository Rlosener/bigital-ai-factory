import { describe, expect, it } from "vitest";
import {
  agentSystemPrompt,
  promptRequiresJsonOnly,
  responseFormatRejected,
  withJsonResponseFormat,
} from "./structured-output.ts";

describe("structured API output", () => {
  it("detects a factory schema request and asks for raw JSON", () => {
    const prompt = "Son yanıtın yalnızca geçerli JSON olsun. Zorunlu çıktı şeması: {}";
    expect(promptRequiresJsonOnly(prompt)).toBe(true);
    expect(agentSystemPrompt("/work", true)).toContain("yalnızca tek bir JSON");
    expect(agentSystemPrompt("/work", true)).not.toContain("açıklamaları kısa");
    expect(agentSystemPrompt("/work", false)).toContain("açıklamaları kısa");
  });

  it("adds JSON mode only for schema requests and recognizes providers that reject it", () => {
    expect(withJsonResponseFormat({ model: "gpt-3.5-turbo" }, true).response_format).toEqual({
      type: "json_object",
    });
    expect(withJsonResponseFormat({ model: "gpt-3.5-turbo" }, false).response_format).toBeUndefined();
    expect(responseFormatRejected(400, "Unsupported response_format")).toBe(true);
    expect(responseFormatRejected(429, "response_format")).toBe(false);
  });
});
