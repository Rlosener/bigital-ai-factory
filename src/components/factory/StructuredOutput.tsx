const fieldLabels: Record<string, string> = {
  title: "Başlık",
  headline: "Başlık",
  features: "Özellikler",
  technical_tasks: "Teknik görevler",
  prd: "Ürün gereksinimleri",
  mvp: "MVP kapsamı",
  backlog: "İş listesi",
  user_flows: "Kullanıcı akışları",
  data_model: "Veri modeli",
  users: "Hedef kullanıcılar",
  strategy: "Strateji",
  audience: "Hedef kitle",
  goal: "Hedef",
  visual_briefs: "Görsel brief'ler",
  brief: "Brief",
  content_id: "İçerik",
  kpis: "Başarı göstergeleri",
  review_notes: "İnceleme notları",
  findings: "Bulgular",
  summary: "Özet",
  problem: "Problem",
  solution: "Çözüm",
  goals: "Hedefler",
  target_audience: "Hedef kitle",
  targetAudience: "Hedef kitle",
  personas: "Personalar",
  requirements: "Gereksinimler",
  functional_requirements: "İşlevsel gereksinimler",
  non_functional_requirements: "Kalite gereksinimleri",
  acceptance_criteria: "Kabul kriterleri",
  acceptanceCriteria: "Kabul kriterleri",
  success_metrics: "Başarı ölçütleri",
  user_stories: "Kullanıcı senaryoları",
  scope: "Kapsam",
  out_of_scope: "Kapsam dışı",
  risks: "Riskler",
  assumptions: "Varsayımlar",
  open_questions: "Açık sorular",
  recommendations: "Öneriler",
  posts: "Gönderiler",
  items: "İçerikler",
  calendar: "İçerik takvimi",
  content_calendar: "İçerik takvimi",
  caption: "Açıklama",
  format: "İçerik türü",
  platform: "Platform",
  hashtags: "Hashtag'ler",
  date: "Tarih",
  time: "Saat",
  timezone: "Saat dilimi",
  hook: "Giriş",
  cta: "Aksiyon",
  objective: "Amaç",
  visual_brief: "Görsel brief",
  status: "Durum",
  evidence: "Kanıtlar",
  limitations: "Sınırlar",
  review: "İnceleme",
  verdict: "Karar",
  tests: "Testler",
  notes: "Notlar",
  steps: "Adımlar",
  priority: "Öncelik",
  description: "Açıklama",
  dependencies: "Bağımlılıklar",
  name: "Ad",
  content: "İçerik",
  type: "Tür",
  task_id: "Görev",
  version: "Sürüm",
  publish_ready: "Yayın hazırlığı",
  scheduled_at: "Planlanan tarih",
  reviewed: "İncelendi",
};
export default function StructuredOutput({ value, depth = 0 }: { value: unknown; depth?: number }) {
  if (value === null || value === undefined) return <span className="factory-muted">Belirtilmedi</span>;
  if (typeof value === "boolean") return <span>{value ? "Evet" : "Hayır"}</span>;
  if (typeof value !== "object") return <p className="factory-output-content">{String(value)}</p>;
  if (depth > 6) return <p className="factory-muted">Bu alanın ayrıntıları indirilen çıktı dosyasında yer alır.</p>;
  if (Array.isArray(value))
    return value.length ? (
      <ol className="factory-structured-list">
        {value.map((item, index) => (
          <li key={index}>
            <StructuredOutput value={item} depth={depth + 1} />
          </li>
        ))}
      </ol>
    ) : (
      <span className="factory-muted">Kayıt yok</span>
    );
  return (
    <dl className="factory-structured">
      {Object.entries(value).map(([key, item]) => (
        <div key={key}>
          <dt>{fieldLabels[key] || key.replaceAll("_", " ")}</dt>
          <dd>
            <StructuredOutput value={item} depth={depth + 1} />
          </dd>
        </div>
      ))}
    </dl>
  );
}
