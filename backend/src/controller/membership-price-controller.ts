import type { RequestHandler } from "express";

import { ApplicationError } from "../error/application-error.js";
import { ERROR_CODE } from "../error/error-code.js";
import type { MembershipPrice } from "../generated/prisma/client.js";
import type { MembershipPriceService } from "../service/membership-price-service.js";
import { createMembershipPriceSchema } from "../validator/membership-price-validator.js";

function serializeMembershipPrice(price: MembershipPrice) {
  return {
    ...price,
    amount: price.amount.toString(),
  };
}

export class MembershipPriceController {
  constructor(private readonly priceService: MembershipPriceService) {}

  createInitialPrice: RequestHandler = async (request, response) => {
    const validation = createMembershipPriceSchema.safeParse(request.body);
    if (!validation.success) {
      throw new ApplicationError(
        400,
        ERROR_CODE.VALIDATION_ERROR,
        "Los datos del valor de la cuota no son válidos",
        validation.error.flatten(),
      );
    }

    const price = await this.priceService.createInitialPrice(
      validation.data,
      request.authenticatedUser!.id,
    );
    response.status(201).json(serializeMembershipPrice(price));
  };

  getCurrentPrice: RequestHandler = async (_request, response) => {
    response.status(200).json(serializeMembershipPrice(await this.priceService.getCurrentPrice()));
  };
}
