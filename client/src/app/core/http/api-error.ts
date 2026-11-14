import type { HttpErrorResponse } from '@angular/common/http';
import type { ApiErrorBody } from './api.models';

/** Normalised error thrown by the HTTP layer so features never deal with raw HttpErrorResponse. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly requestId?: string,
    readonly details?: Record<string, unknown>[],
  ) {
    super(message);
    this.name = 'ApiError';
  }

  static from(response: HttpErrorResponse): ApiError {
    const body = response.error as Partial<ApiErrorBody> | null;

    if (body?.error) {
      return new ApiError(
        body.error.message,
        response.status,
        body.error.code,
        body.error.requestId,
        body.error.details,
      );
    }
    // 0 = no response at all; 502/503/504 = proxy or gateway could not reach the API.
    if ([0, 502, 503, 504].includes(response.status)) {
      return new ApiError(
        'Cannot reach the server. Is the API running?',
        response.status,
        'NETWORK_ERROR',
      );
    }
    return new ApiError(response.message, response.status, 'HTTP_ERROR');
  }
}
