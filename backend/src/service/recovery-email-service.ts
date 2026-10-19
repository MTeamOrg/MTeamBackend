import { ApplicationError } from "../error/application-error.js";
import { ERROR_CODE } from "../error/error-code.js";
import nodemailer, { type SendMailOptions } from "nodemailer";

export interface RecoveryEmailSender {
  send(email: string, link: string): Promise<void>;
}

type GmailTransportOptions = {
  service: "gmail";
  auth: { user: string; pass: string };
  connectionTimeout: number;
  greetingTimeout: number;
  socketTimeout: number;
};

type RecoveryMailTransport = {
  sendMail(options: SendMailOptions): Promise<unknown>;
};

export type RecoveryMailTransportFactory = (
  options: GmailTransportOptions,
) => RecoveryMailTransport;

export interface RecoveryLinkLogOptions {
  appEnvironment: "development" | "test" | "staging" | "production";
  testAccountEmail?: string | undefined;
  logRecoveryLink?: (link: string) => void;
}

const logStagingRecoveryLink = (link: string) => {
  console.warn("Staging password recovery link for the allowlisted test account", {
    expiresInMinutes: 30,
    link,
  });
};

export class RecoveryEmailService implements RecoveryEmailSender {
  private readonly transport: RecoveryMailTransport | undefined;
  private readonly senderAddress: string | undefined;

  constructor(
    user: string | undefined,
    appPassword: string | undefined,
    private readonly createTransport: RecoveryMailTransportFactory = options =>
      nodemailer.createTransport(options),
    private readonly recoveryLinkLogOptions: RecoveryLinkLogOptions = { appEnvironment: "development" },
  ) {
    this.senderAddress = user;
    if (user && appPassword) {
      this.transport = this.createTransport({
        service: "gmail",
        auth: { user, pass: appPassword.replace(/\s/g, "") },
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 10_000,
      });
    }
  }

  async send(email: string, link: string): Promise<void> {
    const canLogRecoveryLink = this.canLogRecoveryLink(email);
    if (canLogRecoveryLink) this.logRecoveryLink(link);
    try {
      if (!this.transport || !this.senderAddress) throw new Error();
      await this.transport.sendMail({
        from: { name: "M-Team", address: this.senderAddress },
        to: email,
        subject: "Recuperá tu acceso a M-Team",
        text: `Si tenés una cuenta activa en M-Team, usá este enlace para elegir una nueva contraseña. Vence en 30 minutos y se puede usar una sola vez.\n\n${link}\n\nSi no solicitaste este correo, ignoralo.`,
      });
    } catch (error) {
      const providerError = error as {
        code?: unknown;
        responseCode?: unknown;
        command?: unknown;
      };
      // Log only non-sensitive SMTP metadata here. The recovery link is logged separately
      // only when the staging environment and exact test-account allowlist both match.
      console.error("Password recovery email delivery failed", {
        code: typeof providerError.code === "string" ? providerError.code : undefined,
        responseCode: typeof providerError.responseCode === "number"
          ? providerError.responseCode
          : undefined,
        command: typeof providerError.command === "string" ? providerError.command : undefined,
      });
      if (canLogRecoveryLink) return;
      // Never propagate provider responses, recipient addresses or credentials to logs.
      throw new ApplicationError(503, ERROR_CODE.SERVICE_UNAVAILABLE,
        "No pudimos enviar el correo. Intentá nuevamente más tarde.");
    }
  }

  private canLogRecoveryLink(email: string): boolean {
    const allowedEmail = this.recoveryLinkLogOptions.testAccountEmail?.trim().toLowerCase();
    return this.recoveryLinkLogOptions.appEnvironment === "staging"
      && Boolean(allowedEmail)
      && email.trim().toLowerCase() === allowedEmail;
  }

  private logRecoveryLink(link: string): void {
    (this.recoveryLinkLogOptions.logRecoveryLink ?? logStagingRecoveryLink)(link);
  }
}
