import { buildApp } from './app';
import { env } from './config/env';
import { pool } from './config/db';
import { redisPubSub } from './realtime/redis-pubsub';
import { sosWorker } from './queue/sos.worker';
import { closeSosQueue } from './queue/sos.queue';

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
let shuttingDown = false;
const shutdown = async () => {
  if (shuttingDown) return;
  shuttingDown = true;

  // Render sends SIGTERM then force-kills after its own grace window — this
  // fallback ensures the process exits on its own terms if any close() call
  // hangs, rather than being killed mid-close with in-flight work lost.
  const forceExit = setTimeout(() => process.exit(1), 10_000);
  forceExit.unref();

  await sosWorker.close();
  await closeSosQueue();
  await redisPubSub.close();
  await pool.end();
  await app.close();
  process.exit(0);
};

process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());
