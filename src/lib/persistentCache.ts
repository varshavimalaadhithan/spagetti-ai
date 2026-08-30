import { Redis } from "@upstash/redis";

const CACHE_NAMESPACE =
  "spaghetti:cache:v1";

let redisClient:
  | Redis
  | null
  | undefined;

let missingCredentialsLogged = false;

function getRedisClient() {
  if (redisClient !== undefined) {
    return redisClient;
  }

  const url =
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.KV_REST_API_URL;

  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.KV_REST_API_TOKEN;

  if (!url || !token) {
    redisClient = null;

    if (!missingCredentialsLogged) {
      console.log(
        "Persistent cache disabled: Upstash Redis credentials are not configured."
      );

      missingCredentialsLogged = true;
    }

    return null;
  }

  redisClient = new Redis({
    url,
    token,
    enableAutoPipelining: true,
  });

  return redisClient;
}

function namespacedKey(
  key: string
) {
  return `${CACHE_NAMESPACE}:${key}`;
}

export function isPersistentCacheEnabled() {
  return getRedisClient() !== null;
}

export async function getPersistentCache<T>(
  key: string
): Promise<T | null> {
  const redis = getRedisClient();

  if (!redis) {
    return null;
  }

  try {
    const value =
      await redis.get<T>(
        namespacedKey(key)
      );

    return value ?? null;
  } catch (error) {
    console.warn(
      `Persistent cache read failed for ${key}.`,
      error
    );

    return null;
  }
}

export async function setPersistentCache<T>(
  key: string,
  value: T,
  ttlSeconds =
    30 * 24 * 60 * 60
) {
  const redis = getRedisClient();

  if (!redis) {
    return;
  }

  try {
    await redis.set(
      namespacedKey(key),
      value,
      {
        ex: ttlSeconds,
      }
    );
  } catch (error) {
    console.warn(
      `Persistent cache write failed for ${key}.`,
      error
    );
  }
}

export async function deletePersistentCache(
  key: string
) {
  const redis = getRedisClient();

  if (!redis) {
    return;
  }

  try {
    await redis.del(
      namespacedKey(key)
    );
  } catch (error) {
    console.warn(
      `Persistent cache delete failed for ${key}.`,
      error
    );
  }
}
