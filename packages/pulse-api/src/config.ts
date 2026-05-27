/**
 * Runtime configuration. Validates required env vars on startup.
 */

import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().default(7004),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().optional(),
  REDIS_HOST: z.string().optional(),
  REDIS_PORT: z.coerce.number().int().optional(),
  REDIS_PASSWORD: z.string().optional(),

  JWT_SECRET: z.string().min(32),
  JWT_ISSUER: z.string().default("pnode-pulse"),
  JWT_AUDIENCE: z.string().default("pnode-pulse"),

  ALLOWED_ORIGINS: z
    .string()
    .default(
      "https://pulse.rectorspace.com,https://staging.pulse.rectorspace.com,http://localhost:3000",
    ),

  LOG_LEVEL: z
    .enum(["trace", "debug", "info", "warn", "error", "fatal", "silent"])
    .default("info"),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function loadConfig(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("\n  ");
    throw new Error(`Invalid environment configuration:\n  ${issues}`);
  }
  cached = parsed.data;
  return cached;
}

export function allowedOrigins(env: Env): string[] {
  return env.ALLOWED_ORIGINS.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
