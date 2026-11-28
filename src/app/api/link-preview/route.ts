import type { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { allowRequest, RATE_LIMITED_MESSAGE } from "@/lib/rate-limit";
import { fetchPublicPage, LinkFetchError } from "@/server/links/fetch";
import { parseListing } from "@/server/links/parse";

// POST { url } -> listing details parsed from that page's public metadata.
export async function POST(request: NextRequest) {
  if (!(await allowRequest("linkPreview"))) return fail(429, { code: "rate_limited", message: RATE_LIMITED_MESSAGE });
  let url = "";
  try {
    const body = (await request.json()) as { url?: unknown };
    url = typeof body.url === "string" ? body.url.slice(0, 2048) : "";
  } catch {
    return fail(400, { code: "invalid_body", message: "Send JSON like { \"url\": \"https://…\" }." });
  }
  if (!url) return fail(400, { code: "invalid_url", message: "Paste a link to a rental listing." });
  try {
    const page = await fetchPublicPage(url);
    return ok(parseListing(page.html, page.url.toString()));
  } catch (error) {
    if (error instanceof LinkFetchError) {
      const blocked = error.code === "http_error" && (error.status === 401 || error.status === 403 || error.status === 429);
      return fail(error.code === "invalid_url" || error.code === "blocked_address" ? 400 : 422, {
        code: blocked ? "site_blocks_previews" : error.code,
        message: blocked ? "That site does not allow previews. You can still add the car by typing its details." : error.message,
      });
    }
    return fail(500, { code: "unexpected", message: "Something went wrong reading that link. You can enter the details by hand." });
  }
}
