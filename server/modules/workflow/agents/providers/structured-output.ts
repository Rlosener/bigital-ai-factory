const JSON_REQUEST = /yalnızca geçerli json|zorunlu çıktı şeması/i;

export function promptRequiresJsonOnly(prompt: string): boolean {
  return JSON_REQUEST.test(prompt);
}

export function agentSystemPrompt(projectPath: string, jsonOnly: boolean): string {
  if (!jsonOnly) {
    return `Sen bir yazılım geliştirme çalışanısın. Proje yolu: ${projectPath}. Görevi doğrudan uygula; kullanıcıya görünen açıklamaları kısa, net ve Türkçe yaz.`;
  }
  return [
    "Yanıtın yalnızca tek bir JSON nesnesi olsun.",
    "Markdown, açıklama cümlesi ve kod bloğu yazma.",
    "Şemadaki her alanı gerçek içerikle doldur.",
    "Belirtilmedi, TODO, TBD ve boş değer kullanma.",
    "Tarihler YYYY-MM-DD biçiminde olsun.",
    `Proje yolu: ${projectPath}.`,
  ].join(" ");
}

export function withJsonResponseFormat(body: Record<string, unknown>, jsonOnly: boolean): Record<string, unknown> {
  if (!jsonOnly) return body;
  return { ...body, response_format: { type: "json_object" } };
}

export function responseFormatRejected(status: number, body: string): boolean {
  return status === 400 && /response_format|json_object|responseMimeType|response_mime_type/i.test(body);
}
