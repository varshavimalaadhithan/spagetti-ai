import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import {
  type NextRequest,
  NextResponse,
} from "next/server";

type LimiterName =
  | "search"
  | "rank"
  | "learningPath"
  | "trialStatus";

type Limiters = Record<
  LimiterName,
  Ratelimit
>;

const MAX_QUERY_LENGTH = 200;

let limiters:
  | Limiters
  | null
  | undefined;

let missingRedisLogged = false;

function getLimiters(): Limiters | null {
  if (limiters !== undefined) {
    return limiters;
  }

  const url =
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.KV_REST_API_URL;

  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.KV_REST_API_TOKEN;

  if (!url || !token) {
    limiters = null;

    if (!missingRedisLogged) {
      console.warn(
        "Public API rate limiting is unavailable because Redis credentials are missing."
      );

      missingRedisLogged = true;
    }

    return null;
  }

  const redis = new Redis({
    url,
    token,
    enableAutoPipelining: true,
  });

  limiters = {
    search: new Ratelimit({
      redis,
      limiter: Ratelimit.fixedWindow(
        20,
        "10 m"
      ),
      prefix:
        "spaghetti:rate:search:v1",
      analytics: false,
      timeout: 1500,
    }),

    rank: new Ratelimit({
      redis,
      limiter: Ratelimit.fixedWindow(
        10,
        "10 m"
      ),
      prefix:
        "spaghetti:rate:rank:v1",
      analytics: false,
      timeout: 1500,
    }),

    learningPath: new Ratelimit({
      redis,
      limiter: Ratelimit.fixedWindow(
        10,
        "10 m"
      ),
      prefix:
        "spaghetti:rate:path:v1",
      analytics: false,
      timeout: 1500,
    }),

    trialStatus: new Ratelimit({
      redis,
      limiter: Ratelimit.fixedWindow(
        60,
        "10 m"
      ),
      prefix:
        "spaghetti:rate:trial-status:v1",
      analytics: false,
      timeout: 1500,
    }),
  };

  return limiters;
}

function getClientIp(
  request: NextRequest
) {
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

  return "unknown-client";
}

async function hashIdentifier(
  value: string
) {
  const bytes =
    new TextEncoder().encode(
      value
    );

  const digest =
    await crypto.subtle.digest(
      "SHA-256",
      bytes
    );

  return Array.from(
    new Uint8Array(digest)
  )
    .map((byte) =>
      byte
        .toString(16)
        .padStart(2, "0")
    )
    .join("");
}

function applySecurityHeaders(
  response: NextResponse
) {
  response.headers.set(
    "X-Content-Type-Options",
    "nosniff"
  );

  response.headers.set(
    "X-Frame-Options",
    "DENY"
  );

  response.headers.set(
    "Referrer-Policy",
    "strict-origin-when-cross-origin"
  );

  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );

  if (
    process.env.NODE_ENV ===
    "production"
  ) {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000"
    );
  }

  return response;
}

function jsonError(
  message: string,
  status: number,
  extraHeaders?: Record<
    string,
    string
  >
) {
  const response =
    NextResponse.json(
      {
        error: message,
      },
      {
        status,
        headers: {
          "Cache-Control":
            "no-store, max-age=0",
          ...extraHeaders,
        },
      }
    );

  return applySecurityHeaders(
    response
  );
}

/*
 * Allows:
 * - normal localhost same-origin requests
 * - normal Vercel same-origin requests
 * - Cloudflare Quick Tunnel requests
 *
 * Still rejects unrelated cross-site browser POSTs.
 */
function isSameOriginBrowserRequest(
  request: NextRequest
) {
  const origin =
    request.headers.get("origin");

  if (!origin) {
    return true;
  }

  let originUrl: URL;

  try {
    originUrl =
      new URL(origin);
  } catch {
    return false;
  }

  /*
   * Normal same-origin request.
   */
  if (
    originUrl.origin ===
    request.nextUrl.origin
  ) {
    return true;
  }

  /*
   * Reverse proxies can expose the public host
   * through x-forwarded-host.
   */
  const forwardedHost =
    request.headers
      .get("x-forwarded-host")
      ?.split(",")[0]
      ?.trim();

  const forwardedProto =
    request.headers
      .get("x-forwarded-proto")
      ?.split(",")[0]
      ?.trim();

  if (forwardedHost) {
    const protocol =
      forwardedProto ||
      originUrl.protocol.replace(
        ":",
        ""
      ) ||
      "https";

    const forwardedOrigin =
      `${protocol}://${forwardedHost}`;

    if (
      originUrl.origin ===
      forwardedOrigin
    ) {
      return true;
    }
  }

  /*
   * Also compare against the Host header.
   */
  const host =
    request.headers.get("host");

  if (
    host &&
    originUrl.host === host
  ) {
    return true;
  }

  /*
   * Cloudflare Quick Tunnel.
   */
  const isQuickTunnel =
    originUrl.protocol === "https:" &&
    originUrl.hostname.endsWith(
      ".trycloudflare.com"
    );

  const cloudflareRequest =
    Boolean(
      request.headers.get("cf-ray") ||
      request.headers.get(
        "cf-connecting-ip"
      )
    );

  if (
    isQuickTunnel &&
    cloudflareRequest
  ) {
    return true;
  }

  return false;
}

