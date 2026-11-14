# Multi-Tenant MongoDB Architecture

## Scope

This document describes Step 3's database foundation. It does not add production login, business CRUD, Google
integration, billing, or usage collection. The Angular app must not receive database names or MongoDB credentials.

## Central database

The server connects to one MongoDB server using the configured `MONGODB_URI`, then explicitly selects
`MONGODB_CENTRAL_DB_NAME` (default `saas_platform`). A single Mongoose connection/client and its pool are shared by
the central database and tenant database handles.

Central models/collections:

| Model | Collection | Purpose |
| --- | --- | --- |
| `Tenant` | `tenants` | Organization identity, registration key, lifecycle status and creator |
| `User` | `users` | Central user identity and active/disabled status |
| `TenantMembership` | `tenant_memberships` | User-to-tenant relationship, role and membership status |
| `TenantDatabase` | `tenant_databases` | Backend-only mapping and provisioning status |
| `TenantModule` | `tenant_modules` | Future per-tenant module visibility |
| `GoogleConnection` | `google_connections` | Future Google connection metadata; no OAuth or secrets are implemented |
| `SubscriptionPlan` | `subscription_plans` | Future plan definitions; no billing is implemented |
| `TenantUsage` | `tenant_usage` | Future usage counters; no collection logic is implemented |
| `AuditLog` | `audit_logs` | Idempotent central audit events for registration |

`initializeCentralModels()` creates the declared indexes before the API starts accepting requests.

## Tenant databases

Each tenant is assigned a server-generated ID of the form `tnt_<24 hex characters>`. Its database name is derived
server-side as `tenant_<same 24 hex characters>` and stored in the central `TenantDatabase` collection. The
different prefixes prevent an API tenant ID from itself being a database name.

The tenant registration step creates only a `TenantMetadata` bootstrap record. Employee, site, attendance, salary,
and tenant-settings schemas are not implemented. Future models must be registered through `getTenantModel()` using
the resolved tenant context; they must never be bound to the central connection.

## Registration and recovery flow

`POST /api/dev/tenants` is the development-only registration entry point for this step:

1. Validate and normalize the organization name and require an active authenticated user.
2. Derive a stable registration key from the user ID and normalized organization name. Unique indexes prevent
   duplicate tenant IDs, registration keys, membership pairs, database mappings, and audit events.
3. Create or recover the tenant record in `provisioning` state.
4. Derive the safe database name from the generated tenant ID; create/recover the central mapping in
   `provisioning` state.
5. Acquire a tenant database handle on the shared Mongoose client, register/initialize the tenant metadata model,
   and initialize the owner membership.
6. Mark the mapping ready, record the central audit event, and activate the tenant.
7. On a failure, persist recoverable failure states and an audit event where possible; repeating the same
   registration resumes the same tenant instead of creating another.

The service coalesces same-process in-flight requests and uses unique central indexes as cross-process duplicate
guards. The workflow does not assume MongoDB transaction support, so registration is designed to be idempotent and
retryable across partial provisioning. A dedicated distributed provisioning lease/reconciler is future operational
hardening for multi-worker deployments.

## Authentication and tenant resolution

Production authentication is not part of this step. The only adapter is deliberately opt-in:

- `DEV_AUTH_ENABLED` defaults to `false`.
- When enabled in development/test, `x-dev-user-email` finds or creates a test user in the central database.
- The adapter refuses to authenticate in `NODE_ENV=production`; configuration validation also rejects enabling it
  for production.
- The `/api/dev/tenants` router is not mounted in production.

For tenant-scoped routes, `x-tenant-id` carries only the tenant ID, never a database name. The backend validates its
format and rechecks that the user exists and is active, the tenant is active, and the user's membership is active.
It then loads the server-side database mapping, verifies that it matches the deterministic tenant-ID mapping,
acquires a tenant connection lease, and attaches the authorized tenant context to the request. Role-to-permission
checks run before protected operations. The lease is released on response completion or close.

