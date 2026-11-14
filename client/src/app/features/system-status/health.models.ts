export interface HealthReport {
  status: 'ok' | 'degraded';
  service: string;
  version: string;
  environment: string;
  timestamp: string;
  uptimeSeconds: number;
  database: { status: 'up' | 'down'; state: string; latencyMs?: number };
}
