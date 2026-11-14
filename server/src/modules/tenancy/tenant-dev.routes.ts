import { Router } from 'express';
import { validate } from '../../common/middleware';
import { requireAuthentication } from './middleware/authentication';
import { requireTenantPermission, resolveTenantContext } from './middleware/resolve-tenant';
import {
  checkCurrentTenantConnection,
  createCurrentTenantTestRecord,
  listAuthorizedMemberships,
  listCurrentTenantTestRecords,
  registerDevelopmentTenant,
} from './tenant-dev.controller';
import { tenantRegistrationSchema, tenantTestRecordSchema } from './schemas/tenant.schema';

export const tenantDevelopmentRouter = Router();

tenantDevelopmentRouter.use(requireAuthentication);
tenantDevelopmentRouter.post(
  '/',
  validate({ body: tenantRegistrationSchema }),
  registerDevelopmentTenant,
);
tenantDevelopmentRouter.get('/memberships', listAuthorizedMemberships);
tenantDevelopmentRouter.use('/current', resolveTenantContext);
tenantDevelopmentRouter.get(
  '/current',
  requireTenantPermission('tenant:read'),
  checkCurrentTenantConnection,
);
tenantDevelopmentRouter.get(
  '/current/records',
  requireTenantPermission('tenant:read'),
  listCurrentTenantTestRecords,
);
tenantDevelopmentRouter.post(
  '/current/records',
  requireTenantPermission('tenant:test:write'),
  validate({ body: tenantTestRecordSchema }),
  createCurrentTenantTestRecord,
);
