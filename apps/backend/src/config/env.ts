import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string(),
  // Only used by node-pg-migrate (via its -d flag, bypassing this object) —
  // never read by the running app. Optional because local dev/test never
  // set it; required in practice only when migrating against Supabase.
  DATABASE_MIGRATIONS_URL: z.string().optional(),
  REDIS_URL: z.string(),
  JWT_SECRET: z.string(),
  JWT_REFRESH_SECRET: z.string(),
  ADMIN_JWT_SECRET: z.string(),
  FCM_SERVICE_ACCOUNT_JSON: z.string(),
  SENTRY_DSN: z.string(),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  // Comma-separated list of origins allowed to call the API from a browser
  // (i.e. admin-web). Mobile isn't affected — native HTTP clients aren't
  // subject to CORS. Defaults to admin-web's local dev port.
  ALLOWED_ORIGINS: z
    .string()
    .default('http://localhost:3001')
    .transform((value) => value.split(',').map((origin) => origin.trim())),
});

export type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(process.env);
