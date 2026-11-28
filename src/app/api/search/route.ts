import type { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { getNow } from "@/lib/clock";
import { serverEnv } from "@/lib/env";
import { allowRequest, RATE_LIMITED_MESSAGE } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { enabledAdapters, runSearch } from "@/server/search/service";
import { validateSearch, type RawParams } from "@/server/search/validator";

// GET /api/search?location=SJC&pickup=2026-12-10T10:00&return=2026-12-13T10:00[&type=SUV…]
// Same validation, sources and filters as the search page.
export async function GET(request: NextRequest) {
  if (!(await allowRequest("api"))) return fail(429, { code: "rate_limited", message: RATE_LIMITED_MESSAGE });
  const raw: RawParams = {};
  for (const key of new Set(request.nextUrl.searchParams.keys())) {
    const values = request.nextUrl.searchParams.getAll(key);
    raw[key] = values.length > 1 ? values : values[0];
  }
  const validation = validateSearch(raw, getNow());
  if (!validation.ok) return fail(400, { code: "invalid_search", message: "Some search fields are invalid.", fieldErrors: validation.fieldErrors });
  const db = await createClient();
  const result = await runSearch(validation.criteria, enabledAdapters(db, serverEnv().PROVIDER_MODE));
  return ok(result);
}
