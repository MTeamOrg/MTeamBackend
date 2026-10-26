import type { TrainerListResult, TrainerRepositoryPort } from "../repository/trainer-repository.js";
import type { TrainerListQueryInput } from "../validator/trainer-validator.js";

export class TrainerService {
  constructor(private readonly trainerRepository: TrainerRepositoryPort) {}

  listTrainers(query: TrainerListQueryInput): Promise<TrainerListResult> {
    return this.trainerRepository.listActiveTrainers(query);
  }
}
