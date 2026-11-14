import type { Connection } from 'mongoose';
import { getCentralConnection } from '../../../database/mongo';
import { env } from '../../../config/env';
import { ConflictError, ServiceUnavailableError } from '../../../common/errors';
import { createLogger } from '../../../common/logger/logger';

const log = createLogger('tenant-connections');
const TENANT_DATABASE_PATTERN = /^tenant_[a-f0-9]{24}$/;

interface CacheEntry {
  databaseName: string;
  connection: Connection;
  activeLeases: number;
}

export interface TenantConnectionLease {
  connection: Connection;
  release: () => void;
}

export interface TenantConnectionProvider {
  acquire(databaseName: string): Promise<TenantConnectionLease>;
}

export const isTenantDatabaseName = (databaseName: string): boolean =>
  TENANT_DATABASE_PATTERN.test(databaseName);

export const tenantDatabaseNameForId = (tenantId: string): string => {
  const match = /^tnt_([a-f0-9]{24})$/.exec(tenantId);
  if (!match) throw new ConflictError('Tenant identifier is invalid');
  return `tenant_${match[1]}`;
};

export class TenantConnectionManager implements TenantConnectionProvider {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly creating = new Map<string, Promise<CacheEntry>>();
  private reservations = 0;

  constructor(
    private readonly centralConnection: Connection = getCentralConnection(),
    private readonly maxCachedConnections: number = env.TENANT_CONNECTION_CACHE_MAX,
  ) {}

  async acquire(databaseName: string): Promise<TenantConnectionLease> {
    if (!isTenantDatabaseName(databaseName)) {
      throw new ConflictError('Tenant database mapping is invalid');
    }

    let entry = this.cache.get(databaseName);
    if (!entry) {
      let creating = this.creating.get(databaseName);
      if (!creating) {
        creating = this.createEntry(databaseName);
        this.creating.set(databaseName, creating);
      }

      try {
        entry = await creating;
      } finally {
        if (this.creating.get(databaseName) === creating) {
          this.creating.delete(databaseName);
        }
      }
    }

    entry.activeLeases += 1;
    this.touch(entry);
    let released = false;

    return {
      connection: entry.connection,
      release: () => {
        if (released) return;
        released = true;
        entry!.activeLeases = Math.max(0, entry!.activeLeases - 1);
        this.touch(entry!);
      },
    };
  }

  async evict(databaseName: string): Promise<boolean> {
    if (!isTenantDatabaseName(databaseName)) {
      throw new ConflictError('Tenant database mapping is invalid');
    }

    const entry = this.cache.get(databaseName);
    if (!entry) return false;
    if (entry.activeLeases > 0) {
      throw new ConflictError('Cannot evict a tenant database that is in use');
    }

    this.cache.delete(databaseName);
    try {
      this.centralConnection.removeDb(databaseName);
      return true;
    } catch (error) {
      this.cache.set(databaseName, entry);
      log.error('Failed to evict tenant database connection', { tenantId: databaseName.slice(7), error });
      throw error;
    }
  }

  async closeAll(): Promise<void> {
    for (const [databaseName, entry] of this.cache) {
      if (entry.activeLeases > 0) {
        throw new ConflictError('Cannot close tenant connections while requests are active');
      }
      await this.evict(databaseName);
    }
  }

  private async createEntry(databaseName: string): Promise<CacheEntry> {
    this.reserveCacheSlot();
    try {
      const connection = this.centralConnection.useDb(databaseName, { useCache: true });
      const entry: CacheEntry = { databaseName, connection, activeLeases: 0 };
      this.cache.set(databaseName, entry);
      return entry;
    } finally {
      this.reservations -= 1;
    }
  }

  private reserveCacheSlot(): void {
    if (this.cache.size + this.reservations >= this.maxCachedConnections) {
      const idleEntry = [...this.cache.values()].find((entry) => entry.activeLeases === 0);
      if (!idleEntry) {
        throw new ServiceUnavailableError(
          'Tenant connection capacity is temporarily full; retry the request',
        );
      }

      this.cache.delete(idleEntry.databaseName);
      this.reservations += 1;
      try {
        this.centralConnection.removeDb(idleEntry.databaseName);
      } catch (error) {
        this.cache.set(idleEntry.databaseName, idleEntry);
        this.reservations -= 1;
        log.error('Failed to evict idle tenant connection', {
          tenantId: idleEntry.databaseName.slice(7),
          error,
        });
        throw error;
      }
      return;
    }

    this.reservations += 1;
  }

  private touch(entry: CacheEntry): void {
    if (this.cache.get(entry.databaseName) !== entry) return;
    this.cache.delete(entry.databaseName);
    this.cache.set(entry.databaseName, entry);
  }
}

export const tenantConnectionManager = new TenantConnectionManager();
