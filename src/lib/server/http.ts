import "server-only";
import { assertSafeUrl, UnsafeUrlError } from "./url-guard";

export class HttpError extends Error {
  constructor(
    message: string,
    public readonly status: number | null,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

/**
 * Minimal token-bucket style limiter: enforces a minimum interval between
 * outbound requests across the whole process.
 */
export class RateLimiter {
  private lastRequestAt = 0;

  constructor(private readonly minIntervalMs: number) {}

  async wait(): Promise<void> {
    const now = Date.now();
    const wait = Math.max(0, this.lastRequestAt + this.minIntervalMs - now);
    if (wait > 0) {
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
    this.lastRequestAt = Date.now();
  }
}

interface SafeFetchOptions {
  allowHosts?: string[];
  timeoutMs?: number;
  rateLimiter?: RateLimiter;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

/** Fetch with SSRF validation, timeout, and redirect rejection. */
export async function safeFetch(
  rawUrl: string,
  options: SafeFetchOptions = {},
): Promise<Response> {
  await assertSafeUrl(rawUrl, { allowHosts: options.allowHosts });
  if (options.rateLimiter) await options.rateLimiter.wait();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 15000);
  const onAbort = () => controller.abort();
  options.signal?.addEventListener("abort", onAbort, { once: true });

  try {
    const response = await fetch(rawUrl, {
      headers: {
        "user-agent": "SIGNAL-Intelligence/0.2 (+local research dashboard)",
        accept: "application/json, application/atom+xml, application/xml, text/xml",
        ...options.headers,
      },
      redirect: "error",
      signal: controller.signal,
      cache: "no-store",
    });
    return response;
  } catch (error) {
    if (controller.signal.aborted && !options.signal?.aborted) {
      throw new HttpError(`Request timed out after ${options.timeoutMs}ms`, null);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", onAbort);
  }
}

interface RetryOptions {
  retries?: number;
  baseDelayMs?: number;
  timeoutMs?: number;
  allowHosts?: string[];
  rateLimiter?: RateLimiter;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /** Delay used for HTTP 429 when the server sends no `Retry-After`. */
  rateLimitDelayMs?: number;
  /** Max additional attempts allowed for HTTP 429 (defaults to `retries`). */
  rateLimitRetries?: number;
}

/**
 * Fetch with a bounded number of retries. Retries only on network errors,
 * HTTP 429 (rate limit) and 5xx responses, honoring `Retry-After`.
 */
export async function fetchWithRetry(
  rawUrl: string,
  options: RetryOptions = {},
): Promise<Response> {
  const retries = options.retries ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 1000;
  const rateLimitDelayMs = options.rateLimitDelayMs ?? baseDelayMs;
  const rateLimitRetries = options.rateLimitRetries ?? retries;

  let lastError: unknown;
  let transportAttempts = 0;
  let rateLimitAttempts = 0;

  for (;;) {
    let response: Response;
    try {
      response = await safeFetch(rawUrl, {
        allowHosts: options.allowHosts,
        timeoutMs: options.timeoutMs,
        rateLimiter: options.rateLimiter,
        headers: options.headers,
        signal: options.signal,
      });
    } catch (error) {
      if (error instanceof UnsafeUrlError) throw error;
      if (options.signal?.aborted) throw error;
      lastError = error;
      if (transportAttempts < retries) {
        await sleep(baseDelayMs * 2 ** transportAttempts + Math.random() * 300);
        transportAttempts += 1;
        continue;
      }
      break;
    }

    if (response.ok) return response;

    if (response.status === 429) {
      if (rateLimitAttempts >= rateLimitRetries) {
        throw new HttpError(`HTTP 429 from ${hostOf(rawUrl)}`, 429);
      }
      const retryAfter = Number(response.headers.get("retry-after"));
      const delay =
        Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : rateLimitDelayMs * 2 ** rateLimitAttempts;
      rateLimitAttempts += 1;
      await sleep(delay + Math.random() * 300);
      continue;
    }

    // 4xx responses (except 429) are not transient — fail immediately.
    if (response.status < 500) {
      throw new HttpError(`HTTP ${response.status} from ${hostOf(rawUrl)}`, response.status);
    }
    if (transportAttempts >= retries) {
      throw new HttpError(`HTTP ${response.status} from ${hostOf(rawUrl)}`, response.status);
    }

    const retryAfter = Number(response.headers.get("retry-after"));
    const delay =
      Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : baseDelayMs * 2 ** transportAttempts;
    transportAttempts += 1;
    await sleep(delay + Math.random() * 300);
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Failed to fetch ${hostOf(rawUrl)}`);
}

function hostOf(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname;
  } catch {
    return rawUrl;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
