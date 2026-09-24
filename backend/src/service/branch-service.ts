import { ApplicationError } from "../error/application-error.js";
import { ERROR_CODE } from "../error/error-code.js";
import type { Branch } from "../generated/prisma/client.js";
import {
  BranchNotFoundError,
  DuplicateBranchError,
  type BranchConflictField,
  type BranchRepositoryPort,
} from "../repository/branch-repository.js";
import type { CreateBranchInput, UpdateBranchInput } from "../validator/branch-validator.js";

export class BranchService {
  constructor(private readonly branchRepository: BranchRepositoryPort) {}

  async createBranch(input: CreateBranchInput): Promise<Branch> {
    const conflict = await this.branchRepository.findConflict(input.name, input.address);
    if (conflict) throw this.conflictError(conflict);

    try {
      return await this.branchRepository.createBranch(input);
    } catch (error: unknown) {
      if (error instanceof DuplicateBranchError) throw this.conflictError(error.field);
      throw error;
    }
  }

  async updateBranch(id: string, input: UpdateBranchInput): Promise<Branch> {
    const branch = await this.branchRepository.findById(id);
    if (!branch) throw this.notFoundError();

    const conflict = await this.branchRepository.findConflict(input.name, input.address, id);
    if (conflict) throw this.conflictError(conflict);

    try {
      return await this.branchRepository.updateBranch(id, input);
    } catch (error: unknown) {
      if (error instanceof BranchNotFoundError) throw this.notFoundError();
      if (error instanceof DuplicateBranchError) throw this.conflictError(error.field);
      throw error;
    }
  }

  private notFoundError(): ApplicationError {
    return new ApplicationError(404, ERROR_CODE.NOT_FOUND, "La sede no existe");
  }

  private conflictError(field: BranchConflictField): ApplicationError {
    return new ApplicationError(
      409,
      ERROR_CODE.CONFLICT,
      field === "name" ? "Ya existe una sede con ese nombre" : "Ya existe una sede con esa dirección",
      { field },
    );
  }
}
