export const FACTORY_CONTROLLER_STATES = ["NORMAL", "STEER", "CONSTRAIN", "STOP"] as const;
export type FactoryControllerState = (typeof FACTORY_CONTROLLER_STATES)[number];
export type FactoryControllerPolicy = {
  max_retries: number;
  same_error_limit: number;
  max_runtime_ms: number;
  max_cost_usd: number | null;
  hard_stop: boolean;
};
export const DEFAULT_FACTORY_CONTROLLER_POLICY: FactoryControllerPolicy = {
  max_retries: 3,
  same_error_limit: 2,
  max_runtime_ms: 30 * 60 * 1000,
  max_cost_usd: null,
  hard_stop: true,
};
export type FactoryControlSignal = {
  state: FactoryControllerState;
  failure: boolean;
  retry_count: number;
  same_error_count: number;
  elapsed_ms: number;
  measured_cost_usd: number | null;
  capacity_blocked?: boolean;
  cost_unknown?: boolean;
};
export type FactoryControlDecision = {
  state: FactoryControllerState;
  action: "continue" | "steer" | "constrain" | "stop" | "wait_capacity";
  allow_dispatch: boolean;
  reason: string;
};

/** Original implementation of a deterministic, one-level-per-beat circuit breaker. No I/O or agent calls. */
export function evaluateFactoryController(
  signal: FactoryControlSignal,
  overrides: Partial<FactoryControllerPolicy> = {},
): FactoryControlDecision {
  const policy = { ...DEFAULT_FACTORY_CONTROLLER_POLICY, ...overrides };
  if (signal.state === "STOP")
    return {
      state: "STOP",
      action: "stop",
      allow_dispatch: false,
      reason: "Devre kesici durdu; kapsam/politika insan tarafından incelenmeli.",
    };
  if (policy.max_cost_usd !== null && signal.cost_unknown) {
    const index = Math.min(2, FACTORY_CONTROLLER_STATES.indexOf(signal.state) + 1);
    return {
      state: FACTORY_CONTROLLER_STATES[index],
      action: index === 1 ? "steer" : "constrain",
      allow_dispatch: false,
      reason:
        "USD görev bütçesi var ancak tamamlanan provider maliyeti bilinmiyor; bütçe politikası incelenmeden yeni iş başlatılamaz.",
    };
  }
  if (signal.capacity_blocked)
    return {
      state: signal.state,
      action: "wait_capacity",
      allow_dispatch: false,
      reason: "Sağlayıcı kapasitesi bekleniyor; bu durum görev hatası/retry bütçesi değildir.",
    };
  const runtimeExceeded = signal.elapsed_ms >= policy.max_runtime_ms;
  const costExceeded =
    policy.max_cost_usd !== null &&
    signal.measured_cost_usd !== null &&
    signal.measured_cost_usd >= policy.max_cost_usd;
  const retryExceeded = signal.retry_count >= policy.max_retries;
  const repeatExceeded = signal.same_error_count >= policy.same_error_limit;
  const hardLimit = runtimeExceeded || costExceeded || retryExceeded || repeatExceeded;
  let target = 0;
  if (signal.failure) target = signal.retry_count >= 1 || repeatExceeded ? 2 : 1;
  if (hardLimit) target = policy.hard_stop ? 3 : 2;
  const current = FACTORY_CONTROLLER_STATES.indexOf(signal.state);
  const index = Math.max(current, Math.min(current + 1, target));
  const state = FACTORY_CONTROLLER_STATES[index];
  const reason = runtimeExceeded
    ? "Çalışma süresi sınırına ulaşıldı."
    : costExceeded
      ? "Ölçülen USD görev bütçesine ulaşıldı."
      : retryExceeded
        ? "Retry sınırına ulaşıldı."
        : repeatExceeded
          ? "Aynı normalize hata tekrar sınırına ulaşıldı."
          : signal.failure
            ? "Doğrulanmış görev hatası; yaklaşım ve kanıtlar yeniden değerlendirilmeli."
            : "Kontrol sınırları içinde.";
  return {
    state,
    action:
      state === "NORMAL" ? "continue" : state === "STEER" ? "steer" : state === "CONSTRAIN" ? "constrain" : "stop",
    allow_dispatch: state !== "STOP" && !runtimeExceeded && !costExceeded && !retryExceeded,
    reason,
  };
}

