# Project Status

## Current state

- **Step 2 - SaaS application UI shell:** implemented. The Angular application has the responsive shell and
  development dashboard UI; backend business workflows are not connected.
- **Step 3 - Multi-tenant MongoDB foundation:** implemented. The backend has central platform models, tenant
  database registration/connection management, tenant membership and authorization resolution, and development-only
  test APIs.
- **Not implemented:** production authentication, Google OAuth/Drive/Sheets, employee CRUD, attendance, salary,
  OCR, billing, subscription enforcement, or usage collection.

## Step 3 implementation

### Models and database behavior

Central `saas_platform` models: `Tenant`, `User`, `TenantMembership`, `TenantDatabase`, `TenantModule`,
`GoogleConnection`, `SubscriptionPlan`, `TenantUsage`, and `AuditLog`.

Tenant connection/model support: bounded `useDb()` connection manager backed by the shared Mongoose client,
tenant-model registry, deterministic server-only database-name derivation, and bootstrap `TenantMetadata` and
development `TenantTestRecord` collections.

Tenant registration uses generated IDs, unique central indexes, idempotent retry/recovery states, owner membership,
and central audit events. Tenant API access validates active user/tenant/membership and role permissions; no API
accepts or returns database names.

### APIs created

Development/test-only routes, disabled in production and requiring `DEV_AUTH_ENABLED=true` outside production:

- `POST /api/dev/tenants`
- `GET /api/dev/tenants/memberships`
- `GET /api/dev/tenants/current`
- `GET /api/dev/tenants/current/records`
- `POST /api/dev/tenants/current/records`

These routes use the non-production `x-dev-user-email` test adapter; they are not production authentication.

### Files created

- `PROJECT_STATUS.md`
- `docs/MULTI_TENANT_ARCHITECTURE.md`
- `server/src/database/mongoose-connection.d.ts`
- `server/src/modules/tenancy/models/central.models.ts`
- `server/src/modules/tenancy/models/tenant.models.ts`
- `server/src/modules/tenancy/services/tenant-connection-manager.ts`
- `server/src/modules/tenancy/services/tenant-registration.service.ts`
- `server/src/modules/tenancy/middleware/authentication.ts`
- `server/src/modules/tenancy/middleware/resolve-tenant.ts`
- `server/src/modules/tenancy/schemas/tenant.schema.ts`
- `server/src/modules/tenancy/tenant-dev.controller.ts`
- `server/src/modules/tenancy/tenant-dev.routes.ts`
- `server/src/modules/tenancy/tenancy.integration.test.ts`
- `server/src/modules/tenancy/types.ts`

### Existing files updated

- `README.md`
- `server/.env.example`
- `server/package.json`
- `server/src/config/env.ts`
- `server/src/database/mongo.ts`
- `server/src/routes/index.ts`
- `server/src/server.ts`
- `server/tsconfig.build.json`

## Verification

- Backend typecheck: **passed**
- Backend lint: **passed**
- Backend integration tests: **16 passed, 0 failed**
- Backend production build: **passed**
- Angular production build: **passed**

The integration suite uses an isolated in-memory MongoDB server; it does not modify the configured local or
production database. Tests cover two-tenant isolation, registration/mapping, unauthorized and inactive access,
membership roles, input/database-name selection rejection, duplicate registration, connection failures, recovery,
and bounded connection caching. The Angular build reports the existing initial-bundle budget warning: 524.41 kB
against a 500 kB budget (24.41 kB over); the production build still succeeds.

## Pending work

- Replace the development test adapter with real authentication before production use.
- Add the future tenant business schemas and versioned migration runner.
- Add production provisioning reconciliation/distributed locking before using multi-worker registration at scale.
- Implement business modules, Google integrations, subscriptions, and usage collection in their respective future
  steps.

See [docs/MULTI_TENANT_ARCHITECTURE.md](docs/MULTI_TENANT_ARCHITECTURE.md) for design and operational details.
