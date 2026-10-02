import type { PrismaClient } from "../generated/prisma/client.js";
import type { TrainerListQueryInput } from "../validator/trainer-validator.js";

export interface PublicTrainer {
  id: string;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  specialty: string;
  description: string;
  branches: Array<{ id: string; name: string; address: string }>;
}

export interface TrainerListResult {
  items: PublicTrainer[];
  page: number;
  limit: number;
  total: number;
}

export interface TrainerRepositoryPort {
  listActiveTrainers(query: TrainerListQueryInput): Promise<TrainerListResult>;
}

export class TrainerRepository implements TrainerRepositoryPort {
  constructor(private readonly database: PrismaClient) {}

  async listActiveTrainers(query: TrainerListQueryInput): Promise<TrainerListResult> {
    const where = { role: "TRAINER" as const, status: "ACTIVE" as const, trainerProfile: { isNot: null } };
    const [total, users] = await this.database.$transaction([
      this.database.user.count({ where }),
      this.database.user.findMany({
        where,
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { id: "asc" }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          photoUrl: true,
          trainerProfile: { select: { specialty: true, description: true } },
          trainerBranches: {
            where: { branch: { isActive: true } },
            orderBy: { branch: { name: "asc" } },
            select: { branch: { select: { id: true, name: true, address: true } } },
          },
        },
      }),
    ]);

    return {
      items: users.map((user) => ({
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        photoUrl: user.photoUrl,
        specialty: user.trainerProfile!.specialty,
        description: user.trainerProfile!.description,
        branches: user.trainerBranches.map(({ branch }) => branch),
      })),
      page: query.page,
      limit: query.limit,
      total,
    };
  }
}