async function checkRateLimit(
  request: NextRequest,
  limiterName: LimiterName
) {
  const currentLimiters =
    getLimiters();

  if (!currentLimiters) {
    if (
      process.env.NODE_ENV ===
      "production"
    ) {
      return jsonError(
        "The service is temporarily unavailable. Please try again shortly.",
        503
      );
    }

    return null;
  }

  const clientIp =
    getClientIp(request);

  const identifier =
    await hashIdentifier(
      `spaghetti-public-api:${clientIp}`
    );

  let result;

  try {
    result =
      await currentLimiters[
        limiterName
      ].limit(identifier);
  } catch (error) {
    console.error(
      "Public API rate-limit check failed.",
      error
    );

    if (
      process.env.NODE_ENV ===
      "production"
    ) {
      return jsonError(
        "The service is temporarily unavailable. Please try again shortly.",
        503
      );
    }

    return null;
  }

  if (
    result.success &&
    !(
      process.env.NODE_ENV ===
        "production" &&
      result.reason === "timeout"
    )
  ) {
    return null;
  }

  if (
    result.reason === "timeout"
  ) {
    return jsonError(
      "The service is temporarily unavailable. Please try again shortly.",
      503
    );
  }

  const retryAfterSeconds =
    Math.max(
      1,
      Math.ceil(
        (result.reset -
          Date.now()) /
          1000
      )
    );

  return jsonError(
    "Too many requests. Please wait a little and try again.",
    429,
    {
      "Retry-After": String(
        retryAfterSeconds
      ),
    }
  );
}

export async function proxy(
  request: NextRequest
) {
  const pathname =
    request.nextUrl.pathname;

  /*
   * Apply security headers to normal pages.
   */
  if (!pathname.startsWith("/api/")) {
    return applySecurityHeaders(
      NextResponse.next()
    );
  }

  const allowedApiRoutes =
    new Set([
      "/api/search",
      "/api/rank-videos",
      "/api/learning-path",
      "/api/trial-status",
    ]);

  if (
    !allowedApiRoutes.has(pathname)
  ) {
    return jsonError(
      "Not found.",
      404
    );
  }

  if (
    (
      pathname ===
        "/api/rank-videos" ||
      pathname ===
        "/api/learning-path"
    ) &&
    !isSameOriginBrowserRequest(
      request
    )
  ) {
    return jsonError(
      "Cross-site requests are not allowed.",
      403
    );
  }

  if (
    pathname === "/api/search"
  ) {
    if (request.method !== "GET") {
      return jsonError(
        "Method not allowed.",
        405,
        {
          Allow: "GET",
        }
      );
    }

    const query =
      request.nextUrl.searchParams
        .get("query")
        ?.trim() || "";

    if (
      query.length < 2 ||
      query.length >
        MAX_QUERY_LENGTH
    ) {
      return jsonError(
        `Learning topics must be between 2 and ${MAX_QUERY_LENGTH} characters.`,
        400
      );
    }

    const limited =
      await checkRateLimit(
        request,
        "search"
      );

    if (limited) {
      return limited;
    }
  }

  if (
    pathname ===
    "/api/rank-videos"
  ) {
    if (
      request.method !== "POST"
    ) {
      return jsonError(
        "Method not allowed.",
        405,
        {
          Allow: "POST",
        }
      );
    }

    const limited =
      await checkRateLimit(
        request,
        "rank"
      );

    if (limited) {
      return limited;
    }
  }

  if (
    pathname ===
    "/api/learning-path"
  ) {
    if (
      request.method !== "POST"
    ) {
      return jsonError(
        "Method not allowed.",
        405,
        {
          Allow: "POST",
        }
      );
    }

    const limited =
      await checkRateLimit(
        request,
        "learningPath"
      );

    if (limited) {
      return limited;
    }
  }

  if (
    pathname ===
    "/api/trial-status"
  ) {
    if (
      request.method !== "GET"
    ) {
      return jsonError(
        "Method not allowed.",
        405,
        {
          Allow: "GET",
        }
      );
    }

    const limited =
      await checkRateLimit(
        request,
        "trialStatus"
      );

    if (limited) {
      return limited;
    }
  }

  return applySecurityHeaders(
    NextResponse.next()
  );
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};