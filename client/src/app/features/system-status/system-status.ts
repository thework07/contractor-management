import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import {
  CircleAlert,
  CircleCheck,
  Database,
  LucideAngularModule,
  RefreshCw,
  Server,
} from 'lucide-angular';
import { ApiError } from '../../core/http/api-error';
import { LoggerService } from '../../core/logging/logger.service';
import type { HealthReport } from './health.models';
import { HealthService } from './health.service';

/** Foundation smoke test: proves Angular, Material, Tailwind, lucide and the API are wired up. */
@Component({
  selector: 'app-system-status',
  imports: [LucideAngularModule, MatButtonModule, MatCardModule, MatProgressBarModule],
  templateUrl: './system-status.html',
})
export class SystemStatus {
  private readonly healthService = inject(HealthService);
  private readonly logger = inject(LoggerService);

  protected readonly icons = { CircleAlert, CircleCheck, Database, RefreshCw, Server };

  protected readonly loading = signal(false);
  protected readonly report = signal<HealthReport | null>(null);
  protected readonly error = signal<string | null>(null);

  constructor() {
    this.refresh();
  }

  protected refresh(): void {
    this.loading.set(true);
    this.error.set(null);

    this.healthService.getHealth().subscribe({
      next: (report) => {
        this.logger.debug('system-status', 'Health check OK', report);
        this.report.set(report);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.report.set(null);
        this.error.set(error instanceof ApiError ? error.message : 'Unexpected error');
        this.loading.set(false);
      },
    });
  }
}
