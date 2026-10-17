import { describe, expect, it, vi } from "vitest";
import {
  GithubApiError,
  classifyGithubError,
  describeToken,
  githubRequest,
  probeGithubAuth,
  readRateLimit,
  sanitizeGithubMessage,
} from "@/lib/server/github-api";

function headers(entries: Record<string, string>): Headers {
  return new Headers(entries);
}

const RESET = 1_792_229_979; // 2026-10-17T06:59:39Z

describe("GitHub token handling", () => {
  it("describes the token format without exposing it", () => {
    expect(describeToken(undefined)).toEqual({
      configured: false,
      format: "none",
      length: 0,
    });
    const fine = describeToken("github_pat_11ABCDEFG0_abcdefghijklmnop");
    expect(fine.configured).toBe(true);
    expect(fine.format).toBe("fine-grained");
    expect(fine.length).toBe("github_pat_11ABCDEFG0_abcdefghijklmnop".length);
    expect(JSON.stringify(fine)).not.toContain("github_pat_11abcdefg");
    expect(describeToken("ghp_1234567890abcdef").format).toBe("classic");
  });

  it("redacts credential-like strings from messages", () => {
    const raw =
      "Bad token github_pat_11ABCDEFG0_abcdefghijklmnop and ghp_ABCDEFGHIJKLMNOPQRST used";
    const clean = sanitizeGithubMessage(raw);
    expect(clean).not.toMatch(/github_pat_|ghp_/);
    expect(clean).toContain("[REDACTED]");
  });
});

describe("GitHub rate-limit headers", () => {
  it("parses limit/remaining/reset/retry-after", () => {
    const snapshot = readRateLimit(
      headers({
        "x-ratelimit-limit": "5000",
        "x-ratelimit-remaining": "4979",
        "x-ratelimit-used": "21",
        "x-ratelimit-reset": String(RESET),
        "x-ratelimit-resource": "core",
        "retry-after": "42",
      }),
    );
    expect(snapshot.limit).toBe(5000);
    expect(snapshot.remaining).toBe(4979);
    expect(snapshot.used).toBe(21);
    expect(snapshot.resource).toBe("core");
    expect(snapshot.resetAt).toBe(new Date(RESET * 1000).toISOString());
    expect(snapshot.retryAfterSeconds).toBe(42);
  });
});

describe("GitHub error classification", () => {
  it("flags bad credentials as auth-failed", () => {
    const result = classifyGithubError(
      401,
      headers({ "x-ratelimit-remaining": "0" }),
      JSON.stringify({ message: "Bad credentials" }),
    );
    expect(result.kind).toBe("auth-failed");
    expect(result.message).toContain("Bad credentials");
  });

  it("distinguishes a primary rate limit by remaining=0", () => {
    const result = classifyGithubError(
      403,
      headers({
        "x-ratelimit-limit": "30",
        "x-ratelimit-remaining": "0",
        "x-ratelimit-reset": String(RESET),
      }),
      JSON.stringify({ message: "API rate limit exceeded for user ID 1." }),
    );
    expect(result.kind).toBe("primary-rate-limit");
    expect(result.message).toContain("primary-rate-limit");
    expect(result.message).toContain("resets");
  });

  it("distinguishes a secondary rate limit by message/retry-after", () => {
    const result = classifyGithubError(
      403,
      headers({ "x-ratelimit-remaining": "4990", "retry-after": "20" }),
      JSON.stringify({
        message:
          "You have exceeded a secondary rate limit. Please wait a few minutes before you try again.",
      }),
    );
    expect(result.kind).toBe("secondary-rate-limit");
    expect(result.rateLimit.retryAfterSeconds).toBe(20);
    expect(result.message).toContain("retry-after 20s");
  });

  it("treats a bare 403 as a permission problem, not a rate limit", () => {
    const result = classifyGithubError(
      403,
      headers({ "x-ratelimit-remaining": "4998" }),
      JSON.stringify({
        message: "Resource not accessible by personal access token",
      }),
    );
    expect(result.kind).toBe("forbidden");
  });

  it("classifies 5xx as server errors", () => {
    expect(classifyGithubError(502, headers({}), "<html>bad gateway</html>").kind).toBe(
      "server-error",
    );
  });
});

