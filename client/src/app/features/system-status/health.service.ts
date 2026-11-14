import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { API_BASE_URL } from '../../core/config/api.config';
import type { ApiSuccess } from '../../core/http/api.models';
import type { HealthReport } from './health.models';

@Injectable({ providedIn: 'root' })
export class HealthService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  getHealth(): Observable<HealthReport> {
    return this.http
      .get<ApiSuccess<HealthReport>>(`${this.baseUrl}/health`)
      .pipe(map((response) => response.data));
  }
}
