import type { RequestHandler } from "express";

import { ApplicationError } from "../error/application-error.js";
import { ERROR_CODE } from "../error/error-code.js";
import type { Branch } from "../generated/prisma/client.js";
import type { PublicBranchDetail } from "../repository/branch-repository.js";
import type { BranchService } from "../service/branch-service.js";
import {
  adminBranchListQuerySchema,
  branchIdParamsSchema,
  createBranchSchema,
  publicBranchListQuerySchema,
  updateBranchStatusSchema,
  updateBranchSchema,
} from "../validator/branch-validator.js";

function serializeBranch(branch: Branch) {
  return {
    ...branch,
    latitude: branch.latitude?.toString() ?? null,
    longitude: branch.longitude?.toString() ?? null,
  };
}

function serializeBranchDetail(branch: PublicBranchDetail) {
  return {
    ...branch,
    latitude: branch.latitude?.toString() ?? null,
    longitude: branch.longitude?.toString() ?? null,
    scheduledClasses: branch.scheduledClasses.map((scheduledClass) => ({
      ...scheduledClass,
      startsAt: scheduledClass.startsAt.toISOString(),
    })),
  };
}

export class BranchController {
  constructor(private readonly branchService: BranchService) {}

  listPublicBranches: RequestHandler = async (request, response) => {
    const validation = publicBranchListQuerySchema.safeParse(request.query);
    if (!validation.success) {
      throw new ApplicationError(400, ERROR_CODE.VALIDATION_ERROR,
        "Los filtros de sedes no son válidos", validation.error.flatten());
    }
    response.status(200).json(await this.branchService.listPublicBranches(validation.data));
  };

  getPublicBranch: RequestHandler = async (request, response) => {
    const validation = branchIdParamsSchema.safeParse(request.params);
    if (!validation.success) {
      throw new ApplicationError(400, ERROR_CODE.VALIDATION_ERROR,
        "El identificador de la sede no es válido", validation.error.flatten());
    }
    const branch = await this.branchService.getPublicBranch(validation.data.branchId);
    response.status(200).json(serializeBranchDetail(branch));
  };

  listAdminBranches: RequestHandler = async (request, response) => {
    const validation = adminBranchListQuerySchema.safeParse(request.query);
    if (!validation.success) {
      throw new ApplicationError(400, ERROR_CODE.VALIDATION_ERROR,
        "Los filtros de sedes no son válidos", validation.error.flatten());
    }
    const result = await this.branchService.listAdminBranches(validation.data);
    response.status(200).json({
      ...result,
      items: result.items.map(serializeBranch),
    });
  };

  getAdminBranch: RequestHandler = async (request, response) => {
    const validation = branchIdParamsSchema.safeParse(request.params);
    if (!validation.success) {
      throw new ApplicationError(400, ERROR_CODE.VALIDATION_ERROR,
        "El identificador de la sede no es válido", validation.error.flatten());
    }
    const branch = await this.branchService.getAdminBranch(validation.data.branchId);
    response.status(200).json(serializeBranchDetail(branch));
  };

  updateBranchStatus: RequestHandler = async (request, response) => {
    const paramsValidation = branchIdParamsSchema.safeParse(request.params);
    const bodyValidation = updateBranchStatusSchema.safeParse(request.body);
    if (!paramsValidation.success || !bodyValidation.success) {
      throw new ApplicationError(400, ERROR_CODE.VALIDATION_ERROR,
        "Los datos para cambiar el estado de la sede no son válidos", {
          params: paramsValidation.success ? null : paramsValidation.error.flatten(),
          body: bodyValidation.success ? null : bodyValidation.error.flatten(),
        });
    }
    const branch = await this.branchService.updateBranchStatus(
      paramsValidation.data.branchId,
      bodyValidation.data,
    );
    response.status(200).json(serializeBranch(branch));
  };

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
