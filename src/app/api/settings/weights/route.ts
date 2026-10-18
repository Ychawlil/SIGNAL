import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/server/auth";
import { rescoreImportance } from "@/lib/server/analysis/rescore";
import {
  getFocusWeights,
  invalidateTodayBriefing,
  saveFocusWeights,
} from "@/lib/server/settings";
import { topicsForCategory } from "@/lib/focus-weights";
import { CATEGORIES } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Current focus weights (defaults when the user never saved any). */
export async function GET() {
  return NextResponse.json({ weights: getFocusWeights() });
}

/**
 * Persists weights, then re-scores the `relevance` factor of every stored
 * analysis so the change is visible immediately instead of only affecting
 * articles analyzed from now on.
 */
export async function PUT(request: NextRequest) {
  const denied = guard(request);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const patch =
    body && typeof body === "object" && "weights" in body
      ? (body as { weights?: unknown }).weights
      : body;

  if (!patch || typeof patch !== "object") {
    return NextResponse.json(
      { error: "expected { weights: { <topic>: 0-100 } }" },
      { status: 400 },
    );
  }

  const weights = saveFocusWeights(patch as Record<string, unknown>);
  const rescored = rescoreImportance(weights);
  invalidateTodayBriefing();

  return NextResponse.json({
    weights,
    rescored,
    // How the weights translate into the relevance factor of importance.
    relevanceByCategory: Object.fromEntries(
      CATEGORIES.map((category) => {
        const topics = topicsForCategory(category.id);
        if (topics.length === 0) return [category.id, { weight: null, relevance: null }];
        const best = Math.max(...topics.map((topic) => weights[topic] ?? 0));
        return [
          category.id,
          { weight: best, relevance: Math.round((best / 100) * 30), topics },
        ];
      }),
    ),
  });
}
