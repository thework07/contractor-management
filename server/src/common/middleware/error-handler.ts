import type { ErrorRequestHandler } from 'express';
import mongoose from 'mongoose';
import { ZodError } from 'zod';
import { isProduction } from '../../config/env';
import { getRequestId } from '../context/request-context';
import { AppError } from '../errors';
import type { ErrorDetail } from '../errors';
import { createLogger } from '../logger/logger';

const log = createLogger('error');

interface NormalizedError {
  statusCode: number;
  code: string;
  message: string;
  details?: ErrorDetail[];
}

const hasProperty = <K extends string>(value: unknown, key: K): value is Record<K, unknown> =>
  typeof value === 'object' && value !== null && key in value;

/** Translates any thrown value into a safe, consistent HTTP error description. */
const normalizeError = (error: unknown): NormalizedError => {
  if (error instanceof AppError) {
    return {
      statusCode: error.statusCode,
      code: error.code,
      message: error.message,
      details: error.details,
    };
  }

  if (error instanceof ZodError) {
    return {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details: error.issues.map((i) => ({
        path: i.path.map(String).join('.'),
        message: i.message,
      })),
    };
  }

  if (error instanceof mongoose.Error.ValidationError) {
    return {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Data validation failed',
      details: Object.values(error.errors).map((e) => ({ path: e.path, message: e.message })),
    };
  }

  if (error instanceof mongoose.Error.CastError) {
    return {
      statusCode: 400,
      code: 'INVALID_VALUE',
      message: `Invalid value for "${error.path}"`,
    };
  }

  // MongoDB duplicate key
  if (hasProperty(error, 'code') && error.code === 11000) {
    const keyValue = hasProperty(error, 'keyValue') ? error.keyValue : undefined;
    return {
      statusCode: 409,
      code: 'DUPLICATE_KEY',
      message: 'A record with the same unique value already exists',
      details:
        keyValue && typeof keyValue === 'object' ? [{ fields: Object.keys(keyValue) }] : undefined,
    };
  }

  if (error instanceof mongoose.Error.MongooseServerSelectionError) {
    return {
      statusCode: 503,
      code: 'DATABASE_UNAVAILABLE',
      message: 'Database is currently unavailable',
    };
  }

  // body-parser / http-errors style errors (malformed JSON, payload too large...)
  if (
    hasProperty(error, 'status') &&
    typeof error.status === 'number' &&
    error.status >= 400 &&
    error.status < 500
  ) {
    const type = hasProperty(error, 'type') ? String(error.type) : '';
    return {
      statusCode: error.status,
      code: type === 'entity.parse.failed' ? 'INVALID_JSON' : 'BAD_REQUEST',
      message:
        type === 'entity.parse.failed'
          ? 'Request body contains invalid JSON'
          : error instanceof Error
            ? error.message
            : 'Bad request',
    };
  }

  return {
    statusCode: 500,
    code: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
  };
};

/** Must be registered last. Express 5 forwards async errors here automatically. */
export const errorHandler: ErrorRequestHandler = (error: unknown, req, res, next) => {
  if (res.headersSent) return next(error);

  const normalized = normalizeError(error);
  const requestId = getRequestId();
  const logMeta = {
    method: req.method,
    url: req.originalUrl,
    statusCode: normalized.statusCode,
    code: normalized.code,
    ...(normalized.details ? { details: normalized.details } : {}),
  };

  if (normalized.statusCode >= 500) {
    log.error(`${normalized.code}: ${error instanceof Error ? error.message : String(error)}`, {
      ...logMeta,
      error,
    });
  } else {
    log.warn(`${normalized.code}: ${normalized.message}`, logMeta);
  }

  res.status(normalized.statusCode).json({
    success: false,
    error: {
      code: normalized.code,
      message: normalized.message,
      ...(normalized.details ? { details: normalized.details } : {}),
      ...(requestId ? { requestId } : {}),
      ...(!isProduction && error instanceof Error && normalized.statusCode >= 500
        ? { stack: error.stack }
        : {}),
    },
  });
};
