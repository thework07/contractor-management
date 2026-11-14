import { Router } from 'express';
import { isProduction } from '../config/env';
import { healthRouter } from '../modules/health/health.routes';
import { tenantDevelopmentRouter } from '../modules/tenancy/tenant-dev.routes';

/** Root API router, mounted at /api. Feature modules register their routers here. */
export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
if (!isProduction) {
  apiRouter.use('/dev/tenants', tenantDevelopmentRouter);
}
