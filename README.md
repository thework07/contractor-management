# Contractor Management

Multi-tenant Contractor Management SaaS. This repository currently contains **Step 1: project foundation** only
(no authentication, employees, attendance, salary or Google integrations yet).

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
| `db:check`                |   ✔    |        | Connects to MongoDB, pings, disconnects    |

## Environment variables (`server/.env`)

| Variable                              | Required | Default                 | Description                                          |
| ------------------------------------- | :------: | ----------------------- | ---------------------------------------------------- |
| `MONGODB_URI`                         |   yes    | -                       | `mongodb://` or `mongodb+srv://` connection string   |
| `NODE_ENV`                            |    no    | `development`           | `development` / `test` / `production`                |
| `PORT`                                |    no    | `3000`                  | API port                                             |
| `CORS_ORIGINS`                        |    no    | `http://localhost:4200` | Comma-separated allowed origins                      |
| `MONGODB_MAX_POOL_SIZE`               |    no    | `10`                    | Connection pool size                                 |
| `MONGODB_SERVER_SELECTION_TIMEOUT_MS` |    no    | `5000`                  | Fail-fast timeout when MongoDB is unreachable        |
| `MONGODB_CONNECT_RETRIES`             |    no    | `3`                     | Extra connection attempts at startup                 |
| `MONGODB_RETRY_DELAY_MS`              |    no    | `2000`                  | Base delay between attempts (multiplied per attempt) |
| `LOG_LEVEL`                           |    no    | `debug` dev / `info`    | `error` `warn` `info` `http` `debug`                 |
| `LOG_TO_FILE`                         |    no    | `false`                 | Also write JSON logs to `LOG_DIR` (14-day rotation)  |
| `LOG_DIR`                             |    no    | `logs`                  | Log directory (relative to `server/`)                |

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
  modules/       feature modules (controller / service / routes / schema) - health for now
  routes/        root /api router
  app.ts         Express app factory   |   server.ts   bootstrap + graceful shutdown

client/src/app
  core/          singletons: API base URL, HTTP error interceptor, LoggerService
  shared/        reusable UI (empty for now)
  features/      lazy-loaded feature areas - system-status for now
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

## Notes

- `lucide-angular@1.0` declares Angular peer support up to v21; `client/package.json` has an `overrides` entry so it
  installs cleanly on Angular 22 (verified: builds and renders).
- Multi-tenancy, authentication and authorization are intentionally not implemented yet.
