import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authRepository = vi.hoisted(() => ({
  findLoginIdentity: vi.fn(),
  createSession: vi.fn(),
  findActiveSession: vi.fn(),
}));

vi.mock("../src/repositories/auth.repository.js", () => ({
  AuthRepository: class {
    findLoginIdentity = authRepository.findLoginIdentity;
    createSession = authRepository.createSession;
    findActiveSession = authRepository.findActiveSession;
  },
}));

import { app } from "../src/app.js";

const passwordHash =
  "$argon2id$v=19$m=19456,p=1,t=2$6jzS+iA8hGK9GBKfrMYq3w$jJzUU2OLHcEhFtvBvnQn4oWwGXp4izoUd+c2K3xsyPs";

const validCredentials = {
  email: "test-user@example.com",
  password: "Password123!",
  organizationId: "10",
};

describe("authentication HTTP endpoints", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("creates a session for valid login credentials", async () => {
    const expiresAt = new Date("2030-01-01T12:00:00.000Z");
    authRepository.findLoginIdentity.mockResolvedValue({
      userId: "1",
      organizationId: "10",
      passwordHash,
    });
    authRepository.createSession.mockResolvedValue(expiresAt);

    const response = await request(app)
      .post("/auth/login")
      .send(validCredentials);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: {
        userId: "1",
        organizationId: "10",
        expiresAt: expiresAt.toISOString(),
      },
    });

    const [sessionCookie] = response.headers["set-cookie"] ?? [];
    expect(sessionCookie).toContain("sid=");
    expect(sessionCookie).toContain("HttpOnly");
    expect(sessionCookie).toContain("SameSite=Lax");
    expect(authRepository.createSession).toHaveBeenCalledWith(
      expect.stringMatching(/^[a-f0-9]{64}$/),
      "1",
      "10",
      expect.any(Date),
    );
  });

  it("rejects an incorrect password without creating a session", async () => {
    authRepository.findLoginIdentity.mockResolvedValue({
      userId: "1",
      organizationId: "10",
      passwordHash,
    });

    const response = await request(app)
      .post("/auth/login")
      .send({ ...validCredentials, password: "incorrect-password" });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: {
        code: "INVALID_CREDENTIALS",
        message: "Invalid login credentials",
      },
    });
    expect(authRepository.createSession).not.toHaveBeenCalled();
  });

  it("rejects a login request with missing email and password", async () => {
    const response = await request(app)
      .post("/auth/login")
      .send({ organizationId: "10" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(authRepository.findLoginIdentity).not.toHaveBeenCalled();
  });

  it("rejects access to a protected endpoint without a session cookie", async () => {
    const response = await request(app)
      .post("/projects/100/tasks")
      .send({ title: "Test task" });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: {
        code: "AUTHENTICATION_REQUIRED",
        message: "Authentication required",
      },
    });
    expect(authRepository.findActiveSession).not.toHaveBeenCalled();
  });

  it("rejects a well-formed token with no active session", async () => {
    authRepository.findActiveSession.mockResolvedValue(null);
    const sessionToken = "a".repeat(43);

    const response = await request(app)
      .post("/projects/100/tasks")
      .set("Cookie", `sid=${sessionToken}`)
      .send({ title: "Test task" });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("AUTHENTICATION_REQUIRED");
    expect(authRepository.findActiveSession).toHaveBeenCalledWith(
      expect.stringMatching(/^[a-f0-9]{64}$/),
    );
  });
});
