import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { Server } from 'node:http';
import { after, before, test } from 'node:test';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Types } from 'mongoose';
import type { getCentralModels } from './models/central.models.js';
import type { TenantConnectionProvider } from './services/tenant-connection-manager.js';
import type { TenantRegistrationService } from './services/tenant-registration.service.js';

interface ApiSuccess<T> {
  success: true;
  data: T;
}

interface ApiFailure {
  success: false;
  error: { code: string; message: string };
}

interface TenantResponse {
  tenantId: string;
  name: string;
  status: string;
  createdAt: string;
  alreadyRegistered: boolean;
  databaseName?: string;
}

let mongoServer: MongoMemoryServer;
let apiServer: Server;
let baseUrl: string;
let models: ReturnType<typeof getCentralModels>;
let registrationService: TenantRegistrationService;
let connectionManager: { closeAll: () => Promise<void> };
let disconnectMongo: () => Promise<void>;
let ownerEmail: string;
let tenantA: TenantResponse;
let tenantB: TenantResponse;

const authHeaders = (email: string): Record<string, string> => ({
  'content-type': 'application/json',
  'x-dev-user-email': email,
});

const tenantHeaders = (email: string, tenantId: string): Record<string, string> => ({
  ...authHeaders(email),
  'x-tenant-id': tenantId,
});

const parseResponse = async <T>(response: Response): Promise<T> =>
  (await response.json()) as T;

before(async () => {
  mongoServer = await MongoMemoryServer.create({
    instance: { dbName: 'isolated_step3_test' },
  });
  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI = mongoServer.getUri();
  process.env.MONGODB_CENTRAL_DB_NAME = 'saas_platform';
  process.env.DEV_AUTH_ENABLED = 'true';
  ownerEmail = 'tenant-owner@example.test';

  const [{ connectMongo, disconnectMongo: disconnect }, central, tenancy, service, appModule] =
    await Promise.all([
      import('../../database/mongo.js'),
      import('./models/central.models.js'),
      import('./services/tenant-connection-manager.js'),
      import('./services/tenant-registration.service.js'),
      import('../../app.js'),
    ]);

  await connectMongo();
  await central.initializeCentralModels();
  models = central.getCentralModels();
  registrationService = new service.TenantRegistrationService();
  connectionManager = tenancy.tenantConnectionManager;
  disconnectMongo = disconnect;

  apiServer = appModule.createApp().listen(0);
  await once(apiServer, 'listening');
  const address = apiServer.address();
  if (!address || typeof address === 'string') throw new Error('Test API server did not bind a TCP port');
  baseUrl = `http://127.0.0.1:${address.port}/api/dev/tenants`;
});

after(async () => {
  if (apiServer?.listening) {
    await new Promise<void>((resolve, reject) => {
      apiServer.close((error) => (error ? reject(error) : resolve()));
    });
  }
  await connectionManager?.closeAll();
  await disconnectMongo?.();
  await mongoServer?.stop();
});

test('creates tenant A with a backend-generated identifier and active membership', async () => {
  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: authHeaders(ownerEmail),
    body: JSON.stringify({ organizationName: 'Northstar Builders' }),
  });
  const body = await parseResponse<ApiSuccess<TenantResponse> | ApiFailure>(response);

  assert.equal(response.status, 201);
  assert.equal(body.success, true);
  if (!body.success) return;
  tenantA = body.data;
  assert.match(tenantA.tenantId, /^tnt_[a-f0-9]{24}$/);
  assert.equal(tenantA.status, 'active');
  assert.equal(tenantA.alreadyRegistered, false);
  assert.equal('databaseName' in tenantA, false);
});

test('creates tenant B with its own generated identifier and database mapping', async () => {
  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: authHeaders(ownerEmail),
    body: JSON.stringify({ organizationName: 'Cedar Works' }),
  });
  const body = await parseResponse<ApiSuccess<TenantResponse> | ApiFailure>(response);

  assert.equal(response.status, 201);
  assert.equal(body.success, true);
  if (!body.success) return;
  tenantB = body.data;
  assert.notEqual(tenantA.tenantId, tenantB.tenantId);
  assert.equal(tenantB.status, 'active');
  assert.equal('databaseName' in tenantB, false);
});

test('central database maps the two tenants to distinct safe database names', async () => {
  const mappings = await models.TenantDatabase.find({
    tenantId: { $in: [tenantA.tenantId, tenantB.tenantId] },
  }).select('tenantId databaseName status');

  assert.equal(mappings.length, 2);
  const [firstMapping, secondMapping] = mappings;
  assert.ok(firstMapping && secondMapping);
  assert.notEqual(firstMapping.databaseName, secondMapping.databaseName);
  assert.ok(mappings.every((mapping) => /^tenant_[a-f0-9]{24}$/.test(mapping.databaseName)));
  assert.ok(mappings.every((mapping) => mapping.status === 'ready'));
});

