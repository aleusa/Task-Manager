import { Router } from "express";

import type { TaskController } from "../controllers/task.controller.js";
import { mockAuthentication } from "../middleware/mock-auth.js";
import { validateBody, validateParams } from "../middleware/validate.js";
import {
  createTaskSchema,
  type CreateTaskInput,
  type ProjectParams,
  projectParamsSchema,
} from "../schemas/task.schema.js";

export function createTaskRouter(taskController: TaskController): Router {
  const router = Router();

  router.post<ProjectParams, unknown, CreateTaskInput>(
    "/projects/:projectId/tasks",
    mockAuthentication,
    validateParams(projectParamsSchema),
    validateBody(createTaskSchema),
    taskController.create,
  );

  return router;
}
