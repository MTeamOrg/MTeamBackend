import type {
  PrismaClient,
  UserAuditAction,
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

export type AccessControlUser = Pick<
  RegisteredMember,
  "id" | "role" | "status" | "isPasswordChangeRequired"
>;

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
  updateOwnPhoto(id: string, photoUrl: string): Promise<OwnProfile>;
}

export interface PasswordUser {
  passwordHash: string;
}

export interface PasswordRepositoryPort {
  findPasswordUserById(id: string): Promise<PasswordUser | null>;
  changePassword(id: string, passwordHash: string): Promise<void>;
}

export interface TemporaryPasswordRepositoryPort {
  findPasswordResetTargetById(id: string): Promise<{ id: string } | null>;
  resetTemporaryPassword(
    userId: string,
    performedById: string,
    passwordHash: string,
  ): Promise<void>;
}

export interface UserListQuery {
  search?: string | undefined;
  role?: UserRole | undefined;
  status?: UserStatus | undefined;
  page: number;
  limit: number;
}

export interface UserListItem {
  id: string;
  firstName: string;
  lastName: string;
  documentNumber: string;
  email: string;
  role: UserRole;
  status: UserStatus;
}

export interface UserListResult {
  items: UserListItem[];
  page: number;
  limit: number;
  total: number;
}

export interface UpdateUserStatusData {
  status: UserStatus;
  reason?: string;
}

export interface CreateAdminUserData {
  firstName: string;
  lastName: string;
  documentNumber: string;
  birthDate: Date;
  email: string;
  phone: string;
  passwordHash: string;
  role: UserRole;
  memberProfile?: MemberProfileData;
  trainerProfile?: TrainerProfileData;
}

export interface UpdateAdminUserData {
  firstName?: string;
  lastName?: string;
  documentNumber?: string;
  birthDate?: Date;
  email?: string;
  phone?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  specialty?: string;
  description?: string;
  reason?: string;
}

export interface AdminUserPayment {
  id: string;
  amount: string;
  method: string;
  receiptNumber: string | null;
  status: string;
  createdAt: Date;
  accreditedAt: Date;
  expiresAt: Date;
}

export interface AdminUserMedicalCertificate {
  id: string;
  fileUrl: string;
  status: string;
  uploadedAt: Date;
  reviewedAt: Date | null;
  reviewComment: string | null;
}

export interface AdminUserDetail extends RegisteredMember {
  createdAt: Date;
  memberProfile: MemberProfileData | null;
  trainerProfile: TrainerProfileData | null;
  membership: {
    status: "ACTIVE" | "EXPIRED";
    paymentId: string;
    expiresAt: Date;
  } | null;
  payments: AdminUserPayment[];
  medicalCertificates: AdminUserMedicalCertificate[];
  trainerBranches: Array<{
    id: string;
    name: string;
    address: string;
  }>;
  classes: Array<{
    id: string;
    activity: string;
    startsAt: Date;
    branch: { id: string; name: string };
  }>;
}

export interface UserAuditLogItem {
  id: string;
  userId: string;
  action: UserAuditAction;
  reason: string | null;
  occurredAt: Date;
  performedBy: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: UserRole;
  };
}

export interface UserAuditLogListResult {
  items: UserAuditLogItem[];
  page: number;
  limit: number;
  total: number;
}

export interface AdminUserRepositoryPort {
  findConflict(email: string, documentNumber: string): Promise<UserConflictField | null>;
  listUsers(query: UserListQuery): Promise<UserListResult>;
  findUserById(id: string): Promise<UserListItem | null>;
  findAdminUserDetailById(id: string): Promise<AdminUserDetail | null>;
  findConflictForUpdate(
    email: string | undefined,
    documentNumber: string | undefined,
    excludedUserId: string,
  ): Promise<UserConflictField | null>;
  createAdminUser(
    data: CreateAdminUserData,
    performedById: string,
  ): Promise<AdminUserDetail>;
  updateAdminUser(
    id: string,
    performedById: string,
    data: UpdateAdminUserData,
  ): Promise<AdminUserDetail>;
  updateUserStatus(
    id: string,
    performedById: string,
    data: UpdateUserStatusData,
  ): Promise<UserListItem>;
  listUserAuditLogs(
    userId: string,
    page: number,
    limit: number,
  ): Promise<UserAuditLogListResult>;
}

