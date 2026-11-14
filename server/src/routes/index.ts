import { Router } from 'express';
import { healthRouter } from '../modules/health/health.routes';

/** Root API router, mounted at /api. Feature modules register their routers here. */
export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
