import { createHash, randomBytes } from "node:crypto";
import { ApplicationError } from "../error/application-error.js";
import { ERROR_CODE } from "../error/error-code.js";
import { fingerprintPassword, type AccountRecoveryRepositoryPort } from "../repository/account-recovery-repository.js";
import type { PasswordHasher, PasswordComparer } from "./password-service.js";
import type { RecoveryEmailSender } from "./recovery-email-service.js";

const TOKEN_LIFETIME_MS = 30 * 60 * 1000;
const hashToken = (token: string): string => createHash("sha256").update(token).digest("hex");
export const RECOVERY_MESSAGE = "Si el correo corresponde a una cuenta activa, recibirás un enlace para restablecer tu contraseña. Revisá también el correo no deseado.";

export class AccountRecoveryService {
  constructor(
    private readonly repository: AccountRecoveryRepositoryPort,
    private readonly passwords: PasswordHasher & PasswordComparer,
    private readonly mail: RecoveryEmailSender,
    private readonly frontendUrl: string | undefined,
  ) {}

  async request(email: string): Promise<void> {
    if (!this.frontendUrl) throw new ApplicationError(503, ERROR_CODE.SERVICE_UNAVAILABLE, "La recuperación no está disponible. Intentá más tarde.");
    const token = randomBytes(32).toString("hex");
    const tokenHash = hashToken(token);
    const user = await this.repository.findUser(email);
    if (user) await this.repository.createToken({ tokenHash, userId: user.id,
      passwordFingerprint: fingerprintPassword(user.passwordHash), expiresAt: new Date(Date.now() + TOKEN_LIFETIME_MS) });
    const link = new URL("/restablecer-contrasena", this.frontendUrl);
    // Fragment stays out of HTTP request URLs and Referer headers.
    link.hash = new URLSearchParams({ token }).toString();
    try {
      // Send the same mail for unknown/inactive addresses, with an unusable random link.
      // Provider failures therefore never disclose whether an account exists.
      await this.mail.send(email, link.toString());
    } catch (error) {
      if (user) await this.repository.deleteToken(tokenHash);
      throw error;
    }
  }

  async complete(token: string, newPassword: string): Promise<void> {
    const stored = await this.repository.findToken(hashToken(token));
    if (!stored) throw new ApplicationError(400, ERROR_CODE.INVALID_RECOVERY_TOKEN, "El enlace es inválido o ya fue utilizado. Solicitá uno nuevo.");
    if (stored.expiresAt.getTime() <= Date.now()) throw new ApplicationError(400, ERROR_CODE.EXPIRED_RECOVERY_TOKEN, "El enlace venció. Solicitá uno nuevo.");
    const currentHash = await this.repository.findPassword(stored.userId);
    if (!currentHash || fingerprintPassword(currentHash) !== stored.passwordFingerprint) {
      throw new ApplicationError(400, ERROR_CODE.INVALID_RECOVERY_TOKEN, "El enlace es inválido o ya fue utilizado. Solicitá uno nuevo.");
    }
    if (await this.passwords.compare(newPassword, currentHash)) {
      throw new ApplicationError(400, ERROR_CODE.PASSWORD_REUSE, "La contraseña nueva debe ser diferente de la actual.");
    }
    const passwordHash = await this.passwords.hash(newPassword);
    if (!await this.repository.consumeToken(stored, passwordHash, new Date())) {
      throw new ApplicationError(400, ERROR_CODE.INVALID_RECOVERY_TOKEN, "El enlace es inválido o ya fue utilizado. Solicitá uno nuevo.");
    }
  }
}
