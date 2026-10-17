import "server-only";
import { getServerConfig } from "./env";
import { RateLimiter, safeFetch } from "./http";

/**
 * Shared GitHub REST client.
 *
 * Implements the retry rules from
 * https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api
 *   - primary rate limit (x-ratelimit-remaining: 0): never retried; wait for reset
 *   - secondary rate limit (abuse detection): retried at most once, honouring
 *     `retry-after`
 *   - authentication / permission failures: never retried
 *   - 5xx / network: bounded exponential backoff
 *
 * Tokens are read server-side only and are never included in messages.
 */

export const GITHUB_API_HOST = "api.github.com";
const USER_AGENT = "SIGNAL-Intelligence/0.2";
const MAX_TRANSPORT_RETRIES = 2;
const MAX_SECONDARY_RETRY_WAIT_MS = 60_000;

export type GithubErrorKind =
  | "auth-failed"
  | "forbidden"
  | "primary-rate-limit"
  | "secondary-rate-limit"
  | "not-found"
  | "server-error"
  | "network";

export interface GithubRateLimitSnapshot {
  limit: number | null;
  remaining: number | null;
  used: number | null;
  resetAt: string | null;
  resource: string | null;
  retryAfterSeconds: number | null;
}

export interface GithubAuthInfo {
  tokenConfigured: boolean;
  tokenFormat: "fine-grained" | "classic" | "oauth" | "app" | "unknown" | "none";
  tokenLength: number;
  /** True when GitHub accepted the token (core limit above the anonymous 60/h). */
  authenticated: boolean;
  limit: number | null;
  remaining: number | null;
  resetAt: string | null;
  searchLimit: number | null;
  searchRemaining: number | null;
  probedAt: string | null;
  error: string | null;
}

export class GithubApiError extends Error {
  constructor(
    message: string,
    public readonly kind: GithubErrorKind,
    public readonly status: number | null,
    public readonly rateLimit: GithubRateLimitSnapshot | null,
  ) {
    super(message);
    this.name = "GithubApiError";
  }
}

/* ------------------------------------------------------------------ */
/* Token handling (never logged)                                       */
/* ------------------------------------------------------------------ */

export function describeToken(token: string | undefined): {
  configured: boolean;
  format: GithubAuthInfo["tokenFormat"];
  length: number;
} {
  if (!token) return { configured: false, format: "none", length: 0 };
  const format: GithubAuthInfo["tokenFormat"] = token.startsWith("github_pat_")
    ? "fine-grained"
    : token.startsWith("ghp_")
      ? "classic"
      : token.startsWith("gho_")
        ? "oauth"
        : token.startsWith("ghs_")
          ? "app"
          : "unknown";
  return { configured: true, format, length: token.length };
}

const TOKEN_PATTERNS = [
  /github_pat_[A-Za-z0-9_]{10,}/g,
  /gh[pousr]_[A-Za-z0-9]{10,}/g,
];

/** Strip anything that looks like a GitHub credential from free-form text. */
export function sanitizeGithubMessage(text: string, maxLength = 500): string {
  let out = text;
  for (const pattern of TOKEN_PATTERNS) out = out.replace(pattern, "[REDACTED]");
  return out.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

export function githubHeaders(): Record<string, string> {
  const config = getServerConfig();
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": USER_AGENT,
  };
  if (config.githubToken) headers.Authorization = `Bearer ${config.githubToken}`;
  return headers;
}

/* ------------------------------------------------------------------ */
/* Rate-limit header parsing + error classification                     */
/* ------------------------------------------------------------------ */

