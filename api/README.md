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

The route uses mocked authentication configured by
`MOCK_CURRENT_USER_ID` and `MOCK_CURRENT_ORGANIZATION_ID`. The seed data makes
user `1` a member of organization `10`, project `100` part of organization
`10`, and project `999` part of organization `20`.

Task creation uses an organization-scoped PostgreSQL insert. A nonexistent
project and a project owned by another organization both return the same 404
response and neither inserts a task.

Manual cases:

```bash
# Valid: 201
curl -i -X POST http://localhost:3000/projects/100/tasks \
  -H 'Content-Type: application/json' \
  -d '{"title":"Prepare launch checklist","priority":"high"}'

# Missing title: 400
curl -i -X POST http://localhost:3000/projects/100/tasks \
  -H 'Content-Type: application/json' \
  -d '{}'

# Missing project: 404
curl -i -X POST http://localhost:3000/projects/404/tasks \
  -H 'Content-Type: application/json' \
  -d '{"title":"Should not be created"}'

# Project belongs to organization 20: 404
curl -i -X POST http://localhost:3000/projects/999/tasks \
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
