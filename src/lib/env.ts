export type StorageMode = "filesystem" | "supabase" | "sqlite";

/**
 * Centralized environment access with feature-flag helpers, mirroring the
 * reference project's `src/lib/env.ts` idiom. Anything that reads `process.env`
 * goes through here so values (and what backs them) stay in one place.
 * Only deployment-critical values live in env; app settings are DB-driven.
 */
export const env = {
  storageMode: (process.env.STORAGE_MODE as StorageMode) || "sqlite",
  nodeEnv: process.env.NODE_ENV || "development",

  dbPath: process.env.DB_PATH || "./data/billator.db",

  isProduction: process.env.NODE_ENV === "production",
  isDevelopment: process.env.NODE_ENV !== "production",

  // Supabase (Postgres) configuration (optional / secondary)
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    dbUrl: process.env.SUPABASE_DB_URL,
    isConfigured: () =>
      !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
      !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },

  // App-secret encryption (holds Gmail secrets in the DB at rest)
  gmailEncryptionKey: process.env.GMAIL_ENCRYPTION_KEY || "",

  isSupabaseEnabled: () =>
    env.storageMode === "supabase" && env.supabase.isConfigured(),

  logConfiguration: () => {
    console.log("[ENV] configuration:", {
      storageMode: env.storageMode,
      nodeEnv: process.env.NODE_ENV,
      dbPath: env.dbPath,
    });
  },
};
