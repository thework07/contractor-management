import type { Connection } from 'mongoose';

export interface AuthenticatedUserContext {
  userId: string;
  email: string;
}

export interface TenantMembershipContext {
  role: 'owner' | 'admin' | 'manager' | 'member';
  permissions: readonly string[];
}

export interface TenantRequestContext {
  tenantId: string;
  databaseName: string;
  connection: Connection;
  membership: TenantMembershipContext;
  releaseConnection: () => void;
}

declare module 'express-serve-static-core' {
  interface Request {
    auth?: AuthenticatedUserContext;
    tenant?: TenantRequestContext;
  }
}
