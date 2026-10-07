# Bigital AI Factory V0 acceptance record

Verified locally on 2026-10-05 against the supplied archive checkout.

## Accepted in this checkout

| Area | Evidence | Result |
| --- | --- | --- |
| One orchestration spine | Factory plans, Hive, capacity leases and controller transitions use the existing Express/SQLite/Claw task runtime | Pass |
| Business/project isolation | Scoped repository/API tests, project switching UI tests and immutable project-bound plans | Pass |
| Manager workflows | Durable software, product and social DAGs with explicit dependencies and assignments | Pass |
| Hive | Versioned six-section blackboard; typed/idempotent mailbox; hop and secret guards | Pass |
| Safety | `NORMAL -> STEER -> CONSTRAIN -> STOP`, explicit human reset, durable events and capacity failures outside retry counts | Pass |
| Capacity | Real registered provider identity references, concurrency leases, reserve slots, 20% human reserve and unknown-capacity single probe | Pass |
| Quality | Structured-output validation, independent reviewer identity, one automatic remediation round, test/build gate for software | Pass |
| Human governance | Plan and final-result approvals are durable; final approval does not merge, deploy, publish or send externally | Pass |
| Product UI | Turkish Manager workspace, task/output/approval/knowledge/Hive/activity/experience tabs and real read-only workflow graph | Pass |
| Responsive browser | Desktop and 390 x 844 mobile checks; no browser console errors in the checked Factory/Hive flows | Pass |
| API contract | OpenAPI validates 129 operations, including Hive, ProviderSeat and controller recovery endpoints | Pass |

## Automated evidence

- Web: 29 test files, 99 tests passed.
- API: 53 test files, 255 tests passed.
- TypeScript project build passed.
- Vite production build passed; the existing large-chunk advisory remains a performance follow-up.
- Full ESLint completed with 0 errors and 40 pre-existing warnings outside the new Factory implementation.
- Focused post-live-fix runtime tests: 16 passed; TypeScript and targeted lint passed.

Browser captures are stored under `docs/bigital/evidence/`:

- `workflow-graph-desktop.png`
- `hive-desktop.png`
- `hive-mobile.png`
- `factory-live-desktop.png`
- `final-approval-desktop.png`

## Real runtime evidence

The local Codex CLI produced a structured product plan with provider-reported token usage. A different reviewer identity returned concrete findings through the private mailbox; the producer acknowledged them and ran remediation passes. The final independent review passed and the plan reached `awaiting_approval`; the final human approval was deliberately left pending in the UI. During this real flow, two integration defects were found and fixed: object-shaped review findings are now normalized into the bounded Hive text contract, and product/social reviewers receive the complete structured predecessor within a larger bounded context budget. Neither defect was hidden as completion.

The configured `Efe-Codex` ProviderSeat points to an existing Codex CLI agent configuration and applies a 20% human reserve. No credential, token or fabricated account was added to the seat record.

## Acceptance boundaries

- The supplied Claw folder is not a Git checkout, so a real isolated software branch, push and draft pull request cannot be accepted against it. Temporary Git fixtures only prove the gate implementation.
- Docker is unavailable on this host. Container and nginx configuration exist, but the image was not built here.
- `agents.bigital.net`, DNS, TLS and hosting health were not verified because target hosting access was not supplied.
- Real mail, WhatsApp, social publishing, remote worker and MCP deployment are outside V0 and remain unclaimed.
- The current authorization model is suitable for a trusted internal operator. It is not presented as completed hostile multi-tenant isolation.
