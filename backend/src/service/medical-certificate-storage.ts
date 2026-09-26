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
    const response = await fetch(
      new URL(`/storage/v1/object/${encodeURIComponent(configuration.bucket)}`, configuration.url),
      {
        method: "DELETE",
        headers: {
          apikey: configuration.serviceRoleKey,
          authorization: `Bearer ${configuration.serviceRoleKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ prefixes: [path] }),
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
    return new URL(
      `/storage/v1/object/${encodeURIComponent(configuration.bucket)}/${encodedPath(path)}`,
      configuration.url,
    );
  }
}