function numberHeader(headers: Headers, name: string): number | null {
  const raw = headers.get(name);
  if (raw === null) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export function readRateLimit(headers: Headers): GithubRateLimitSnapshot {
  const resetSeconds = numberHeader(headers, "x-ratelimit-reset");
  const retryAfter = numberHeader(headers, "retry-after");
  return {
    limit: numberHeader(headers, "x-ratelimit-limit"),
    remaining: numberHeader(headers, "x-ratelimit-remaining"),
    used: numberHeader(headers, "x-ratelimit-used"),
    resetAt:
      resetSeconds !== null ? new Date(resetSeconds * 1000).toISOString() : null,
    resource: headers.get("x-ratelimit-resource"),
    retryAfterSeconds: retryAfter,
  };
}

/**
 * Distinguish authentication failure, permission failure, primary rate limit
 * and secondary rate limit from the status code, headers and body.
 */
export function classifyGithubError(
  status: number,
  headers: Headers,
  body: string,
): { kind: GithubErrorKind; message: string; rateLimit: GithubRateLimitSnapshot } {
  const rateLimit = readRateLimit(headers);
  const parsed = (() => {
    try {
      return JSON.parse(body) as { message?: string; documentation_url?: string };
    } catch {
      return {} as { message?: string; documentation_url?: string };
    }
  })();
  const rawMessage = sanitizeGithubMessage(parsed.message ?? body ?? "");

  let kind: GithubErrorKind;
  if (status === 401) {
    kind = "auth-failed";
  } else if (status === 404) {
    kind = "not-found";
  } else if (status === 403 || status === 429) {
    const exhausted = rateLimit.remaining === 0;
    const secondary =
      /secondary rate limit|abuse detection/i.test(rawMessage) ||
      (rateLimit.retryAfterSeconds !== null && !exhausted);
    const primary =
      !secondary && (exhausted || /api rate limit exceeded/i.test(rawMessage));
    kind = secondary
      ? "secondary-rate-limit"
      : primary
        ? "primary-rate-limit"
        : "forbidden";
  } else if (status >= 500) {
    kind = "server-error";
  } else {
    kind = "forbidden";
  }

  const detail = rawMessage || `HTTP ${status}`;
  const resetHint = rateLimit.resetAt
    ? ` (resets ${rateLimit.resetAt}, remaining ${rateLimit.remaining ?? "?"}/${rateLimit.limit ?? "?"})`
    : "";
  const retryHint =
    rateLimit.retryAfterSeconds !== null
      ? ` (retry-after ${rateLimit.retryAfterSeconds}s)`
      : "";

  const message = `GitHub ${kind}: ${detail}${resetHint}${retryHint}`;
  return { kind, message, rateLimit };
}

/* ------------------------------------------------------------------ */
/* Process-wide pacing                                                 */
/* ------------------------------------------------------------------ */

let limiter: RateLimiter | null = null;
let limiterInterval = 0;
let queue: Promise<unknown> = Promise.resolve();

/** GitHub asks clients to avoid bursts; serialize and space requests. */
function githubLimiter(): RateLimiter {
  const configured = getServerConfig().minRequestIntervalMs;
  const interval = Math.max(200, Number.isFinite(configured) ? configured : 1000);
  if (!limiter || limiterInterval !== interval) {
    limiter = new RateLimiter(interval);
    limiterInterval = interval;
  }
  return limiter;
}

function serialized<T>(task: () => Promise<T>): Promise<T> {
  const next = queue.then(task, task);
  queue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* ------------------------------------------------------------------ */
/* Request                                                             */
/* ------------------------------------------------------------------ */

export interface GithubRequestOptions {
  timeoutMs?: number;
}

/**
 * Authenticated GET returning parsed JSON. Throws {@link GithubApiError} with
 * a classified, token-free message.
 */
export async function githubGetJson<T>(
  path: string,
  options: GithubRequestOptions = {},
): Promise<T> {
  const response = await githubRequest(path, options);
  return (await response.json()) as T;
}

export async function githubRequest(
  path: string,
  options: GithubRequestOptions = {},
): Promise<Response> {
  const url = `https://${GITHUB_API_HOST}${path}`;
  const timeoutMs = options.timeoutMs ?? getServerConfig().requestTimeoutMs;
  const headers = githubHeaders();

  let transportRetries = 0;
  let secondaryRetried = false;

  for (;;) {
    const response = await serialized(async () => {
      const limiterRef = githubLimiter();
      return safeFetch(url, {
        allowHosts: [GITHUB_API_HOST],
        timeoutMs,
        rateLimiter: limiterRef,
        headers,
      });
    }).catch((error: unknown) => {
      throw new GithubApiError(
        `GitHub network error: ${sanitizeGithubMessage(
          error instanceof Error ? error.message : String(error),
        )}`,
        "network",
        null,
        null,
      );
    });

    if (response.ok) return response;

    const body = await response.text().catch(() => "");
    const { kind, message, rateLimit } = classifyGithubError(
      response.status,
      response.headers,
      body,
    );

    if (kind === "server-error" && transportRetries < MAX_TRANSPORT_RETRIES) {
      transportRetries += 1;
      const wait =
        (rateLimit.retryAfterSeconds ?? 0) > 0
          ? rateLimit.retryAfterSeconds! * 1000
          : 1000 * 2 ** (transportRetries - 1);
      await sleep(wait + Math.random() * 250);
      continue;
    }

    // One compliant retry for abuse detection, never for a plain 403.
    const retryAfterMs = (rateLimit.retryAfterSeconds ?? 0) * 1000;
    if (
      kind === "secondary-rate-limit" &&
      !secondaryRetried &&
      retryAfterMs > 0 &&
      retryAfterMs <= MAX_SECONDARY_RETRY_WAIT_MS
    ) {
      secondaryRetried = true;
      await sleep(retryAfterMs + 250);
      continue;
    }

    throw new GithubApiError(message, kind, response.status, rateLimit);
  }
}

/* ------------------------------------------------------------------ */
/* Authentication probe                                                */
/* ------------------------------------------------------------------ */

let cachedAuth: { value: GithubAuthInfo; at: number } | null = null;
const AUTH_CACHE_MS = 60_000;

/**
 * Probe GET /rate_limit to prove whether the configured token is accepted.
 * Anonymous access reports limit 60; any authenticated identity reports more.
 */
export async function probeGithubAuth(force = false): Promise<GithubAuthInfo> {
  const now = Date.now();
  if (!force && cachedAuth && now - cachedAuth.at < AUTH_CACHE_MS) {
    return cachedAuth.value;
  }

  const config = getServerConfig();
  const token = describeToken(config.githubToken);
  const base: GithubAuthInfo = {
    tokenConfigured: token.configured,
    tokenFormat: token.format,
    tokenLength: token.length,
    authenticated: false,
    limit: null,
    remaining: null,
    resetAt: null,
    searchLimit: null,
    searchRemaining: null,
    probedAt: new Date(now).toISOString(),
    error: null,
  };

  try {
    const response = await githubRequest("/rate_limit", { timeoutMs: 15_000 });
    const payload = (await response.json()) as {
      resources?: {
        core?: { limit?: number; remaining?: number; reset?: number };
        search?: { limit?: number; remaining?: number };
      };
      rate?: { limit?: number; remaining?: number; reset?: number };
    };
    const core = payload.resources?.core ?? payload.rate ?? {};
    const search = payload.resources?.search;
    const limit = core.limit ?? null;
    const value: GithubAuthInfo = {
      ...base,
      // Only a credential can raise the core ceiling above the 60/h anonymous tier.
      authenticated: limit !== null && limit > 60,
      limit,
      remaining: core.remaining ?? null,
      resetAt:
        typeof core.reset === "number"
          ? new Date(core.reset * 1000).toISOString()
          : null,
      searchLimit: search?.limit ?? null,
      searchRemaining: search?.remaining ?? null,
      error: null,
    };
    cachedAuth = { value, at: now };
    return value;
  } catch (error) {
    const info: GithubAuthInfo = {
      ...base,
      error:
        error instanceof GithubApiError
          ? error.message
          : sanitizeGithubMessage(error instanceof Error ? error.message : String(error)),
    };
    cachedAuth = { value: info, at: now };
    return info;
  }
}
