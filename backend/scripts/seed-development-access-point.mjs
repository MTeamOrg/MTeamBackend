import { database, disconnectDatabase } from "../dist/config/database.js";
import { environment } from "../dist/config/environment.js";

const developmentAccessPoint = {
  id: "a19e150a-52b3-4e71-92a8-a487f401c801",
  name: "Punto QR de desarrollo",
  qrToken: "mteam-development-access-point-qr-v1",
};

async function seedDevelopmentAccessPoint() {
  if (environment.APP_ENV !== "development") {
    throw new Error("Este seed solo puede ejecutarse con APP_ENV=development");
  }

  const byId = await database.accessPoint.findUnique({
    where: { id: developmentAccessPoint.id },
    include: { branch: { select: { id: true, name: true } } },
  });
  if (byId) {
    if (
      byId.name !== developmentAccessPoint.name ||
      byId.qrToken !== developmentAccessPoint.qrToken
    ) {
      throw new Error("El punto QR de desarrollo ya existe con una configuración diferente; no se modificó");
    }
    console.log(`access_point=already_present active=${byId.isActive} branch=${byId.branch.name} qr_token=${byId.qrToken}`);
    return;
  }

  const branch = await database.branch.findFirst({
    where: { isActive: true },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    select: { id: true, name: true },
  });

  if (!branch) {
    throw new Error("No hay una sede activa existente para asociar el punto QR de desarrollo");
  }

  const byToken = await database.accessPoint.findUnique({
    where: { qrToken: developmentAccessPoint.qrToken },
    select: { id: true },
  });
  if (byToken) {
    throw new Error("El token QR de desarrollo ya está asignado a otro punto; no se modificaron datos");
  }

  const point = await database.accessPoint.create({
    data: {
      ...developmentAccessPoint,
      branchId: branch.id,
      isActive: true,
    },
    select: { id: true, name: true, qrToken: true, branchId: true },
  });

  console.log(
    `access_point=created id=${point.id} name=${point.name} branch=${branch.name} branch_id=${point.branchId} qr_token=${point.qrToken}`,
  );
}

try {
  await seedDevelopmentAccessPoint();
} finally {
  await disconnectDatabase();
}
