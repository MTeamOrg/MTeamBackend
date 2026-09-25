import type { MembershipPrice, PrismaClient } from "../generated/prisma/client.js";

export interface NewMembershipPriceData {
  amount: string;
  effectiveFrom: Date;
  createdById: string;
}

export interface MembershipPriceWithPrevious extends MembershipPrice {
  previousAmount: string | null;
}

export interface MembershipPriceHistory {
  items: MembershipPriceWithPrevious[];
  page: number;
  limit: number;
  total: number;
}

export interface MembershipPriceListQuery {
  page: number;
  limit: number;
}

export interface MembershipPriceRepositoryPort {
  createPrice(data: NewMembershipPriceData): Promise<MembershipPriceWithPrevious>;
  findCurrentPrice(now: Date): Promise<MembershipPrice | null>;
  listPrices(query: MembershipPriceListQuery): Promise<MembershipPriceHistory>;
}

export class MembershipPriceRepository implements MembershipPriceRepositoryPort {
  constructor(private readonly database: PrismaClient) {}

  createPrice(data: NewMembershipPriceData): Promise<MembershipPriceWithPrevious> {
    return this.database.$transaction(async (transaction) => {
      const price = await transaction.membershipPrice.create({ data });
      const previous = await transaction.membershipPrice.findFirst({
        where: {
          OR: [
            { effectiveFrom: { lt: price.effectiveFrom } },
            { effectiveFrom: price.effectiveFrom, createdAt: { lt: price.createdAt } },
            { effectiveFrom: price.effectiveFrom, createdAt: price.createdAt, id: { lt: price.id } },
          ],
        },
        orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }, { id: "desc" }],
        select: { amount: true },
      });
      return { ...price, previousAmount: previous?.amount.toString() ?? null };
    });
  }

  findCurrentPrice(now: Date): Promise<MembershipPrice | null> {
    return this.database.membershipPrice.findFirst({
      where: { effectiveFrom: { lte: now } },
      orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    });
  }

  async listPrices(query: MembershipPriceListQuery): Promise<MembershipPriceHistory> {
    const [total, prices] = await this.database.$transaction([
      this.database.membershipPrice.count(),
      this.database.membershipPrice.findMany({
        orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }, { id: "desc" }],
        skip: (query.page - 1) * query.limit,
        take: query.limit + 1,
      }),
    ]);

    return {
      items: prices.slice(0, query.limit).map((price, index) => ({
        ...price,
        previousAmount: prices[index + 1]?.amount.toString() ?? null,
      })),
      page: query.page,
      limit: query.limit,
      total,
    };
  }
}
