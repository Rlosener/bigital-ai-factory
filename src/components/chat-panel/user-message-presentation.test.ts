import { describe, expect, it } from "vitest";
import { presentChatMessage } from "./user-message-presentation";

describe("presentChatMessage", () => {
  it("ham kota hatasını kısa Türkçe açıklamaya çevirir", () => {
    const content = 'Antigravity API error (429): {"status":"RESOURCE_EXHAUSTED"}';
    const result = presentChatMessage(content, "tr-TR");
    expect(result).toContain("kullanım sınırına ulaşıldı");
    expect(result).not.toContain("RESOURCE_EXHAUSTED");
    expect(result).not.toContain("429");
  });

  it("teknik dal bilgisini gizleyip çalışma durumunu Türkçeleştirir", () => {
    expect(presentChatMessage("Alex started work on 'Webhook'. (isolated branch: bigital/abc123)", "tr-TR")).toBe(
      "Alex, “Webhook” görevi üzerinde çalışmaya başladı.",
    );
  });

  it("diğer dillerde kayıt içeriğini değiştirmez", () => {
    const content = "Task 'Webhook' failed (exit code: 1).";
    expect(presentChatMessage(content, "en-US")).toBe(content);
  });

  it("eski rapor yönlendirmesindeki yabancı sistem metnini gizler", () => {
    const content = "[REPORT ROUTING] Assigned '보고 자료(PPT) 작성: naber' to Atlas (codex). Output format: PPT";
    const result = presentChatMessage(content, "tr-TR");
    expect(result).toBe("Rapor görevi uygun AI çalışana atandı.");
    expect(result).not.toMatch(/[\uac00-\ud7af]/);
  });
});
