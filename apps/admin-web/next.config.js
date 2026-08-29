const { withSentryConfig } = require('@sentry/nextjs');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Deliberately empty of an icon-import transform.
  //
  // There used to be a `modularizeImports` rule rewriting every
  // `import { X } from 'lucide-react'` to `lucide-react/dist/esm/icons/...`,
  // to stop the ~1500-icon barrel file entering the module graph. It is gone
  // for two reasons:
  //
  // 1. It broke Turbopack outright. The rewritten path resolves to a module
  //    whose export shape Turbopack reads differently, so every page using an
  //    icon 500'd with "Element type is invalid ... you might have mixed up
  //    default and named imports". That is why --turbo had been removed from
  //    the dev script rather than the config being fixed.
  // 2. It was redundant anyway. Next 14 ships `lucide-react` in the default
  //    `experimental.optimizePackageImports` list (see
  //    next/dist/server/config.js), so the barrel is already collapsed for
  //    both bundlers without any config here.
  //
  // If an icon package ever does need this, reach for
  // `experimental.optimizePackageImports` rather than `modularizeImports` —
  // it is the supported route and it does not break the dev bundler.
};

// Source-map upload (org/project/authToken) is left unconfigured on purpose —
// that needs a real Sentry account, which is out of scope for this pass.
// Error capture still works without it; only source-mapped stack traces
// in the Sentry UI are affected.
//
// Applied to production builds only. `next dev` runs Turbopack (see the dev
// script), which ignores an injected webpack config outright — so in dev this
// wrapper buys nothing and costs two things: Next prints "Webpack is
// configured while Turbopack is not" on every start, and the webpack fallback
// path pays for the Sentry plugin. Nothing is lost at dev runtime either,
// since instrumentation.ts already returns early without a DSN and keeps the
// Sentry/OpenTelemetry tree out of the module graph entirely.
//
// `next build` and `next start` are unaffected: they do not take --turbo, and
// NODE_ENV is 'production' there, so deployed builds are wrapped exactly as
// before.
module.exports =
  process.env.NODE_ENV === 'production'
    ? withSentryConfig(nextConfig, {
        silent: true,
        disableLogger: true,
        autoInstrumentServerFunctions: false,
        autoInstrumentMiddleware: false,
        autoInstrumentAppDirectory: false,
        sourcemaps: { disable: true },
      })
    : nextConfig;
