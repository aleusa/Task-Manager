import type {
  TaskRecord,
  TaskRepository,
} from "../repositories/task.repository.js";
import type { CreateTaskInput } from "../schemas/task.schema.js";

export class TaskService {
  constructor(private readonly taskRepository: TaskRepository) {}

  async createTask(
    projectId: string,
    input: CreateTaskInput,
  ): Promise<TaskRecord> {
    return this.taskRepository.create(projectId, input);
  }
}
