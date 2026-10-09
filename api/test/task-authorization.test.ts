import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authRepository = vi.hoisted(() => ({
  findActiveSession: vi.fn(),
}));

const membershipRepository = vi.hoisted(() => ({
  findRole: vi.fn(),
}));

const taskRepository = vi.hoisted(() => ({
  createForOrganization: vi.fn(),
}));

vi.mock("../src/repositories/auth.repository.js", () => ({
  AuthRepository: class {
    findActiveSession = authRepository.findActiveSession;
  },
}));

vi.mock("../src/repositories/membership.repository.js", () => ({
  MembershipRepository: class {
    findRole = membershipRepository.findRole;
  },
}));

vi.mock("../src/repositories/task.repository.js", () => ({
  TaskRepository: class {
    createForOrganization = taskRepository.createForOrganization;
  },
}));

import { app } from "../src/app.js";

describe("task authorization", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("allows a manager to create a task", async () => {
    const sessionToken = "a".repeat(43);
    const taskInput = { title: "Manager task" };
    const createdTask = {
      id: "501",
      projectId: "100",
      title: "Manager task",
      description: null,
      assigneeId: null,
      priority: "medium",
      dueDate: null,
      createdAt: "2030-01-01T12:00:00.000Z",
    };

    authRepository.findActiveSession.mockResolvedValue({
      userId: "1",
      organizationId: "10",
    });
    membershipRepository.findRole.mockResolvedValue("MANAGER");
    taskRepository.createForOrganization.mockResolvedValue(createdTask);

    const response = await request(app)
      .post("/projects/100/tasks")
      .set("Cookie", `sid=${sessionToken}`)
      .send(taskInput);

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ data: createdTask });
    expect(membershipRepository.findRole).toHaveBeenCalledWith("1", "10");
    expect(taskRepository.createForOrganization).toHaveBeenCalledWith(
      "100",
      "10",
      "1",
      taskInput,
    );
  });

  it("rejects a member before attempting to create a task", async () => {
    const sessionToken = "a".repeat(43);

    authRepository.findActiveSession.mockResolvedValue({
      userId: "2",
      organizationId: "10",
    });
    membershipRepository.findRole.mockResolvedValue("MEMBER");

    const response = await request(app)
      .post("/projects/100/tasks")
      .set("Cookie", `sid=${sessionToken}`)
      .send({ title: "Member task" });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: {
        code: "FORBIDDEN",
        message: "Only administrators and managers can create tasks",
      },
    });
    expect(membershipRepository.findRole).toHaveBeenCalledWith("2", "10");
    expect(taskRepository.createForOrganization).not.toHaveBeenCalled();
  });

  it("rejects a user from another organization", async () => {
    const sessionToken = "a".repeat(43);
    const taskInput = { title: "Cross-tenant task" };

    authRepository.findActiveSession.mockResolvedValue({
      userId: "2",
      organizationId: "20",
    });
    membershipRepository.findRole.mockResolvedValue("MANAGER");
    taskRepository.createForOrganization.mockResolvedValue(null);

    const response = await request(app)
      .post("/projects/100/tasks")
      .set("Cookie", `sid=${sessionToken}`)
      .send(taskInput);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: {
        code: "RESOURCE_NOT_FOUND",
        message: "Project or assignee not found",
      },
    });
    expect(membershipRepository.findRole).toHaveBeenCalledWith("2", "20");
    expect(taskRepository.createForOrganization).toHaveBeenCalledWith(
      "100",
      "20",
      "2",
      taskInput,
    );
  });

  it("returns not found when the project does not exist", async () => {
    const sessionToken = "a".repeat(43);
    const taskInput = { title: "Orphan task" };

    authRepository.findActiveSession.mockResolvedValue({
      userId: "1",
      organizationId: "10",
    });
    membershipRepository.findRole.mockResolvedValue("MANAGER");
    taskRepository.createForOrganization.mockResolvedValue(null);

    const response = await request(app)
      .post("/projects/404/tasks")
      .set("Cookie", `sid=${sessionToken}`)
      .send(taskInput);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: {
        code: "RESOURCE_NOT_FOUND",
        message: "Project or assignee not found",
      },
    });
    expect(taskRepository.createForOrganization).toHaveBeenCalledWith(
      "404",
      "10",
      "1",
      taskInput,
    );
  });

  it("rejects an invalid request body before attempting persistence", async () => {
    const sessionToken = "a".repeat(43);

    authRepository.findActiveSession.mockResolvedValue({
      userId: "1",
      organizationId: "10",
    });

    const response = await request(app)
      .post("/projects/100/tasks")
      .set("Cookie", `sid=${sessionToken}`)
      .send({ title: "   " });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(membershipRepository.findRole).not.toHaveBeenCalled();
    expect(taskRepository.createForOrganization).not.toHaveBeenCalled();
  });
});
