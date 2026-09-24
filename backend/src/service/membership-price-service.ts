import { ApplicationError } from "../error/application-error.js";
import { ERROR_CODE } from "../error/error-code.js";
import type { MembershipPrice } from "../generated/prisma/client.js";
import {
  MembershipPriceAlreadyConfiguredError,
  type MembershipPriceRepositoryPort,
} from "../repository/membership-price-repository.js";
import type { CreateMembershipPriceInput } from "../validator/membership-price-validator.js";

export class MembershipPriceService {
  constructor(private readonly priceRepository: MembershipPriceRepositoryPort) {}

  async createInitialPrice(
    input: CreateMembershipPriceInput,
    administratorId: string,
  ): Promise<MembershipPrice> {
    try {
      return await this.priceRepository.createInitialPrice({
        amount: input.amount.toString(),
        effectiveFrom: new Date(input.effectiveFrom),
        createdById: administratorId,
      });
    } catch (error: unknown) {
      if (error instanceof MembershipPriceAlreadyConfiguredError) {
        throw new ApplicationError(
          409,
          ERROR_CODE.CONFLICT,
          "El valor de la cuota ya está configurado",
        );
      }
      throw error;
    }
  }

  async getCurrentPrice(): Promise<MembershipPrice> {
    const price = await this.priceRepository.findCurrentPrice(new Date());
    if (!price) {
      throw new ApplicationError(404, ERROR_CODE.NOT_FOUND, "El valor de la cuota no está configurado");
    }
    return price;
  }
}
