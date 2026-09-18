import bcrypt from "bcrypt";

import { PasswordService } from "../../src/service/password-service.js";

describe("PasswordService", () => {
  test("hashes passwords with bcrypt instead of storing plain text", async () => {
    const password = "safe-password";
    const hash = await new PasswordService().hash(password);

    expect(hash).not.toBe(password);
    await expect(bcrypt.compare(password, hash)).resolves.toBe(true);
  });
});
