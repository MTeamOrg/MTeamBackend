import type {
  PrismaClient,
  UserRole,
  UserStatus,
} from "../generated/prisma/client.js";
import { Prisma } from "../generated/prisma/client.js";

export type UserConflictField = "documentNumber" | "email";

export interface CreateMemberData {
  firstName: string;
  lastName: string;
  documentNumber: string;
  birthDate: Date;
  email: string;
  phone: string;
  passwordHash: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
}

export interface RegisteredMember {
  id: string;
  firstName: string;
  lastName: string;
  documentNumber: string;
  birthDate: Date;
  email: string;
  phone: string;
  photoUrl: string | null;
  role: UserRole;
  status: UserStatus;
  isPasswordChangeRequired: boolean;
}

export interface UserRepositoryPort {
  findByEmail(email: string): Promise<AuthenticationUser | null>;
  findConflict(email: string, documentNumber: string): Promise<UserConflictField | null>;
  createMember(data: CreateMemberData): Promise<RegisteredMember>;
}

export type AuthenticationUser = Pick<
  RegisteredMember,
  "id" | "firstName" | "lastName" | "email" | "role" | "status" | "isPasswordChangeRequired"
> & { passwordHash: string };

export class DuplicateUserError extends Error {
  constructor(readonly field: UserConflictField) {
    super(`Duplicate user field: ${field}`);
    this.name = "DuplicateUserError";
  }
}

const registeredMemberSelection = {
  id: true,
  firstName: true,
  lastName: true,
  documentNumber: true,
  birthDate: true,
  email: true,
  phone: true,
  photoUrl: true,
  role: true,
  status: true,
  isPasswordChangeRequired: true,
} satisfies Prisma.UserSelect;

export class UserRepository implements UserRepositoryPort {
  constructor(private readonly database: PrismaClient) {}

  async findByEmail(email: string): Promise<AuthenticationUser | null> {
    return this.database.user.findUnique({
      where: { email },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        passwordHash: true,
        role: true,
        status: true,
        isPasswordChangeRequired: true,
      },
    });
  }

  async findConflict(
    email: string,
    documentNumber: string,
  ): Promise<UserConflictField | null> {
    const user = await this.database.user.findFirst({
      where: { OR: [{ email }, { documentNumber }] },
      select: { email: true, documentNumber: true },
    });

    if (!user) return null;
    return user.email === email ? "email" : "documentNumber";
  }

  async createMember(data: CreateMemberData): Promise<RegisteredMember> {
    try {
      return await this.database.$transaction(async (transaction) => {
        const user = await transaction.user.create({
          data: {
            firstName: data.firstName,
            lastName: data.lastName,
            documentNumber: data.documentNumber,
            birthDate: data.birthDate,
            email: data.email,
            phone: data.phone,
            passwordHash: data.passwordHash,
            role: "MEMBER",
            status: "ACTIVE",
            isPasswordChangeRequired: false,
            memberProfile: {
              create: {
                emergencyContactName: data.emergencyContactName,
                emergencyContactPhone: data.emergencyContactPhone,
              },
            },
          },
          select: registeredMemberSelection,
        });

        await transaction.userAuditLog.create({
          data: {
            userId: user.id,
            performedById: user.id,
            action: "CREATED",
          },
        });

        return user;
      });
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const target = Array.isArray(error.meta?.target)
          ? error.meta.target.join(" ")
          : String(error.meta?.target ?? "");
        throw new DuplicateUserError(
          target.includes("document") ? "documentNumber" : "email",
        );
      }
      throw error;
    }
  }
}
