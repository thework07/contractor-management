import 'dotenv/config';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

const booleanString = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  CORS_ORIGINS: z.string().default('http://localhost:4200'),

  MONGODB_URI: z
    .string({ error: 'MONGODB_URI is required' })
    .regex(/^mongodb(\+srv)?:\/\//, 'must start with mongodb:// or mongodb+srv://'),
  MONGODB_CENTRAL_DB_NAME: z.literal('saas_platform').default('saas_platform'),
  MONGODB_MAX_POOL_SIZE: z.coerce.number().int().positive().default(10),
  MONGODB_SERVER_SELECTION_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  MONGODB_CONNECT_RETRIES: z.coerce.number().int().min(0).default(3),
  MONGODB_RETRY_DELAY_MS: z.coerce.number().int().min(0).default(2000),
  TENANT_CONNECTION_CACHE_MAX: z.coerce.number().int().min(1).max(1000).default(100),
  DEV_AUTH_ENABLED: booleanString,

  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'debug']).optional(),
  LOG_TO_FILE: booleanString,
  LOG_DIR: z.string().default('logs'),
}).superRefine((config, context) => {
  if (config.NODE_ENV === 'production' && config.DEV_AUTH_ENABLED) {
    context.addIssue({
      code: 'custom',
      path: ['DEV_AUTH_ENABLED'],
      message: 'must be false in production',
    });
  }
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // The logger depends on env, so configuration errors are printed directly.
  console.error('\n✖ Invalid environment configuration:\n');
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.') || 'env'}: ${issue.message}`);
  }
  console.error('\n  Copy .env.example to .env and fix the values above.\n');
  process.exit(1);
}

const raw = parsed.data;

export const env = {
  ...raw,
  LOG_LEVEL: raw.LOG_LEVEL ?? (raw.NODE_ENV === 'development' ? 'debug' : 'info'),
  CORS_ORIGINS: raw.CORS_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
};

export const isProduction = env.NODE_ENV === 'production';
export const isDevelopment = env.NODE_ENV === 'development';
export const isTest = env.NODE_ENV === 'test';

const packageJson = JSON.parse(
  readFileSync(path.resolve(__dirname, '../../package.json'), 'utf-8'),
) as { name: string; version: string };

export const appInfo = { name: packageJson.name, version: packageJson.version } as const;
