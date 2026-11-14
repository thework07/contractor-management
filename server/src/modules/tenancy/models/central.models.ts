import { Schema, type Connection, type Model } from 'mongoose';
import type { Types } from 'mongoose';
import { getCentralConnection } from '../../../database/mongo';

export type TenantStatus =
  | 'provisioning'
  | 'provisioning_failed'
  | 'active'
  | 'suspended'
  | 'deleted';
export type TenantDatabaseStatus = 'provisioning' | 'failed' | 'ready';
export type MembershipStatus = 'active' | 'revoked';
export type MembershipRole = 'owner' | 'admin' | 'manager' | 'member';

export interface UserRecord {
  email: string;
  displayName: string;
  status: 'active' | 'disabled';
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TenantRecord {
  tenantId: string;
  name: string;
  normalizedName: string;
  registrationKey: string;
  status: TenantStatus;
  createdBy: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TenantMembershipRecord {
  tenantId: string;
  userId: Types.ObjectId;
  role: MembershipRole;
  status: MembershipStatus;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TenantDatabaseRecord {
  tenantId: string;
  databaseName: string;
  status: TenantDatabaseStatus;
  createdAt?: Date;
  updatedAt?: Date;
}

interface TenantModuleRecord {
  tenantId: string;
  moduleKey: string;
  enabled: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

interface GoogleConnectionRecord {
  tenantId: string;
  connectedBy: Types.ObjectId;
  googleSubject?: string;
  accountEmail?: string;
  credentialRef?: string;
  status: 'connected' | 'disconnected';
  createdAt?: Date;
  updatedAt?: Date;
}

interface SubscriptionPlanRecord {
  planKey: string;
  displayName: string;
  description?: string;
  moduleKeys: string[];
  status: 'active' | 'archived';
  createdAt?: Date;
  updatedAt?: Date;
}

interface TenantUsageRecord {
  tenantId: string;
  metricKey: string;
  periodStart: Date;
  value: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface AuditLogRecord {
  eventKey: string;
  actorUserId: Types.ObjectId;
  tenantId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata: Record<string, unknown>;
  createdAt?: Date;
}

const userSchema = new Schema<UserRecord>(
  {
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    displayName: { type: String, required: true, trim: true, maxlength: 120 },
    status: { type: String, enum: ['active', 'disabled'], default: 'active', required: true },
  },
  { collection: 'users', timestamps: true, versionKey: false },
);
userSchema.index({ email: 1 }, { unique: true });

const tenantSchema = new Schema<TenantRecord>(
  {
    tenantId: { type: String, required: true, immutable: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    normalizedName: { type: String, required: true, immutable: true },
    registrationKey: { type: String, required: true, immutable: true, select: false },
    status: {
      type: String,
      enum: ['provisioning', 'provisioning_failed', 'active', 'suspended', 'deleted'],
      default: 'provisioning',
      required: true,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  },
  { collection: 'tenants', timestamps: true, versionKey: false },
);
tenantSchema.index({ tenantId: 1 }, { unique: true });
tenantSchema.index({ registrationKey: 1 }, { unique: true });

const tenantMembershipSchema = new Schema<TenantMembershipRecord>(
  {
    tenantId: { type: String, required: true, immutable: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
    role: { type: String, enum: ['owner', 'admin', 'manager', 'member'], required: true },
    status: { type: String, enum: ['active', 'revoked'], default: 'active', required: true },
  },
  { collection: 'tenant_memberships', timestamps: true, versionKey: false },
);
tenantMembershipSchema.index({ tenantId: 1, userId: 1 }, { unique: true });
tenantMembershipSchema.index({ userId: 1, status: 1 });

const tenantDatabaseSchema = new Schema<TenantDatabaseRecord>(
  {
    tenantId: { type: String, required: true, immutable: true },
    databaseName: { type: String, required: true, immutable: true },
    status: {
      type: String,
      enum: ['provisioning', 'failed', 'ready'],
      default: 'provisioning',
      required: true,
    },
  },
  { collection: 'tenant_databases', timestamps: true, versionKey: false },
);
tenantDatabaseSchema.index({ tenantId: 1 }, { unique: true });
tenantDatabaseSchema.index({ databaseName: 1 }, { unique: true });

const tenantModuleSchema = new Schema<TenantModuleRecord>(
  {
    tenantId: { type: String, required: true },
    moduleKey: { type: String, required: true },
    enabled: { type: Boolean, default: false, required: true },
  },
  { collection: 'tenant_modules', timestamps: true, versionKey: false },
);
tenantModuleSchema.index({ tenantId: 1, moduleKey: 1 }, { unique: true });

const googleConnectionSchema = new Schema<GoogleConnectionRecord>(
  {
    tenantId: { type: String, required: true, immutable: true },
    connectedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    googleSubject: { type: String },
    accountEmail: { type: String, trim: true, lowercase: true },
    credentialRef: { type: String },
    status: { type: String, enum: ['connected', 'disconnected'], default: 'disconnected' },
  },
  { collection: 'google_connections', timestamps: true, versionKey: false },
);
googleConnectionSchema.index({ tenantId: 1 }, { unique: true });

const subscriptionPlanSchema = new Schema<SubscriptionPlanRecord>(
  {
    planKey: { type: String, required: true, trim: true, lowercase: true },
    displayName: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, trim: true, maxlength: 500 },
    moduleKeys: { type: [String], default: [] },
    status: { type: String, enum: ['active', 'archived'], default: 'active', required: true },
  },
  { collection: 'subscription_plans', timestamps: true, versionKey: false },
);
subscriptionPlanSchema.index({ planKey: 1 }, { unique: true });

const tenantUsageSchema = new Schema<TenantUsageRecord>(
  {
    tenantId: { type: String, required: true },
    metricKey: { type: String, required: true },
    periodStart: { type: Date, required: true },
    value: { type: Number, min: 0, required: true },
  },
  { collection: 'tenant_usage', timestamps: true, versionKey: false },
);
tenantUsageSchema.index({ tenantId: 1, metricKey: 1, periodStart: 1 }, { unique: true });

const auditLogSchema = new Schema<AuditLogRecord>(
  {
    eventKey: { type: String, required: true, immutable: true },
    actorUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
    tenantId: { type: String },
    action: { type: String, required: true },
    entityType: { type: String, required: true },
    entityId: { type: String },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { collection: 'audit_logs', timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);
auditLogSchema.index({ eventKey: 1 }, { unique: true });
auditLogSchema.index({ tenantId: 1, createdAt: -1 });

const bindModel = <T>(connection: Connection, name: string, schema: Schema<T>, collection: string) =>
  (connection.models[name] as Model<T> | undefined) ??
  connection.model<T>(name, schema, collection);

export const getCentralModels = (connection = getCentralConnection()) => ({
  User: bindModel(connection, 'User', userSchema, 'users'),
  Tenant: bindModel(connection, 'Tenant', tenantSchema, 'tenants'),
  TenantMembership: bindModel(
    connection,
    'TenantMembership',
    tenantMembershipSchema,
    'tenant_memberships',
  ),
  TenantDatabase: bindModel(
    connection,
    'TenantDatabase',
    tenantDatabaseSchema,
    'tenant_databases',
  ),
  TenantModule: bindModel(connection, 'TenantModule', tenantModuleSchema, 'tenant_modules'),
  GoogleConnection: bindModel(
    connection,
    'GoogleConnection',
    googleConnectionSchema,
    'google_connections',
  ),
  SubscriptionPlan: bindModel(
    connection,
    'SubscriptionPlan',
    subscriptionPlanSchema,
    'subscription_plans',
  ),
  TenantUsage: bindModel(connection, 'TenantUsage', tenantUsageSchema, 'tenant_usage'),
  AuditLog: bindModel(connection, 'AuditLog', auditLogSchema, 'audit_logs'),
});

export const initializeCentralModels = async (): Promise<void> => {
  const models = getCentralModels();
  await Promise.all(Object.values(models).map((model) => model.createIndexes()));
};
