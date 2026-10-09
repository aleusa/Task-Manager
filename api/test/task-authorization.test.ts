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

  it("hides a project that belongs to another organization", async () => {
    const sessionToken = "a".repeat(43);
    const taskInput = { title: "Cross-tenant task" };

    authRepository.findActiveSession.mockResolvedValue({
      userId: "1",
      organizationId: "10",
    });
    membershipRepository.findRole.mockResolvedValue("MANAGER");
    taskRepository.createForOrganization.mockResolvedValue(null);

    const response = await request(app)
      .post("/projects/999/tasks")
      .set("Cookie", `sid=${sessionToken}`)
      .send(taskInput);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: {
        code: "RESOURCE_NOT_FOUND",
        message: "Project or assignee not found",
      },
    });
    expect(membershipRepository.findRole).toHaveBeenCalledWith("1", "10");
    expect(taskRepository.createForOrganization).toHaveBeenCalledWith(
      "999",
      "10",
      "1",
      taskInput,
    );
  });
});
