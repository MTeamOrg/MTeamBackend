import { ApplicationError } from "../error/application-error.js";
import { ERROR_CODE } from "../error/error-code.js";

export interface MedicalCertificateStorageFile {
  buffer: Buffer;
  mimeType: string;
}

export interface MedicalCertificateStorage {
  upload(path: string, file: MedicalCertificateStorageFile): Promise<void>;
  createSignedUrl(path: string): Promise<string>;
  remove(path: string): Promise<void>;
}

export interface MedicalCertificateStorageConfiguration {
  url: string | undefined;
  serviceRoleKey: string | undefined;
  bucket: string | undefined;
  signedUrlExpiresInSeconds?: number;
}

function encodedPath(path: string): string {
  return path.split("/").map((segment) => encodeURIComponent(segment)).join("/");
}

export function normalizeMedicalCertificateObjectPath(path: string, bucket: string): string {
  let normalized = path.trim();

  if (/^https?:\/\//i.test(normalized)) {
    normalized = new URL(normalized).pathname;
  }

  normalized = normalized.split(/[?#]/, 1)[0] ?? "";
  normalized = decodeURIComponent(normalized).replace(/^\/+/, "");
  normalized = normalized.replace(/^storage\/v1\/object\//, "");
  normalized = normalized.replace(/^(?:sign|public)\//, "");

  const bucketPrefix = `${bucket}/`;
  if (normalized === bucket || normalized.startsWith(bucketPrefix)) {
    normalized = normalized.slice(bucketPrefix.length);
  }

  normalized = normalized.split("/").filter(Boolean).join("/");
  if (!normalized || normalized.split("/").some((segment) => segment === "." || segment === "..")) {
    throw new ApplicationError(502, ERROR_CODE.STORAGE_ERROR,
      "La ruta del apto m\u00e9dico no es v\u00e1lida");
  }
  return normalized;
}

export class SupabaseMedicalCertificateStorage implements MedicalCertificateStorage {
  private readonly signedUrlExpiresInSeconds: number;

  constructor(private readonly configuration: MedicalCertificateStorageConfiguration) {
    this.signedUrlExpiresInSeconds = configuration.signedUrlExpiresInSeconds ?? 300;
  }

  async upload(path: string, file: MedicalCertificateStorageFile): Promise<void> {
    const configuration = this.requireConfiguration();
    const response = await fetch(this.objectUrl(configuration, path), {
      method: "POST",
      headers: {
        apikey: configuration.serviceRoleKey,
        authorization: `Bearer ${configuration.serviceRoleKey}`,
        "content-type": file.mimeType,
        "cache-control": "0",
      },
      body: new Uint8Array(file.buffer),
    });
    if (!response.ok) {
      throw new ApplicationError(502, ERROR_CODE.STORAGE_ERROR,
        "No se pudo almacenar el apto médico");
    }
  }

  async createSignedUrl(path: string): Promise<string> {
    const configuration = this.requireConfiguration();
    const response = await fetch(
      this.objectUrl(configuration, path).toString()
        .replace("/storage/v1/object/", "/storage/v1/object/sign/"),
      {
        method: "POST",
        headers: {
          apikey: configuration.serviceRoleKey,
          authorization: `Bearer ${configuration.serviceRoleKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ expiresIn: this.signedUrlExpiresInSeconds }),
      },
    );
    if (!response.ok) {
      throw new ApplicationError(502, ERROR_CODE.STORAGE_ERROR,
        "No se pudo generar el acceso temporal al apto médico");
    }
    const data = await response.json() as {
      signedURL?: string;
      signedUrl?: string;
    };
    const signedPath = data.signedURL ?? data.signedUrl;
    if (!signedPath) {
      throw new ApplicationError(502, ERROR_CODE.STORAGE_ERROR,
        "Supabase no devolvió un acceso temporal válido");
    }
    return new URL(signedPath, configuration.url).toString();
  }

  async remove(path: string): Promise<void> {
    const configuration = this.requireConfiguration();
    const objectPath = normalizeMedicalCertificateObjectPath(path, configuration.bucket);
    const response = await fetch(
      new URL(`/storage/v1/object/${encodeURIComponent(configuration.bucket)}`, configuration.url),
      {
        method: "DELETE",
        headers: {
          apikey: configuration.serviceRoleKey,
          authorization: `Bearer ${configuration.serviceRoleKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ prefixes: [objectPath] }),
      },
    );
    if (!response.ok) {
      throw new ApplicationError(502, ERROR_CODE.STORAGE_ERROR,
        "No se pudo limpiar el archivo temporal del apto médico");
    }
  }

  private requireConfiguration(): {
    url: string;
    serviceRoleKey: string;
    bucket: string;
    signedUrlExpiresInSeconds: number;
  } {
    const { url, serviceRoleKey, bucket } = this.configuration;
    if (!url || !serviceRoleKey || !bucket) {
      throw new ApplicationError(503, ERROR_CODE.SERVICE_UNAVAILABLE,
        "El almacenamiento privado de aptos médicos no está configurado");
    }
    return {
      url,
      serviceRoleKey,
      bucket,
      signedUrlExpiresInSeconds: this.signedUrlExpiresInSeconds,
    };
  }

  private objectUrl(
    configuration: {
      url: string;
      serviceRoleKey: string;
      bucket: string;
      signedUrlExpiresInSeconds: number;
    },
    path: string,
  ): URL {
    const objectPath = normalizeMedicalCertificateObjectPath(path, configuration.bucket);
    return new URL(
      `/storage/v1/object/${encodeURIComponent(configuration.bucket)}/${encodedPath(objectPath)}`,
      configuration.url,
    );
  }
}
