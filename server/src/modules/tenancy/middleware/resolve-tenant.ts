import type { Request, RequestHandler } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { BadRequestError, ForbiddenError, ServiceUnavailableError } from '../../../common/errors';
import { getCentralModels, type MembershipRole } from '../models/central.models';
import {
  tenantConnectionManager,
  tenantDatabaseNameForId,
} from '../services/tenant-connection-manager';
import type { AuthenticatedUserContext, TenantRequestContext } from '../types';

const tenantIdSchema = z.string().regex(/^tnt_[a-f0-9]{24}$/);

const ROLE_PERMISSIONS: Record<MembershipRole, readonly string[]> = {
  owner: ['tenant:read', 'tenant:test:write'],
  admin: ['tenant:read', 'tenant:test:write'],
  manager: ['tenant:read'],
  member: ['tenant:read'],
};

export const getAuthenticatedUser = (request: Request): AuthenticatedUserContext => {
  if (!request.auth) throw new Error('Authenticated user context is missing');
  return request.auth;
};

export const getTenantContext = (request: Request): TenantRequestContext => {
  if (!request.tenant) throw new Error('Resolved tenant context is missing');
  return request.tenant;
};

export const resolveTenantContext: RequestHandler = async (req, res, next) => {
  const auth = req.auth;
  if (!auth) return next(new Error('Authentication middleware must run before tenant resolution'));

  const parsedTenantId = tenantIdSchema.safeParse(req.header('x-tenant-id'));
  if (!parsedTenantId.success) {
    return next(new BadRequestError('A valid x-tenant-id is required'));
  }

  try {
    const tenantId = parsedTenantId.data;
    const models = getCentralModels();
    const userId = new Types.ObjectId(auth.userId);
    const [user, membership, tenant] = await Promise.all([
      models.User.findById(userId).select('status'),
      models.TenantMembership.findOne({ tenantId, userId, status: 'active' }),
      models.Tenant.findOne({ tenantId, status: 'active' }),
    ]);

    if (!user || user.status !== 'active' || !membership || !tenant) {
      return next(new ForbiddenError('Tenant access denied'));
    }

    const databaseMapping = await models.TenantDatabase.findOne({
      tenantId,
      status: 'ready',
    }).select('databaseName');
    if (!databaseMapping) {
      return next(new ServiceUnavailableError('Tenant database is not ready'));
    }
    if (databaseMapping.databaseName !== tenantDatabaseNameForId(tenantId)) {
      return next(new ServiceUnavailableError('Tenant database mapping is invalid'));
    }

    const lease = await tenantConnectionManager.acquire(databaseMapping.databaseName);
    const release = lease.release;
    const tenantContext: TenantRequestContext = {
      tenantId,
      databaseName: databaseMapping.databaseName,
      connection: lease.connection,
      membership: {
        role: membership.role,
        permissions: ROLE_PERMISSIONS[membership.role],
      },
      releaseConnection: release,
    };

    req.tenant = tenantContext;
    res.once('finish', release);
    res.once('close', release);
    next();
  } catch (error) {
    next(error);
  }
};

export const requireTenantPermission =
  (permission: string): RequestHandler =>
  (req, _res, next) => {
    const tenant = req.tenant;
    if (!tenant) return next(new Error('Tenant resolution middleware must run first'));
    if (!tenant.membership.permissions.includes(permission)) {
      return next(new ForbiddenError('You do not have permission to perform this action'));
    }
    next();
  };
