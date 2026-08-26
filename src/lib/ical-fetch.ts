import { lookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import type { IncomingHttpHeaders } from "node:http";
import { isIP, type LookupFunction } from "node:net";

export const MAX_ICAL_RESPONSE_BYTES = 2 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_REDIRECTS = 3;

export type HostResolver = (hostname: string) => Promise<readonly string[]>;

type FetchIcalOptions = {
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  transport?: IcalTransport;
  resolveHost?: HostResolver;
  userAgent?: string;
};

export type IcalTransportRequest = {
  url: URL;
  /** The already-resolved and validated public address the socket must use. */
  address: string;
  family: 4 | 6;
  signal: AbortSignal;
  maxBytes: number;
  userAgent: string;
};

export type IcalTransportResponse = {
  status: number;
  statusText: string;
  headers: IncomingHttpHeaders;
  body: string;
};

export type IcalTransport = (
  request: IcalTransportRequest,
) => Promise<IcalTransportResponse>;

const defaultResolver: HostResolver = async (hostname) => {
  const records = await lookup(hostname, { all: true, verbatim: true });
  return records.map((record) => record.address);
};

function blockedIpv4(address: string): boolean {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return true;
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function blockedIpv6(address: string): boolean {
  const normalized = address.toLowerCase().split("%")[0];
  if (normalized === "::" || normalized === "::1") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (/^fe[89ab]/.test(normalized)) return true;
  if (normalized.startsWith("ff")) return true;
  // Reject mapped addresses rather than risk bypassing the IPv4 classifier
  // through an alternate textual representation.
  if (normalized.startsWith("::ffff:")) return true;
  return false;
}

export function isBlockedIcalAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return blockedIpv4(address);
  if (family === 6) return blockedIpv6(address);
  return true;
}

export async function assertSafeIcalUrl(
  rawUrl: string,
  resolveHost: HostResolver = defaultResolver,
): Promise<URL> {
  return (await resolveSafeIcalUrl(rawUrl, resolveHost)).url;
}

async function resolveSafeIcalUrl(
  rawUrl: string,
  resolveHost: HostResolver,
): Promise<{ url: URL; addresses: string[] }> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Invalid iCal URL");
  }

  if (url.protocol !== "https:") throw new Error("iCal URL must use HTTPS");
  if (url.username || url.password) throw new Error("iCal URL must not include credentials");

  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost")) {
    throw new Error("iCal destination is not public");
  }

  const addresses = [...(isIP(hostname) ? [hostname] : await resolveHost(hostname))];
  if (addresses.length === 0 || addresses.some(isBlockedIcalAddress)) {
    throw new Error("iCal destination is not public");
  }

  return { url, addresses };
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

export function createPinnedLookup(address: string, family: 4 | 6): LookupFunction {
  return (_hostname, _options, callback) => {
    callback(null, address, family);
  };
}

const pinnedHttpsTransport: IcalTransport = ({
  url,
  address,
  family,
  signal,
  maxBytes,
  userAgent,
}) => new Promise((resolve, reject) => {
  const pinnedLookup = createPinnedLookup(address, family);
  const tlsHostname = url.hostname.replace(/^\[|\]$/g, "");

  let settled = false;
  const finish = (response: IcalTransportResponse) => {
    if (settled) return;
    settled = true;
    resolve(response);
  };
  const fail = (error: Error) => {
    if (settled) return;
    settled = true;
    reject(error);
  };

  const request = httpsRequest(url, {
    method: "GET",
    signal,
    family,
    lookup: pinnedLookup,
    // Preserve the original hostname for certificate verification/SNI even
    // though the TCP socket is connected to the pinned numeric address.
    servername: isIP(tlsHostname) ? undefined : tlsHostname,
    headers: {
      Host: url.host,
      "User-Agent": userAgent,
      Accept: "text/calendar, text/plain, */*",
    },
  }, (response) => {
    const status = response.statusCode ?? 0;
    const statusText = response.statusMessage ?? "";

    if (REDIRECT_STATUSES.has(status)) {
      response.resume();
      finish({ status, statusText, headers: response.headers, body: "" });
      return;
    }

    const contentLengthHeader = response.headers["content-length"];
    const contentLength = Number(
      Array.isArray(contentLengthHeader) ? contentLengthHeader[0] : contentLengthHeader,
    );
    if (Number.isFinite(contentLength) && contentLength > maxBytes) {
      response.destroy();
      fail(new Error(`iCal response exceeds ${maxBytes} bytes`));
      return;
    }

    const chunks: Buffer[] = [];
    let total = 0;
    response.on("data", (chunk: Buffer) => {
      total += chunk.byteLength;
      if (total > maxBytes) {
        response.destroy();
        fail(new Error(`iCal response exceeds ${maxBytes} bytes`));
        return;
      }
      chunks.push(chunk);
    });
    response.on("end", () => {
      finish({
        status,
        statusText,
        headers: response.headers,
        body: Buffer.concat(chunks, total).toString("utf8"),
      });
    });
    response.on("error", fail);
  });

  request.on("error", fail);
  request.end();
});

function firstHeader(headers: IncomingHttpHeaders, name: string): string | undefined {
  const value = headers[name];
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Fetch an iCal response while validating the initial destination and every
 * redirect. Redirects are manual so an attacker cannot bounce an allowed host
 * into loopback/private metadata endpoints.
 */
export async function fetchIcalText(
  rawUrl: string,
  options: FetchIcalOptions = {},
): Promise<string> {
  const transport = options.transport ?? pinnedHttpsTransport;
  const resolveHost = options.resolveHost ?? defaultResolver;
  const maxBytes = options.maxBytes ?? MAX_ICAL_RESPONSE_BYTES;
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    let current = await resolveSafeIcalUrl(rawUrl, resolveHost);
    for (let redirects = 0; redirects <= maxRedirects; redirects++) {
      // Prefer IPv4 when both families are advertised. This retains the
      // complete "all answers must be public" validation while avoiding a
      // needless failure on hosts without IPv6 egress.
      const address = current.addresses.find((candidate) => isIP(candidate) === 4)
        ?? current.addresses[0];
      const family = isIP(address);
      if (family !== 4 && family !== 6) throw new Error("iCal destination is not public");

      const response = await transport({
        url: current.url,
        address,
        family,
        signal: controller.signal,
        maxBytes,
        userAgent: options.userAgent ?? "RentTool-CalendarSync/1.0",
      });

      if (REDIRECT_STATUSES.has(response.status)) {
        const location = firstHeader(response.headers, "location");
        if (!location) throw new Error("iCal redirect is missing a location");
        if (redirects === maxRedirects) throw new Error("Too many iCal redirects");
        try {
          current = await resolveSafeIcalUrl(
            new URL(location, current.url).toString(),
            resolveHost,
          );
        } catch (error) {
          throw error instanceof Error ? error : new Error("Unsafe iCal redirect");
        }
        continue;
      }

      if (response.status < 200 || response.status >= 300) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      if (Buffer.byteLength(response.body, "utf8") > maxBytes) {
        throw new Error(`iCal response exceeds ${maxBytes} bytes`);
      }
      return response.body;
    }

    throw new Error("Too many iCal redirects");
  } finally {
    clearTimeout(timeout);
  }
}