export class DuplicateUserError extends Error {
  constructor(readonly field: UserConflictField) {
    super(`Duplicate user field: ${field}`);
    this.name = "DuplicateUserError";
  }
}

export class UserNotFoundError extends Error {
  constructor() {
    super("User not found");
    this.name = "UserNotFoundError";
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
  implements
    UserRepositoryPort,
    UserAccessRepositoryPort,
    OwnProfileRepositoryPort,
    PasswordRepositoryPort,
    TemporaryPasswordRepositoryPort,
    AdminUserRepositoryPort
{
  constructor(private readonly database: PrismaClient) {}

  async listUsers(query: UserListQuery): Promise<UserListResult> {
    const where: Prisma.UserWhereInput = {};
    if (query.search) {
      where.OR = [
        { firstName: { contains: query.search, mode: "insensitive" } },
        { lastName: { contains: query.search, mode: "insensitive" } },
        { documentNumber: { contains: query.search, mode: "insensitive" } },
        { email: { contains: query.search, mode: "insensitive" } },
      ];
    }
    if (query.role) where.role = query.role;
    if (query.status) where.status = query.status;

    const skip = (query.page - 1) * query.limit;
    const [total, items] = await this.database.$transaction([
      this.database.user.count({ where }),
      this.database.user.findMany({
        where,
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { id: "asc" }],
        skip,
        take: query.limit,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          documentNumber: true,
          email: true,
          role: true,
          status: true,
        },
      }),
    ]);
    return { items, page: query.page, limit: query.limit, total };
  }

  async findUserById(id: string): Promise<UserListItem | null> {
    return this.database.user.findUnique({
      where: { id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        documentNumber: true,
        email: true,
        role: true,
        status: true,
      },
    });
  }

