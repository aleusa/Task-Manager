# Task Management API

A small production-style backend built with Node.js, TypeScript, Express 5,
PostgreSQL, and Zod 4.

## Run locally

```bash
npm install
npm run dev
```

The server defaults to `http://localhost:3000`.

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

### Create task skeleton

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

The repository currently returns a generated task without writing to
PostgreSQL. Database persistence is deliberately deferred.

## Layer responsibilities

- **Route:** Maps an HTTP method and path to validation and a controller.
- **Controller:** Translates between HTTP request/response objects and the use
  case.
- **Service:** Holds business rules and coordinates the use case independently
  of Express.
- **Repository:** Owns persistence details so PostgreSQL can be introduced
  without moving SQL into controllers or services.
- **Schema:** Validates untrusted runtime input and provides the inferred
  TypeScript type used by the inner layers.

Each layer exists for a specific boundary. If the application remains small
and a layer stops serving that purpose, it should be removed rather than kept
for ceremony.
