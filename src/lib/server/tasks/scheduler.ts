import "server-only";
import { runPipeline } from "./jobs";
import { extendNamedLock, tryAcquireNamedLock } from "./runner";

let started = false;
let timer: ReturnType<typeof setInterval> | null = null;
let isOwner = false;
let running = false;

const OWNER = "scheduler-owner";

/**
 * In-process interval scheduler. Enabled only when SIGNAL_SCHEDULER_ENABLED
 * is "true". Instrumentation may run in several Next.js workers, so ownership
 * is lease-based: exactly one worker owns the schedule at a time, and a
 * crashed owner's lease expires so another worker takes over. Every tick runs
 * the pipeline (sync → analyze → briefing → trends); each step is locked,
 * idempotent, and recorded, so duplicate writes are impossible.
 */
export function startScheduler(): void {
  if (started) return;
  const enabled = process.env.SIGNAL_SCHEDULER_ENABLED === "true";
  if (!enabled) return;

  const raw = Number(process.env.SIGNAL_SCHEDULER_INTERVAL_MS ?? 21600000);
  const intervalMs = Number.isFinite(raw) && raw >= 15000 ? raw : 21600000;
  const ownerLeaseMs = intervalMs * 2 + 60_000;

  started = true;

  const tick = async () => {
    if (running) return;

    if (isOwner) {
      if (!extendNamedLock(OWNER, ownerLeaseMs)) {
        isOwner = false;
        return;
      }
    } else {
      if (!tryAcquireNamedLock(OWNER, ownerLeaseMs)) return;
      isOwner = true;
    }

    running = true;
    try {
      await runPipeline("scheduled");
    } catch (error) {
      console.error("[scheduler] pipeline error", error);
    } finally {
      running = false;
    }
  };

  setTimeout(() => {
    void tick();
  }, 3000);

  timer = setInterval(() => {
    void tick();
  }, intervalMs);
  timer.unref?.();

  console.log(`[scheduler] started (interval ${intervalMs}ms)`);
}