import { ApplicationError } from "../error/application-error.js";
import { ERROR_CODE } from "../error/error-code.js";

export interface ProfilePhotoFile {
  buffer: Buffer;
  mimeType: string;
}

export interface ProfilePhotoStorage {
  upload(userId: string, file: ProfilePhotoFile): Promise<string>;
}

export interface ProfilePhotoStorageConfiguration {
  url: string | undefined;
  serviceRoleKey: string | undefined;
  bucket: string | undefined;
}

export class SupabaseProfilePhotoStorage implements ProfilePhotoStorage {
  constructor(private readonly configuration: ProfilePhotoStorageConfiguration) {}

  async upload(userId: string, file: ProfilePhotoFile): Promise<string> {
    const { url, serviceRoleKey, bucket } = this.configuration;
    if (!url || !serviceRoleKey || !bucket) {
      throw new ApplicationError(
        503,
        ERROR_CODE.SERVICE_UNAVAILABLE,
        "El almacenamiento de archivos no está configurado",
      );
    }

    const objectPath = `profile-photo/${userId}`;
    const uploadUrl = new URL(
      `/storage/v1/object/${encodeURIComponent(bucket)}/${objectPath}`,
      url,
    );
    const uploadResponse = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        authorization: `Bearer ${serviceRoleKey}`,
        "content-type": file.mimeType,
        "cache-control": "0",
        "x-upsert": "true",
      },
      body: new Uint8Array(file.buffer),
    });

    if (!uploadResponse.ok) {
      throw new ApplicationError(
        502,
        ERROR_CODE.STORAGE_ERROR,
        "No se pudo almacenar la fotografía",
      );
    }

    return new URL(
      `/storage/v1/object/public/${encodeURIComponent(bucket)}/${objectPath}`,
      url,
    ).toString();
  }
}
