import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
import { runWithRequestContext } from '../context/request-context';
import { createLogger } from '../logger/logger';

const log = createLogger('http');
const REQUEST_ID_HEADER = 'x-request-id';
const SAFE_REQUEST_ID = /^[\w-]{8,64}$/;

/**
 * Gives every request an id (honouring a sane incoming x-request-id), exposes it as a response
 * header, keeps it available to the logger via AsyncLocalStorage and logs one line per response.
 */
export const requestLogger: RequestHandler = (req, res, next) => {
  const incoming = req.header(REQUEST_ID_HEADER);
  const requestId = incoming && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();
  res.setHeader(REQUEST_ID_HEADER, requestId);

  runWithRequestContext({ requestId }, () => {
    const startedAt = process.hrtime.bigint();

    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
      const message = `${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs.toFixed(1)}ms`;
      if (res.statusCode >= 500) log.error(message);
      else if (res.statusCode >= 400) log.warn(message);
      else log.http(message);
    });

    next();
  });
};
