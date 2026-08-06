import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: {
      DATABASE_URL: 'postgres://famshare:famshare@localhost:5432/famshare',
      REDIS_URL: 'redis://localhost:6379',
      JWT_SECRET: 'test-jwt-secret',
      JWT_REFRESH_SECRET: 'test-jwt-refresh-secret',
      ADMIN_JWT_SECRET: 'test-admin-jwt-secret',
      FCM_SERVICE_ACCOUNT_JSON: '{}',
      TWILIO_ACCOUNT_SID: 'test-sid',
      TWILIO_AUTH_TOKEN: 'test-token',
      TWILIO_FROM_NUMBER: '+10000000000',
      SENTRY_DSN: '',
      NODE_ENV: 'test',
      PORT: '3000',
    },
  },
});
