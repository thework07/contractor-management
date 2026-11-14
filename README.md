# Contractor Management

Multi-tenant Contractor Management SaaS. The responsive Angular SaaS shell and **Step 3: multi-tenant MongoDB
foundation** are implemented. Production authentication and employee, attendance, salary and Google integrations are
not implemented yet.

| Part   | Stack                                                                    |
| ------ | ------------------------------------------------------------------------ |
| Client | Angular 22, TypeScript, Angular Material, Tailwind CSS 4, lucide-angular |
| Server | Node.js, Express 5, TypeScript, Mongoose 9, Zod, Winston                 |
| DB     | MongoDB                                                                  |

## Prerequisites

- **Node.js `^22.22.3` or `^24.15`** (required by Angular 22) and npm 10+
- A running **MongoDB** (local install, Docker, or MongoDB Atlas)

## Setup

```bash
# 1. install everything
npm run install:all            # or: npm --prefix server install && npm --prefix client install

# 2. configure the server
cp server/.env.example server/.env      # Windows: copy server\.env.example server\.env
# edit server/.env -> at minimum set MONGODB_URI
```

## Run (development)

Two terminals from the repository root:

```bash
npm run dev:server    # API on http://localhost:3000  (tsx watch, auto-restart)
npm run dev:client    # UI  on http://localhost:4200  (proxies /api -> localhost:3000)
```

Open http://localhost:4200 - the **System status** card calls `GET /api/health`.

## Scripts

Run inside `server/` or `client/` (or via the root `npm run <script>` where available).

| Script                    | Server | Client | Purpose                                    |
| ------------------------- | :----: | :----: | ------------------------------------------ |
| `dev` / `start`           |   ✔    |   ✔    | Dev server (`dev` for API, `start` for UI) |
| `build`                   |   ✔    |   ✔    | Production build                           |
| `typecheck`               |   ✔    |   ✔    | TypeScript check without emitting          |
| `lint` / `lint:fix`       |   ✔    |   ✔    | ESLint                                     |
| `format` / `format:check` |   ✔    |   ✔    | Prettier                                   |
| `test`                    |   ✔    |        | Isolated multi-tenant integration tests    |
| `db:check`                |   ✔    |        | Connects to MongoDB, pings, disconnects    |

## Environment variables (`server/.env`)

| Variable                              | Required | Default                 | Description                                          |
| ------------------------------------- | :------: | ----------------------- | ---------------------------------------------------- |
| `MONGODB_URI`                         |   yes    | -                       | MongoDB server URI; server selects central DB         |
| `MONGODB_CENTRAL_DB_NAME`             |    no    | `saas_platform`          | Platform database for tenants, users and memberships  |
| `NODE_ENV`                            |    no    | `development`           | `development` / `test` / `production`                 |
| `PORT`                                |    no    | `3000`                  | API port                                              |
| `CORS_ORIGINS`                        |    no    | `http://localhost:4200` | Comma-separated allowed origins                       |
| `MONGODB_MAX_POOL_SIZE`               |    no    | `10`                    | Shared MongoDB client pool size                       |
| `MONGODB_SERVER_SELECTION_TIMEOUT_MS` |    no    | `5000`                  | Fail-fast timeout when MongoDB is unreachable         |
| `MONGODB_CONNECT_RETRIES`             |    no    | `3`                     | Extra connection attempts at startup                  |
| `MONGODB_RETRY_DELAY_MS`              |    no    | `2000`                  | Base delay between attempts (multiplied per attempt)  |
| `TENANT_CONNECTION_CACHE_MAX`         |    no    | `100`                   | Maximum cached tenant database handles                |
| `DEV_AUTH_ENABLED`                    |    no    | `false`                 | Opt-in test identity adapter; rejected in production  |
| `LOG_LEVEL`                           |    no    | `debug` dev / `info`    | `error` `warn` `info` `http` `debug`                  |
| `LOG_TO_FILE`                         |    no    | `false`                 | Also write JSON logs to `LOG_DIR` (14-day rotation)   |
| `LOG_DIR`                             |    no    | `logs`                  | Log directory (relative to `server/`)                 |

