import type { RequestHandler } from "express";

import type { CreateTaskInput } from "../schemas/task.schema.js";
import type { TaskService } from "../services/task.service.js";

interface ProjectParams {
  projectId: string;
}

export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  create: RequestHandler<ProjectParams, unknown, CreateTaskInput> = async (
    request,
    response,
  ) => {
    const task = await this.taskService.createTask(
      request.params.projectId,
      request.body,
    );

    response.status(201).json({ data: task });
  };
}
