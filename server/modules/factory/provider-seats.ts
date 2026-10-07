import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { FactoryProviderSeat } from "../../../shared/factory.ts";
import { createRunInTransaction } from "../bootstrap/helpers.ts";
import { createFactoryRepository, rejectFactorySecrets, sanitizeFactoryValue } from "./repository.ts";
import { FactoryError } from "./types.ts";
const providers = ["claude", "codex", "gemini", "opencode", "kimi", "copilot", "antigravity", "api"];
function slots(value: unknown, label: string, minimum: number) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < minimum || value > 64)
    throw new FactoryError(400, "invalid_seat_capacity", `${label} ${minimum}–64 aralığında tam sayı olmalı.`);
  return value;
}
export function configureFactoryProviderSeat(
  db: DatabaseSync,
  businessId: string,
  input: Record<string, unknown>,
  id?: string,
): FactoryProviderSeat {
  createFactoryRepository(db).scope(businessId);
  const existing = id
    ? db.prepare("SELECT * FROM factory_provider_seats WHERE id=? AND business_id=?").get(id, businessId)
    : null;
  if (id && !existing)
    throw new FactoryError(404, "provider_seat_not_found", "Sağlayıcı seat bu işletme kapsamında bulunamadı.");
  if (existing && ["provider", "api_provider_id", "oauth_account_id"].some((key) => key in input))
    throw new FactoryError(
      400,
      "seat_identity_immutable",
      "Seat kimliği değiştirilemez; yalnızca etkinlik, concurrency ve reserve ayarları düzenlenebilir.",
    );
  const provider = existing ? String(existing.provider) : String(input.provider ?? "");
  if (!providers.includes(provider))
    throw new FactoryError(400, "invalid_seat_provider", "Mevcut bir CLI/API sağlayıcı türünü seçin.");
  const apiId = existing?.api_provider_id ?? input.api_provider_id ?? null;
  const oauthId = existing?.oauth_account_id ?? input.oauth_account_id ?? null;
  if ((apiId != null && typeof apiId !== "string") || (oauthId != null && typeof oauthId !== "string"))
    throw new FactoryError(400, "invalid_seat_identity", "Sağlayıcı/hesap kimliği geçerli metin olmalı.");
  if (provider === "api") {
    if (!apiId || !db.prepare("SELECT id FROM api_providers WHERE id=? AND enabled=1").get(apiId))
      throw new FactoryError(404, "seat_api_provider_missing", "Mevcut etkin API sağlayıcı kimliği gerekli.");
    if (oauthId) throw new FactoryError(400, "invalid_seat_identity", "API seat OAuth hesap kimliği alamaz.");
  } else {
    if (apiId) throw new FactoryError(400, "invalid_seat_identity", "CLI seat API sağlayıcı kimliği alamaz.");
    if (!db.prepare("SELECT id FROM agents WHERE cli_provider=? LIMIT 1").get(provider))
      throw new FactoryError(
        404,
        "seat_cli_identity_missing",
        "Bu CLI sağlayıcısını kullanan mevcut çalışan yapılandırması bulunamadı.",
      );
    if (
      oauthId &&
      (provider !== "antigravity" ||
        !db
          .prepare("SELECT id FROM oauth_accounts WHERE id=? AND provider='google_antigravity' AND status='active'")
          .get(oauthId))
    )
      throw new FactoryError(
        404,
        "seat_oauth_identity_missing",
        "CLI sağlayıcısının desteklediği mevcut etkin OAuth hesabı gerekli.",
      );
  }
  const concurrency = slots(input.max_concurrency ?? existing?.max_concurrency ?? 1, "Concurrency", 1);
  const reserve = slots(input.reserve_slots ?? existing?.reserve_slots ?? 0, "Reserve", 0);
  if (reserve > concurrency)
    throw new FactoryError(400, "invalid_seat_capacity", "Reserve concurrency değerini aşamaz.");
  if (input.enabled != null && typeof input.enabled !== "boolean")
    throw new FactoryError(400, "invalid_seat_enabled", "Seat etkinlik değeri boolean olmalı.");
  const enabled = input.enabled == null ? (existing ? Boolean(existing.enabled) : true) : input.enabled;
  if (input.label != null && typeof input.label !== "string")
    throw new FactoryError(400, "invalid_seat_label", "Seat etiketi metin olmalı.");
  const label = input.label != null ? String(input.label).trim() : String(existing?.label || `${provider}-seat`);
  if (!label || label.length > 80)
    throw new FactoryError(400, "invalid_seat_label", "Seat etiketi en çok 80 karakter olmalı.");
  const humanReserve = input.human_reserve_percent ?? existing?.human_reserve_percent ?? 20;
  if (typeof humanReserve !== "number" || !Number.isInteger(humanReserve) || humanReserve < 0 || humanReserve > 99)
    throw new FactoryError(
      400,
      "invalid_human_reserve",
      "İnsan kapasite rezervi yüzde 0–99 aralığında tam sayı olmalı.",
    );
  rejectFactorySecrets(label);
  const seatId = id ?? randomUUID();
  const now = Date.now();
  createRunInTransaction(db)(() => {
    if (existing)
      db.prepare(
        "UPDATE factory_provider_seats SET enabled=?,max_concurrency=?,reserve_slots=?,human_reserve_percent=?,label=?,updated_at=? WHERE id=? AND business_id=?",
      ).run(enabled ? 1 : 0, concurrency, reserve, humanReserve, label, now, seatId, businessId);
    else {
      if (
        db
          .prepare(
            "SELECT id FROM factory_provider_seats WHERE business_id=? AND provider=? AND api_provider_id IS ? AND oauth_account_id IS ? LIMIT 1",
          )
          .get(businessId, provider, apiId, oauthId)
      )
        throw new FactoryError(
          409,
          "seat_identity_exists",
          "Bu gerçek sağlayıcı kimliği için seat zaten mevcut; kayıtlı seat'i düzenleyin.",
        );
      db.prepare(
        "INSERT INTO factory_provider_seats(id,business_id,provider,api_provider_id,oauth_account_id,enabled,max_concurrency,reserve_slots,human_reserve_percent,label,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
      ).run(
        seatId,
        businessId,
        provider,
        apiId,
        oauthId,
        enabled ? 1 : 0,
        concurrency,
        reserve,
        humanReserve,
        label,
        now,
        now,
      );
    }
  });
  const row = db.prepare("SELECT * FROM factory_provider_seats WHERE id=?").get(seatId)!;
  return sanitizeFactoryValue({ ...row, enabled: Boolean(row.enabled) }) as unknown as FactoryProviderSeat;
}
