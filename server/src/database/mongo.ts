import mongoose from 'mongoose';
import { createLogger } from '../common/logger/logger';
import { env, isProduction } from '../config/env';

const log = createLogger('mongo');

mongoose.set('strictQuery', true);

export type MongoState = 'disconnected' | 'connected' | 'connecting' | 'disconnecting' | 'unknown';

const READY_STATES: Record<number, MongoState> = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

let listenersAttached = false;

/** Hides credentials so the URI can be logged safely. */
export const redactMongoUri = (uri: string): string =>
  uri.replace(/\/\/([^:@/]+):([^@/]+)@/, '//$1:****@');

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const attachListeners = (): void => {
  if (listenersAttached) return;
  listenersAttached = true;

  mongoose.connection.on('disconnected', () => log.warn('MongoDB disconnected'));
  mongoose.connection.on('reconnected', () => log.info('MongoDB reconnected'));
  mongoose.connection.on('error', (error: Error) =>
    log.error('MongoDB connection error', { error }),
  );
};

export const getMongoState = (): MongoState =>
  READY_STATES[mongoose.connection.readyState] ?? 'unknown';

export const getCentralConnection = () => mongoose.connection;

/** Connects with bounded retries. Throws the last error when every attempt fails. */
export const connectMongo = async (): Promise<void> => {
  if (mongoose.connection.readyState === 1) return;

  attachListeners();
  const maxAttempts = env.MONGODB_CONNECT_RETRIES + 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      log.info(`Connecting to MongoDB (attempt ${attempt}/${maxAttempts})`, {
        uri: redactMongoUri(env.MONGODB_URI),
      });
      await mongoose.connect(env.MONGODB_URI, {
        dbName: env.MONGODB_CENTRAL_DB_NAME,
        maxPoolSize: env.MONGODB_MAX_POOL_SIZE,
        serverSelectionTimeoutMS: env.MONGODB_SERVER_SELECTION_TIMEOUT_MS,
        autoIndex: !isProduction,
      });
      log.info('MongoDB connected', {
        host: mongoose.connection.host,
        port: mongoose.connection.port,
        database: mongoose.connection.name,
      });
      return;
    } catch (error) {
      const isLastAttempt = attempt === maxAttempts;
      log.error(`MongoDB connection failed (attempt ${attempt}/${maxAttempts})`, { error });
      if (isLastAttempt) {
        log.error('Hint: is MongoDB running and is MONGODB_URI in .env correct?');
        throw error;
      }
      const delay = env.MONGODB_RETRY_DELAY_MS * attempt;
      log.warn(`Retrying in ${delay}ms`);
      await sleep(delay);
    }
  }
};

export const disconnectMongo = async (): Promise<void> => {
  if (mongoose.connection.readyState === 0) return;
  await mongoose.disconnect();
  log.info('MongoDB connection closed');
};

/** Round-trips to the server and returns the latency in milliseconds. */
export const pingMongo = async (): Promise<number> => {
  const db = mongoose.connection.db;
  if (!db) throw new Error('MongoDB is not connected');
  const start = performance.now();
  await db.admin().ping();
  return Math.round(performance.now() - start);
};
