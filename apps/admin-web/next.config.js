const { withSentryConfig } = require('@sentry/nextjs');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // lucide-react's barrel file re-exports ~1500 icons through a single
  // namespace module, which can defeat automatic tree-shaking. This forces
  // every `import { X } from 'lucide-react'` to resolve straight to that
  // icon's own file instead of pulling the whole package into the graph.
  modularizeImports: {
    'lucide-react': {
      transform: 'lucide-react/dist/esm/icons/{{kebabCase member}}',
      skipDefaultConversion: true,
    },
  },
};

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
