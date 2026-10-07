export const statusLabels: Record<string, string> = {
  draft: "Taslak",
  blocked: "Engellendi",
  approved: "Onaylandı",
  running: "Çalışıyor",
  working: "Çalışıyor",
  awaiting_approval: "Onay bekliyor",
  completed: "Tamamlandı",
  failed: "Başarısız",
  rejected: "Reddedildi",
  revision_requested: "Revizyon istendi",
  pending: "Bekliyor",
  ready: "Hazır",
  review: "İnceleniyor",
  idle: "Hazır",
  done: "Tamamlandı",
  in_progress: "Çalışıyor",
  planned: "Planlandı",
  inbox: "Bekliyor",
  cancelled: "İptal edildi",
  open: "Açık",
  resolved: "Çözüldü",
  verified: "Doğrulandı",
  handled: "İşlendi",
  break: "Molada",
  offline: "Çevrimdışı",
};
export const riskLabels = { low: "Düşük", medium: "Orta", high: "Yüksek" };
export const workflowLabels = { software: "Yazılım geliştirme", product: "Ürün ve tasarım", social: "Sosyal medya" };
export const outputTypeLabels: Record<string, string> = {
  implementation: "Yazılım değişikliği",
  product: "Ürün ve MVP planı",
  social: "Sosyal medya içeriği",
  review: "Bağımsız inceleme",
  analysis: "Analiz",
  verification_failure: "Başarısız doğrulama",
  final: "Nihai teslim",
  prd: "Ürün gereksinimleri",
};
export function outputTypeLabel(value: string): string {
  return outputTypeLabels[value] || value.replaceAll("_", " ");
}
export function dateLabel(value: number): string {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Famagusta",
  }).format(value);
}
export function Status({ value }: { value: string }) {
  return (
    <span className={`factory-status factory-status--${value}`}>
      <span aria-hidden="true" />
      {statusLabels[value] || value}
    </span>
  );
}
