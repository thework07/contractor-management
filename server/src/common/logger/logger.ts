import path from 'node:path';
import { inspect } from 'node:util';
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { env, isDevelopment, isTest } from '../../config/env';
import { getRequestId } from '../context/request-context';

const { combine, timestamp, colorize, printf, json, errors } = winston.format;

const ANSI = { dim: '\x1b[2m', cyan: '\x1b[36m', red: '\x1b[31m', reset: '\x1b[0m' };
const paint = (color: keyof typeof ANSI, text: string) => `${ANSI[color]}${text}${ANSI.reset}`;

/** Adds the current request id (if any) so every log line of a request can be correlated. */
const attachRequestId = winston.format((info) => {
  const requestId = getRequestId();
  if (requestId) info.requestId = requestId;
  return info;
});

interface SerializedError {
  name: string;
  message: string;
  stack?: string;
  [key: string]: unknown;
}

const serializeError = (error: Error): SerializedError => ({
  ...error,
  name: error.name,
  message: error.message,
  ...(error.stack ? { stack: error.stack } : {}),
  ...(error.cause instanceof Error ? { cause: serializeError(error.cause) } : {}),
});

/** Error instances become plain objects, otherwise JSON.stringify drops them. */
const serializeErrors = winston.format((info) => {
  for (const key of Object.keys(info)) {
    const value = info[key] as unknown;
    if (value instanceof Error) info[key] = serializeError(value);
  }
  return info;
});

const isSerializedError = (value: unknown): value is SerializedError =>
  typeof value === 'object' &&
  value !== null &&
  'stack' in value &&
  typeof (value as SerializedError).stack === 'string';

const padLevel = winston.format((info) => {
  info.level = info.level.toUpperCase().padEnd(5);
  return info;
});

/**
 * Human friendly output for local development:
 *   14:03:22.481 ERROR [mongo] (a1b2c3d4) Connection failed
 *     { host: '127.0.0.1' }
 *     MongooseServerSelectionError: connect ECONNREFUSED ...
 *         at ...
 */
const developmentFormat = combine(
  errors({ stack: true }),
  serializeErrors(),
  attachRequestId(),
  timestamp({ format: 'HH:mm:ss.SSS' }),
  padLevel(),
  colorize({ level: true }),
  printf((info) => {
    const { timestamp: time, level, message, context, requestId } = info;
    // Object.keys skips winston's internal Symbol properties (level, message, splat).
    const reserved = new Set(['timestamp', 'level', 'message', 'context', 'requestId']);
    const meta: Record<string, unknown> = {};
    for (const key of Object.keys(info)) {
      if (!reserved.has(key)) meta[key] = info[key];
    }
    const errorBlocks: string[] = [];

    for (const [key, value] of Object.entries(meta)) {
      if (isSerializedError(value)) {
        errorBlocks.push(`  ${paint('red', `${key}: ${value.name}: ${value.message}`)}`);
        if (value.stack) {
          const stackLines = value.stack.split('\n').slice(1);
          errorBlocks.push(paint('dim', stackLines.map((line) => `  ${line}`).join('\n')));
        }
        delete meta[key];
      }
    }

    const head = [
      paint('dim', String(time)),
      level,
      context ? paint('cyan', `[${String(context)}]`) : '',
      requestId ? paint('dim', `(${String(requestId).slice(0, 8)})`) : '',
      String(message),
    ]
      .filter(Boolean)
      .join(' ');

    const metaBlock = Object.keys(meta).length
      ? `\n  ${inspect(meta, { colors: true, depth: 6, breakLength: 100 }).replace(/\n/g, '\n  ')}`
      : '';

    return [head + metaBlock, ...errorBlocks].join('\n');
  }),
);

/** Machine readable output (one JSON object per line) for production and log files. */
const jsonFormat = combine(
  errors({ stack: true }),
  serializeErrors(),
  attachRequestId(),
  timestamp(),
  json(),
);

const transports: winston.transport[] = [
  new winston.transports.Console({
    format: isDevelopment ? developmentFormat : jsonFormat,
    silent: isTest,
  }),
];

if (env.LOG_TO_FILE && !isTest) {
  const dirname = path.resolve(process.cwd(), env.LOG_DIR);
  const common = {
    dirname,
    datePattern: 'YYYY-MM-DD',
    maxFiles: '14d',
    zippedArchive: true,
    format: jsonFormat,
  };
  transports.push(
    new DailyRotateFile({ ...common, filename: 'combined-%DATE%.log' }),
    new DailyRotateFile({ ...common, filename: 'error-%DATE%.log', level: 'error' }),
  );
}

export const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  transports,
  exitOnError: false,
});

/** Creates a logger tagged with a context, e.g. `createLogger('mongo')`. */
export const createLogger = (context: string) => logger.child({ context });

export type Logger = ReturnType<typeof createLogger>;
