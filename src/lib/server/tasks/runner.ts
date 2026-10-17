import "server-only";
import { getDb } from "../db";

export type TaskName = "sync" | "analyze" | "briefing" | "trends" | "pipeline";
export type TaskTrigger = "manual" | "scheduled";
export type TaskStatus = "running" | "success" | "error" | "skipped";

function nowIso(): string {
  return new Date().toISOString();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Atomically acquire a named lease so concurrent runs are impossible. */
export function tryAcquireNamedLock(name: string, leaseMs: number): boolean {
  const database = getDb();
  const now = nowIso();
  const leaseUntil = new Date(Date.now() + leaseMs).toISOString();
  database
    .prepare(`DELETE FROM task_locks WHERE lease_until <= ?`)
    .run(now);
  const result = database
    .prepare(
      `INSERT OR IGNORE INTO task_locks (task, acquired_at, lease_until) VALUES (?, ?, ?)`,
    )
    .run(name, now, leaseUntil);
  return result.changes > 0;
}

export function releaseNamedLock(name: string): void {
  getDb().prepare(`DELETE FROM task_locks WHERE task = ?`).run(name);
}

/** Renew a lock the caller already owns. Returns true if it still owns it. */
export function extendNamedLock(name: string, leaseMs: number): boolean {
  const database = getDb();
  const leaseUntil = new Date(Date.now() + leaseMs).toISOString();
  const result = database
    .prepare(`UPDATE task_locks SET lease_until = ? WHERE task = ?`)
    .run(leaseUntil, name);
  return result.changes > 0;
}

/** Atomically acquire a per-task lease so concurrent runs are impossible. */
export function tryAcquireLock(task: TaskName, leaseMs: number): boolean {
  return tryAcquireNamedLock(task, leaseMs);
}

export function releaseLock(task: TaskName): void {
  releaseNamedLock(task);
}

export interface TaskRunResult<T = unknown> {
  runId: number;
  task: TaskName;
  trigger: TaskTrigger;
  status: TaskStatus;
  startedAt: string;
  finishedAt: string | null;
  result: T | null;
  error: string | null;
  skippedReason: string | null;
}

export interface RunOptions {
  retries?: number;
  leaseMs?: number;
  baseDelayMs?: number;
}

/**
 * Run a task exactly once (per lease window), recording every execution.
 * Retries are bounded; on failure the previous successful result remains in
 * the database because tasks never delete existing data on error.
 */
export async function runTask<T>(
  task: TaskName,
  trigger: TaskTrigger,
  fn: () => Promise<T>,
  options: RunOptions = {},
): Promise<TaskRunResult<T>> {
  const retries = options.retries ?? 2;
  const leaseMs = options.leaseMs ?? 30 * 60 * 1000; // 30 min
  const baseDelayMs = options.baseDelayMs ?? 1500;

  if (!tryAcquireLock(task, leaseMs)) {
    const database = getDb();
    const startedAt = nowIso();
    const runId = Number(
      (
        database
          .prepare(
            `INSERT INTO task_runs (task, trigger, status, started_at, skipped_reason)
             VALUES (?, ?, 'skipped', ?, ?)`,
          )
          .run(task, trigger, startedAt, "another run holds the lock")
      ).lastInsertRowid,
    );
    return {
      runId,
      task,
      trigger,
      status: "skipped",
      startedAt,
      finishedAt: startedAt,
      result: null,
      error: null,
      skippedReason: "another run holds the lock",
    };
  }

  const database = getDb();
  const startedAt = nowIso();
  const runId = Number(
    (
      database
        .prepare(
          `INSERT INTO task_runs (task, trigger, status, started_at)
           VALUES (?, ?, 'running', ?)`,
        )
        .run(task, trigger, startedAt)
    ).lastInsertRowid,
  );

  let lastError: unknown = null;

  try {
    let result: T | null = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        result = await fn();
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
        if (attempt < retries) {
          await sleep(baseDelayMs * 2 ** attempt + Math.random() * 500);
        }
      }
    }

    if (lastError) {
      const message = lastError instanceof Error ? lastError.message : String(lastError);
      const finishedAt = nowIso();
      database
        .prepare(
          `UPDATE task_runs SET status = 'error', finished_at = ?, error = ? WHERE id = ?`,
        )
        .run(finishedAt, message.slice(0, 4000), runId);
      return {
        runId,
        task,
        trigger,
        status: "error",
        startedAt,
        finishedAt,
        result: null,
        error: message,
        skippedReason: null,
      };
    }

    const finishedAt = nowIso();
    database
      .prepare(
        `UPDATE task_runs SET status = 'success', finished_at = ?, result_json = ? WHERE id = ?`,
      )
      .run(finishedAt, JSON.stringify(result ?? null).slice(0, 100000), runId);
    return {
      runId,
      task,
      trigger,
      status: "success",
      startedAt,
      finishedAt,
      result,
      error: null,
      skippedReason: null,
    };
  } finally {
    releaseLock(task);
  }
}

export interface TaskRunRow {
  id: number;
  task: TaskName;
  trigger: TaskTrigger;
  status: TaskStatus;
  startedAt: string;
  finishedAt: string | null;
  error: string | null;
  skippedReason: string | null;
}

export function listTaskRuns(task: TaskName | "all", limit = 20): TaskRunRow[] {
  const database = getDb();
  const rows = (
    task === "all"
      ? database
          .prepare(
            `SELECT id, task, trigger, status, started_at, finished_at, error, skipped_reason
             FROM task_runs ORDER BY started_at DESC LIMIT ?`,
          )
          .all(limit)
      : database
          .prepare(
            `SELECT id, task, trigger, status, started_at, finished_at, error, skipped_reason
             FROM task_runs WHERE task = ? ORDER BY started_at DESC LIMIT ?`,
          )
          .all(task, limit)
  ) as Record<string, unknown>[];

  return rows.map((row) => ({
    id: Number(row.id),
    task: row.task as TaskName,
    trigger: row.trigger as TaskTrigger,
    status: row.status as TaskStatus,
    startedAt: String(row.started_at),
    finishedAt: row.finished_at ? String(row.finished_at) : null,
    error: row.error ? String(row.error) : null,
    skippedReason: row.skipped_reason ? String(row.skipped_reason) : null,
  }));
}

export function lastSuccessfulRun(task: TaskName): TaskRunRow | null {
  const database = getDb();
  const row = database
    .prepare(
      `SELECT id, task, trigger, status, started_at, finished_at, error, skipped_reason
       FROM task_runs WHERE task = ? AND status = 'success'
       ORDER BY started_at DESC LIMIT 1`,
    )
    .get(task) as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    id: Number(row.id),
    task: row.task as TaskName,
    trigger: row.trigger as TaskTrigger,
    status: row.status as TaskStatus,
    startedAt: String(row.started_at),
    finishedAt: row.finished_at ? String(row.finished_at) : null,
    error: row.error ? String(row.error) : null,
    skippedReason: row.skipped_reason ? String(row.skipped_reason) : null,
  };
}
