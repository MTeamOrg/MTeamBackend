import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../generated/prisma/client.js";
import { environment } from "./environment.js";

const adapter = new PrismaPg({ connectionString: environment.DATABASE_URL });

export const database = new PrismaClient({ adapter });

export async function disconnectDatabase(): Promise<void> {
  await database.$disconnect();
}
