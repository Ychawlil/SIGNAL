import { describe, expect, it } from "vitest";
import {
  assertSafeUrl,
  canonicalizeUrl,
  isPrivateIPv4,
  UnsafeUrlError,
} from "@/lib/server/url-guard";

describe("SSRF / URL guard", () => {
  it("rejects non-http(s) protocols", async () => {
    await expect(assertSafeUrl("file:///etc/passwd")).rejects.toThrow(UnsafeUrlError);
    await expect(assertSafeUrl("gopher://127.0.0.1:70/_x")).rejects.toThrow(UnsafeUrlError);
  });

  it("rejects embedded credentials", async () => {
    await expect(
      assertSafeUrl("https://user:pass@example.com/x", { allowHosts: ["example.com"] }),
    ).rejects.toThrow(UnsafeUrlError);
  });

  it("rejects loopback addresses", async () => {
    await expect(assertSafeUrl("http://127.0.0.1/admin")).rejects.toThrow(UnsafeUrlError);
  });

  it("rejects disallowed hosts", async () => {
    await expect(
      assertSafeUrl("https://evil.example.com/x", { allowHosts: ["api.github.com"] }),
    ).rejects.toThrow(UnsafeUrlError);
  });

  it("classifies private IPv4 ranges", () => {
    expect(isPrivateIPv4("10.0.0.1")).toBe(true);
    expect(isPrivateIPv4("172.16.0.1")).toBe(true);
    expect(isPrivateIPv4("192.168.1.1")).toBe(true);
    expect(isPrivateIPv4("169.254.169.254")).toBe(true);
    expect(isPrivateIPv4("8.8.8.8")).toBe(false);
    expect(isPrivateIPv4("1.1.1.1")).toBe(false);
  });

  it("canonicalizes URLs for dedup", () => {
    expect(canonicalizeUrl("https://A.com/p?utm_source=x&q=1#frag")).toBe(
      "https://a.com/p?q=1",
    );
  });
});
