import { beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

type Runner = typeof import("@/lib/server/tasks/runner");

let runner: Runner;

beforeAll(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "signal-test-"));
  process.env.SIGNAL_DB_PATH = path.join(dir, "test.db");
  runner = await import("@/lib/server/tasks/runner");
});

describe("task runner", () => {
  it("records a successful run", async () => {
    const run = await runner.runTask("briefing", "manual", async () => "ok", {
      retries: 0,
      baseDelayMs: 5,
    });
    expect(run.status).toBe("success");
    expect(run.result).toBe("ok");
  });

  it("retries a transient failure then succeeds", async () => {
    let attempts = 0;
    const run = await runner.runTask(
      "briefing",
      "manual",
      async () => {
        attempts += 1;
        if (attempts < 2) throw new Error("transient");
        return "done";
      },
      { retries: 2, baseDelayMs: 5 },
    );
    expect(run.status).toBe("success");
    expect(attempts).toBe(2);
  });

  it("records an error on final failure", async () => {
    const run = await runner.runTask(
      "briefing",
      "manual",
      async () => {
        throw new Error("boom");
      },
      { retries: 1, baseDelayMs: 5 },
    );
    expect(run.status).toBe("error");
    expect(run.error).toContain("boom");
  });

  it("skips when the lock is already held", async () => {
    expect(runner.tryAcquireLock("sync", 60000)).toBe(true);
    try {
      const run = await runner.runTask("sync", "manual", async () => "x", { retries: 0 });
      expect(run.status).toBe("skipped");
      expect(run.skippedReason).toContain("lock");
    } finally {
      runner.releaseLock("sync");
    }
  });

  it("exposes the last successful run", async () => {
    const last = runner.lastSuccessfulRun("briefing");
    expect(last?.status).toBe("success");
  });
});
