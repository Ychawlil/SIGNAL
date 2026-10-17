import { NextRequest, NextResponse } from "next/server";
import { probeGithubAuth } from "@/lib/server/github-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Reports whether the server-side GITHUB_TOKEN is accepted by the API.
 * The response never contains the token itself.
 */
export async function GET(request: NextRequest) {
  const force = request.nextUrl.searchParams.get("force") === "1";
  const info = await probeGithubAuth(force);
  return NextResponse.json(info);
}
