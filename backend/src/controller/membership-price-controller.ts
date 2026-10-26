import type { RequestHandler } from "express";

import { ApplicationError } from "../error/application-error.js";
import { ERROR_CODE } from "../error/error-code.js";
import type { MembershipPrice } from "../generated/prisma/client.js";
import type { MembershipPriceService } from "../service/membership-price-service.js";
import {
  createMembershipPriceSchema,
  membershipPriceIdempotencyKeySchema,
  membershipPriceListQuerySchema,
} from "../validator/membership-price-validator.js";

function serializeMembershipPrice(price: MembershipPrice) {
  const serialized = { ...price, amount: price.amount.toString() };
  const { idempotencyKey, ...publicPrice } = serialized;
  void idempotencyKey;
  return publicPrice;
}

export class MembershipPriceController {
  constructor(private readonly priceService: MembershipPriceService) {}

  createPrice: RequestHandler = async (request, response) => {
    const validation = createMembershipPriceSchema.safeParse(request.body);
    const idempotencyKeyValidation = membershipPriceIdempotencyKeySchema.safeParse(
      request.get("Idempotency-Key"),
    );
    if (!validation.success || !idempotencyKeyValidation.success) {
      throw new ApplicationError(
        400,
        ERROR_CODE.VALIDATION_ERROR,
        "Los datos del valor de la cuota o su clave de solicitud no son válidos",
        {
          body: validation.success ? null : validation.error.flatten(),
          idempotencyKey: idempotencyKeyValidation.success
            ? null
            : idempotencyKeyValidation.error.flatten(),
        },
      );
    }

    const price = await this.priceService.createPrice(
      validation.data,
      request.authenticatedUser!.id,
      idempotencyKeyValidation.data,
    );
    response.status(201).json(serializeMembershipPrice(price));
  };

  getCurrentPrice: RequestHandler = async (_request, response) => {
    response.status(200).json(serializeMembershipPrice(await this.priceService.getCurrentPrice()));
  };

  listPrices: RequestHandler = async (request, response) => {
    const validation = membershipPriceListQuerySchema.safeParse(request.query);
    if (!validation.success) {
      throw new ApplicationError(
        400,
        ERROR_CODE.VALIDATION_ERROR,
        "Los filtros del historial de valores no son válidos",
        validation.error.flatten(),
      );
    }
    const history = await this.priceService.listPrices(validation.data);
    response.status(200).json({
      ...history,
      items: history.items.map(serializeMembershipPrice),
    });
  };
}
