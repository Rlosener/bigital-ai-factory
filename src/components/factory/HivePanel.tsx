import type { FactoryWorkspace } from "../../../shared/factory";
import { EmptyState } from "./FactoryPanels";
import TechnicalDetails from "./TechnicalDetails";
import { dateLabel, Status } from "./presentation";

const sectionNames: Record<string, string> = {
  current_objective: "Güncel hedef",
  active_plan: "Aktif plan",
  shared_finding: "Ortak bulgular",
  blocker: "Engeller",
  decision: "Kararlar",
  deliverable: "Çıktı bağlamı",
};
const messageNames: Record<string, string> = {
  review_feedback: "İnceleme geri bildirimi iletildi",
  request: "Çalışma talebi iletildi",
  inform: "Bilgi paylaşıldı",
  done: "Çalışma sonucu iletildi",
};

export default function HivePanel({ workspace }: { workspace: FactoryWorkspace }) {
  const names = new Map(workspace.agents.map((agent) => [agent.id, agent.name]));
  const pending = workspace.mailbox.filter((message) => message.status === "pending").length;
  const handled = workspace.mailbox.filter((message) => message.status === "handled").length;
  return (
    <section className="factory-hive">
      <div className="factory-section-heading">
        <div>
          <h2>Ortak Alan · Proje çalışma bağlamı</h2>
          <p className="factory-muted">
            AI Yönetici ve uzmanların bu işletme/proje kapsamında paylaştığı bilgiler ve koordinasyon kayıtları.
          </p>
        </div>
      </div>
      <div className="factory-hive-summary">
        <div>
          <span>Ortak bilgi</span>
          <strong>{workspace.blackboard.length}</strong>
        </div>
        <div>
          <span>Bekleyen ileti</span>
          <strong>{pending}</strong>
        </div>
        <div>
          <span>İşlenen ileti</span>
          <strong>{handled}</strong>
        </div>
      </div>
      <h3>Ortak bilgi panosu</h3>
      {workspace.blackboard.length === 0 && (
        <EmptyState
          title="Henüz ortak çalışma bilgisi yok"
          description="Güncel hedef, plan, bulgular, engeller ve kararlar çalışma ilerledikçe burada görünür."
        />
      )}
      {workspace.blackboard.map((entry) => (
        <article className={`factory-hive-entry factory-hive-entry--${entry.section}`} key={entry.id}>
          <div className="factory-section-heading">
            <h3>{sectionNames[entry.section] || entry.section}</h3>
            <span className="factory-muted">Sürüm {entry.version}</span>
          </div>
          <p className="factory-output-content">{entry.content.summary}</p>
          {entry.content.items.length > 0 && (
            <ul className="factory-evidence">
              {entry.content.items.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          )}
          <p className="factory-muted">{dateLabel(entry.updated_at)}</p>
          {entry.content.references.length > 0 && (
            <TechnicalDetails label="Bağlam referansları">
              {entry.content.references.map((reference, index) => (
                <p key={index}>{reference}</p>
              ))}
            </TechnicalDetails>
          )}
        </article>
      ))}
      <div className="factory-section-heading factory-hive-mailbox-heading">
        <div>
          <h3>Uzmanlar arası koordinasyon</h3>
          <p className="factory-muted">İç koordinasyon mesajları kullanıcı sohbetine eklenmez.</p>
        </div>
      </div>
      {workspace.mailbox.length === 0 && (
        <EmptyState
          title="Henüz koordinasyon kaydı yok"
          description="Uzmanlar arasında görev ve inceleme bilgileri paylaşıldığında bu kapsamda görünür."
        />
      )}
      <ol className="factory-timeline">
        {workspace.mailbox.map((message) => (
          <li key={message.id}>
            <time>{dateLabel(message.created_at)}</time>
            <div>
              <div className="factory-section-heading">
                <strong>{messageNames[message.kind] || "Koordinasyon bilgisi iletildi"}</strong>
                <Status value={message.status} />
              </div>
              <p>
                {message.sender_agent_id ? names.get(message.sender_agent_id) || "Uzman" : "AI Yönetici"} →{" "}
                {names.get(message.recipient_agent_id) || "Uzman"}
              </p>
              <TechnicalDetails label="İç koordinasyon ayrıntıları">
                <p>{message.content.summary}</p>
                {message.content.items.length > 0 && (
                  <ul className="factory-evidence">
                    {message.content.items.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                )}
                {message.content.references.map((reference, index) => (
                  <p key={index}>{reference}</p>
                ))}
                <p>
                  İleti: {message.id} · Aktarım: {message.hop_count}/8
                </p>
                {message.parent_id && <p>Önceki ileti: {message.parent_id}</p>}
                {message.handled_at && <p>İşlenme: {dateLabel(message.handled_at)}</p>}
              </TechnicalDetails>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
