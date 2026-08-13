import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Integration tests share one Postgres instance and truncate tables in
    // beforeEach — running files in parallel races truncation against
    // in-flight inserts from other files, so force sequential execution.
    fileParallelism: false,
    env: {
      DATABASE_URL: 'postgres://findfam:findfam@localhost:5432/findfam_test',
      REDIS_URL: 'redis://localhost:6379',
      JWT_SECRET: 'test-jwt-secret',
      ADMIN_JWT_SECRET: 'test-admin-jwt-secret',
      FCM_SERVICE_ACCOUNT_JSON: '{}',
      SENTRY_DSN: '',
      NODE_ENV: 'test',
      PORT: '3000',
    },
  },
});