describe("GitHub retry policy", () => {
  it("does not retry a plain 403", async () => {
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        calls += 1;
        return new Response(
          JSON.stringify({ message: "Resource not accessible by personal access token" }),
          {
            status: 403,
            headers: {
              "content-type": "application/json",
              "x-ratelimit-remaining": "4990",
            },
          },
        );
      }),
    );

    await expect(githubRequest("/repos/a/b/readme")).rejects.toBeInstanceOf(GithubApiError);
    expect(calls).toBe(1);
    vi.unstubAllGlobals();
  });

  it("does not retry a primary rate limit", async () => {
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        calls += 1;
        return new Response(JSON.stringify({ message: "API rate limit exceeded" }), {
          status: 403,
          headers: { "x-ratelimit-remaining": "0", "x-ratelimit-limit": "5000" },
        });
      }),
    );

    await expect(githubRequest("/user")).rejects.toMatchObject({
      kind: "primary-rate-limit",
    });
    expect(calls).toBe(1);
    vi.unstubAllGlobals();
  });

  it("never leaks the configured token in an error message", async () => {
    const secret = "github_pat_11ABCDEFG0_secretsecretsecret";
    process.env.GITHUB_TOKEN = secret;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            message: `Bad credentials for token ${secret}`,
          }),
          { status: 401, headers: { "content-type": "application/json" } },
        ),
      ),
    );

    const error = (await githubRequest("/user").then(
      () => null,
      (e: unknown) => e,
    )) as GithubApiError | null;
    expect(error).toBeInstanceOf(GithubApiError);
    expect(error?.message).not.toContain(secret);
    expect(error?.message).toContain("[REDACTED]");
    vi.unstubAllGlobals();
    delete process.env.GITHUB_TOKEN;
  });
});

describe("GitHub auth probe", () => {
  it("reports authenticated when the credential raises the core ceiling", async () => {
    process.env.GITHUB_TOKEN = "github_pat_11ABCDEFG0_abcdefghijklmnop";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            resources: {
              core: { limit: 5000, remaining: 4979, reset: RESET },
              search: { limit: 30, remaining: 30 },
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ),
    );

    const info = await probeGithubAuth(true);
    expect(info.tokenConfigured).toBe(true);
    expect(info.tokenFormat).toBe("fine-grained");
    expect(info.authenticated).toBe(true);
    expect(info.limit).toBe(5000);
    expect(info.searchLimit).toBe(30);
    expect(info.resetAt).toBe(new Date(RESET * 1000).toISOString());
    expect(JSON.stringify(info)).not.toContain("abcdefghijklmnop");
    vi.unstubAllGlobals();
    delete process.env.GITHUB_TOKEN;
  });

  it("reports not-authenticated for the anonymous 60/h tier", async () => {
    delete process.env.GITHUB_TOKEN;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            resources: { core: { limit: 60, remaining: 60, reset: RESET } },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ),
    );

    const info = await probeGithubAuth(true);
    expect(info.tokenConfigured).toBe(false);
    expect(info.limit).toBe(60);
    expect(info.authenticated).toBe(false);
    vi.unstubAllGlobals();
  });

  it("surfaces a rejected token as an auth error", async () => {
    process.env.GITHUB_TOKEN = "ghp_invalidtoken000000";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ message: "Bad credentials" }), {
          status: 401,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    const info = await probeGithubAuth(true);
    expect(info.authenticated).toBe(false);
    expect(info.error).toContain("auth-failed");
    vi.unstubAllGlobals();
    delete process.env.GITHUB_TOKEN;
  });
});
