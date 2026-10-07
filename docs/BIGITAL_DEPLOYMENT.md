# Bigital AI Factory deployment

## Local development

Requirements: Node.js 22+, pnpm, and at least one authenticated CLI provider for real agent runs.

```bash
node scripts/setup-factory-env.mjs
pnpm install --frozen-lockfile
pnpm dev:local
```

Open `http://127.0.0.1:8800`. Provider keys belong in Settings, where the existing encrypted provider store is used. Do not put provider credentials in Business/Project Knowledge, the Hive blackboard or mailbox.

## Production preparation

1. Copy `deploy/bigital.env.example` to `deploy/.env.bigital` on the target host.
2. Generate three different random values of at least 32 characters for `API_AUTH_TOKEN`, `OAUTH_ENCRYPTION_SECRET` and `INBOX_WEBHOOK_SECRET`.
3. Point `BIGITAL_PROJECTS_DIR` at the host directory containing the repositories the Factory may access.
4. Authenticate the selected CLI provider inside the persistent `bigital-agent-home` volume, or configure an encrypted API provider in Settings.
5. Validate the environment before starting:

```bash
set -a
. deploy/.env.bigital
set +a
node scripts/validate-factory-production.mjs
docker compose -f deploy/docker-compose.bigital.yml up -d --build
```

The container publishes only `127.0.0.1:8790`; `deploy/nginx/bigital.conf` terminates HTTPS for `agents.bigital.net` and proxies HTTP/WebSocket traffic. Install a valid certificate before enabling the TLS server block.

## Verification gates

Deployment is accepted only after all of these succeed on the target host:

- `/api/health` returns a healthy response through `https://agents.bigital.net`;
- session authentication and CSRF protection reject unauthenticated/malformed mutations;
- WebSocket status stays connected through nginx;
- data survives a container restart through the `bigital-data` volume;
- a real configured provider can run one approved Product task;
- a different agent can perform its independent review;
- a real Git-backed Software project creates an isolated worktree, passes repository checks and opens a draft PR;
- no plan approval causes main merge, production deployment, social publishing or external messaging;
- rate-limit/capacity failure records a cooldown/block and can resume the same plan after capacity returns.

The repository includes the configuration needed for these checks. Live DNS, TLS, hosting credentials, provider logins and a Git remote are environment responsibilities and cannot be claimed from a local build.
