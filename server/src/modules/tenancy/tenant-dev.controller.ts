import type { RequestHandler } from 'express';
import { Types } from 'mongoose';
import { ServiceUnavailableError } from '../../common/errors';
import { sendSuccess } from '../../common/http/api-response';
import { getCentralModels } from './models/central.models';
import { getTenantModel } from './models/tenant.models';
import { tenantRegistrationService } from './services/tenant-registration.service';
import { getAuthenticatedUser, getTenantContext } from './middleware/resolve-tenant';
import type { TenantRegistrationBody, TenantTestRecordBody } from './schemas/tenant.schema';

export const registerDevelopmentTenant: RequestHandler = async (req, res) => {
  const auth = getAuthenticatedUser(req);
  const body = req.body as TenantRegistrationBody;
  const tenant = await tenantRegistrationService.register(body, auth.userId);
  sendSuccess(res, tenant, tenant.alreadyRegistered ? 200 : 201);
};

export const listAuthorizedMemberships: RequestHandler = async (req, res) => {
  const auth = getAuthenticatedUser(req);
  const models = getCentralModels();
  const memberships = await models.TenantMembership.find({
    userId: new Types.ObjectId(auth.userId),
    status: 'active',
  }).select('tenantId role createdAt');
  const tenantIds = memberships.map((membership) => membership.tenantId);
  const tenants = await models.Tenant.find({
    tenantId: { $in: tenantIds },
    status: 'active',
  }).select('tenantId name createdAt');
  const tenantById = new Map(tenants.map((tenant) => [tenant.tenantId, tenant]));

  sendSuccess(
    res,
    memberships.flatMap((membership) => {
      const tenant = tenantById.get(membership.tenantId);
      return tenant
        ? [
            {
              tenantId: tenant.tenantId,
              organizationName: tenant.name,
              role: membership.role,
              createdAt: tenant.createdAt,
            },
          ]
        : [];
    }),
  );
};

export const checkCurrentTenantConnection: RequestHandler = async (req, res) => {
  const tenant = getTenantContext(req);
  const database = tenant.connection.db;
  if (!database) {
    throw new ServiceUnavailableError('Tenant database is not connected');
  }
  await database.command({ ping: 1 });
  sendSuccess(res, {
    tenantId: tenant.tenantId,
    status: 'connected',
    connectionState: tenant.connection.readyState,
  });
};

export const createCurrentTenantTestRecord: RequestHandler = async (req, res) => {
  const tenant = getTenantContext(req);
  const auth = getAuthenticatedUser(req);
  const body = req.body as TenantTestRecordBody;
  const record = await getTenantModel(tenant, 'TenantTestRecord').create({
    tenantId: tenant.tenantId,
    value: body.value,
    createdBy: new Types.ObjectId(auth.userId),
  });

  sendSuccess(
    res,
    {
      id: record._id.toString(),
      value: record.value,
      createdAt: record.createdAt,
    },
    201,
  );
};

export const listCurrentTenantTestRecords: RequestHandler = async (req, res) => {
  const tenant = getTenantContext(req);
  const records = await getTenantModel(tenant, 'TenantTestRecord')
    .find({ tenantId: tenant.tenantId })
    .select('value createdAt')
    .sort({ createdAt: -1 })
    .limit(50);

  sendSuccess(
    res,
    records.map((record) => ({
      id: record._id.toString(),
      value: record.value,
      createdAt: record.createdAt,
    })),
  );
};
