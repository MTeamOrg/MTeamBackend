import type { RequestHandler } from "express";

import { ApplicationError } from "../error/application-error.js";
import { ERROR_CODE } from "../error/error-code.js";
import type { MemberService } from "../service/member-service.js";
import { memberListQuerySchema } from "../validator/member-validator.js";

export class MemberController {
  constructor(private readonly memberService: MemberService) {}

  listMembers: RequestHandler = async (request, response) => {
    const validation = memberListQuerySchema.safeParse(request.query);
    if (!validation.success) {
      throw new ApplicationError(400, ERROR_CODE.VALIDATION_ERROR,
        "Los filtros de socios no son válidos", validation.error.flatten());
    }

    const result = await this.memberService.listMembers(validation.data);
    response.status(200).json({
      ...result,
      items: result.items.map((member) => ({
        ...member,
        lastPaymentAt: member.lastPaymentAt?.toISOString() ?? null,
        expiresAt: member.expiresAt?.toISOString() ?? null,
      })),
    });
  };
}
