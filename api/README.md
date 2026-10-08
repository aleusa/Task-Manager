# Task Management API

A small production-style backend built with Node.js, TypeScript, Express 5,
PostgreSQL, and Zod 4.

## Run locally

```bash
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

The server defaults to `http://localhost:3000`.

Copy `.env.example` to `.env` and update `DATABASE_URL` for your PostgreSQL
instance before running the database commands.

## Run tests

```bash
npm test
```

Vitest runs HTTP tests against the exported Express application, so the test
command does not start `src/server.ts` or reserve the development port. Test
configuration sets `NODE_ENV=test` and replaces `DATABASE_URL` with a dedicated
test database URL. It defaults to the local `task_management_test` database; set
`TEST_DATABASE_URL` to override it in local development or CI. As a safety
guard, the database name must contain a standalone `test` segment.

## Testing architecture

The test suite uses three boundaries rather than trying to prove everything in
one kind of test:

- **Unit tests** should cover schemas and service business rules with repository
  fakes or mocks. They should be fast and should not use Express or PostgreSQL.
- **HTTP integration tests** use Supertest with the exported Express `app`.
  They exercise routing, validation, controllers, services, middleware, cookies,
  and error responses together. The authentication tests currently mock the
  repository boundary, so they never connect to PostgreSQL.
- **Database integration tests** should exercise repository methods against a
  real PostgreSQL test database. These tests are necessary for SQL, constraints,
  transactions, joins, and tenant-isolation behavior that a mock cannot prove.

External systems should sit behind small adapters and be replaced with
deterministic fakes or Vitest mocks in most tests. A smaller integration suite
can exercise a provider's sandbox when that behavior cannot be represented
locally.

Real PostgreSQL tests should apply the migrations to a dedicated database,
insert only the fixtures required by each test, and clean up with transactions
or table truncation. `TEST_DATABASE_URL` must always point to a database whose
name contains a standalone `test` segment.

In CI, start PostgreSQL as a service container, set `TEST_DATABASE_URL`, apply
the migration, and then run `npm test`, `npm run typecheck`, and `npm run build`.
The one-shot `npm test` command already returns a failing exit code when a test
fails, so it can be used directly as a CI quality gate.

The current `app.ts`/`server.ts` separation makes HTTP testing easier because
tests can import the application without opening the production port. The
route/controller/service/repository layers also provide useful test boundaries.
The main testing difficulty is that `app.ts` constructs concrete repositories
and the repositories default to a global database pool. This requires module
mocking today; a future `createApp(dependencies)` factory would allow tests to
inject repository fakes explicitly.

## Endpoints

### Health

```http
GET /health
```

```json
{
  "status": "ok"
}
```

### Login

```http
POST /auth/login
Content-Type: application/json
```

```json
{
  "email": "mock-user@example.com",
  "password": "Password123!",
  "organizationId": "10"
}
```

The development seed creates this account as a `MANAGER`. A successful login
returns an `HttpOnly` `sid` cookie. PostgreSQL stores only the token's SHA-256
hash, together with its user, organization, and expiration.

### Create task

```http
POST /projects/:projectId/tasks
Content-Type: application/json
```

```json
{
  "title": "Prepare launch checklist",
  "description": "Confirm production readiness",
  "priority": "high",
  "dueDate": "2026-09-01T17:00:00-04:00"
}
```

The route requires the `sid` cookie created by login. The seed data makes user
`1` a manager of organization `10`, project `100` part of organization `10`,
and project `999` part of organization `20`.

Task creation uses an organization-scoped PostgreSQL insert. A nonexistent
project and a project owned by another organization both return the same 404
response and neither inserts a task. The service also reads the user's current
membership role and permits only `ADMIN` and `MANAGER` users to create tasks.

Manual cases:

```bash
# Login and save the returned cookie: 200
curl -i -c /tmp/task-manager-cookies.txt \
  -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"mock-user@example.com","password":"Password123!","organizationId":"10"}'

# Valid: 201
curl -i -b /tmp/task-manager-cookies.txt \
  -X POST http://localhost:3000/projects/100/tasks \
  -H 'Content-Type: application/json' \
  -d '{"title":"Prepare launch checklist","priority":"high"}'

# Missing title: 400
curl -i -b /tmp/task-manager-cookies.txt \
  -X POST http://localhost:3000/projects/100/tasks \
  -H 'Content-Type: application/json' \
  -d '{}'

# Missing project: 404
curl -i -b /tmp/task-manager-cookies.txt \
  -X POST http://localhost:3000/projects/404/tasks \
  -H 'Content-Type: application/json' \
  -d '{"title":"Should not be created"}'

# Project belongs to organization 20: 404
curl -i -b /tmp/task-manager-cookies.txt \
  -X POST http://localhost:3000/projects/999/tasks \
  -H 'Content-Type: application/json' \
  -d '{"title":"Must be denied"}'
```

## Layer responsibilities

- **Route:** Maps an HTTP method and path to validation and a controller.
- **Controller:** Translates between HTTP request/response objects and the use
  case.
- **Service:** Holds business rules and coordinates the use case independently
  of Express.
- **Repository:** Owns persistence details so PostgreSQL can be introduced
  without moving SQL into controllers or services. Its scoped insert also
  prevents cross-tenant writes at the database-query boundary.
- **Schema:** Validates untrusted runtime input and provides the inferred
  TypeScript type used by the inner layers.

## Authentication and authorization

Login verifies passwords with Argon2id and returns a random session token in
an `HttpOnly`, `SameSite=Lax` cookie. The raw token is never stored in the
database. Authentication middleware hashes the cookie and accepts only a
matching session that is unexpired and not revoked.

Authentication attaches the trusted user and active organization IDs to the
request. Authorization remains separate: the task service loads the user's
current membership role for each operation, so role changes take effect
without waiting for the session to expire.

Each layer exists for a specific boundary. If the application remains small
and a layer stops serving that purpose, it should be removed rather than kept
for ceremony.

## Tenant isolation decision

The service owns the rule that task creation is allowed only inside the
current organization. It passes the trusted organization from authentication
to the repository; the organization ID is never accepted from the request
body. The repository applies that rule atomically with `INSERT ... SELECT`, so
it inserts only when the current user belongs to the organization and the
requested project belongs to that same organization. Zero inserted rows are
denied by default and translated to 404.
