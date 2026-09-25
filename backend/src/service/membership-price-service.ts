import { ApplicationError } from "../error/application-error.js";
import { ERROR_CODE } from "../error/error-code.js";
import type { MembershipPrice } from "../generated/prisma/client.js";
import type {
  MembershipPriceHistory,
  MembershipPriceListQuery,
  MembershipPriceRepositoryPort,
  MembershipPriceWithPrevious,
} from "../repository/membership-price-repository.js";
import type { CreateMembershipPriceInput } from "../validator/membership-price-validator.js";

export class MembershipPriceService {
  constructor(private readonly priceRepository: MembershipPriceRepositoryPort) {}

  createPrice(
    input: CreateMembershipPriceInput,
    administratorId: string,
  ): Promise<MembershipPriceWithPrevious> {
    return this.priceRepository.createPrice({
      amount: input.amount.toString(),
      effectiveFrom: new Date(input.effectiveFrom),
      createdById: administratorId,
    });
  }

  listPrices(query: MembershipPriceListQuery): Promise<MembershipPriceHistory> {
    return this.priceRepository.listPrices(query);
  }

  async getCurrentPrice(): Promise<MembershipPrice> {
    const price = await this.priceRepository.findCurrentPrice(new Date());
    if (!price) {
      throw new ApplicationError(404, ERROR_CODE.NOT_FOUND, "El valor de la cuota no está configurado");
    }
    return price;
  }
}
