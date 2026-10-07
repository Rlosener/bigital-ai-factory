import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  buildFactoryGraph,
  getFactoryGraph,
  queryFactoryGraph,
  type FactoryCodeGraph,
  type FactoryCodeHit,
  type FactoryGraphOverview,
  type FactoryScope,
} from "../../api/factory";
import { useFactoryWorkspace } from "./useFactoryWorkspace";
import { FactoryError } from "./TechnicalDetails";
import { dateLabel } from "./presentation";

const KIND: Record<string, string> = {
  incident: "Olay",
  root_cause: "Kök neden",
  attempt: "Başarısız deneme",
  solution: "Doğrulanmış çözüm",
  verification: "Doğrulama",
  playbook: "Playbook",
  prevention: "Önleme kuralı",
};
const CONFIDENCE: Record<string, string> = {
  NEW: "Yeni",
  OBSERVED: "Gözlemlendi",
  VERIFIED: "Doğrulandı",
  REPEATED: "Tekrarlandı",
  PROVEN: "Kanıtlandı",
};

function CommunityMap({ graph }: { graph: FactoryCodeGraph }) {
  const width = 720;
  const height = 340;
  const largest = Math.max(1, ...graph.communities.map((item) => item.size));
  const placed = new Map(
    graph.communities.map((community, index) => {
      const angle = (index / Math.max(1, graph.communities.length)) * Math.PI * 2 - Math.PI / 2;
      const ring = index % 2 === 0 ? 125 : 95;
      return [
        community.id,
        {
          x: width / 2 + Math.cos(angle) * ring * 2.1,
          y: height / 2 + Math.sin(angle) * ring,
          r: 6 + Math.sqrt(community.size / largest) * 16,
          community,
        },
      ];
    }),
  );
  const heaviest = Math.max(1, ...graph.links.map((link) => link.weight));
  return (
    <svg
      className="graph-community-map"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Bigital kod ağı: ${graph.community_count} topluluk`}
    >
      {graph.links.map((link) => {
        const from = placed.get(link.source);
        const to = placed.get(link.target);
        if (!from || !to) return null;
        return (
          <line
            key={`${link.source}-${link.target}`}
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            strokeWidth={0.5 + (link.weight / heaviest) * 3}
          />
        );
      })}
      {[...placed.values()].map(({ x, y, r, community }) => (
        <g key={community.id}>
          <circle cx={x} cy={y} r={r}>
            <title>{`${community.name}: ${community.size} düğüm`}</title>
          </circle>
          <text x={x} y={y + r + 11} textAnchor="middle">
            {community.name.length > 22 ? `${community.name.slice(0, 21)}…` : community.name}
          </text>
        </g>
      ))}
    </svg>
  );
}

export function GraphPanel({ scope }: { scope: FactoryScope }) {
  const [graph, setGraph] = useState<FactoryGraphOverview | null>(null);
  const [error, setError] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<{ brief: string; code: FactoryCodeHit[] } | null>(null);
  const [asking, setAsking] = useState(false);
  const [building, setBuilding] = useState(false);
  const load = useCallback(async () => {
    try {
      setGraph(await getFactoryGraph(scope));
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sinir ağı yüklenemedi.");
    }
  }, [scope]);

  useEffect(() => {
    if (!scope.businessId) return;
    void load();
    const timer = window.setInterval(() => void load(), graph?.code_graph.building ? 2000 : 8000);
    return () => window.clearInterval(timer);
  }, [scope.businessId, load, graph?.code_graph.building]);

  const code = graph?.code_graph;
  const experience = useMemo(() => graph?.nodes.slice(0, 12) ?? [], [graph]);

  async function rebuild() {
    setBuilding(true);
    setError("");
    try {
      await buildFactoryGraph(scope);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Kod grafiği güncellenemedi.");
    } finally {
      setBuilding(false);
    }
  }

  async function ask(event: FormEvent) {
    event.preventDefault();
    if (asking || question.trim().length < 3) return;
    setAsking(true);
    setError("");
    try {
      setAnswer(await queryFactoryGraph(scope, question.trim()));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sorgu tamamlanamadı.");
    } finally {
      setAsking(false);
    }
  }

  const busy = building || Boolean(code?.building);
  return (
    <section className="graph-panel" aria-label="Sinir ağı">
      <div className="factory-section-heading">
        <h2>Sinir ağı</h2>
        <button onClick={() => void rebuild()} disabled={busy || !code?.installed}>
          {busy ? "Bigital kod ağı hazırlanıyor…" : code?.ready ? "Kod ağını güncelle" : "Kod ağını oluştur"}
        </button>
      </div>
      <p className="factory-muted">
        Bigital Sinir Ağı projenin kodunu fonksiyon, servis ve dosya düğümlerine ayırır. AI Yönetici her adımdan önce bu
        ağa sorar ve ajana tüm depo yerine yalnızca ilgili kodu, benzer olayları ve doğrulanmış çözümleri verir.
      </p>
      {error && <FactoryError error={error} />}
      {code?.last_error && <p className="factory-error">Kod ağı: {code.last_error}</p>}
      <div className="graph-status">
        <div>
          <strong>Bigital Graph Engine</strong>
          <span>{!graph ? "Kontrol ediliyor" : code?.installed ? "Bu bilgisayarda hazır" : "Kurulum bulunamadı"}</span>
        </div>
        <div>
          <strong>Kod grafiği</strong>
          <span>
            {code?.ready
              ? `${code.node_count.toLocaleString("tr-TR")} düğüm · ${code.edge_count.toLocaleString("tr-TR")} bağ · ${code.community_count} topluluk`
              : busy
                ? "Üretiliyor"
                : "Henüz üretilmedi"}
          </span>
        </div>
        <div>
          <strong>Son güncelleme</strong>
          <span>
            {code?.built_at
              ? `${dateLabel(code.built_at)}${code.built_at_commit ? ` · ${code.built_at_commit.slice(0, 7)}` : ""}`
              : "—"}
          </span>
        </div>
      </div>
      {code?.ready && code.communities.length > 0 && <CommunityMap graph={code} />}
      {code?.ready && code.hubs.length > 0 && (
        <>
          <h3>En çok bağlantısı olan kod</h3>
          <ul className="graph-hits">
            {code.hubs.map((hub) => (
              <li key={`${hub.source_file}:${hub.label}`}>
                {hub.label} <code>{hub.source_file}</code> · {hub.degree} bağ
              </li>
            ))}
          </ul>
        </>
      )}
      <form className="factory-composer" onSubmit={ask}>
        <label htmlFor="graph-question">Ağa sor</label>
        <textarea
          id="graph-question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Örneğin: factory plan çalıştırma akışı"
          rows={3}
          maxLength={500}
        />
        <div className="factory-composer-footer">
          <button className="factory-primary" type="submit" disabled={asking || !scope.businessId}>
            {asking ? "Sorgulanıyor…" : "İlgili kodu ve deneyimi getir"}
          </button>
        </div>
      </form>
      {answer && (
        <>
          <h3>Sinir ağının bulduğu kod</h3>
          {answer.code.length ? (
            <ul className="graph-hits">
              {answer.code.map((hit) => (
                <li key={`${hit.source_file}:${hit.location}:${hit.label}`}>
                  {hit.label}{" "}
                  <code>
                    {hit.source_file}
                    {hit.location ? `:${hit.location}` : ""}
                  </code>
                </li>
              ))}
            </ul>
          ) : (
            <p className="factory-muted">Bu soru için kod grafiğinde eşleşme yok.</p>
          )}
          <h3>Ajana gidecek bağlam</h3>
          <pre className="graph-brief">{answer.brief || "Bu soru için kayıtlı deneyim yok."}</pre>
        </>
      )}
      <h3>Öğrenilen deneyim</h3>
      {graph && experience.length === 0 && (
        <p className="factory-muted">
          Çalışmalar tamamlandıkça olaylar, başarısız denemeler ve çözümler burada birikir.
        </p>
      )}
      <ul className="graph-list">
        {experience.map((node) => (
          <li key={node.id}>
            <strong>{KIND[node.kind] || node.kind}</strong>
            <span>{CONFIDENCE[node.confidence] || node.confidence}</span>
            <p>{node.label}</p>
            <small>{node.body}</small>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function GraphNervousSystem() {
  const { scope, workspace, projects, selectBusiness, selectProject, loading, error } = useFactoryWorkspace();
  return (
    <div className="factory-workspace">
      <p className="factory-eyebrow">BIGITAL GRAPH ENGINE</p>
      <h1>Sinir ağı</h1>
      <p>Kod grafiği ve öğrenilen deneyim, AI Yönetici’nin her adımda kullandığı aynı katmandır.</p>
      {error && <FactoryError error={error} />}
      <div className="graph-scope">
        <label>
          İşletme
          <select
            aria-label="İşletme"
            value={scope.businessId}
            onChange={(event) => selectBusiness(event.target.value)}
            disabled={loading || !workspace}
          >
            {(workspace?.businesses ?? []).map((business) => (
              <option key={business.id} value={business.id}>
                {business.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Proje
          <select
            aria-label="Proje"
            value={scope.projectId}
            onChange={(event) => selectProject(event.target.value)}
            disabled={!scope.businessId}
          >
            <option value="">Tüm işletme</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {scope.businessId ? (
        <GraphPanel key={`${scope.businessId}:${scope.projectId}`} scope={scope} />
      ) : (
        <p>Sinir ağını görmek için bir işletme seçin.</p>
      )}
    </div>
  );
}