test('tenant connection cache reuses the shared client, limits entries, and respects active leases', async () => {
  const [{ TenantConnectionManager }, { getCentralConnection }] = await Promise.all([
    import('./services/tenant-connection-manager.js'),
    import('../../database/mongo.js'),
  ]);
  const manager = new TenantConnectionManager(getCentralConnection(), 1);
  const firstName = 'tenant_aaaaaaaaaaaaaaaaaaaaaaaa';
  const nextName = 'tenant_bbbbbbbbbbbbbbbbbbbbbbbb';
  const [firstLease, secondLease] = await Promise.all([
    manager.acquire(firstName),
    manager.acquire(firstName),
  ]);

  assert.strictEqual(firstLease.connection, secondLease.connection);
  assert.strictEqual(firstLease.connection.getClient(), getCentralConnection().getClient());
  await assert.rejects(manager.acquire(nextName), /capacity is temporarily full/);

  firstLease.release();
  secondLease.release();
  const nextLease = await manager.acquire(nextName);
  assert.strictEqual(nextLease.connection.getClient(), getCentralConnection().getClient());
  nextLease.release();
  await manager.closeAll();
});

test('checks the current tenant connection without returning its database name', async () => {
  const response = await fetch(`${baseUrl}/current`, {
    headers: tenantHeaders(ownerEmail, tenantA.tenantId),
  });
  const body = await parseResponse<
    ApiSuccess<{ tenantId: string; status: string; connectionState: number }>
  >(response);

  assert.equal(response.status, 200);
  assert.equal(body.data.tenantId, tenantA.tenantId);
  assert.equal(body.data.status, 'connected');
  assert.equal(body.data.connectionState, 1);
  assert.equal('databaseName' in body.data, false);
});

test('records created in tenant A are isolated from tenant B', async () => {
  const createA = await fetch(`${baseUrl}/current/records`, {
    method: 'POST',
    headers: tenantHeaders(ownerEmail, tenantA.tenantId),
    body: JSON.stringify({ value: 'Tenant A private test record' }),
  });
  assert.equal(createA.status, 201);

  const listA = await fetch(`${baseUrl}/current/records`, {
    headers: tenantHeaders(ownerEmail, tenantA.tenantId),
  });
  const recordsA = await parseResponse<ApiSuccess<Array<{ value: string }>>>(listA);
  assert.deepEqual(recordsA.data.map((record) => record.value), ['Tenant A private test record']);

  const listB = await fetch(`${baseUrl}/current/records`, {
    headers: tenantHeaders(ownerEmail, tenantB.tenantId),
  });
  const recordsB = await parseResponse<ApiSuccess<Array<{ value: string }>>>(listB);
  assert.deepEqual(recordsB.data, []);
});

test('rejects access to another user’s tenant without an active membership', async () => {
  const response = await fetch(`${baseUrl}/current`, {
    headers: tenantHeaders('unrelated-user@example.test', tenantA.tenantId),
  });
  const body = await parseResponse<ApiFailure>(response);

  assert.equal(response.status, 403);
  assert.equal(body.success, false);
  assert.equal(body.error.code, 'FORBIDDEN');
});

test('development tenant APIs still require the explicit test authentication adapter', async () => {
  const response = await fetch(`${baseUrl}/memberships`);
  const body = await parseResponse<ApiFailure>(response);

  assert.equal(response.status, 401);
  assert.equal(body.success, false);
  assert.equal(body.error.code, 'UNAUTHORIZED');
});

test('membership roles are checked before tenant writes', async () => {
  await fetch(`${baseUrl}/memberships`, {
    headers: authHeaders('read-only-member@example.test'),
  });
  const member = await models.User.findOne({ email: 'read-only-member@example.test' }).select(
    '_id',
  );
  assert.ok(member);
  await models.TenantMembership.create({
    tenantId: tenantA.tenantId,
    userId: member._id,
    role: 'member',
    status: 'active',
  });

  const response = await fetch(`${baseUrl}/current/records`, {
    method: 'POST',
    headers: tenantHeaders('read-only-member@example.test', tenantA.tenantId),
    body: JSON.stringify({ value: 'write must be denied' }),
  });
  assert.equal(response.status, 403);
});

test('rejects arbitrary database-name selection in headers and registration bodies', async () => {
  const mapping = await models.TenantDatabase.findOne({ tenantId: tenantA.tenantId }).select(
    'databaseName',
  );
  assert.ok(mapping);

  const connectionResponse = await fetch(`${baseUrl}/current`, {
    headers: tenantHeaders(ownerEmail, mapping.databaseName),
  });
  assert.equal(connectionResponse.status, 400);

  const registrationResponse = await fetch(baseUrl, {
    method: 'POST',
    headers: authHeaders(ownerEmail),
    body: JSON.stringify({
      organizationName: 'Arbitrary database attempt',
      databaseName: 'admin',
    }),
  });
  assert.equal(registrationResponse.status, 400);
});

