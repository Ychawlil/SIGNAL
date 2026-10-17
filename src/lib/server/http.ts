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

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
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
      if (attempt < retries) {
        await sleep(baseDelayMs * 2 ** attempt + Math.random() * 300);
        continue;
      }
      break;
    }

    if (response.ok) return response;

    // 4xx responses (except 429) are not transient — fail immediately.
    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable) {
      throw new HttpError(`HTTP ${response.status} from ${hostOf(rawUrl)}`, response.status);
    }
    if (attempt === retries) {
      throw new HttpError(`HTTP ${response.status} from ${hostOf(rawUrl)}`, response.status);
    }

    const retryAfter = Number(response.headers.get("retry-after"));
    const delay = Number.isFinite(retryAfter) && retryAfter > 0
      ? retryAfter * 1000
      : baseDelayMs * 2 ** attempt;
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
