import { Router } from 'express';
import { validate } from '../../common/middleware';
import { getHealth } from './health.controller';
import { healthQuerySchema } from './health.schema';

export const healthRouter = Router();

healthRouter.get('/', validate({ query: healthQuerySchema }), getHealth);
