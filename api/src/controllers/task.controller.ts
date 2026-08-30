import type { RequestHandler } from "express";

import type {
  CreateTaskInput,
  ProjectParams,
} from "../schemas/task.schema.js";
import type { TaskService } from "../services/task.service.js";

export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  create: RequestHandler<ProjectParams, unknown, CreateTaskInput> = async (
    request,
    response,
  ) => {
    const task = await this.taskService.createTask(
      request.auth,
      request.params.projectId,
      request.body,
    );

    response.status(201).json({ data: task });
  };
}
