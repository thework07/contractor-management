import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { ValidationError } from '../errors';
import type { ErrorDetail } from '../errors';

type Source = 'params' | 'query' | 'body';
export type ValidationSchemas = Partial<Record<Source, ZodType>>;

/**
 * Validates (and coerces) request params, query and body with Zod.
 * On success the parsed values replace the originals; on failure a ValidationError is raised
 * listing every problem at once.
 */
export const validate =
  (schemas: ValidationSchemas): RequestHandler =>
  (req, _res, next) => {
    const issues: ErrorDetail[] = [];
    const parsed: Partial<Record<Source, unknown>> = {};

    for (const source of ['params', 'query', 'body'] as const) {
      const schema = schemas[source];
      if (!schema) continue;

      const result = schema.safeParse(req[source]);
      if (result.success) {
        parsed[source] = result.data;
      } else {
        for (const issue of result.error.issues) {
          issues.push({ source, path: issue.path.map(String).join('.'), message: issue.message });
        }
      }
    }

    if (issues.length > 0) return next(new ValidationError('Request validation failed', issues));

    if ('params' in parsed) req.params = parsed.params as typeof req.params;
    if ('body' in parsed) req.body = parsed.body;
    // Express 5 exposes req.query as a read-only getter, so it has to be redefined.
    if ('query' in parsed) {
      Object.defineProperty(req, 'query', {
        value: parsed.query,
        writable: true,
        configurable: true,
      });
    }
    next();
  };
