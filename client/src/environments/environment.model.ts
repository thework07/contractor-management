export interface Environment {
  production: boolean;
  /** Base URL of the API. Relative ("/api") means "same origin" (reverse proxy / dev proxy). */
  apiUrl: string;
  /** Minimum level printed by LoggerService. */
  logLevel: 'debug' | 'info' | 'warn' | 'error' | 'silent';
  dashboardMockData?: DashboardMockData;
}

export interface DashboardMockData {
  stats: {
    id: 'employees' | 'active' | 'uploads' | 'pending' | 'approved' | 'salary';
    label: string;
    value: string;
    note: string;
  }[];
  activity: {
    [key: string]: string;
    action: string;
    details: string;
    time: string;
    status: string;
  }[];
}
