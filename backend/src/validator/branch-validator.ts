import { z } from "zod";

const coordinateSchema = z.number().finite().refine(
  (value) => /^-?\d+(?:\.\d{1,6})?$/.test(value.toString()),
  "La coordenada debe tener como máximo seis decimales",
);

const branchFields = {
  name: z.string().trim().min(1).max(150),
  address: z.string().trim().min(1).max(255),
  openingHours: z.string().trim().min(1).max(255),
  phone: z.string().trim().min(1).max(30).regex(/^\+?[\d ()./-]+$/).refine(
    (value) => (value.match(/\d/g) ?? []).length >= 6,
    "El teléfono debe contener al menos seis dígitos",
  ),
  description: z.string().trim().min(1),
  imageUrl: z.string().trim().max(2048).pipe(z.url()).refine(
    (value) => /^https?:\/\//i.test(value),
    "La imagen debe tener una URL HTTP o HTTPS",
  ),
};

const latitudeSchema = coordinateSchema.min(-90).max(90);
const longitudeSchema = coordinateSchema.min(-180).max(180);

export const branchIdParamsSchema = z.strictObject({ branchId: z.uuid() });

export const createBranchSchema = z.strictObject({
  ...branchFields,
  latitude: latitudeSchema.optional(),
  longitude: longitudeSchema.optional(),
}).refine(
  (value) => (value.latitude === undefined) === (value.longitude === undefined),
  "Debe indicar latitud y longitud juntas",
);

export const updateBranchSchema = z.strictObject({
  name: branchFields.name.optional(),
  address: branchFields.address.optional(),
  openingHours: branchFields.openingHours.optional(),
  phone: branchFields.phone.optional(),
  description: branchFields.description.optional(),
  imageUrl: branchFields.imageUrl.optional(),
  latitude: latitudeSchema.nullable().optional(),
  longitude: longitudeSchema.nullable().optional(),
}).refine(
  (value) => Object.keys(value).length > 0,
  "Debe indicar al menos un campo para modificar",
).refine(
  (value) => (value.latitude === undefined) === (value.longitude === undefined) &&
    (value.latitude === null) === (value.longitude === null),
  "Debe indicar latitud y longitud juntas",
);

export type CreateBranchInput = z.infer<typeof createBranchSchema>;
export type UpdateBranchInput = z.infer<typeof updateBranchSchema>;
