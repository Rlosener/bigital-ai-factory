import { describe, expect, it } from "vitest";
import { toUserFriendlyError } from "./user-facing-errors";

describe("toUserFriendlyError", () => {
  it("kota ve kimlik doğrulama hatalarını kısa Türkçe açıklamaya çevirir", () => {
    expect(toUserFriendlyError(new Error("HTTP 429 insufficient_quota"))).toContain("kullanım sınırına ulaşıldı");
    expect(toUserFriendlyError(new Error("401 invalid API key"))).toContain("Kimlik doğrulama başarısız");
  });

  it("ağ hatasını teknik ayrıntı göstermeden açıklar", () => {
    const result = toUserFriendlyError(new Error("fetch failed: ECONNRESET socket closed"));
    expect(result).toBe("Sağlayıcıya şu anda ulaşılamıyor. İnternet bağlantısını ve sağlayıcı durumunu kontrol edin.");
    expect(result).not.toContain("ECONNRESET");
  });

  it("tanınmayan hata için verilen güvenli mesajı kullanır", () => {
    expect(toUserFriendlyError("provider exploded mysteriously", "Bağlantı testi tamamlanamadı.")).toBe(
      "Bağlantı testi tamamlanamadı.",
    );
  });
});
