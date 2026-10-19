import type { RequestHandler } from "express";
import multer from "multer";

import { ApplicationError } from "../error/application-error.js";
import { ERROR_CODE } from "../error/error-code.js";

export const MAX_PROFILE_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_PROFILE_PHOTO_TYPES = new Set(["image/jpeg", "image/png"]);

function hasValidSignature(file: Express.Multer.File): boolean {
  if (file.mimetype === "image/jpeg") {
    return file.buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
  }
  return file.buffer
    .subarray(0, 8)
    .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PROFILE_PHOTO_SIZE_BYTES, files: 1 },
  fileFilter: (_request, file, callback) => {
    if (!ALLOWED_PROFILE_PHOTO_TYPES.has(file.mimetype)) {
      callback(new Error("UNSUPPORTED_PROFILE_PHOTO_TYPE"));
      return;
    }
    callback(null, true);
  },
}).single("file");

export const uploadProfilePhoto: RequestHandler = (request, response, next) => {
  upload(request, response, (error) => {
    if (error) {
      next(
        new ApplicationError(
          400,
          ERROR_CODE.VALIDATION_ERROR,
          "La fotografía debe ser JPG o PNG y no superar los 5 MB",
        ),
      );
      return;
    }
    if (request.file && !hasValidSignature(request.file)) {
      next(
        new ApplicationError(
          400,
          ERROR_CODE.VALIDATION_ERROR,
          "El contenido del archivo no corresponde a una fotografía JPG o PNG",
        ),
      );
      return;
    }
    next();
  });
};
