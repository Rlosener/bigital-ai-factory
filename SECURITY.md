# Security Policy

## Supported Versions

Security fixes are primarily applied to the latest stable line.

| Version | Supported |
| --- | --- |
| 1.2.x | Yes |
| < 1.2.0 | No |

## Reporting a Vulnerability

Please do not open public GitHub issues for security vulnerabilities.

Report vulnerabilities privately to the project maintainers. Do not include exploit details in a public issue.

## Response Expectations

- Initial triage target: within 72 hours
- Follow-up status updates: provided during investigation
- Fix publication: coordinated with impact and patch readiness

## Scope

Typical in-scope areas include:

- Auth/session boundaries
- OAuth token handling and encryption flows
- `/api/inbox` secret validation and webhook handling
- Command execution paths, worktree operations, and update flows
- Secrets handling in logs/configuration
