import type { RequestHandler } from "express";
import multer from "multer";

import { ApplicationError } from "../error/application-error.js";
import { ERROR_CODE } from "../error/error-code.js";

export const MAX_MEDICAL_CERTIFICATE_SIZE_BYTES = 10 * 1024 * 1024;
export const ALLOWED_MEDICAL_CERTIFICATE_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
] as const;

const allowedTypes = new Set<string>(ALLOWED_MEDICAL_CERTIFICATE_TYPES);

function hasValidSignature(file: Express.Multer.File): boolean {
  if (file.mimetype === "application/pdf") {
    return file.buffer.subarray(0, 5).equals(Buffer.from("%PDF-"));
  }
  if (file.mimetype === "image/jpeg") {
    return file.buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
  }
  return file.buffer.subarray(0, 8).equals(
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  );
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_MEDICAL_CERTIFICATE_SIZE_BYTES, files: 1 },
  fileFilter: (_request, file, callback) => {
    if (!allowedTypes.has(file.mimetype)) {
      callback(new Error("UNSUPPORTED_MEDICAL_CERTIFICATE_TYPE"));
      return;
    }
    callback(null, true);
  },
}).single("file");

export const uploadMedicalCertificate: RequestHandler = (request, response, next) => {
  upload(request, response, (error) => {
    if (error) {
      next(new ApplicationError(
        400,
        ERROR_CODE.VALIDATION_ERROR,
        "El apto médico debe ser PDF, JPG o PNG y no superar los 10 MB",
      ));
      return;
    }
    if (request.file && !hasValidSignature(request.file)) {
      next(new ApplicationError(
        400,
        ERROR_CODE.VALIDATION_ERROR,
        "El contenido del archivo no corresponde al formato declarado",
      ));
      return;
    }
    next();
  });
};
