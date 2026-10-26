import { createHash } from "node:crypto";
import { AccountRecoveryService } from "../../src/service/account-recovery-service.js";
import { fingerprintPassword, type AccountRecoveryRepositoryPort, type RecoveryToken } from "../../src/repository/account-recovery-repository.js";

function setup(hasUser = true) {
  const tokens = new Map<string, RecoveryToken>();
  let currentHash = "old-bcrypt-hash";
  const repository: jest.Mocked<AccountRecoveryRepositoryPort> = {
    findUser: jest.fn().mockResolvedValue(hasUser ? { id: "user-id", passwordHash: currentHash } : null),
    findPassword: jest.fn(async () => currentHash),
    createToken: jest.fn(async token => { tokens.set(token.tokenHash, token); }),
    deleteToken: jest.fn(async hash => { tokens.delete(hash); }),
    findToken: jest.fn(async hash => tokens.get(hash) ?? null),
    consumeToken: jest.fn(async (token, hash, now) => {
      if (!tokens.has(token.tokenHash) || token.expiresAt <= now || token.passwordFingerprint !== fingerprintPassword(currentHash)) return false;
      tokens.clear(); currentHash = hash; return true;
    }),
  };
  const passwords = { hash: jest.fn().mockResolvedValue("new-bcrypt-hash"), compare: jest.fn().mockResolvedValue(false) };
  const mail = { send: jest.fn().mockResolvedValue(undefined) };
  const service = new AccountRecoveryService(repository, passwords, mail, "http://localhost:5173");
  const getToken = () => new URLSearchParams(new URL(mail.send.mock.calls[0]![1]).hash.slice(1)).get("token")!;
  return { service, repository, mail, passwords, tokens, getToken };
}

describe("email account recovery", () => {
  test.each([true, false])("sends identical mail flow for existing=%s without returning identity", async hasUser => {
    const { service, repository, mail, getToken } = setup(hasUser);
    await expect(service.request("person@example.com")).resolves.toBeUndefined();
    expect(mail.send).toHaveBeenCalledWith("person@example.com", expect.stringMatching(/^http:\/\/localhost:5173\/restablecer-contrasena#token=[a-f0-9]{64}$/));
    if (hasUser) {
      expect(repository.createToken).toHaveBeenCalledWith(expect.objectContaining({ tokenHash: createHash("sha256").update(getToken()).digest("hex") }));
      expect(JSON.stringify(repository.createToken.mock.calls)).not.toContain(getToken());
    } else expect(repository.createToken).not.toHaveBeenCalled();
  });
  test.each([true, false])("propagates send failure for existing=%s and removes issued token", async hasUser => {
    const { service, mail, tokens } = setup(hasUser);
    mail.send.mockRejectedValue(new Error("provider unavailable"));
    await expect(service.request("person@example.com")).rejects.toThrow();
    expect(tokens.size).toBe(0);
  });
  test("valid token updates password using shared hasher and cannot be reused", async () => {
    const { service, passwords, repository, getToken } = setup();
    await service.request("person@example.com");
    await service.complete(getToken(), "new-password");
    expect(passwords.hash).toHaveBeenCalledWith("new-password");
    expect(repository.consumeToken).toHaveBeenCalledWith(expect.anything(), "new-bcrypt-hash", expect.any(Date));
    await expect(service.complete(getToken(), "another-password")).rejects.toMatchObject({ code: "INVALID_RECOVERY_TOKEN" });
  });
  test("rejects unknown tokens without hashing a password", async () => {
    const { service, passwords } = setup();
    await expect(service.complete("a".repeat(64), "new-password")).rejects.toMatchObject({ code: "INVALID_RECOVERY_TOKEN" });
    expect(passwords.hash).not.toHaveBeenCalled();
  });
  test("rejects expired token", async () => {
    const { service, tokens, getToken } = setup();
    await service.request("person@example.com");
    for (const token of tokens.values()) token.expiresAt = new Date(Date.now() - 1);
    await expect(service.complete(getToken(), "new-password")).rejects.toMatchObject({ code: "EXPIRED_RECOVERY_TOKEN" });
  });
  test("rejects a link invalidated by another password change", async () => {
    const { service, repository, getToken } = setup();
    await service.request("person@example.com");
    repository.findPassword.mockResolvedValue("administrative-reset-hash");
    await expect(service.complete(getToken(), "new-password")).rejects.toMatchObject({ code: "INVALID_RECOVERY_TOKEN" });
  });
  test("rejects reuse of current password", async () => {
    const { service, passwords, getToken } = setup();
    await service.request("person@example.com");
    passwords.compare.mockResolvedValue(true);
    await expect(service.complete(getToken(), "old-password")).rejects.toMatchObject({ code: "PASSWORD_REUSE" });
    expect(passwords.hash).not.toHaveBeenCalled();
  });
  test("concurrent completion has only one winner", async () => {
    const { service, getToken } = setup();
    await service.request("person@example.com");
    const results = await Promise.allSettled([service.complete(getToken(), "password-one"), service.complete(getToken(), "password-two")]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
  });
  test("missing frontend config fails without sending mail", async () => {
    const { repository, passwords, mail } = setup();
    await expect(new AccountRecoveryService(repository, passwords, mail, undefined).request("person@example.com")).rejects.toMatchObject({ statusCode: 503 });
    expect(mail.send).not.toHaveBeenCalled();
  });
});
