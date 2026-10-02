import type { EventStatus, Prisma, PrismaClient, UserRole } from "../generated/prisma/client.js";
import { createNotifications, type NotificationRecipient } from "./notification-repository.js";
import type {
  CreateEventInput,
  EventListQuery,
  EventStatusUpdateInput,
  UpdateEventInput,
} from "../validator/event-validator.js";

const eventSelect = {
  id: true,
  title: true,
  description: true,
  startsAt: true,
  location: true,
  imageUrl: true,
  status: true,
  createdById: true,
} as const satisfies Prisma.EventSelect;

export type EventRecord = Prisma.EventGetPayload<{ select: typeof eventSelect }>;

export interface EventList {
  items: EventRecord[];
  page: number;
  limit: number;
  total: number;
}

export class EventNotFoundError extends Error {}
export class EventInvalidStatusError extends Error {}

export interface EventRepositoryPort {
  list(query: EventListQuery, role: UserRole): Promise<EventList>;
  findById(id: string, role: UserRole): Promise<EventRecord | null>;
  create(input: CreateEventInput, administratorId: string): Promise<EventRecord>;
  update(id: string, input: UpdateEventInput): Promise<EventRecord>;
  updateStatus(id: string, input: EventStatusUpdateInput): Promise<EventRecord>;
}

export class EventRepository implements EventRepositoryPort {
  constructor(private readonly database: PrismaClient) {}

  async list(query: EventListQuery, role: UserRole): Promise<EventList> {
    const where = this.buildWhere(query, role);
    const [total, items] = await this.database.$transaction([
      this.database.event.count({ where }),
      this.database.event.findMany({
        where,
        orderBy: [{ startsAt: "asc" }, { id: "asc" }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: eventSelect,
      }),
    ]);
    return { items, page: query.page, limit: query.limit, total };
  }

  findById(id: string, role: UserRole): Promise<EventRecord | null> {
    return this.database.event.findFirst({ where: this.buildWhere({ eventId: id }, role), select: eventSelect });
  }

  create(input: CreateEventInput, administratorId: string): Promise<EventRecord> {
    return this.database.event.create({
      data: {
        title: input.title,
        description: input.description,
        startsAt: new Date(input.startsAt),
        location: input.location,
        imageUrl: input.imageUrl,
        status: input.status,
        createdById: administratorId,
      },
      select: eventSelect,
    });
  }

  update(id: string, input: UpdateEventInput): Promise<EventRecord> {
    return this.database.event.findUnique({ where: { id }, select: { id: true } }).then((current) => {
      if (!current) throw new EventNotFoundError();
      return this.database.event.update({
      where: { id },
      data: {
        ...(input.title === undefined ? {} : { title: input.title }),
        ...(input.description === undefined ? {} : { description: input.description }),
        ...(input.startsAt === undefined ? {} : { startsAt: new Date(input.startsAt) }),
        ...(input.location === undefined ? {} : { location: input.location }),
        ...(input.imageUrl === undefined ? {} : { imageUrl: input.imageUrl }),
      },
      select: eventSelect,
      });
    });
  }

  async updateStatus(id: string, input: EventStatusUpdateInput): Promise<EventRecord> {
    return this.database.$transaction(async (transaction) => {
      const current = await transaction.event.findUnique({ where: { id }, select: eventSelect });
      if (!current) throw new EventNotFoundError();
      if (current.status === "CANCELLED" && input.status !== "CANCELLED") {
        throw new EventInvalidStatusError();
      }
      if (current.status === input.status) return current;
      const updated = await transaction.event.update({
        where: { id },
        data: { status: input.status },
        select: eventSelect,
      });
      if (input.status === "CANCELLED") {
        const users = await transaction.user.findMany({
          where: { role: { in: ["MEMBER", "TRAINER"] }, status: "ACTIVE" },
          select: { id: true },
        });
        const notifications: NotificationRecipient[] = users.map((user) => ({
          userId: user.id,
          title: "Evento cancelado",
          message: `Se canceló el evento \"${current.title}\" previsto para ${current.startsAt.toLocaleDateString("es-AR")}.`,
          type: "EVENT_CANCELLED",
          dedupeKey: `event-cancelled:${current.id}:${user.id}`,
        }));
        await createNotifications(transaction, notifications);
      }
      return updated;
    });
  }

  private buildWhere(query: Partial<EventListQuery> & { eventId?: string }, role: UserRole): Prisma.EventWhereInput {
    const where: Prisma.EventWhereInput = {};
    if (role !== "ADMIN") {
      where.status = { in: ["PUBLISHED", "CANCELLED"] };
    } else if (query.status) {
      where.status = query.status as EventStatus;
    }
    if (query.eventId) where.id = query.eventId;
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: "insensitive" } },
        { description: { contains: query.search, mode: "insensitive" } },
        { location: { contains: query.search, mode: "insensitive" } },
      ];
    }
    return where;
  }
}
