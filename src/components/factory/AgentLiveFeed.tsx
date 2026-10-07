import { useEffect, useState } from "react";
import type { FactoryWorkspace } from "../../../shared/factory";

function ago(value: number, nowMs: number): string {
  const seconds = Math.max(0, Math.round((nowMs - value) / 1000));
  if (seconds < 60) return `${seconds} sn önce`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} dk önce`;
  return `${Math.round(minutes / 60)} sa önce`;
}

export default function AgentLiveFeed({ workspace }: { workspace: FactoryWorkspace }) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 5000);
    return () => window.clearInterval(timer);
  }, []);
  const notes = workspace.activity.filter((item) => item.action === "agent_note").slice(0, 8);
  const working = workspace.agents.filter((agent) => agent.status === "working");
  return (
    <section className="agent-feed" aria-label="Ajanlar şu an ne yapıyor" aria-live="polite">
      <div className="factory-section-heading">
        <h2>Ajanlar şu an ne yapıyor</h2>
        <span className="factory-muted">
          {working.length ? `${working.map((agent) => agent.name).join(", ")} çalışıyor` : "Şu an çalışan ajan yok"}
        </span>
      </div>
      {notes.length === 0 ? (
        <p className="factory-muted">Bir plan başlattığında ajanlar her adımı burada kısa cümlelerle anlatır.</p>
      ) : (
        <ol>
          {notes.map((note) => (
            <li key={note.id}>
              <strong>{note.actor}</strong>
              <span>{note.detail}</span>
              <time>{ago(note.created_at, nowMs)}</time>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
