import type { MembershipPrice, PrismaClient } from "../generated/prisma/client.js";
import { Prisma } from "../generated/prisma/client.js";

export interface InitialMembershipPriceData {
  amount: string;
  effectiveFrom: Date;
  createdById: string;
}

export class MembershipPriceAlreadyConfiguredError extends Error {
  constructor() {
    super("Membership price already configured");
    this.name = "MembershipPriceAlreadyConfiguredError";
  }
}

export interface MembershipPriceRepositoryPort {
  createInitialPrice(data: InitialMembershipPriceData): Promise<MembershipPrice>;
  findCurrentPrice(now: Date): Promise<MembershipPrice | null>;
}

export class MembershipPriceRepository implements MembershipPriceRepositoryPort {
  constructor(private readonly database: PrismaClient) {}

  async createInitialPrice(data: InitialMembershipPriceData): Promise<MembershipPrice> {
    try {
      return await this.database.$transaction(async (transaction) => {
        const existingPrice = await transaction.membershipPrice.findFirst({
          select: { id: true },
        });
        if (existingPrice) throw new MembershipPriceAlreadyConfiguredError();

        return transaction.membershipPrice.create({ data });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
        const existingPrice = await this.database.membershipPrice.findFirst({
          select: { id: true },
        });
        if (existingPrice) throw new MembershipPriceAlreadyConfiguredError();
      }
      throw error;
    }
  }

  findCurrentPrice(now: Date): Promise<MembershipPrice | null> {
    return this.database.membershipPrice.findFirst({
      where: { effectiveFrom: { lte: now } },
      orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    });
  }
}
