export async function register() {
  // No DSN means Sentry sends nothing anyway — skip importing it so its
  // @opentelemetry auto-instrumentation tree (dozens of packages for
  // frameworks/DBs this app doesn't use) never enters the module graph.
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}