test('rejects duplicate and mismatched tenant database mappings', async () => {
  const mappingA = await models.TenantDatabase.findOne({ tenantId: tenantA.tenantId });
  const mappingB = await models.TenantDatabase.findOne({ tenantId: tenantB.tenantId });
  assert.ok(mappingA && mappingB);

  await assert.rejects(
    models.TenantDatabase.collection.updateOne(
      { tenantId: tenantA.tenantId },
      { $set: { databaseName: mappingB.databaseName } },
    ),
    { code: 11000 },
  );

  const invalidMapping = `tenant_${new Types.ObjectId().toHexString()}`;
  await models.TenantDatabase.collection.updateOne(
    { tenantId: tenantA.tenantId },
    { $set: { databaseName: invalidMapping } },
  );
  try {
    const response = await fetch(`${baseUrl}/current`, {
      headers: tenantHeaders(ownerEmail, tenantA.tenantId),
    });
    assert.equal(response.status, 503);
  } finally {
    await models.TenantDatabase.collection.updateOne(
      { tenantId: tenantA.tenantId },
      { $set: { databaseName: mappingA.databaseName } },
    );
  }
});

test('rejects access when a tenant is inactive', async () => {
  await models.Tenant.updateOne({ tenantId: tenantA.tenantId }, { $set: { status: 'suspended' } });
  try {
    const response = await fetch(`${baseUrl}/current`, {
      headers: tenantHeaders(ownerEmail, tenantA.tenantId),
    });
    assert.equal(response.status, 403);
  } finally {
    await models.Tenant.updateOne({ tenantId: tenantA.tenantId }, { $set: { status: 'active' } });
  }
});

test('lists only authorized active tenant memberships', async () => {
  const response = await fetch(`${baseUrl}/memberships`, {
    headers: authHeaders(ownerEmail),
  });
  const body = await parseResponse<
    ApiSuccess<Array<{ tenantId: string; organizationName: string; role: string }>>
  >(response);

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.deepEqual(
    body.data.map((membership) => membership.tenantId).sort(),
    [tenantA.tenantId, tenantB.tenantId].sort(),
  );
  assert.ok(body.data.every((membership) => membership.role === 'owner'));
  assert.ok(body.data.every((membership) => !('databaseName' in membership)));
});

test('duplicate registration is idempotent and does not create another tenant', async () => {
  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: authHeaders(ownerEmail),
    body: JSON.stringify({ organizationName: ' northstar builders ' }),
  });
  const body = await parseResponse<ApiSuccess<TenantResponse>>(response);

  assert.equal(response.status, 200);
  assert.equal(body.data.tenantId, tenantA.tenantId);
  assert.equal(body.data.alreadyRegistered, true);
  const owner = await models.User.findOne({ email: ownerEmail }).select('_id');
  assert.ok(owner);
  assert.equal(
    await models.Tenant.countDocuments({
      createdBy: new Types.ObjectId(owner._id.toString()),
      normalizedName: 'northstar builders',
    }),
    1,
  );
});

test('concurrent duplicate registrations share one tenant provisioning operation', async () => {
  const register = () =>
    fetch(baseUrl, {
      method: 'POST',
      headers: authHeaders(ownerEmail),
      body: JSON.stringify({ organizationName: 'Concurrent Workspace' }),
    });
  const responses = await Promise.all([register(), register()]);
  const responseBodies = await Promise.all(
    responses.map((response) => parseResponse<ApiSuccess<TenantResponse>>(response)),
  );
  const [firstBody, secondBody] = responseBodies;
  assert.ok(firstBody && secondBody);

  assert.deepEqual(
    responses.map((response) => response.status).sort(),
    [200, 201],
  );
  assert.equal(firstBody.data.tenantId, secondBody.data.tenantId);
  assert.equal(
    await models.Tenant.countDocuments({ normalizedName: 'concurrent workspace' }),
    1,
  );
});

test('failed tenant database provisioning remains recoverable and retry-safe', async () => {
  const owner = await models.User.findOne({ email: ownerEmail }).select('_id');
  assert.ok(owner);
  const failingProvider: TenantConnectionProvider = {
    acquire: async () => {
      throw new Error('injected tenant connection failure');
    },
  };
  const { TenantRegistrationService: RegistrationService } =
    await import('./services/tenant-registration.service.js');
  const failingService = new RegistrationService(failingProvider);
  await assert.rejects(
    failingService.register({ organizationName: 'Retryable Workspace' }, owner._id.toString()),
    /injected tenant connection failure/,
  );

  const failedTenant = await models.Tenant.findOne({
    createdBy: owner._id,
    normalizedName: 'retryable workspace',
  });
  assert.ok(failedTenant);
  assert.equal(failedTenant.status, 'provisioning_failed');
  assert.equal(
    (await models.TenantDatabase.findOne({ tenantId: failedTenant.tenantId }))?.status,
    'failed',
  );

  const retry = await registrationService.register(
    { organizationName: 'Retryable Workspace' },
    owner._id.toString(),
  );
  assert.equal(retry.tenantId, failedTenant.tenantId);
  assert.equal(retry.status, 'active');
  assert.equal(
    await models.Tenant.countDocuments({
      createdBy: owner._id,
      normalizedName: 'retryable workspace',
    }),
    1,
  );
});
