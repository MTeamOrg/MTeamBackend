import type { RequestHandler } from "express";

import type { MemberMembershipService } from "../service/member-membership-service.js";

export class MemberMembershipController {
  constructor(private readonly membershipService: MemberMembershipService) {}

  getOwnMembership: RequestHandler = async (request, response) => {
    response.status(200).json(
      await this.membershipService.getOwnMembership(request.authenticatedUser!.id),
    );
  };
}
