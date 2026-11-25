import { z } from "zod";

// Public (browser-safe) configuration. NEXT_PUBLIC_ values must be referenced
// literally so Next.js can inline them.
const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(10),
});

const serverSchema = z.object({
  SUPABASE_SECRET_KEY: z.string().min(10),
  APP_BASE_URL: z.url().default("http://localhost:3000"),
  APP_ENV: z.enum(["development", "test", "preview", "production"]).default("development"),
  PAYMENT_MODE: z.enum(["simulated"]).default("simulated"),
  PROVIDER_MODE: z.enum(["native", "native+demo"]).default("native"),
  PARTNER_FEEDS_JSON: z.string().optional(),
  PUBLIC_DEMO_LISTINGS: z.enum(["true", "false"]).default("false"),
  CARRUS_FIXED_NOW: z.iso.datetime().optional(),
});

export type PublicEnv = z.infer<typeof publicSchema>;
export type ServerEnv = z.infer<typeof serverSchema>;

let cachedPublic: PublicEnv | undefined;
let cachedServer: ServerEnv | undefined;

function fail(scope: string, error: z.ZodError): never {
  const fields = error.issues.map((i) => i.path.join(".")).join(", ");
  // Fail closed: never fall back to mock auth or default credentials.
  throw new Error(
    `Carrus ${scope} configuration is missing or invalid: ${fields}. ` +
      "Copy .env.example to .env.local and fill it in (see README).",
  );
}

export function publicEnv(): PublicEnv {
  if (!cachedPublic) {
    const parsed = publicSchema.safeParse({
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    });
    if (!parsed.success) fail("public", parsed.error);
    cachedPublic = parsed.data;
  }
  return cachedPublic;
}

/** Server-only configuration. Do not import from client components. */
export function serverEnv(): ServerEnv {
  if (typeof window !== "undefined") {
    throw new Error("serverEnv() must not be called in the browser");
  }
  if (!cachedServer) {
    const parsed = serverSchema.safeParse({
      SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
      APP_BASE_URL: process.env.APP_BASE_URL || undefined,
      APP_ENV: process.env.APP_ENV || undefined,
      PAYMENT_MODE: process.env.PAYMENT_MODE || undefined,
      PROVIDER_MODE: process.env.PROVIDER_MODE || undefined,
      PARTNER_FEEDS_JSON: process.env.PARTNER_FEEDS_JSON || undefined,
      PUBLIC_DEMO_LISTINGS: process.env.PUBLIC_DEMO_LISTINGS || undefined,
      CARRUS_FIXED_NOW: process.env.CARRUS_FIXED_NOW || undefined,
    });
    if (!parsed.success) fail("server", parsed.error);
    cachedServer = parsed.data;
  }
  return cachedServer;
}
