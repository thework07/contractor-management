import type { Server } from 'node:http';
import { createApp } from './app';
import { createLogger } from './common/logger/logger';
import { env } from './config/env';
import { connectMongo, disconnectMongo } from './database';

const log = createLogger('server');
const SHUTDOWN_TIMEOUT_MS = 10_000;

let server: Server | undefined;
let shuttingDown = false;

const shutdown = async (reason: string, exitCode = 0): Promise<void> => {
  if (shuttingDown) return;
  shuttingDown = true;
  log.info(`Shutting down (${reason})`);

  const forceExit = setTimeout(() => {
    log.error('Graceful shutdown timed out, forcing exit');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceExit.unref();

  try {
    if (server)
      await new Promise<void>((resolve, reject) =>
        server?.close((e) => (e ? reject(e) : resolve())),
      );
    await disconnectMongo();
    process.exit(exitCode);
  } catch (error) {
    log.error('Error during shutdown', { error });
    process.exit(1);
  }
};

const bootstrap = async (): Promise<void> => {
  await connectMongo();

  const app = createApp();
  server = app.listen(env.PORT, () => {
    log.info(`API listening on http://localhost:${env.PORT}`, {
      environment: env.NODE_ENV,
      health: `http://localhost:${env.PORT}/api/health`,
    });
  });

  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      log.error(
        `Port ${env.PORT} is already in use. Stop the other process or change PORT in .env`,
      );
    } else {
      log.error('HTTP server error', { error });
    }
    void shutdown('server error', 1);
  });
};

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => {
  log.error('Unhandled promise rejection', { error: reason });
  void shutdown('unhandledRejection', 1);
});
process.on('uncaughtException', (error) => {
  log.error('Uncaught exception', { error });
  void shutdown('uncaughtException', 1);
});

bootstrap().catch((error: unknown) => {
  log.error('Failed to start server', { error });
  void shutdown('startup failure', 1);
});
