const { withSentryConfig } = require('@sentry/nextjs');

/** @type {import('next').NextConfig} */
const nextConfig = {};

// Source-map upload (org/project/authToken) is left unconfigured on purpose —
// that needs a real Sentry account, which is out of scope for this pass.
// Error capture still works without it; only source-mapped stack traces
// in the Sentry UI are affected.
module.exports = withSentryConfig(nextConfig, {
  silent: true,
  disableLogger: true,
  autoInstrumentServerFunctions: false,
  autoInstrumentMiddleware: false,
  autoInstrumentAppDirectory: false,
  sourcemaps: { disable: true },
});
