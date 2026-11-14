export interface Environment {
  production: boolean;
  /** Base URL of the API. Relative ("/api") means "same origin" (reverse proxy / dev proxy). */
  apiUrl: string;
  /** Minimum level printed by LoggerService. */
  logLevel: 'debug' | 'info' | 'warn' | 'error' | 'silent';
}
