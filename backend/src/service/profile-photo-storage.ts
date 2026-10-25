import { randomUUID } from "node:crypto";

import { ApplicationError } from "../error/application-error.js";
import { ERROR_CODE } from "../error/error-code.js";
import { supabaseStorageAuthHeaders } from "./supabase-storage-headers.js";

export interface ProfilePhotoFile {
  buffer: Buffer;
  mimeType: string;
}

export interface ProfilePhotoStorage {
  upload(userId: string, file: ProfilePhotoFile): Promise<string>;
}

export interface ProfilePhotoStorageConfiguration {
  url: string | undefined;
  apiKey: string | undefined;
  bucket: string | undefined;
}

export class SupabaseProfilePhotoStorage implements ProfilePhotoStorage {
  constructor(private readonly configuration: ProfilePhotoStorageConfiguration) {}

  async upload(userId: string, file: ProfilePhotoFile): Promise<string> {
    const { url, apiKey, bucket } = this.configuration;
    if (!url || !apiKey || !bucket) {
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
        ...supabaseStorageAuthHeaders(apiKey),
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

    const publicUrl = new URL(
      `/storage/v1/object/public/${encodeURIComponent(bucket)}/${objectPath}`,
      url,
    );
    // The object is intentionally upserted at a stable path per user. Persist a
    // fresh URL version so browsers and CDNs cannot reuse the previous image.
    publicUrl.searchParams.set("v", randomUUID());
    return publicUrl.toString();
  }
}
