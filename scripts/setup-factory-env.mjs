import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const destination = fileURLToPath(new URL("../.env", import.meta.url));
if (existsSync(destination)) {
  console.log("Existing .env preserved. Configure providers through application Settings.");
} else {
  const template = readFileSync(new URL("../.env.example", import.meta.url), "utf8");
  const configured = template
    .replace('OAUTH_ENCRYPTION_SECRET="__CHANGE_ME__"', `OAUTH_ENCRYPTION_SECRET="${randomBytes(32).toString("hex")}"`)
    .replace("# INBOX_WEBHOOK_SECRET=__CHANGE_ME__", `INBOX_WEBHOOK_SECRET=${randomBytes(32).toString("hex")}`);
  writeFileSync(destination, configured, { flag: "wx", mode: 0o600 });
  console.log("Local .env created with independent encryption and inbox secrets. Secrets are not printed.");
}
