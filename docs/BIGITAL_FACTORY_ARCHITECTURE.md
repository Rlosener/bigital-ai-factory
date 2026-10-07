# Bigital AI Factory — locked architecture

## Product boundary

Bigital AI Factory has one orchestration spine. The product owns the application, database, task runtime, process lifecycle, realtime event layer and Pixel Office. Every capability below is a native Bigital module; none is presented as a separate application or parallel orchestration product.

| Bigital module            | Responsibility                                                                                      | Boundary                                              |
| ------------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Bigital Execution Engine  | Express/SQLite application, tasks, CLI execution, worktrees, realtime state and office              | The only execution/task owner                         |
| Bigital Workflow Studio   | Team and dependency graph interaction                                                               | Factory plans remain the durable workflow graph       |
| Bigital Project Hive      | Structured mailbox, project blackboard, agent memory boundary and circuit-breaker ladder            | No second PTY manager or filesystem task ledger       |
| Bigital Capacity Governor | Provider-neutral capacity, reserve and worker/seat scheduling                                       | No provider-specific account farm or second scheduler |
| Bigital Graph Engine      | Local code graph, query/path/explain, change impact, incremental updates and reflection             | Retrieval beneath Manager; never a task owner         |
| Bigital Product Layer     | Business/project context, Manager, quality gates, private experience and Turkish product experience | Product domain and governance                         |

No Donebird record is seeded. Donebird can be registered later as an ordinary project with an explicitly supplied repository path.

## Runtime ownership

```text
User
  -> Company Brain + Project Brain
  -> AI Manager
  -> durable Factory plan DAG
  -> Graph Intelligence query + bounded context optimizer
  -> Project Hive (blackboard + mailbox + private memory boundary)
  -> Capacity Governor
  -> Bigital task/runtime/worktree engine
  -> quality gate + independent review
  -> human approval
  -> versioned deliverable + private experience episode
```

The Manager creates a persistent plan before work starts. Plan approval authorizes the planned generation work only. Final approval never implies a main-branch merge, production deployment, social publishing or external messaging.

## Identity and execution model

```text
Agent identity
  -> model strategy
  -> provider
  -> provider seat
  -> worker machine
  -> runtime adapter
  -> tools
```

These are separate records. An agent is a durable Bigital role and history. A model or CLI can change without replacing that identity. A provider seat describes a capacity and credential boundary, while a worker describes the machine capability boundary. V0 runs through the existing local Claw process engine; remote workers remain a later phase.

## Project Hive

The Hive belongs to one business/project scope and uses the same SQLite transaction and WebSocket event mechanisms as the rest of Factory.

The blackboard stores six structured sections: current objective, active plan, shared findings, blockers, decisions and deliverables. The Manager/API is the authoritative writer. Updates use versions so a stale update cannot overwrite newer project state. Agent output is validated before the Manager promotes a finding to shared context.

Mailbox messages are internal coordination records. They have a conversation, sender, recipient, semantic type, task/plan scope, bounded hop count and pending/handled state. Review feedback can return to the producer without copying every agent chat into every prompt. The ordinary activity feed exposes a short human-readable event; message bodies stay in technical/internal views.

Private experience remains distinct from shared knowledge. Failed attempts become incidents and private episodes. A fix becomes verified experience only after structured output, independent review and final human approval.

## Graph Intelligence and Experience

Bigital Graph Engine maps code structure locally with AST extraction. The Manager calls it through a bounded adapter for project queries and change-impact analysis. It never injects the raw graph file or the full repository into an agent prompt. It requests a small subgraph, combines it with scoped experience and sends a short task brief.

```text
Manager task
  -> Bigital project-code query
  -> private Bigital experience lookup
  -> relevance + prior success + confidence + technology + scope similarity + recency
  -> bounded context brief
  -> existing Claw agent runtime
```

The durable Bigital experience graph stores `Incident -> caused_by -> Root Cause`, failed `Attempt` records, verified `Solution -> verified_by -> Verification`, and sanitized `Playbook -> prevents -> Prevention Rule` records. Confidence progresses through `NEW`, `OBSERVED`, `VERIFIED`, `REPEATED` and `PROVEN`. Project and business nodes stay private. A global playbook is created only from verified, generalizable text after organization names, domains, paths, identifiers and secrets are removed.

After a code commit the runtime starts an incremental graph update for the changed worktree. Final human approval becomes a useful-result signal; rejection becomes a dead-end signal; a revision request becomes a correction signal. The project-local reflection overlay is then refreshed. These signals never replace Bigital's approval or confidence rules.

## Safety controller

The circuit breaker is a policy over the existing task runtime:

```text
normal -> steer -> constrain -> stop -> Manager/human
```

The default task policy allows at most three attempts, two consecutive occurrences of the same normalized error and 30 minutes per attempt. A cost cap is optional because a provider that reports no cost must remain `unknown`, not `$0`. Every transition is durable and visible in activity/incident history. A lower capacity decision blocks new starts; it does not kill work already in progress.

## Capacity Governor

Capacity decisions use only provider-reported or operator-configured facts:

- seat enabled/disabled state and cooldown;
- current running count and maximum concurrency;
- provider usage windows when the provider actually reports them;
- factory-usable percentage after the human reserve;
- daily/task cost limits for metered APIs;
- task priority, runtime/tool capability and worker availability.

When a seat has no usage snapshot, the conservative V0 behavior allows one measurement run. A real rate-limit response records a cooldown and retry time. Provider-specific parsing lives behind adapters; the scheduling policy itself does not assume Claude, Codex or a particular billing model.

## Workflow Studio phases

1. V0 renders the real Manager DAG with step dependencies, assignments, statuses and task evidence.
2. The Team Builder adds reusable role/capability templates.
3. The Workflow Studio may edit validated graphs, but it will save back to the same Factory plan/workflow contracts.
4. Durable missions and schedules reuse the same Manager, capacity and approval gates.
5. Remote workers and an authenticated MCP surface are later deployment capabilities, not a parallel orchestrator.

## Security and deployment boundary

Factory V0 is an internal, trusted-operator application. Business/project scope checks prevent accidental cross-project reads, but this is not a multi-tenant authorization claim. Secrets use the existing encrypted provider settings and are rejected from knowledge, blackboard, mailbox and public deliverable records. Raw CLI logs remain an operator-only technical surface and require host-level protection.

Software runs require a real Git repository. Agent changes use isolated worktrees, repository test/build gates, a different reviewer identity and a draft pull request. Main merge and production deployment stay human-controlled. The included container/nginx files prepare `agents.bigital.net`; live DNS, TLS, server credentials, provider logins and hosting health still need verification on the target server.

## Product and license boundary

Bigital presents every integrated capability under its own product architecture and design system. External runtime dependencies and legally required notices stay in the dedicated third-party notice; they do not appear as separate products in the application flow.
