import fs from "fs";
import path from "path";

const memoryCache = new Map<string, unknown>();

const CACHE_DIR = path.join(
  process.cwd(),
  ".spaghetti-cache"
);

function useDiskCache() {
  return process.env.NODE_ENV !== "production";
}

function safeFilename(key: string) {
  return key.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function getCachePath(key: string) {
  return path.join(
    CACHE_DIR,
    `${safeFilename(key)}.json`
  );
}

export function getCache<T>(
  key: string
): T | null {
  if (memoryCache.has(key)) {
    return memoryCache.get(key) as T;
  }

  if (!useDiskCache()) {
    return null;
  }

  try {
    const filePath = getCachePath(key);

    if (!fs.existsSync(filePath)) {
      return null;
    }

    const raw = fs.readFileSync(
      filePath,
      "utf8"
    );

    const parsed = JSON.parse(raw) as T;

    memoryCache.set(
      key,
      parsed
    );

    return parsed;
  } catch (error) {
    console.warn(
      `Local cache read failed for ${key}.`,
      error
    );

    return null;
  }
}

export function setCache<T>(
  key: string,
  value: T
) {
  memoryCache.set(
    key,
    value
  );

  if (!useDiskCache()) {
    return;
  }

  try {
    fs.mkdirSync(
      CACHE_DIR,
      {
        recursive: true,
      }
    );

    fs.writeFileSync(
      getCachePath(key),
      JSON.stringify(value),
      "utf8"
    );
  } catch (error) {
    console.warn(
      `Local cache write failed for ${key}.`,
      error
    );
  }
}

export function deleteCache(
  key: string
) {
  memoryCache.delete(key);

  if (!useDiskCache()) {
    return;
  }

  try {
    const filePath = getCachePath(key);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.warn(
      `Local cache delete failed for ${key}.`,
      error
    );
  }
}
