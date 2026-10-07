const missing = ["API_AUTH_TOKEN", "OAUTH_ENCRYPTION_SECRET", "INBOX_WEBHOOK_SECRET"].filter((name) => {
  const value = (process.env[name] ?? "").trim().replace(/^['"]|['"]$/g, "");
  return value.length < 32 || value === "__CHANGE_ME__";
});
if (missing.length) {
  console.error(`Production configuration requires independent secrets of at least 32 characters: ${missing.join(", ")}`);
  process.exit(1);
}
if (new Set([process.env.API_AUTH_TOKEN, process.env.OAUTH_ENCRYPTION_SECRET, process.env.INBOX_WEBHOOK_SECRET]).size !== 3) {
  console.error("Production API, encryption and inbox secrets must be independent.");
  process.exit(1);
}
