/**
 * Public origin of the incoming request, honoring proxy headers.
 *
 * Behind a reverse proxy (nginx → Next on localhost) `new URL(request.url)`
 * reflects the proxy hop's HTTP/localhost addressing, not the public-facing
 * URL Cloudflare presents to users. Honor X-Forwarded-Proto / X-Forwarded-Host
 * first, fall back to the request URL only when no proxy headers are present
 * (e.g. local dev).
 */
export function getPublicOrigin(request: Request): string {
  // A configured canonical origin wins outright. Some proxies forward
  // neither Host nor X-Forwarded-Host (the family instance's nginx hands
  // Next "localhost:3000"), and then every header-derived answer is wrong.
  const configured = configuredPublicOrigin();
  if (configured) return configured;
  const url = new URL(request.url);
  const fwdProto = request.headers.get("x-forwarded-proto");
  // Take the FIRST forwarded value if a comma-separated chain is sent
  // (Cloudflare → nginx → next can stack headers in some setups).
  const proto = (fwdProto?.split(",")[0]?.trim()) || url.protocol.replace(/:$/, "");
  const fwdHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  if (fwdHost) return `${proto}://${fwdHost}`;
  // A browser's same-origin fetch carries Origin, which is the public
  // address the user actually typed - more trustworthy than a Host header
  // rewritten by the proxy hop.
  const origin = request.headers.get("origin");
  if (origin && /^https?:\/\/[^/]+$/.test(origin)) return origin;
  const host = request.headers.get("host")?.split(",")[0]?.trim() || url.host;
  return `${proto}://${host}`;
}

/** PUBLIC_APP_URL (or NEXT_PUBLIC_APP_URL) as an origin, or null when
 *  unset or not an absolute http(s) URL. */
export function configuredPublicOrigin(): string | null {
  const raw = process.env.PUBLIC_APP_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.origin;
  } catch {
    return null;
  }
}
