import type {
  TaskRecord,
  TaskRepository,
} from "../repositories/task.repository.js";
import { ForbiddenError, ResourceNotFoundError } from "../errors/http-error.js";
import type { MembershipRepository } from "../repositories/membership.repository.js";
import type { CreateTaskInput } from "../schemas/task.schema.js";
import type { AuthContext } from "../types/auth.js";

export class TaskService {
  constructor(
    private readonly taskRepository: TaskRepository,
    private readonly membershipRepository: MembershipRepository,
  ) {}

  async createTask(
    auth: AuthContext,
    projectId: string,
    input: CreateTaskInput,
  ): Promise<TaskRecord> {
    const role = await this.membershipRepository.findRole(
      auth.currentUserId,
      auth.currentOrganizationId,
    );

    if (role !== "ADMIN" && role !== "MANAGER") {
      throw new ForbiddenError(
        "Only administrators and managers can create tasks",
      );
    }

    const task = await this.taskRepository.createForOrganization(
      projectId,
      auth.currentOrganizationId,
      auth.currentUserId,
      input,
    );

    if (!task) {
      throw new ResourceNotFoundError("Project or assignee not found");
    }

    return task;
  }
}
