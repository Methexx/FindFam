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
});

export type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(process.env);
