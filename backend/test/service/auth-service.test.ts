import { ApplicationError } from "../../src/error/application-error.js";
import {
  DuplicateUserError,
  type CreateMemberData,
  type RegisteredMember,
  type UserConflictField,
  type UserRepositoryPort,
} from "../../src/repository/user-repository.js";
import { AuthService } from "../../src/service/auth-service.js";
import type { PasswordHasher } from "../../src/service/password-service.js";

const input = {
  firstName: "  Lara ",
  lastName: " Frenkel ",
  documentNumber: "12.345.678",
  birthDate: "2000-05-20",
  email: " LARA@EXAMPLE.COM ",
  phone: " 1122334455 ",
  password: "safe-password",
};

const member: RegisteredMember = {
  id: "83cd902e-0475-4c92-943c-129b751dacee",
  firstName: "Lara",
  lastName: "Frenkel",
  documentNumber: "12345678",
  birthDate: new Date("2000-05-20T00:00:00.000Z"),
  email: "lara@example.com",
  phone: "1122334455",
  photoUrl: null,
  role: "MEMBER",
  status: "ACTIVE",
  isPasswordChangeRequired: false,
};

class FakeUserRepository implements UserRepositoryPort {
  conflict: UserConflictField | null = null;
  duplicateOnCreate: UserConflictField | null = null;
  createdData: CreateMemberData | null = null;

  async findConflict(): Promise<UserConflictField | null> {
    return this.conflict;
  }

  async createMember(data: CreateMemberData): Promise<RegisteredMember> {
    if (this.duplicateOnCreate) {
      throw new DuplicateUserError(this.duplicateOnCreate);
    }
    this.createdData = data;
    return member;
  }
}

class FakePasswordHasher implements PasswordHasher {
  receivedPassword: string | null = null;

  async hash(password: string): Promise<string> {
    this.receivedPassword = password;
    return "hashed-password";
  }
}

describe("AuthService.registerMember", () => {
  test("normalizes the identity data and hashes the password", async () => {
    const repository = new FakeUserRepository();
    const passwordHasher = new FakePasswordHasher();
    const service = new AuthService(repository, passwordHasher);

    const result = await service.registerMember(input);

    expect(result).toEqual(member);
    expect(passwordHasher.receivedPassword).toBe("safe-password");
    expect(repository.createdData).toMatchObject({
      firstName: "Lara",
      lastName: "Frenkel",
      documentNumber: "12345678",
      email: "lara@example.com",
      phone: "1122334455",
      passwordHash: "hashed-password",
    });
  });

  test.each(["email", "documentNumber"] as const)(
    "rejects an existing %s before hashing",
    async (field) => {
      const repository = new FakeUserRepository();
      repository.conflict = field;
      const passwordHasher = new FakePasswordHasher();
      const service = new AuthService(repository, passwordHasher);

      await expect(service.registerMember(input)).rejects.toMatchObject({
        statusCode: 409,
        code: "CONFLICT",
        details: { field },
      } satisfies Partial<ApplicationError>);
      expect(passwordHasher.receivedPassword).toBeNull();
    },
  );

  test("converts a concurrent unique constraint violation into a conflict", async () => {
    const repository = new FakeUserRepository();
    repository.duplicateOnCreate = "email";
    const service = new AuthService(repository, new FakePasswordHasher());

    await expect(service.registerMember(input)).rejects.toMatchObject({
      statusCode: 409,
      code: "CONFLICT",
      details: { field: "email" },
    });
  });
});
