import type { PrismaClient, User } from "../generated/prisma/client.js";

export type PaymentPreviewMember = Pick<User,
  "id" | "firstName" | "lastName" | "documentNumber" | "email" | "role"
>;

export interface PaymentPreviewRepositoryPort {
  findMemberById(memberId: string): Promise<PaymentPreviewMember | null>;
}

export class PaymentPreviewRepository implements PaymentPreviewRepositoryPort {
  constructor(private readonly database: PrismaClient) {}

  findMemberById(memberId: string): Promise<PaymentPreviewMember | null> {
    return this.database.user.findUnique({
      where: { id: memberId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        documentNumber: true,
        email: true,
        role: true,
      },
    });
  }
}
