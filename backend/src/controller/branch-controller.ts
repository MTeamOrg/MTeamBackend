import type { RequestHandler } from "express";

import { ApplicationError } from "../error/application-error.js";
import { ERROR_CODE } from "../error/error-code.js";
import type { Branch } from "../generated/prisma/client.js";
import type { BranchService } from "../service/branch-service.js";
import {
  branchIdParamsSchema,
  createBranchSchema,
  updateBranchSchema,
} from "../validator/branch-validator.js";

function serializeBranch(branch: Branch) {
  return {
    ...branch,
    latitude: branch.latitude?.toString() ?? null,
    longitude: branch.longitude?.toString() ?? null,
  };
}

export class BranchController {
  constructor(private readonly branchService: BranchService) {}

  createBranch: RequestHandler = async (request, response) => {
    const validation = createBranchSchema.safeParse(request.body);
    if (!validation.success) {
      throw new ApplicationError(
        400,
        ERROR_CODE.VALIDATION_ERROR,
        "Los datos de la sede no son válidos",
        validation.error.flatten(),
      );
    }

    const branch = await this.branchService.createBranch(validation.data);
    response.status(201).json(serializeBranch(branch));
  };

  updateBranch: RequestHandler = async (request, response) => {
    const paramsValidation = branchIdParamsSchema.safeParse(request.params);
    const bodyValidation = updateBranchSchema.safeParse(request.body);
    if (!paramsValidation.success || !bodyValidation.success) {
      throw new ApplicationError(
        400,
        ERROR_CODE.VALIDATION_ERROR,
        "Los datos para modificar la sede no son válidos",
        {
          params: paramsValidation.success ? null : paramsValidation.error.flatten(),
          body: bodyValidation.success ? null : bodyValidation.error.flatten(),
        },
      );
    }

    const branch = await this.branchService.updateBranch(
      paramsValidation.data.branchId,
      bodyValidation.data,
    );
    response.status(200).json(serializeBranch(branch));
  };
}
