import "server-only";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Access control for admin / manual-update endpoints.
 *
 * This is a single-user local deployment: by default (no token configured)
 * requests are allowed from same-origin / server-side callers. If
 * `SIGNAL_ADMIN_TOKEN` is set, mutation endpoints require a matching
 * `Authorization: Bearer <token>` or `X-Admin-Token` header.
 *
 * A cross-origin `Origin` header is always rejected to blunt CSRF.
 */
export function isRequestAllowed(request: NextRequest): boolean {
  const token = process.env.SIGNAL_ADMIN_TOKEN;
  if (token) {
    const auth = request.headers.get("authorization") ?? "";
    const header = request.headers.get("x-admin-token") ?? "";
    const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (bearer !== token && header !== token) return false;
  }

  const origin = request.headers.get("origin");
  if (origin) {
    const requestHost = request.headers.get("host");
    try {
      const originHost = new URL(origin).host;
      if (requestHost && originHost !== requestHost) return false;
    } catch {
      return false;
    }
  }
  return true;
}

export function unauthorizedResponse(): NextResponse {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

export function forbiddenResponse(): NextResponse {
  return NextResponse.json({ error: "forbidden" }, { status: 403 });
}

export function guard(request: NextRequest): NextResponse | null {
  return isRequestAllowed(request) ? null : unauthorizedResponse();
}
