import "server-only";
import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import http from "node:http";
import https from "node:https";
import { isIP } from "node:net";
import zlib from "node:zlib";

// Fetches ONE public web page on a user's request (like a chat app's link
// preview). Guards against server-side request forgery: http(s) on default
// ports only, every resolved address must be public (checked at connect
// time, so DNS rebinding cannot slip a private address in), bounded
// redirects, size and time. It does not bypass logins, paywalls or bot
// protection: a blocked page is reported as blocked.

export const MAX_BYTES = 1_500_000;
export const TIMEOUT_MS = 6000;
const MAX_REDIRECTS = 3;
const USER_AGENT = "CarrusLinkPreview/1.0 (+student class project; fetches one page per user request)";

export class LinkFetchError extends Error {
  constructor(
    public code: "invalid_url" | "blocked_address" | "timeout" | "too_large" | "http_error" | "not_html" | "too_many_redirects" | "network",
    message: string,
    public status?: number,
  ) {
    super(message);
  }
}

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((n, part) => (n << 8) + Number(part), 0) >>> 0;
}
function inRange(ip: string, cidr: string): boolean {
  const [base, bits] = cidr.split("/");
  const mask = Number(bits) === 0 ? 0 : (~0 << (32 - Number(bits))) >>> 0;
  return (ipv4ToInt(ip) & mask) === (ipv4ToInt(base) & mask);
}
const PRIVATE_V4 = ["0.0.0.0/8", "10.0.0.0/8", "100.64.0.0/10", "127.0.0.0/8", "169.254.0.0/16", "172.16.0.0/12", "192.0.0.0/24", "192.0.2.0/24", "192.168.0.0/16", "198.18.0.0/15", "198.51.100.0/24", "203.0.113.0/24", "224.0.0.0/4", "240.0.0.0/4"];

/** true for loopback, private, link-local, carrier-grade NAT, multicast and reserved addresses. */
export function isPrivateAddress(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) return PRIVATE_V4.some((c) => inRange(ip, c));
  if (kind === 6) {
    const v = ip.toLowerCase();
    if (v === "::" || v === "::1") return true;
    const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(v) || v.startsWith("64:ff9b:") || v.startsWith("2001:db8");
  }
  return true;
}

/** Validates and normalizes a user-supplied URL. */
export function parsePublicUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new LinkFetchError("invalid_url", "Enter a full link starting with https://");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new LinkFetchError("invalid_url", "Only http and https links are supported.");
  if (url.username || url.password) throw new LinkFetchError("invalid_url", "Links with embedded credentials are not supported.");
  if (url.port && url.port !== "80" && url.port !== "443") throw new LinkFetchError("invalid_url", "Only standard web ports are supported.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new LinkFetchError("blocked_address", "That address is not a public website.");
  }
  if (isIP(host) && isPrivateAddress(host)) throw new LinkFetchError("blocked_address", "That address is not a public website.");
  url.hash = "";
  return url;
}

type LookupCb = (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void;
/** DNS lookup used for the actual connection: refuses private results. */
function safeLookup(hostname: string, options: { all?: boolean }, callback: LookupCb) {
  dnsLookup(hostname, { all: true }, (err, addresses) => {
    if (err) return callback(err, "", 4);
    const list = addresses as LookupAddress[];
    if (list.length === 0 || list.some((a) => isPrivateAddress(a.address))) {
      return callback(Object.assign(new Error("blocked_address"), { code: "EBLOCKED" }), "", 4);
    }
    if (options?.all) return callback(null, list);
    return callback(null, list[0].address, list[0].family);
  });
}

function requestOnce(url: URL, signal: AbortSignal): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const lib = url.protocol === "https:" ? https : http;
    const req = lib.request(
      url,
      {
        method: "GET",
        lookup: safeLookup as unknown as typeof dnsLookup,
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1",
          "Accept-Encoding": "gzip, deflate, br",
          "Accept-Language": "en-US,en;q=0.8",
        },
        signal,
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400) {
          res.resume();
          return resolve({ status, headers: res.headers, body: Buffer.alloc(0) });
        }
        const encoding = String(res.headers["content-encoding"] ?? "").toLowerCase();
        const stream =
          encoding === "gzip" ? res.pipe(zlib.createGunzip()) : encoding === "deflate" ? res.pipe(zlib.createInflate()) : encoding === "br" ? res.pipe(zlib.createBrotliDecompress()) : res;
        const chunks: Buffer[] = [];
        let size = 0;
        stream.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_BYTES) {
            // Keep what we have: metadata lives in <head>.
            req.destroy();
            resolve({ status, headers: res.headers, body: Buffer.concat(chunks) });
            return;
          }
          chunks.push(chunk);
        });
        stream.on("end", () => resolve({ status, headers: res.headers, body: Buffer.concat(chunks) }));
        stream.on("error", (e) => (size > MAX_BYTES ? undefined : reject(e)));
      },
    );
    req.on("error", reject);
    req.end();
  });
}

/** Fetches a public HTML page. Returns the final URL and decoded HTML. */
export async function fetchPublicPage(raw: string): Promise<{ url: URL; html: string }> {
  let url = parsePublicUrl(raw);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      let res;
      try {
        res = await requestOnce(url, controller.signal);
      } catch (e) {
        const err = e as NodeJS.ErrnoException;
        if (controller.signal.aborted) throw new LinkFetchError("timeout", "The site took too long to respond.");
        if (err.code === "EBLOCKED" || err.message === "blocked_address") throw new LinkFetchError("blocked_address", "That address is not a public website.");
        throw new LinkFetchError("network", "We could not reach that site.");
      }
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.location;
        if (!location) throw new LinkFetchError("http_error", "The site redirected without a destination.", res.status);
        url = parsePublicUrl(new URL(location, url).toString());
        continue;
      }
      if (res.status >= 400) throw new LinkFetchError("http_error", `The site answered ${res.status}.`, res.status);
      const type = String(res.headers["content-type"] ?? "");
      if (type && !/html|xml/i.test(type)) throw new LinkFetchError("not_html", "That link is not a web page.");
      const charset = /charset=([\w-]+)/i.exec(type)?.[1]?.toLowerCase();
      let decoder: TextDecoder;
      try {
        decoder = new TextDecoder(charset && charset !== "utf8" ? charset : "utf-8");
      } catch {
        decoder = new TextDecoder("utf-8");
      }
      const html = decoder.decode(res.body);
      return { url, html };
    }
    throw new LinkFetchError("too_many_redirects", "The link redirected too many times.");
  } finally {
    clearTimeout(timer);
  }
}
