import type { AuthenticationUser, UserRepositoryPort } from "../../src/repository/user-repository.js";
import { AuthService } from "../../src/service/auth-service.js";

const user: AuthenticationUser = {
  id: "83cd902e-0475-4c92-943c-129b751dacee",
  firstName: "Lara",
  lastName: "Frenkel",
  email: "lara@example.com",
  passwordHash: "test-hash",
  role: "MEMBER",
  status: "ACTIVE",
  isPasswordChangeRequired: false,
};

function setup() {
  const repository: jest.Mocked<UserRepositoryPort> = {
    findByEmail: jest.fn().mockResolvedValue(user),
    findConflict: jest.fn(),
    createMember: jest.fn(),
  };
  const passwords = { hash: jest.fn(), compare: jest.fn().mockResolvedValue(true) };
  const tokens = { expiresIn: 3600, sign: jest.fn().mockReturnValue("signed-token") };
  return { repository, passwords, tokens, service: new AuthService(repository, passwords, tokens) };
}

describe("AuthService.login", () => {
  test("normalizes email, compares the unmodified password and returns only safe fields", async () => {
    const { repository, passwords, tokens, service } = setup();
    repository.findByEmail.mockResolvedValue({ ...user, documentNumber: "12345678" } as AuthenticationUser);
    const result = await service.login({ email: " LARA@EXAMPLE.COM ", password: " p " });
    expect(repository.findByEmail).toHaveBeenCalledWith("lara@example.com");
    expect(passwords.compare).toHaveBeenCalledWith(" p ", user.passwordHash);
    expect(tokens.sign).toHaveBeenCalledWith({ id: user.id, role: "MEMBER" });
    const { passwordHash: _passwordHash, ...safeUser } = user;
    expect(result).toEqual({ accessToken: "signed-token", tokenType: "Bearer", expiresIn: 3600, user: safeUser });
  });

  test.each(["missing", "wrong-password", "inactive-wrong-password"])(
    "%s returns the same generic error without issuing a token",
    async (scenario) => {
      const { repository, passwords, tokens, service } = setup();
      if (scenario === "missing") repository.findByEmail.mockResolvedValue(null);
      else passwords.compare.mockResolvedValue(false);
      if (scenario === "inactive-wrong-password") repository.findByEmail.mockResolvedValue({ ...user, status: "INACTIVE" });
      await expect(service.login({ email: user.email, password: "wrong" })).rejects.toMatchObject({
        statusCode: 401, code: "INVALID_CREDENTIALS", message: "Correo electrónico o contraseña incorrectos", details: null,
      });
      expect(tokens.sign).not.toHaveBeenCalled();
    },
  );

  test("blocks an inactive account after checking its password", async () => {
    const { repository, passwords, tokens, service } = setup();
    repository.findByEmail.mockResolvedValue({ ...user, status: "INACTIVE" });
    await expect(service.login({ email: user.email, password: "correct" })).rejects.toMatchObject({
      statusCode: 403, code: "ACCOUNT_INACTIVE", message: "La cuenta se encuentra inactiva", details: null,
    });
    expect(passwords.compare).toHaveBeenCalled();
    expect(tokens.sign).not.toHaveBeenCalled();
  });
});
