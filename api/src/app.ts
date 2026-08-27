import express from "express";

import { TaskController } from "./controllers/task.controller.js";
import { errorHandler } from "./middleware/error-handler.js";
import { notFoundHandler } from "./middleware/not-found.js";
import { TaskRepository } from "./repositories/task.repository.js";
import { healthRouter } from "./routes/health.routes.js";
import { createTaskRouter } from "./routes/task.routes.js";
import { TaskService } from "./services/task.service.js";

const taskRepository = new TaskRepository();
const taskService = new TaskService(taskRepository);
const taskController = new TaskController(taskService);

export const app = express();

app.disable("x-powered-by");
app.use(express.json({ limit: "100kb" }));

app.use(healthRouter);
app.use(createTaskRouter(taskController));

app.use(notFoundHandler);
app.use(errorHandler);