The server validates these at startup and exits with a readable list of problems if any are invalid.
Client settings live in `client/src/environments/` (`apiUrl`, `logLevel`).

## Architecture

```
server/src
  config/        env parsing & validation (Zod), app info
  database/      MongoDB connection management (retry, events, ping, graceful close)
  common/
    errors/      AppError + typed subclasses (NotFound, Validation, Conflict, ...)
    middleware/  request-logger, validate (Zod), not-found, error-handler
    logger/      Winston logger (pretty in dev, JSON in prod)
    context/     AsyncLocalStorage request id
    http/        response helpers
  modules/
    health/      health-check API
    tenancy/     central models, tenant provisioning, connection manager and dev test APIs
  routes/        root /api router
  app.ts         Express app factory   |   server.ts   bootstrap + graceful shutdown

client/src/app
  core/          singletons: API base URL, HTTP error interceptor, LoggerService
  shared/        reusable SaaS layout and UI components
  features/      dashboard, employee, attendance and system-status UI areas
```

Add a feature on the server by creating `modules/<name>/` and registering its router in `routes/index.ts`.

### API conventions

```jsonc
// success
{ "success": true, "data": { ... } }
// error (stack only included outside production for 5xx)
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [...], "requestId": "..." } }
```

Every response carries an `x-request-id` header that also appears in the logs.

### Logging

- **Development**: colourised, one readable block per event - time, level, `[context]`, short request id,
  message, indented metadata, and error stack traces under the message.
- **Production**: one JSON object per line (ready for log shippers). `LOG_TO_FILE=true` adds `combined-*.log`
  and `error-*.log` with daily rotation.
- Use `createLogger('my-context')`; never `console.log` (enforced by ESLint).
- Browser: `LoggerService` prints coloured, level-filtered logs; failed HTTP calls are logged by the interceptor
  together with the server's `requestId`, so you can grep it in the server log.

## Manual testing

```bash
curl -i  http://localhost:3000/api/health                 # 200, database "up"
curl     "http://localhost:3000/api/health?details=true"   # + runtime diagnostics
curl -i  "http://localhost:3000/api/health?details=maybe"  # 400 VALIDATION_ERROR
curl -i  http://localhost:3000/api/unknown                 # 404 NOT_FOUND
npm --prefix server run db:check                           # MongoDB connectivity
```

Stop MongoDB and call `/api/health` again: it returns **503** with `"status": "degraded"`.

### Development-only tenant API

The test endpoints are mounted only outside production and remain disabled unless `DEV_AUTH_ENABLED=true` is set in
`server/.env`. Restart the server after changing the setting. Use only a local or isolated test database: the
`x-dev-user-email` header creates a development user if necessary and is **not real authentication**.

```powershell
$base = "http://localhost:3000/api/dev/tenants"
$headers = @{ "x-dev-user-email" = "owner@example.test" }
$body = @{ organizationName = "Example Org" } | ConvertTo-Json
$created = Invoke-RestMethod -Method Post -Uri $base -Headers $headers `
  -ContentType "application/json" -Body $body
# Newly provisioned organization returns 201; a repeated registration returns 200.
$tenantId = $created.data.tenantId

Invoke-RestMethod -Uri "$base/memberships" -Headers $headers
$headers["x-tenant-id"] = $tenantId
Invoke-RestMethod -Uri "$base/current" -Headers $headers

$record = @{ value = "isolated test value" } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "$base/current/records" -Headers $headers `
  -ContentType "application/json" -Body $record
Invoke-RestMethod -Uri "$base/current/records" -Headers $headers
```

These APIs expose tenant IDs and membership information, but never accept or return MongoDB database names.
Membership and active-tenant checks are repeated on each tenant-scoped request. See
[docs/MULTI_TENANT_ARCHITECTURE.md](docs/MULTI_TENANT_ARCHITECTURE.md) for routes, security, and operational details.

## Notes

- `lucide-angular@1.0` declares Angular peer support up to v21; `client/package.json` has an `overrides` entry so it
  installs cleanly on Angular 22 (verified: builds and renders).
- Only the development test adapter exists; production authentication and user provisioning are pending. Business
  tenant models (employees, sites, attendance, salaries) are not part of this step.
