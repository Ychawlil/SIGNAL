import "server-only";
import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

/**
 * SSRF protection for outbound requests. Every URL fetched from an
 * external source is validated before it reaches the network stack.
 */

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    const octet = Number(part);
    if (!Number.isInteger(octet) || octet < 0 || octet > 255) return null;
    value = value * 256 + octet;
  }
  return value >>> 0;
}

export function isPrivateIPv4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  if (n === null) return true; // treat unparseable as unsafe
  const cidr = (base: string, prefix: number) => {
    const baseInt = ipv4ToInt(base) ?? 0;
    const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
    return (n & mask) === (baseInt & mask);
  };
  return (
    cidr("0.0.0.0", 8) ||
    cidr("10.0.0.0", 8) ||
    cidr("100.64.0.0", 10) ||
    cidr("127.0.0.0", 8) ||
    cidr("169.254.0.0", 16) ||
    cidr("172.16.0.0", 12) ||
    cidr("192.0.0.0", 24) ||
    cidr("192.0.2.0", 24) ||
    cidr("192.168.0.0", 16) ||
    cidr("198.18.0.0", 15) ||
    cidr("198.51.100.0", 24) ||
    cidr("203.0.113.0", 24) ||
    cidr("224.0.0.0", 4) ||
    cidr("240.0.0.0", 4) ||
    ip === "255.255.255.255"
  );
}

function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized.includes("%")) return true; // zone-scoped
  if (normalized === "::" || normalized === "::1") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true; // fc00::/7
  if (normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb")) return true; // fe80::/10
  if (normalized.startsWith("ff")) return true; // multicast
  return false;
}

function isUnsafeIp(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) return isPrivateIPv4(ip);
  if (family === 6) return isPrivateIPv6(ip);
  return true;
}

function hostMatchesAllowlist(hostname: string, allowHosts: string[]): boolean {
  if (allowHosts.length === 0) return true;
  const normalized = hostname.toLowerCase();
  return allowHosts.some((allowed) => {
    const a = allowed.toLowerCase();
    return normalized === a || normalized.endsWith(`.${a}`);
  });
}

export interface SafeUrlOptions {
  allowHosts?: string[];
}

/** Validate a URL and confirm it resolves only to public IPs. */
export async function assertSafeUrl(
  raw: string,
  options: SafeUrlOptions = {},
): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError("Invalid URL");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new UnsafeUrlError(`Disallowed protocol: ${url.protocol}`);
  }
  if (url.username || url.password) {
    throw new UnsafeUrlError("URLs with embedded credentials are not allowed");
  }
  if (!url.hostname) {
    throw new UnsafeUrlError("URL is missing a hostname");
  }
  if (!hostMatchesAllowlist(url.hostname, options.allowHosts ?? [])) {
    throw new UnsafeUrlError(`Host not allowed: ${url.hostname}`);
  }

  // Resolve the hostname and verify every address is public. This blocks
  // DNS rebinding attacks and direct access to private ranges.
  const addresses = await lookup(url.hostname, { all: true }).catch(() => {
    throw new UnsafeUrlError(`Could not resolve host: ${url.hostname}`);
  });
  if (addresses.length === 0) {
    throw new UnsafeUrlError(`No addresses resolved for: ${url.hostname}`);
  }
  for (const addr of addresses) {
    if (isUnsafeIp(addr.address)) {
      throw new UnsafeUrlError(`Resolved to a non-public address: ${addr.address}`);
    }
  }
  return url;
}

/** Canonical form used as the cross-provider deduplication key. */
export function canonicalizeUrl(raw: string): string {
  try {
    const url = new URL(raw);
    url.hash = "";
    const search = url.searchParams;
    for (const key of [...search.keys()]) {
      if (key.startsWith("utm_") || key === "ref" || key === "source") {
        search.delete(key);
      }
    }
    url.search = search.toString();
    url.hostname = url.hostname.toLowerCase();
    if ((url.pathname === "" || url.pathname === "/") && url.search === "") {
      url.pathname = "/";
    }
    return url.toString();
  } catch {
    return raw;
  }
}
