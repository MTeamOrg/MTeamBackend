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

export type AccessControlUser = Pick<RegisteredMember, "id" | "role" | "status">;

export interface UserAccessRepositoryPort {
  findAccessControlUserById(id: string): Promise<AccessControlUser | null>;
}

export interface MemberProfileData {
  emergencyContactName: string;
  emergencyContactPhone: string;
}

export interface TrainerProfileData {
  specialty: string;
  description: string;
}

export interface OwnProfile extends RegisteredMember {
  memberProfile: MemberProfileData | null;
  trainerProfile: TrainerProfileData | null;
}

export interface UpdateOwnProfileData {
  email?: string;
  phone?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
}

export interface OwnProfileRepositoryPort {
  findOwnProfileById(id: string): Promise<OwnProfile | null>;
  findEmailOwnerId(email: string): Promise<string | null>;
  updateOwnProfile(
    id: string,
    role: UserRole,
    data: UpdateOwnProfileData,
  ): Promise<OwnProfile>;
}

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

export class UserRepository
  implements UserRepositoryPort, UserAccessRepositoryPort, OwnProfileRepositoryPort
{
  constructor(private readonly database: PrismaClient) {}

  async findAccessControlUserById(id: string): Promise<AccessControlUser | null> {
    return this.database.user.findUnique({
      where: { id },
      select: { id: true, role: true, status: true },
    });
  }

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

  async findOwnProfileById(id: string): Promise<OwnProfile | null> {
    return this.database.user.findUnique({
      where: { id },
      select: {
        ...registeredMemberSelection,
        memberProfile: {
          select: {
            emergencyContactName: true,
            emergencyContactPhone: true,
          },
        },
        trainerProfile: {
          select: { specialty: true, description: true },
        },
      },
    });
  }

  async findEmailOwnerId(email: string): Promise<string | null> {
    const user = await this.database.user.findUnique({
      where: { email },
      select: { id: true },
    });
    return user?.id ?? null;
  }

  async updateOwnProfile(
    id: string,
    role: UserRole,
    data: UpdateOwnProfileData,
  ): Promise<OwnProfile> {
    try {
      return await this.database.$transaction(async (transaction) => {
        const userData: Prisma.UserUpdateInput = {};
        if (data.email !== undefined) userData.email = data.email;
        if (data.phone !== undefined) userData.phone = data.phone;
        if (role === "MEMBER") {
          const memberData: Prisma.MemberProfileUpdateInput = {};
          if (data.emergencyContactName !== undefined) {
            memberData.emergencyContactName = data.emergencyContactName;
          }
          if (data.emergencyContactPhone !== undefined) {
            memberData.emergencyContactPhone = data.emergencyContactPhone;
          }
          if (Object.keys(memberData).length > 0) {
            userData.memberProfile = { update: memberData };
          }
        }

        const user = await transaction.user.update({
          where: { id },
          data: userData,
          select: {
            ...registeredMemberSelection,
            memberProfile: {
              select: {
                emergencyContactName: true,
                emergencyContactPhone: true,
              },
            },
            trainerProfile: {
              select: { specialty: true, description: true },
            },
          },
        });

        await transaction.userAuditLog.create({
          data: {
            userId: id,
            performedById: id,
            action: "UPDATED",
          },
        });
        return user;
      });
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new DuplicateUserError("email");
      }
      throw error;
    }
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
