import "server-only";
import { createHash } from "crypto";
import { Redis } from "@upstash/redis";

export const DAILY_TRIAL_LIMIT = 2;

export type TrialStatus = {
  enabled: boolean;
  limit: number;
  remaining: number;
  reset: number | null;
  resetAt: string | null;
};

export type TrialConsumeResult =
  TrialStatus & {
    success: boolean;
    unavailable: boolean;
  };

let trialRedis:
  | Redis
  | null
  | undefined;

let missingCredentialsLogged = false;

function getTrialRedis() {
  if (trialRedis !== undefined) {
    return trialRedis;
  }

  const url =
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.KV_REST_API_URL;

  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.KV_REST_API_TOKEN;

  if (!url || !token) {
    trialRedis = null;

    if (!missingCredentialsLogged) {
      console.warn(
        "Trial limiter disabled: Upstash Redis credentials are not configured."
      );

      missingCredentialsLogged = true;
    }

    return null;
  }

  trialRedis = new Redis({
    url,
    token,
    enableAutoPipelining: true,
  });

  return trialRedis;
}

function getClientIp(request: Request) {
  const vercelForwardedFor =
    request.headers.get(
      "x-vercel-forwarded-for"
    );

  if (vercelForwardedFor) {
    const firstIp =
      vercelForwardedFor
        .split(",")[0]
        ?.trim();

    if (firstIp) {
      return firstIp;
    }
  }

  const forwardedFor =
    request.headers.get(
      "x-forwarded-for"
    );

  if (forwardedFor) {
    const firstIp =
      forwardedFor
        .split(",")[0]
        ?.trim();

    if (firstIp) {
      return firstIp;
    }
  }

  const realIp =
    request.headers.get(
      "x-real-ip"
    );

  if (realIp) {
    return realIp.trim();
  }

  const cloudflareIp =
    request.headers.get(
      "cf-connecting-ip"
    );

  if (cloudflareIp) {
    return cloudflareIp.trim();
  }

  /*
   * Local development does not always
   * provide a client IP header.
   * One shared local identifier makes
   * the daily limit easy to test.
   */
  return "local-development";
}

function getTrialIdentifier(
  request: Request
) {
  const clientIp =
    getClientIp(request);

  return createHash("sha256")
    .update(
      `spaghetti-trial:${clientIp}`
    )
    .digest("hex");
}

function getDailyWindow() {
  const now = new Date();

  const reset = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0,
    0,
    0,
    0
  );

  const dateKey =
    now.toISOString().slice(0, 10);

  return {
    dateKey,
    reset,
    resetAt: new Date(reset).toISOString(),
  };
}

function getTrialKey(
  request: Request
) {
  const identifier =
    getTrialIdentifier(request);

  const { dateKey } =
    getDailyWindow();

  /*
   * v3 intentionally starts a clean
   * quota namespace after the previous
   * pre-charge-only implementation.
   */
  return `spaghetti:trial:v3:${dateKey}:${identifier}`;
}

function disabledStatus(): TrialStatus {
  return {
    enabled: false,
    limit: DAILY_TRIAL_LIMIT,
    remaining:
      DAILY_TRIAL_LIMIT,
    reset: null,
    resetAt: null,
  };
}

function enabledStatusFromUsed(
  used: number
): TrialStatus {
  const { reset, resetAt } =
    getDailyWindow();

  const safeUsed = Math.max(
    0,
    Math.floor(
      Number.isFinite(used)
        ? used
        : 0
    )
  );

  return {
    enabled: true,
    limit: DAILY_TRIAL_LIMIT,
    remaining: Math.max(
      0,
      DAILY_TRIAL_LIMIT -
        safeUsed
    ),
    reset,
    resetAt,
  };
}

function toNumber(value: unknown) {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

export async function getTrialStatus(
  request: Request
): Promise<TrialStatus> {
  const redis =
    getTrialRedis();

  if (!redis) {
    return disabledStatus();
  }

  try {
    const key =
      getTrialKey(request);

    const usedRaw =
      await redis.get<
        number | string
      >(key);

    return enabledStatusFromUsed(
      toNumber(usedRaw)
    );
  } catch (error) {
    console.warn(
      "Trial status check failed. Allowing the request.",
      error
    );

    return disabledStatus();
  }
}

export async function consumeTrialGeneration(
  request: Request
): Promise<TrialConsumeResult> {
  const redis =
    getTrialRedis();

  if (!redis) {
    if (
      process.env.NODE_ENV ===
      "production"
    ) {
      return {
        success: false,
        unavailable: true,
        ...disabledStatus(),
      };
    }

    return {
      success: true,
      unavailable: false,
      ...disabledStatus(),
    };
  }

  try {
    const key =
      getTrialKey(request);

    const { reset } =
      getDailyWindow();

    const resetSeconds =
      Math.floor(reset / 1000);

    /*
     * Atomically reserve exactly one
     * generation. If the daily quota is
     * already full, do not increment it.
     */
    const rawResult =
      await redis.eval(
        `
local current = tonumber(redis.call('GET', KEYS[1]) or '0')
local max_allowed = tonumber(ARGV[1])
local reset_at = tonumber(ARGV[2])

if current >= max_allowed then
  return {0, current}
end

local next_value = redis.call('INCR', KEYS[1])

if next_value == 1 then
  redis.call('EXPIREAT', KEYS[1], reset_at)
end

return {1, next_value}
        `,
        [key],
        [
          String(
            DAILY_TRIAL_LIMIT
          ),
          String(resetSeconds),
        ]
      );

    const result =
      Array.isArray(rawResult)
        ? rawResult
        : [0, DAILY_TRIAL_LIMIT];

    const success =
      toNumber(result[0]) === 1;

    const used =
      toNumber(result[1]);

    return {
      success,
      unavailable: false,
      ...enabledStatusFromUsed(
        used
      ),
    };
  } catch (error) {
    /*
     * In local development we fail open so
     * debugging is not blocked by Redis.
     * In production we fail closed so a
     * Redis outage or missing credentials
     * cannot silently remove cost protection.
     */
    console.warn(
      process.env.NODE_ENV === "production"
        ? "Trial limiter failed. Blocking fresh generation in production."
        : "Trial limiter failed. Allowing the request in local development.",
      error
    );

    if (
      process.env.NODE_ENV ===
      "production"
    ) {
      return {
        success: false,
        unavailable: true,
        ...disabledStatus(),
      };
    }

    return {
      success: true,
      unavailable: false,
      ...disabledStatus(),
    };
  }
}

export async function refundTrialGeneration(
  request: Request
): Promise<TrialStatus> {
  const redis =
    getTrialRedis();

  if (!redis) {
    return disabledStatus();
  }

  try {
    const key =
      getTrialKey(request);

    /*
     * A failed fresh-path generation must
     * not cost the visitor one of their
     * two successful daily paths.
     *
     * This script decrements exactly one
     * reservation while preserving the
     * key's existing expiry.
     */
    const usedRaw =
      await redis.eval(
        `
local current = tonumber(redis.call('GET', KEYS[1]) or '0')

if current <= 0 then
  return 0
end

if current == 1 then
  redis.call('DEL', KEYS[1])
  return 0
end

return redis.call('DECR', KEYS[1])
        `,
        [key],
        []
      );

    return enabledStatusFromUsed(
      toNumber(usedRaw)
    );
  } catch (error) {
    console.warn(
      "Trial refund failed.",
      error
    );

    return getTrialStatus(
      request
    );
  }
}
