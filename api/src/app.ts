import express from "express";

import { AuthController } from "./controllers/auth.controller.js";
import { TaskController } from "./controllers/task.controller.js";
import { errorHandler } from "./middleware/error-handler.js";
import { createAuthenticationMiddleware } from "./middleware/authenticate.js";
import { notFoundHandler } from "./middleware/not-found.js";
import { AuthRepository } from "./repositories/auth.repository.js";
import { MembershipRepository } from "./repositories/membership.repository.js";
import { TaskRepository } from "./repositories/task.repository.js";
import { createAuthRouter } from "./routes/auth.routes.js";
import { healthRouter } from "./routes/health.routes.js";
import { createTaskRouter } from "./routes/task.routes.js";
import { AuthService } from "./services/auth.service.js";
import { TaskService } from "./services/task.service.js";

const authRepository = new AuthRepository();
const authService = new AuthService(authRepository);
const authController = new AuthController(authService);
const authenticate = createAuthenticationMiddleware(authService);

const taskRepository = new TaskRepository();
const membershipRepository = new MembershipRepository();
const taskService = new TaskService(taskRepository, membershipRepository);
const taskController = new TaskController(taskService);

export const app = express();

app.disable("x-powered-by");
app.use(express.json({ limit: "100kb" }));

app.use(healthRouter);
app.use(createAuthRouter(authController));
app.use(createTaskRouter(taskController, authenticate));

app.use(notFoundHandler);
app.use(errorHandler);
