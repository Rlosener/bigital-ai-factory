import { useId, useMemo } from "react";
import { ArrowRight } from "lucide-react";
import type { FactoryAgent, FactoryPlan } from "../../../shared/factory";
import { translateEnglishToTurkish } from "../../i18n";
import { GRAPH_NODE_HEIGHT, GRAPH_NODE_WIDTH, buildWorkflowGraph } from "./workflow-graph";
import { Status } from "./presentation";

export default function WorkflowGraph({
  plan,
  agents,
  onTask,
}: {
  plan: FactoryPlan;
  agents: FactoryAgent[];
  onTask: (taskId: string) => void;
}) {
  const graph = useMemo(() => buildWorkflowGraph(plan.steps), [plan.steps]);
  const markerId = useId().replaceAll(":", "");
  const names = useMemo(
    () => new Map(agents.map((agent) => [agent.id, translateEnglishToTurkish(agent.name)])),
    [agents],
  );
  if (!plan.steps.length) return <p className="factory-muted">Bu planın henüz çalışma adımı yok.</p>;
  return (
    <section className="factory-workflow-graph" aria-label="İş akışı grafiği">
      <p className="factory-muted">Salt okunur akış. Oklar, bir adımın başlamadan önce beklediği işleri gösterir.</p>
      {(graph.cyclic || graph.missingDependency) && (
        <p role="alert" className="factory-error">
          {graph.cyclic
            ? "Plan bağımlılıklarında döngü bulundu. Çalıştırmadan önce planı kontrol edin."
            : "Planda bulunamayan bir bağımlılık var. Çalıştırmadan önce planı kontrol edin."}
        </p>
      )}
      <div className="factory-graph-viewport" tabIndex={0} aria-label="Adım grafiği; büyük akışlarda kaydırılabilir">
        <svg
          width={graph.width}
          height={graph.height}
          viewBox={`0 0 ${graph.width} ${graph.height}`}
          aria-label={`${plan.steps.length} adım ve ${graph.edges.length} bağımlılık`}
        >
          <defs>
            <marker
              id={markerId}
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#727671" />
            </marker>
          </defs>
          <g aria-hidden="true">
            {graph.edges.map((edge) => {
              const x1 = edge.from.x + GRAPH_NODE_WIDTH / 2;
              const y1 = edge.from.y + GRAPH_NODE_HEIGHT;
              const x2 = edge.to.x + GRAPH_NODE_WIDTH / 2;
              const y2 = edge.to.y;
              const middle = (y1 + y2) / 2;
              return (
                <path
                  key={edge.id}
                  data-from={edge.from.step.id}
                  data-to={edge.to.step.id}
                  d={`M${x1},${y1} C${x1},${middle} ${x2},${middle} ${x2},${y2 - 3}`}
                  fill="none"
                  stroke="#727671"
                  strokeWidth="1.5"
                  markerEnd={`url(#${markerId})`}
                />
              );
            })}
          </g>
          {graph.nodes.map(({ step, x, y }) => (
            <foreignObject key={step.id} x={x} y={y} width={GRAPH_NODE_WIDTH} height={GRAPH_NODE_HEIGHT}>
              <article className="factory-graph-node" aria-label={`${step.position + 1}. ${step.title}`}>
                <div>
                  <span className="factory-step-number">{step.position + 1}</span>
                  <Status value={step.status} />
                </div>
                <strong title={step.title}>{step.title}</strong>
                <p>
                  {step.agent_id ? names.get(step.agent_id) || "Çalışan kaydı bulunamadı" : "Çalışan atanmadı"} ·{" "}
                  {translateEnglishToTurkish(step.role)}
                </p>
                {step.task_id ? (
                  <button onClick={() => onTask(step.task_id!)}>
                    Görevi incele <ArrowRight size={12} />
                  </button>
                ) : (
                  <span className="factory-muted">Görev henüz başlamadı</span>
                )}
              </article>
            </foreignObject>
          ))}
        </svg>
      </div>
    </section>
  );
}
