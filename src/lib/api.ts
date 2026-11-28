import { NextResponse } from "next/server";

// One JSON shape for every API route: { data } on success, { error } otherwise.
export type ApiError = { code: string; message: string; fieldErrors?: Record<string, string | undefined> };

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ data }, { ...init, headers: { "Cache-Control": "no-store", ...init?.headers } });
}

export function fail(status: number, error: ApiError) {
  return NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}
