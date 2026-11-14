import { createHash } from 'node:crypto';
import { Types } from 'mongoose';
import { ConflictError, ForbiddenError } from '../../../common/errors';
import { createLogger } from '../../../common/logger/logger';
import { getCentralModels, type TenantRecord } from '../models/central.models';
import { getTenantModel, initializeTenantModels } from '../models/tenant.models';
import type {
  TenantConnectionProvider,
  TenantConnectionLease,
} from './tenant-connection-manager';
import { tenantConnectionManager, tenantDatabaseNameForId } from './tenant-connection-manager';
import type { TenantRequestContext } from '../types';

const log = createLogger('tenant-registration');

export interface RegisterTenantInput {
  organizationName: string;
}

export interface RegisteredTenant {
  tenantId: string;
  name: string;
  status: 'active';
  createdAt: Date;
  alreadyRegistered: boolean;
}

const normalizeOrganizationName = (name: string): string =>
  name.normalize('NFKC').trim().toLocaleLowerCase('en-US');

const registrationKeyFor = (userId: Types.ObjectId, normalizedName: string): string =>
  createHash('sha256').update(`${userId.toHexString()}\0${normalizedName}`).digest('hex');

const isDuplicateKeyError = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code?: unknown }).code === 11000;

const getTenantDto = (tenant: TenantRecord, alreadyRegistered: boolean): RegisteredTenant => ({
  tenantId: tenant.tenantId,
  name: tenant.name,
  status: 'active',
  createdAt: tenant.createdAt ?? new Date(),
  alreadyRegistered,
});

export class TenantRegistrationService {
  private readonly inFlight = new Map<string, Promise<RegisteredTenant>>();

  constructor(
    private readonly connections: TenantConnectionProvider = tenantConnectionManager,
  ) {}

  async register(
    input: RegisterTenantInput,
    ownerUserId: string,
  ): Promise<RegisteredTenant> {
    const ownerId = new Types.ObjectId(ownerUserId);
    const name = input.organizationName.normalize('NFKC').trim();
    const normalizedName = normalizeOrganizationName(name);
    const registrationKey = registrationKeyFor(ownerId, normalizedName);
    const pending = this.inFlight.get(registrationKey);
    if (pending) return pending.then((tenant) => ({ ...tenant, alreadyRegistered: true }));

    const registration = this.registerOnce(name, normalizedName, registrationKey, ownerId);
    this.inFlight.set(registrationKey, registration);
    try {
      return await registration;
    } finally {
      if (this.inFlight.get(registrationKey) === registration) {
        this.inFlight.delete(registrationKey);
      }
    }
  }

