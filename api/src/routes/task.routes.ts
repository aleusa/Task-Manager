import { Router } from "express";

import type { TaskController } from "../controllers/task.controller.js";
import { validateBody } from "../middleware/validate.js";
import {
  createTaskSchema,
  type CreateTaskInput,
} from "../schemas/task.schema.js";

export function createTaskRouter(taskController: TaskController): Router {
  const router = Router();

  router.post<{ projectId: string }, unknown, CreateTaskInput>(
    "/projects/:projectId/tasks",
    validateBody(createTaskSchema),
    taskController.create,
  );

  return router;
}
