import type { Branch, PrismaClient, User } from "../generated/prisma/client.js";
import { Prisma } from "../generated/prisma/client.js";
import type {
  AdminBranchListQuery,
  CreateBranchInput,
  PublicBranchListQuery,
  UpdateBranchStatusInput,
  UpdateBranchInput,
} from "../validator/branch-validator.js";

export type BranchConflictField = "name" | "address";

export class DuplicateBranchError extends Error {
  constructor(readonly field: BranchConflictField) {
    super(`Duplicate branch field: ${field}`);
    this.name = "DuplicateBranchError";
  }
}

export class BranchNotFoundError extends Error {
  constructor() {
    super("Branch not found");
    this.name = "BranchNotFoundError";
  }
}

type BranchCard = Pick<Branch,
  "id" | "name" | "imageUrl" | "address" | "openingHours" | "phone" | "description"
>;

export interface PublicBranchList {
  items: BranchCard[];
  page: number;
  limit: number;
  total: number;
}

export interface PublicBranchDetail extends BranchCard {
  latitude: Branch["latitude"];
  longitude: Branch["longitude"];
  scheduledClasses: Array<{
    id: string;
    activity: string;
    startsAt: Date;
    trainer: Pick<User, "id" | "firstName" | "lastName"> | null;
  }>;
}

export interface AdminBranchList {
  items: Branch[];
  page: number;
  limit: number;
  total: number;
}

export interface AdminBranchDetail extends PublicBranchDetail {
  isActive: boolean;
}

const branchCardSelect = {
  id: true,
  name: true,
  imageUrl: true,
  address: true,
  openingHours: true,
  phone: true,
  description: true,
} as const;

const branchDetailSelect = {
  ...branchCardSelect,
  latitude: true,
  longitude: true,
  scheduledClasses: {
    orderBy: [{ startsAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      activity: true,
      startsAt: true,
      trainer: { select: { id: true, firstName: true, lastName: true } },
    },
  },
} satisfies Prisma.BranchSelect;

function branchSearchWhere(search?: string): Prisma.BranchWhereInput {
  if (!search) return {};
  return {
    OR: [
      { name: { contains: search, mode: "insensitive" } },
      { address: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ],
  };
}

export interface BranchRepositoryPort {
  listPublicBranches(query: PublicBranchListQuery): Promise<PublicBranchList>;
  findPublicBranchById(id: string): Promise<PublicBranchDetail | null>;
  listAdminBranches(query: AdminBranchListQuery): Promise<AdminBranchList>;
  findAdminBranchById(id: string): Promise<AdminBranchDetail | null>;
  updateBranchStatus(id: string, input: UpdateBranchStatusInput): Promise<Branch>;
  findById(id: string): Promise<Branch | null>;
  findConflict(
    name: string | undefined,
    address: string | undefined,
    excludedId?: string,
  ): Promise<BranchConflictField | null>;
  createBranch(input: CreateBranchInput): Promise<Branch>;
  updateBranch(id: string, input: UpdateBranchInput): Promise<Branch>;
}

export class BranchRepository implements BranchRepositoryPort {
  constructor(private readonly database: PrismaClient) {}

  async listPublicBranches(query: PublicBranchListQuery): Promise<PublicBranchList> {
    const where: Prisma.BranchWhereInput = { isActive: true, ...branchSearchWhere(query.search) };
    const [total, items] = await this.database.$transaction([
      this.database.branch.count({ where }),
      this.database.branch.findMany({
        where,
        orderBy: [{ name: "asc" }, { id: "asc" }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: branchCardSelect,
      }),
    ]);
    return { items, page: query.page, limit: query.limit, total };
  }

  findPublicBranchById(id: string): Promise<PublicBranchDetail | null> {
    return this.database.branch.findFirst({
      where: { id, isActive: true },
      select: branchDetailSelect,
    });
  }

  async listAdminBranches(query: AdminBranchListQuery): Promise<AdminBranchList> {
    const where: Prisma.BranchWhereInput = {
      ...branchSearchWhere(query.search),
      ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
    };
    const [total, items] = await this.database.$transaction([
      this.database.branch.count({ where }),
      this.database.branch.findMany({
        where,
        orderBy: [{ name: "asc" }, { id: "asc" }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);
    return { items, page: query.page, limit: query.limit, total };
  }

  findAdminBranchById(id: string): Promise<AdminBranchDetail | null> {
    return this.database.branch.findUnique({
      where: { id },
      select: { ...branchDetailSelect, isActive: true },
    });
  }

  async updateBranchStatus(id: string, input: UpdateBranchStatusInput): Promise<Branch> {
    try {
      return await this.database.branch.update({
        where: { id },
        data: { isActive: input.isActive },
      });
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
        throw new BranchNotFoundError();
      }
      throw error;
    }
  }

  findById(id: string): Promise<Branch | null> {
    return this.database.branch.findUnique({ where: { id } });
  }

  async findConflict(
    name: string | undefined,
    address: string | undefined,
    excludedId?: string,
  ): Promise<BranchConflictField | null> {
    const or: Prisma.BranchWhereInput[] = [];
    if (name !== undefined) or.push({ name: { equals: name, mode: "insensitive" } });
    if (address !== undefined) or.push({ address: { equals: address, mode: "insensitive" } });
    if (or.length === 0) return null;

    const branch = await this.database.branch.findFirst({
      where: { OR: or, ...(excludedId ? { id: { not: excludedId } } : {}) },
      select: { name: true, address: true },
    });
    if (!branch) return null;
    return name !== undefined && branch.name.toLowerCase() === name.toLowerCase()
      ? "name"
      : "address";
  }

  async createBranch(input: CreateBranchInput): Promise<Branch> {
    try {
      return await this.database.branch.create({
        data: {
          ...input,
          latitude: input.latitude?.toString() ?? null,
          longitude: input.longitude?.toString() ?? null,
        },
      });
    } catch (error: unknown) {
      if (this.isUniqueError(error)) throw this.duplicateError(error);
      throw error;
    }
  }

  async updateBranch(id: string, input: UpdateBranchInput): Promise<Branch> {
    const data: Prisma.BranchUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.address !== undefined) data.address = input.address;
    if (input.openingHours !== undefined) data.openingHours = input.openingHours;
    if (input.phone !== undefined) data.phone = input.phone;
    if (input.description !== undefined) data.description = input.description;
    if (input.imageUrl !== undefined) data.imageUrl = input.imageUrl;
    if (input.latitude !== undefined) data.latitude = input.latitude?.toString() ?? null;
    if (input.longitude !== undefined) data.longitude = input.longitude?.toString() ?? null;

    try {
      return await this.database.branch.update({ where: { id }, data });
    } catch (error: unknown) {
      if (this.isUniqueError(error)) throw this.duplicateError(error);
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
        throw new BranchNotFoundError();
      }
      throw error;
    }
  }

  private isUniqueError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
  }

  private duplicateError(error: Prisma.PrismaClientKnownRequestError): DuplicateBranchError {
    const target = Array.isArray(error.meta?.target)
      ? error.meta.target.join(" ")
      : String(error.meta?.target ?? "");
    return new DuplicateBranchError(target.toLowerCase().includes("address") ? "address" : "name");
  }
}