  async findAdminUserDetailById(id: string): Promise<AdminUserDetail | null> {
    const user = await this.database.user.findUnique({
      where: { id },
      select: {
        ...registeredMemberSelection,
        createdAt: true,
        memberProfile: {
          select: {
            emergencyContactName: true,
            emergencyContactPhone: true,
          },
        },
        trainerProfile: { select: { specialty: true, description: true } },
        memberPayments: {
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: {
            id: true,
            amount: true,
            method: true,
            receiptNumber: true,
            status: true,
            createdAt: true,
            accreditedAt: true,
            expiresAt: true,
          },
        },
        medicalCertificates: {
          orderBy: [{ uploadedAt: "desc" }, { id: "desc" }],
          select: {
            id: true,
            fileUrl: true,
            status: true,
            uploadedAt: true,
            reviewedAt: true,
            reviewComment: true,
          },
        },
        trainerBranches: {
          select: { branch: { select: { id: true, name: true, address: true } } },
          orderBy: { branch: { name: "asc" } },
        },
        taughtClasses: {
          orderBy: [{ startsAt: "asc" }, { id: "asc" }],
          select: {
            id: true,
            activity: true,
            startsAt: true,
            branch: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!user) return null;

    const payments = user.memberPayments.map((payment) => ({
      ...payment,
      amount: payment.amount.toString(),
    }));
    const latestAccreditedPayment = payments.find(
      (payment) => payment.status === "ACCREDITED",
    );

    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      documentNumber: user.documentNumber,
      birthDate: user.birthDate,
      email: user.email,
      phone: user.phone,
      photoUrl: user.photoUrl,
      role: user.role,
      status: user.status,
      isPasswordChangeRequired: user.isPasswordChangeRequired,
      createdAt: user.createdAt,
      memberProfile: user.memberProfile,
      trainerProfile: user.trainerProfile,
      membership: latestAccreditedPayment
        ? {
            status: latestAccreditedPayment.expiresAt >= new Date() ? "ACTIVE" : "EXPIRED",
            paymentId: latestAccreditedPayment.id,
            expiresAt: latestAccreditedPayment.expiresAt,
          }
        : null,
      payments,
      medicalCertificates: user.medicalCertificates,
      trainerBranches: user.trainerBranches.map(({ branch }) => branch),
      classes: user.taughtClasses,
    };
  }

  async findConflictForUpdate(
    email: string | undefined,
    documentNumber: string | undefined,
    excludedUserId: string,
  ): Promise<UserConflictField | null> {
    const values = [
      email === undefined ? null : { email },
      documentNumber === undefined ? null : { documentNumber },
    ].filter((value): value is { email: string } | { documentNumber: string } => value !== null);
    if (values.length === 0) return null;
    const user = await this.database.user.findFirst({
      where: { id: { not: excludedUserId }, OR: values },
      select: { email: true, documentNumber: true },
    });
    if (!user) return null;
    if (email !== undefined && user.email === email) return "email";
    return "documentNumber";
  }

  async createAdminUser(
    data: CreateAdminUserData,
    performedById: string,
  ): Promise<AdminUserDetail> {
    try {
      const userId = await this.database.$transaction(async (transaction) => {
        const user = await transaction.user.create({
          data: {
            firstName: data.firstName,
            lastName: data.lastName,
            documentNumber: data.documentNumber,
            birthDate: data.birthDate,
            email: data.email,
            phone: data.phone,
            passwordHash: data.passwordHash,
            role: data.role,
            status: "ACTIVE",
            isPasswordChangeRequired: true,
            ...(data.memberProfile
              ? { memberProfile: { create: data.memberProfile } }
              : {}),
            ...(data.trainerProfile
              ? { trainerProfile: { create: data.trainerProfile } }
              : {}),
          },
          select: { id: true },
        });
        await transaction.userAuditLog.create({
          data: {
            userId: user.id,
            performedById,
            action: "CREATED",
          },
        });
        return user.id;
      });
      const created = await this.findAdminUserDetailById(userId);
      if (!created) throw new UserNotFoundError();
      return created;
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new DuplicateUserError(this.duplicateFieldFromError(error));
      }
      throw error;
    }
  }

  async updateAdminUser(
    id: string,
    performedById: string,
    data: UpdateAdminUserData,
  ): Promise<AdminUserDetail> {
    try {
      await this.database.$transaction(async (transaction) => {
        const userData: Prisma.UserUpdateInput = {};
        if (data.firstName !== undefined) userData.firstName = data.firstName;
        if (data.lastName !== undefined) userData.lastName = data.lastName;
        if (data.documentNumber !== undefined) userData.documentNumber = data.documentNumber;
        if (data.birthDate !== undefined) userData.birthDate = data.birthDate;
        if (data.email !== undefined) userData.email = data.email;
        if (data.phone !== undefined) userData.phone = data.phone;

        const current = await transaction.user.findUnique({
          where: { id },
          select: { role: true },
        });
        if (!current) throw new UserNotFoundError();

        if (current.role === "MEMBER" &&
            (data.emergencyContactName !== undefined || data.emergencyContactPhone !== undefined)) {
          userData.memberProfile = {
            upsert: {
              create: {
                emergencyContactName: data.emergencyContactName ?? "",
                emergencyContactPhone: data.emergencyContactPhone ?? "",
              },
              update: {
                ...(data.emergencyContactName === undefined
                  ? {}
                  : { emergencyContactName: data.emergencyContactName }),
                ...(data.emergencyContactPhone === undefined
                  ? {}
                  : { emergencyContactPhone: data.emergencyContactPhone }),
              },
            },
          };
        }
        if (current.role === "TRAINER" &&
            (data.specialty !== undefined || data.description !== undefined)) {
          userData.trainerProfile = {
            upsert: {
              create: {
                specialty: data.specialty ?? "",
                description: data.description ?? "",
              },
              update: {
                ...(data.specialty === undefined ? {} : { specialty: data.specialty }),
                ...(data.description === undefined ? {} : { description: data.description }),
              },
            },
          };
        }

        await transaction.user.update({ where: { id }, data: userData });
        await transaction.userAuditLog.create({
          data: {
            userId: id,
            performedById,
            action: "UPDATED",
            reason: data.reason ?? null,
          },
        });
      });
      const updated = await this.findAdminUserDetailById(id);
      if (!updated) throw new UserNotFoundError();
      return updated;
    } catch (error: unknown) {
      if (error instanceof UserNotFoundError) throw error;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new DuplicateUserError(this.duplicateFieldFromError(error));
      }
      throw error;
    }
  }

  private duplicateFieldFromError(error: Prisma.PrismaClientKnownRequestError): UserConflictField {
    const target = Array.isArray(error.meta?.target)
      ? error.meta.target.join(" ")
      : String(error.meta?.target ?? "");
    return target.toLowerCase().includes("document") ? "documentNumber" : "email";
  }

  async updateUserStatus(
    id: string,
    performedById: string,
    data: UpdateUserStatusData,
  ): Promise<UserListItem> {
    return this.database.$transaction(async (transaction) => {
      const current = await transaction.user.findUnique({
        where: { id },
        select: { status: true },
      });
      if (!current) throw new UserNotFoundError();

      const user = await transaction.user.update({
        where: { id },
        data: { status: data.status },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          documentNumber: true,
          email: true,
          role: true,
          status: true,
        },
      });

      if (current.status !== data.status) {
        await transaction.userAuditLog.create({
          data: {
            userId: id,
            performedById,
            action: data.status === "ACTIVE" ? "ACTIVATED" : "DEACTIVATED",
            reason: data.reason ?? null,
          },
        });
      }
      return user;
    });
  }

