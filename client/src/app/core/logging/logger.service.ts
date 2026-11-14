/* eslint-disable no-console -- this service is the single sanctioned wrapper around console */
import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel | 'silent', number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
};

const LEVEL_STYLE: Record<LogLevel, string> = {
  debug: 'background:#64748b;color:#fff',
  info: 'background:#0284c7;color:#fff',
  warn: 'background:#d97706;color:#fff',
  error: 'background:#dc2626;color:#fff',
};

/**
 * Small console logger with coloured level badges and a context label, e.g.
 *   [ERROR] [http] GET /api/health failed   { status: 503 }
 * The minimum level comes from the environment file (debug in development, warn in production).
 */
@Injectable({ providedIn: 'root' })
export class LoggerService {
  debug(context: string, message: string, data?: unknown): void {
    this.write('debug', context, message, data);
  }

  info(context: string, message: string, data?: unknown): void {
    this.write('info', context, message, data);
  }

  warn(context: string, message: string, data?: unknown): void {
    this.write('warn', context, message, data);
  }

  error(context: string, message: string, data?: unknown): void {
    this.write('error', context, message, data);
  }

  private write(level: LogLevel, context: string, message: string, data?: unknown): void {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[environment.logLevel]) return;

    const args: unknown[] = [
      `%c ${level.toUpperCase()} %c [${context}] ${message}`,
      `${LEVEL_STYLE[level]};border-radius:3px;font-weight:bold`,
      'color:inherit',
    ];
    if (data !== undefined) args.push(data);

    console[level](...args);
  }
}
