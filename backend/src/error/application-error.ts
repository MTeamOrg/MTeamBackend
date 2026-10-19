import type { ErrorCode } from "./error-code.js";

export class ApplicationError extends Error {
  readonly #code: ErrorCode;
  readonly #details: unknown;
  readonly #statusCode: number;

  constructor(
    statusCode: number,
    code: ErrorCode,
    message: string,
    details: unknown = null,
  ) {
    super(message);
    this.name = "ApplicationError";
    this.#statusCode = statusCode;
    this.#code = code;
    this.#details = details;
  }

  get code(): ErrorCode {
    return this.#code;
  }

  get details(): unknown {
    return this.#details;
  }

  get statusCode(): number {
    return this.#statusCode;
  }
}
