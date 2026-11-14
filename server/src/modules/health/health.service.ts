import { appInfo, env } from '../../config/env';
import { createLogger } from '../../common/logger/logger';
import { getMongoState, pingMongo } from '../../database';

const log = createLogger('health');

export interface HealthReport {
  status: 'ok' | 'degraded';
  service: string;
  version: string;
  environment: string;
  timestamp: string;
  uptimeSeconds: number;
  database: {
    status: 'up' | 'down';
    state: string;
    latencyMs?: number;
  };
  runtime?: {
    nodeVersion: string;
    pid: number;
    memoryMb: { rss: number; heapUsed: number };
  };
}

const toMb = (bytes: number) => Math.round((bytes / 1024 / 1024) * 10) / 10;

export const getHealthReport = async (includeDetails: boolean): Promise<HealthReport> => {
  const state = getMongoState();
  let dbUp = false;
  let latencyMs: number | undefined;

  if (state === 'connected') {
    try {
      latencyMs = await pingMongo();
      dbUp = true;
    } catch (error) {
      log.error('Database ping failed', { error });
    }
  }

  const memory = process.memoryUsage();

  return {
    status: dbUp ? 'ok' : 'degraded',
    service: appInfo.name,
    version: appInfo.version,
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    database: {
      status: dbUp ? 'up' : 'down',
      state,
      ...(includeDetails && latencyMs !== undefined ? { latencyMs } : {}),
    },
    ...(includeDetails
      ? {
          runtime: {
            nodeVersion: process.version,
            pid: process.pid,
            memoryMb: { rss: toMb(memory.rss), heapUsed: toMb(memory.heapUsed) },
          },
        }
      : {}),
  };
};
