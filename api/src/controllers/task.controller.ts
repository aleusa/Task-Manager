import type { RequestHandler } from "express";

import type {
  CreateTaskInput,
  ProjectParams,
} from "../schemas/task.schema.js";
import type { TaskService } from "../services/task.service.js";
import { BadRequestError } from "../errors/http-error.js";

export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  create: RequestHandler<ProjectParams, unknown, CreateTaskInput> = async (
    request,
    response,
  ) => {
    const rawIdempotencyKey = request.get("Idempotency-Key");
    const idempotencyKey = rawIdempotencyKey?.trim();

    if (
      rawIdempotencyKey !== undefined &&
      (!idempotencyKey || idempotencyKey.length > 200)
    ) {
      throw new BadRequestError(
        "Idempotency-Key header must contain between 1 and 200 characters",
      );
    }

    const result = await this.taskService.createTask(
      request.auth,
      request.params.projectId,
      request.body,
      idempotencyKey,
    );

    if (result.replayed) {
      response.set("Idempotency-Replayed", "true");
    }

    response.status(result.replayed ? 200 : 201).json({ data: result.task });
  };
}
