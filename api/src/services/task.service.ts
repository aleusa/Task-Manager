import type {
  TaskRecord,
  TaskRepository,
} from "../repositories/task.repository.js";
import { ResourceNotFoundError } from "../errors/http-error.js";
import type { CreateTaskInput } from "../schemas/task.schema.js";
import type { AuthContext } from "../types/auth.js";

export class TaskService {
  constructor(private readonly taskRepository: TaskRepository) {}

  async createTask(
    auth: AuthContext,
    projectId: string,
    input: CreateTaskInput,
  ): Promise<TaskRecord> {
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