The development header is a test adapter, not an authentication mechanism. Do not expose it or enable it in
production. Replace it with verified session/JWT middleware before adding real tenant-facing functionality.

## Connection manager and model registration

`TenantConnectionManager` calls `useDb(name, { useCache: true })` on the existing central connection. It does not
open a MongoDB server connection per tenant. Concurrent requests for a database share a cached handle. Leases
prevent eviction while a request is active; an LRU-style capacity bound (`TENANT_CONNECTION_CACHE_MAX`, default
100) evicts idle handles. `evict()` supports explicit eviction, and `closeAll()` is used during graceful shutdown.

`getTenantModel(context, modelName)` validates the tenant ID/database-name pairing, rejects the central database,
and binds/reuses the model on the tenant-specific Mongoose connection. Future tenant model additions belong in the
tenant model registry and should have indexes initialized there.

## Development/test APIs

These routes are mounted only outside production and require the explicit development authentication adapter:

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/dev/tenants` | Create/recover a tenant for the authenticated development user |
| `GET` | `/api/dev/tenants/memberships` | List that user's active memberships |
| `GET` | `/api/dev/tenants/current` | Verify access and ping the resolved tenant database |
| `POST` | `/api/dev/tenants/current/records` | Create a test record in the selected authorized tenant |
| `GET` | `/api/dev/tenants/current/records` | Read test records from that tenant only |

Set `x-dev-user-email` for the development identity and `x-tenant-id` for the selected tenant. Unknown fields and
invalid inputs are rejected. There is no API for selecting a database by name, and database mappings are never
included in API responses. The test record API is not a business module.

## Environment variables

| Variable | Default | Description |
| --- | --- | --- |
| `MONGODB_URI` | Required | MongoDB server URI; keep credentials private |
| `MONGODB_CENTRAL_DB_NAME` | `saas_platform` | Central platform database selected by the server |
| `MONGODB_MAX_POOL_SIZE` | `10` | Shared MongoDB client pool size |
| `MONGODB_SERVER_SELECTION_TIMEOUT_MS` | `5000` | MongoDB server selection timeout |
| `MONGODB_CONNECT_RETRIES` | `3` | Additional startup connection attempts |
| `MONGODB_RETRY_DELAY_MS` | `2000` | Base retry delay |
| `TENANT_CONNECTION_CACHE_MAX` | `100` | Bound for cached tenant database handles |
| `DEV_AUTH_ENABLED` | `false` | Explicit development/test adapter switch; forbidden in production |
| `NODE_ENV` | `development` | Environment mode; production disables test routes and adapter |

See `server/.env.example` for the complete server configuration. MongoDB must be reachable by the server. Tenant
handles use the same credentials and server as the central database, so the MongoDB principal needs access to the
central database and tenant databases. Keep `MONGODB_URI` out of source control and browser configuration.

## Migration strategy

No tenant migration runner is implemented yet. When tenant business models are added, use versioned, idempotent
migrations and apply each migration to each `TenantDatabase` mapping in `ready` state. Track the applied version per
tenant, use bounded batches and resumable progress, and make failure state observable. Do not assume every tenant
migration can be run in one cross-database transaction.

## Backup and restore

Back up the central database and every tenant database; a tenant database backup without its central mapping and
membership metadata is not a complete restore. Retain the tenant-ID/database mapping in the central backup. For a
consistent recovery point, coordinate snapshots or use MongoDB's supported point-in-time recovery. Test restoring a
tenant and its central mapping together, and verify isolation after restore. Establish retention, encryption, and
restore objectives before production data is stored.

## Verification commands

From the repository root:

```powershell
npm --prefix server run typecheck
npm --prefix server run lint
npm --prefix server test
npm --prefix server run build
npm --prefix client run build
```

The integration suite uses `mongodb-memory-server` and does not connect to the configured MongoDB deployment.
