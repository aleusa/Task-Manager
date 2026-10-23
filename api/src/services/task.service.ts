import type {
  IdempotentTaskCreationResult,
  TaskRecord,
  TaskRepository,
} from "../repositories/task.repository.js";
import {
  ConflictError,
  ForbiddenError,
  ResourceNotFoundError,
} from "../errors/http-error.js";
import type { MembershipRepository } from "../repositories/membership.repository.js";
import type { CreateTaskInput } from "../schemas/task.schema.js";
import type { AuthContext } from "../types/auth.js";

export interface CreateTaskResult {
  task: TaskRecord;
  replayed: boolean;
}

export class TaskService {
  constructor(
    private readonly taskRepository: TaskRepository,
    private readonly membershipRepository: MembershipRepository,
  ) {}

  async createTask(
    auth: AuthContext,
    projectId: string,
    input: CreateTaskInput,
    idempotencyKey?: string,
  ): Promise<CreateTaskResult> {
    const role = await this.membershipRepository.findRole(
      auth.currentUserId,
      auth.currentOrganizationId,
    );

    if (role !== "ADMIN" && role !== "MANAGER") {
      throw new ForbiddenError(
        "Only administrators and managers can create tasks",
      );
    }

    if (!idempotencyKey) {
      const task = await this.taskRepository.createForOrganization(
        projectId,
        auth.currentOrganizationId,
        auth.currentUserId,
        input,
      );

      if (!task) {
        throw new ResourceNotFoundError("Project or assignee not found");
      }

      return { task, replayed: false };
    }

    const result = await this.taskRepository.createIdempotentForOrganization(
      projectId,
      auth.currentOrganizationId,
      auth.currentUserId,
      idempotencyKey,
      input,
    );

    if (result.status === "not_found") {
      throw new ResourceNotFoundError("Project or assignee not found");
    }

    if (result.status === "conflict") {
      throw new ConflictError(
        "Idempotency-Key was already used for a different request",
      );
    }

    return this.toCreateTaskResult(result);
  }

  private toCreateTaskResult(
    result: Extract<
      IdempotentTaskCreationResult,
      { status: "created" | "replayed" }
    >,
  ): CreateTaskResult {
    return {
      task: result.task,
      replayed: result.status === "replayed",
    };
  }
}
