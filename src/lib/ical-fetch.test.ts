import { describe, expect, it, vi } from "vitest";
import {
  assertSafeIcalUrl,
  createPinnedLookup,
  fetchIcalText,
  isBlockedIcalAddress,
  type IcalTransport,
} from "./ical-fetch";

const publicResolver = vi.fn(async () => ["93.184.216.34"]);

describe("iCal SSRF guard", () => {
  it("makes the HTTPS socket lookup return only the prevalidated address", async () => {
    const lookup = createPinnedLookup("93.184.216.34", 4);
    const result = await new Promise<{ address: string; family?: number }>((resolve, reject) => {
      lookup("changed-by-dns.example", {}, (error, address, family) => {
        if (error) return reject(error);
        if (typeof address !== "string") return reject(new Error("expected one pinned address"));
        resolve({ address, family });
      });
    });

    expect(result).toEqual({ address: "93.184.216.34", family: 4 });
  });

  it("requires HTTPS", async () => {
    await expect(assertSafeIcalUrl("http://example.com/feed.ics", publicResolver)).rejects.toThrow(
      "must use HTTPS",
    );
  });

  it("rejects loopback, private and link-local IP literals", async () => {
    for (const address of ["127.0.0.1", "10.0.0.8", "172.16.4.1", "192.168.1.5", "169.254.169.254", "::1", "fd00::1", "fe80::1"]) {
      expect(isBlockedIcalAddress(address)).toBe(true);
    }
  });

  it("rejects a hostname when DNS returns a private destination", async () => {
    await expect(
      assertSafeIcalUrl("https://calendar.example/feed.ics", async () => ["10.0.0.7"]),
    ).rejects.toThrow("not public");
  });

  it("validates every redirect and refuses a metadata-service bounce", async () => {
    const transport = vi.fn<IcalTransport>().mockResolvedValueOnce({
      status: 302,
      statusText: "Found",
      headers: { location: "https://169.254.169.254/latest/meta-data" },
      body: "",
    });

    await expect(
      fetchIcalText("https://example.com/feed.ics", { transport, resolveHost: publicResolver }),
    ).rejects.toThrow("not public");
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("stops reading when the response exceeds the configured byte limit", async () => {
    const transport = vi.fn<IcalTransport>().mockResolvedValue({
      status: 200,
      statusText: "OK",
      headers: {},
      body: "BEGIN:VCALENDAR\n" + "x".repeat(100),
    });

    await expect(
      fetchIcalText("https://example.com/feed.ics", {
        transport,
        resolveHost: publicResolver,
        maxBytes: 32,
      }),
    ).rejects.toThrow("exceeds 32 bytes");
  });

  it("pins the validated address while preserving the original TLS/Host URL", async () => {
    const transport = vi.fn<IcalTransport>().mockResolvedValue({
      status: 200,
      statusText: "OK",
      headers: {},
      body: "BEGIN:VCALENDAR\nEND:VCALENDAR",
    });

    await expect(
      fetchIcalText("https://calendar.example/feed.ics", {
        transport,
        resolveHost: async () => ["93.184.216.34"],
      }),
    ).resolves.toContain("VCALENDAR");

    expect(transport).toHaveBeenCalledWith(expect.objectContaining({
      address: "93.184.216.34",
      family: 4,
      url: expect.objectContaining({
        hostname: "calendar.example",
        pathname: "/feed.ics",
      }),
    }));
  });
});
