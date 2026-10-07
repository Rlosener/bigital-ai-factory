function extractMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === "string" ? error : "";
}

export function toUserFriendlyError(error: unknown, fallback = "İşlem şu anda tamamlanamadı."): string {
  const message = extractMessage(error)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const normalized = message.toLocaleLowerCase("tr-TR");

  if (!message) return fallback;
  if (/429|rate.?limit|usage limit|quota|insufficient_quota|resource_exhausted/.test(normalized)) {
    return "Bu bağlantının kullanım sınırına ulaşıldı. Bir süre sonra yeniden deneyin veya başka bir bağlantı seçin.";
  }
  if (/401|unauthori[sz]ed|invalid.*key|api key.*invalid|authentication/.test(normalized)) {
    return "Kimlik doğrulama başarısız. API anahtarını veya hesap bağlantısını kontrol edin.";
  }
  if (/403|forbidden|permission|scope/.test(normalized)) {
    return "Bu hesabın işlem için gerekli izni yok. Hesap yetkilerini kontrol edin.";
  }
  if (/timeout|timed out|aborterror/.test(normalized)) {
    return "Sağlayıcı zamanında yanıt vermedi. Bağlantıyı kontrol edip yeniden deneyin.";
  }
  if (/fetch failed|econn|network|socket|dns|upstream|502|503|504/.test(normalized)) {
    return "Sağlayıcıya şu anda ulaşılamıyor. İnternet bağlantısını ve sağlayıcı durumunu kontrol edin.";
  }
  if (/encryption|oauth_encryption_secret/.test(normalized)) {
    return "Hesap bilgileri güvenli biçimde saklanamıyor. OAuth şifreleme ayarını tamamlayın.";
  }
  if (/required|invalid|400/.test(normalized)) {
    return "Girilen bilgiler eksik veya geçersiz. Alanları kontrol edip yeniden deneyin.";
  }
  if (/404|not[_ -]?found/.test(normalized)) {
    return "İstenen kayıt bulunamadı. Sayfayı yenileyip yeniden deneyin.";
  }
  if (/500|internal server/.test(normalized)) {
    return "Sistem işlemi tamamlayamadı. Kısa bir süre sonra yeniden deneyin.";
  }

  return fallback;
}
