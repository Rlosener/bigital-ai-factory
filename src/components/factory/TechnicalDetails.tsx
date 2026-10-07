import type { ReactNode } from "react";
export default function TechnicalDetails({
  children,
  label = "Teknik detay",
}: {
  children: ReactNode;
  label?: string;
}) {
  return (
    <details className="factory-technical">
      <summary>{label}</summary>
      <div>{children}</div>
    </details>
  );
}
export function FactoryError({ error }: { error: string }) {
  const explanations: Record<string, string> = {
    project_path_not_found: "Proje klasörü sunucuda bulunamadı. Mevcut klasörün tam yolunu kontrol edin.",
    absolute_path_required: "Proje için sunucuda mevcut olan tam klasör yolunu yazın.",
    approval_already_resolved:
      "Bu onay daha önce sonuçlandırıldı. Çalışma alanını yenileyerek güncel kararı inceleyin.",
    delivery_not_ready: "Tüm çalışma adımları ve bağımsız inceleme tamamlanmadan çıktı onaylanamaz.",
    project_scope_changed: "Projenin işletme kapsamı değişti. Çalışma alanını yenileyin.",
    plan_state_changed: "Plan durumu başka bir işlemde değişti. Güncel planı inceleyin.",
    plan_approval_required:
      "Çalışma başlamadan önce plan için insan onayı gerekiyor. Onaylar bölümünden planı inceleyin.",
    knowledge_not_found: "Bilgi bu işletme ve proje kapsamında bulunamadı. Çalışma alanını yenileyin.",
    invalid_input: "Gönderilen bilgiler uygun değil. Formdaki alanları ve metin uzunluklarını kontrol edin.",
    secret_in_knowledge:
      "API anahtarlarını ve erişim bilgilerini bilgi tabanına kaydetmeyin. Entegrasyon ayarlarını kullanın.",
    controller_reset_running: "Bir görev hâlâ çalışıyor. Çalışma bitince veya durdurulunca kontrolü sıfırlayın.",
    controller_reset_unavailable: "Bu plan için sıfırlanacak bir kontrol durumu yok. Çalışma alanını yenileyin.",
    controller_state_changed: "Kontrol durumu başka bir işlemde değişti. Çalışma alanını yenileyin.",
    revision_note_required: "Revizyon için neyin değişmesi gerektiğini kısaca yazın.",
    revision_unavailable: "Revizyon yalnızca nihai çıktı onayında istenebilir.",
  };
  return (
    <div className="factory-error" role="alert">
      <p>
        {explanations[error] ||
          "İşlem tamamlanamadı. Bağlantıyı ve ilgili proje ayarlarını kontrol ederek tekrar deneyin."}
      </p>
      <TechnicalDetails>
        <pre>{error}</pre>
      </TechnicalDetails>
    </div>
  );
}
