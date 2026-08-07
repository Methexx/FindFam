import { buildApp } from './app';
import { env } from './config/env';
import { sosWorker } from './queue/sos.worker';

const app = buildApp();

app
  .listen({ port: env.PORT, host: '0.0.0.0' })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });

// SOS delivery worker runs in the same process as the API this sprint —
// splitting it into a separate deployment is a later scaling concern
// (docs/05-realtime-channels.md), not something this sprint needs.
const shutdown = async () => {
  await sosWorker.close();
  await app.close();
  process.exit(0);
};

process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());
