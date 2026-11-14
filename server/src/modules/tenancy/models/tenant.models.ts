import { Schema, type Connection, type Model } from 'mongoose';
import type { Types } from 'mongoose';
import { getCentralConnection } from '../../../database/mongo';
import { env } from '../../../config/env';
import type { TenantRequestContext } from '../types';
import {
  isTenantDatabaseName,
  tenantDatabaseNameForId,
} from '../services/tenant-connection-manager';

export interface TenantDataRecord {
  tenantId: string;
  value?: string;
  createdBy?: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

export type TenantModelName = 'TenantMetadata' | 'TenantTestRecord';

const tenantMetadataSchema = new Schema<TenantDataRecord>(
  {
    tenantId: { type: String, required: true, immutable: true },
  },
  { collection: 'tenant_metadata', timestamps: true, versionKey: false },
);
tenantMetadataSchema.index({ tenantId: 1 }, { unique: true });

const tenantTestRecordSchema = new Schema<TenantDataRecord>(
  {
    tenantId: { type: String, required: true, immutable: true },
    value: { type: String, required: true, trim: true, maxlength: 500 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  },
  { collection: 'tenant_test_records', timestamps: true, versionKey: false },
);
tenantTestRecordSchema.index({ createdAt: -1 });

interface TenantModelDefinition {
  schema: Schema<TenantDataRecord>;
  collection: string;
}

const TENANT_MODELS: Record<TenantModelName, TenantModelDefinition> = {
  TenantMetadata: { schema: tenantMetadataSchema, collection: 'tenant_metadata' },
  TenantTestRecord: { schema: tenantTestRecordSchema, collection: 'tenant_test_records' },
};

const assertTenantConnection = (tenant: TenantRequestContext): Connection => {
  if (
    tenant.connection === getCentralConnection() ||
    tenant.databaseName === env.MONGODB_CENTRAL_DB_NAME ||
    tenant.databaseName !== tenantDatabaseNameForId(tenant.tenantId) ||
    !isTenantDatabaseName(tenant.databaseName) ||
    tenant.connection.name !== tenant.databaseName
  ) {
    throw new Error('Tenant model registration requires the resolved tenant database connection');
  }
  return tenant.connection;
};

export const getTenantModel = (
  tenant: TenantRequestContext,
  name: TenantModelName,
): Model<TenantDataRecord> => {
  const connection = assertTenantConnection(tenant);
  const definition = TENANT_MODELS[name];
  const existing = connection.models[name] as Model<TenantDataRecord> | undefined;
  return existing ?? connection.model<TenantDataRecord>(name, definition.schema, definition.collection);
};

export const initializeTenantModels = async (tenant: TenantRequestContext): Promise<void> => {
  const models = [
    getTenantModel(tenant, 'TenantMetadata'),
    getTenantModel(tenant, 'TenantTestRecord'),
  ];
  await Promise.all(models.map((model) => model.createIndexes()));
};
