import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string(),
  // Only used by node-pg-migrate (via its -d flag, bypassing this object) —
  // never read by the running app. Optional because local dev/test never
  // set it; required in practice only when migrating against Supabase.
  DATABASE_MIGRATIONS_URL: z.string().optional(),
  REDIS_URL: z.string(),
  JWT_SECRET: z.string(),
  ADMIN_JWT_SECRET: z.string(),
  FCM_SERVICE_ACCOUNT_JSON: z.string(),
  // Avatar uploads (POST /auth/me/avatar) — a Supabase Storage bucket in
  // the same project as DATABASE_URL. The service-role key is server-side
  // only and must never reach a client; it's what lets the backend write
  // to the bucket on the user's behalf without per-user Storage policies.
  // Defaulted rather than required, same reasoning as SENTRY_DSN above:
  // this env schema is parsed at module load, so a required-but-unset var
  // would crash-loop the whole app before /health ever passed, over a
  // feature (avatar upload) most of the app doesn't depend on. An unset
  // value just means lib/supabase-storage.ts throws when that one route is
  // actually hit, not that nothing starts.
  SUPABASE_URL: z.string().default(''),
  SUPABASE_SERVICE_ROLE_KEY: z.string().default(''),
  SUPABASE_AVATARS_BUCKET: z.string().default('avatars'),
  // Defaulted, not required: this schema is parsed at module load, and
  // render.yaml deliberately omits SENTRY_DSN. Requiring it meant the
  // process threw before Fastify ever started, so the container
  // crash-looped and /health never passed — a deploy blocker that could
  // only ever surface on the first real deploy. An empty string is a
  // valid no-op DSN for @sentry/node, matching how mobile already treats
  // an unset --dart-define=SENTRY_DSN.
  SENTRY_DSN: z.string().default(''),
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
