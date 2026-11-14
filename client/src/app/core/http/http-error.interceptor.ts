import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { LoggerService } from '../logging/logger.service';
import { ApiError } from './api-error';

/** Converts every failed HTTP call into an ApiError and logs it with the server's request id. */
export const httpErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const logger = inject(LoggerService);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse)) return throwError(() => error);

      const apiError = ApiError.from(error);
      logger.error('http', `${req.method} ${req.urlWithParams} failed (${apiError.status})`, {
        code: apiError.code,
        message: apiError.message,
        requestId: apiError.requestId,
        details: apiError.details,
      });
      return throwError(() => apiError);
    }),
  );
};