  private async registerOnce(
    name: string,
    normalizedName: string,
    registrationKey: string,
    ownerId: Types.ObjectId,
  ): Promise<RegisteredTenant> {
    const models = getCentralModels();
    const owner = await models.User.findById(ownerId).select('_id status');
    if (!owner || owner.status !== 'active') {
      throw new ForbiddenError('An active user is required to register an organization');
    }

    let tenant = await models.Tenant.findOne({ registrationKey });
    let alreadyRegistered = Boolean(tenant);

    if (!tenant) {
      const tenantId = `tnt_${new Types.ObjectId().toHexString()}`;
      try {
        tenant = await models.Tenant.create({
          tenantId,
          name,
          normalizedName,
          registrationKey,
          status: 'provisioning',
          createdBy: ownerId,
        });
      } catch (error) {
        if (!isDuplicateKeyError(error)) throw error;
        tenant = await models.Tenant.findOne({ registrationKey });
        if (!tenant) throw error;
        alreadyRegistered = true;
      }
    }

    if (tenant.status === 'active') {
      const [mapping, membership] = await Promise.all([
        models.TenantDatabase.findOne({ tenantId: tenant.tenantId, status: 'ready' }),
        models.TenantMembership.findOne({
          tenantId: tenant.tenantId,
          userId: ownerId,
          status: 'active',
        }),
      ]);
      if (mapping && membership) return getTenantDto(tenant, true);
    }

    const tenantId = tenant.tenantId;
    const databaseName = tenantDatabaseNameForId(tenantId);

    try {
      await models.Tenant.updateOne({ tenantId }, { $set: { status: 'provisioning' } });

      const mapping = await models.TenantDatabase.findOneAndUpdate(
        { tenantId },
        {
          $setOnInsert: { tenantId, databaseName },
          $set: { status: 'provisioning' },
        },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
      );
      if (!mapping || mapping.databaseName !== databaseName) {
        throw new Error('Tenant database mapping does not match the generated tenant identifier');
      }

      const lease = await this.connections.acquire(databaseName);
      try {
        const tenantContext = this.toTenantContext(tenantId, databaseName, lease);
        await initializeTenantModels(tenantContext);
        await getTenantModel(tenantContext, 'TenantMetadata').updateOne(
          { tenantId },
          { $setOnInsert: { tenantId } },
          { upsert: true },
        );
      } finally {
        lease.release();
      }

      const membership = await models.TenantMembership.findOneAndUpdate(
        { tenantId, userId: ownerId },
        {
          $setOnInsert: { tenantId, userId: ownerId, role: 'owner', status: 'active' },
        },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
      );
      if (!membership || membership.status !== 'active') {
        throw new ConflictError('The organization owner membership is not active');
      }

      await models.TenantDatabase.updateOne({ tenantId }, { $set: { status: 'ready' } });
      await models.Tenant.updateOne({ tenantId }, { $set: { status: 'active' } });
      await models.AuditLog.updateOne(
        { eventKey: `tenant.registered:${tenantId}` },
        {
          $setOnInsert: {
            eventKey: `tenant.registered:${tenantId}`,
            actorUserId: ownerId,
            tenantId,
            action: 'tenant.registered',
            entityType: 'tenant',
            entityId: tenantId,
            metadata: { organizationName: name },
          },
        },
        { upsert: true },
      );

      const activatedTenant = await models.Tenant.findOne({ tenantId });
      if (!activatedTenant || activatedTenant.status !== 'active') {
        throw new Error('Tenant activation could not be confirmed');
      }

      log.info('Tenant registration completed', { tenantId, alreadyRegistered });
      return getTenantDto(activatedTenant, alreadyRegistered);
    } catch (error) {
      log.error('Tenant registration failed; registration can be retried safely', {
        tenantId,
        error,
      });
      try {
        await Promise.all([
          models.Tenant.updateOne(
            { tenantId },
            { $set: { status: 'provisioning_failed' } },
          ),
          models.TenantDatabase.updateOne({ tenantId }, { $set: { status: 'failed' } }),
          models.AuditLog.updateOne(
            { eventKey: `tenant.registration_failed:${tenantId}` },
            {
              $setOnInsert: {
                eventKey: `tenant.registration_failed:${tenantId}`,
                actorUserId: ownerId,
                tenantId,
                action: 'tenant.registration_failed',
                entityType: 'tenant',
                entityId: tenantId,
                metadata: { errorCode: isDuplicateKeyError(error) ? 'DUPLICATE_KEY' : 'PROVISIONING_FAILED' },
              },
            },
            { upsert: true },
          ),
        ]);
      } catch (recoveryError) {
        log.error('Could not persist tenant registration recovery state', {
          tenantId,
          error: recoveryError,
        });
      }
      throw error;
    }
  }

  private toTenantContext(
    tenantId: string,
    databaseName: string,
    lease: TenantConnectionLease,
  ): TenantRequestContext {
    return {
      tenantId,
      databaseName,
      connection: lease.connection,
      membership: { role: 'owner', permissions: [] },
      releaseConnection: lease.release,
    };
  }
}

export const tenantRegistrationService = new TenantRegistrationService();