  async listUserAuditLogs(
    userId: string,
    page: number,
    limit: number,
  ): Promise<UserAuditLogListResult> {
    const skip = (page - 1) * limit;
    const [total, items] = await this.database.$transaction([
      this.database.userAuditLog.count({ where: { userId } }),
      this.database.userAuditLog.findMany({
        where: { userId },
        orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
        skip,
        take: limit,
        select: {
          id: true,
          userId: true,
          action: true,
          reason: true,
          occurredAt: true,
          performedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              role: true,
            },
          },
        },
      }),
    ]);
    return { items, page, limit, total };
  }

  async findAccessControlUserById(id: string): Promise<AccessControlUser | null> {
    return this.database.user.findUnique({
      where: { id },
      select: {
        id: true,
        role: true,
        status: true,
        isPasswordChangeRequired: true,
      },
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

  async findPasswordUserById(id: string): Promise<PasswordUser | null> {
    return this.database.user.findUnique({
      where: { id },
      select: { passwordHash: true },
    });
  }

  async changePassword(id: string, passwordHash: string): Promise<void> {
    await this.database.$transaction(async (transaction) => {
      await transaction.user.update({
        where: { id },
        data: {
          passwordHash,
          isPasswordChangeRequired: false,
        },
      });
      await transaction.userAuditLog.create({
        data: {
          userId: id,
          performedById: id,
          action: "UPDATED",
          reason: "PASSWORD_CHANGED",
        },
      });
    });
  }

  async findPasswordResetTargetById(id: string): Promise<{ id: string } | null> {
    return this.database.user.findUnique({
      where: { id },
      select: { id: true },
    });
  }

  async resetTemporaryPassword(
    userId: string,
    performedById: string,
    passwordHash: string,
  ): Promise<void> {
    await this.database.$transaction(async (transaction) => {
      await transaction.user.update({
        where: { id: userId },
        data: {
          passwordHash,
          isPasswordChangeRequired: true,
        },
      });
      await transaction.userAuditLog.create({
        data: {
          userId,
          performedById,
          action: "PASSWORD_RESET",
        },
      });
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

  async updateOwnPhoto(id: string, photoUrl: string): Promise<OwnProfile> {
    return this.database.$transaction(async (transaction) => {
      const user = await transaction.user.update({
        where: { id },
        data: { photoUrl },
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
          reason: "PROFILE_PHOTO_UPDATED",
        },
      });
      return user;
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
