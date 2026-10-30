import { Router } from "express";

import type { RequestHandler } from "express";

import type { TaskController } from "../controllers/task.controller.js";
import { validateBody, validateParams } from "../middleware/validate.js";
import {
  createTaskSchema,
  type CreateTaskInput,
  type ProjectParams,
  projectParamsSchema,
  type TaskParams,
  taskParamsSchema,
  type UpdateTaskInput,
  updateTaskSchema,
} from "../schemas/task.schema.js";

export function createTaskRouter(
  taskController: TaskController,
  authenticate: RequestHandler,
): Router {
  const router = Router();

  router.post<ProjectParams, unknown, CreateTaskInput>(
    "/projects/:projectId/tasks",
    authenticate,
    validateParams(projectParamsSchema),
    validateBody(createTaskSchema),
    taskController.create,
  );

  router.patch<TaskParams, unknown, UpdateTaskInput>(
    "/tasks/:taskId",
    authenticate,
    validateParams(taskParamsSchema),
    validateBody(updateTaskSchema),
    taskController.update,
  );

  return router;
}