export function parseFactoryCapacityFailure(
  raw: string,
  now: number,
): { retry_after: number | null; reason: string } | null {
  if (
    !/(?:usage limit|rate.?limit|quota (?:exceeded|exhausted)|insufficient_quota|resource_exhausted|too many requests|\b429\b|hit your (?:usage|rate) limit)/i.test(
      raw,
    )
  )
    return null;
  const duration = raw.match(
    /(?:retry[- ]after\s*[:=]\s*|(?:try again|retry|reset(?:s)?) in\s*)(\d+(?:\.\d+)?)\s*(seconds?|secs?|s\b|minutes?|mins?|m\b|hours?|hrs?|h\b)?/i,
  );
  let retryAfter: number | null = null;
  if (duration) {
    const factor = /^m/i.test(duration[2] || "") ? 60_000 : /^h/i.test(duration[2] || "") ? 3_600_000 : 1000;
    const delta = Number(duration[1]) * factor;
    if (Number.isFinite(delta) && delta >= 0 && delta <= 7 * 24 * 3600_000) retryAfter = now + delta;
  }
  const absolute = raw.match(
    /(?:retry[- ]after|try again at|reset(?:s)? at)\s*[:=]?\s*(\d{4}-\d{2}-\d{2}T[\d:.]+(?:Z|[+-]\d{2}:\d{2}))/i,
  );
  if (!retryAfter && absolute) {
    const parsed = Date.parse(absolute[1]);
    if (Number.isFinite(parsed) && parsed >= now) retryAfter = parsed;
  }
  const english = raw.match(
    /(?:try again at|reset(?:s)? at)\s+((?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}\s+\d{1,2}:\d{2}\s*(?:AM|PM)(?:\s*(?:UTC|GMT|[+-]\d{4}))?)/i,
  );
  if (!retryAfter && english) {
    // CLI provider wall-clock dates are interpreted in the runtime's configured timezone.
    const parsed = Date.parse(english[1].replace(/(\d)(?:st|nd|rd|th)/gi, "$1"));
    if (Number.isFinite(parsed) && parsed >= now && parsed - now <= 7 * 24 * 3600_000) retryAfter = parsed;
  }
  return {
    retry_after: retryAfter,
    reason: retryAfter
      ? `Sağlayıcı kullanım sınırı; ${new Date(retryAfter).toISOString()} sonrasında yeniden ölçün.`
      : "Sağlayıcı kullanım sınırı; kesin yenilenme zamanı bildirilmedi. Kapasiteyi kontrol edip aynı planı yeniden başlatın.",
  };
}

export type FactorySeatSnapshot = {
  enabled: boolean;
  max_concurrency: number;
  reserve_slots: number;
  human_reserve_percent?: number;
  active_leases: number;
  cooldown_until: number | null;
  health: "unknown" | "healthy" | "degraded" | "blocked";
  remaining_fraction: number | null;
};
export function evaluateFactoryCapacity(
  seat: FactorySeatSnapshot,
  now: number,
): { allow: boolean; cap: number; measurement: boolean; reason: string } {
  const cap = Math.max(0, Math.floor(seat.max_concurrency) - Math.max(0, Math.floor(seat.reserve_slots)));
  // Hard gates precede pacing; existing leases are never killed when cap decreases.
  if (!seat.enabled) return { allow: false, cap, measurement: false, reason: "Sağlayıcı seat kapalı." };
  if (seat.cooldown_until !== null && seat.cooldown_until > now)
    return { allow: false, cap, measurement: false, reason: "Sağlayıcı cooldown süresi henüz dolmadı." };
  if (seat.remaining_fraction === 0 || (seat.health === "blocked" && seat.cooldown_until === null))
    return {
      allow: false,
      cap,
      measurement: false,
      reason: "Sağlayıcı kapasite sınırı doğrulanmış; yeni işler bekliyor.",
    };
  if (seat.remaining_fraction !== null && seat.remaining_fraction <= (seat.human_reserve_percent ?? 20) / 100)
    return {
      allow: false,
      cap,
      measurement: false,
      reason: "İnsan kullanımına ayrılan yüzde rezervine ulaşıldı; yeni AI işleri bekliyor.",
    };
  if (cap === 0 || seat.active_leases >= cap)
    return {
      allow: false,
      cap,
      measurement: false,
      reason: "Koltuk concurrency/reserve sınırı dolu; aktif işler devam eder.",
    };
  const unknown = seat.remaining_fraction === null || seat.health === "unknown";
  if (unknown && seat.active_leases >= 1)
    return {
      allow: false,
      cap: Math.min(1, cap),
      measurement: true,
      reason: "Kapasite snapshot bilinmiyor; yalnızca bir ölçüm çalışması izinli.",
    };
  return {
    allow: true,
    cap: unknown ? Math.min(1, cap) : cap,
    measurement: unknown,
    reason: unknown ? "Bilinmeyen kapasite için tek ölçüm çalışması." : "Kapasite/reserve sınırları içinde.",
  };
}
