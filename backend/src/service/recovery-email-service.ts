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

const SMTP_ERROR_CODES = ["EAUTH", "ECONNECTION", "ETIMEDOUT", "ESOCKET", "EDNS", "EENVELOPE", "EMESSAGE"];
const SMTP_COMMANDS = ["CONN", "EHLO", "HELO", "STARTTLS", "AUTH", "MAIL FROM", "RCPT TO", "DATA", "QUIT"];

export class RecoveryEmailService implements RecoveryEmailSender {
  private readonly transport: RecoveryMailTransport | undefined;
  private readonly senderAddress: string | undefined;

  constructor(
    user: string | undefined,
    appPassword: string | undefined,
    private readonly createTransport: RecoveryMailTransportFactory = options =>
      nodemailer.createTransport(options),
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
    try {
      if (!this.transport || !this.senderAddress) throw new Error();
      await this.transport.sendMail({
        from: { name: "M-Team", address: this.senderAddress },
        to: email,
        subject: "Recuperá tu acceso a M-Team",
        text: `Si tenés una cuenta activa en M-Team, usá este enlace para elegir una nueva contraseña. Vence en 30 minutos y se puede usar una sola vez.\n\n${link}\n\nSi no solicitaste este correo, ignoralo.`,
      });
    } catch (error) {
      const providerError = (typeof error === "object" && error !== null ? error : {}) as {
        code?: unknown;
        responseCode?: unknown;
        command?: unknown;
      };
      // Only known SMTP metadata may reach logs; provider messages and payloads are private.
      console.error("Password recovery email delivery failed", {
        code: typeof providerError.code === "string" && SMTP_ERROR_CODES.includes(providerError.code)
          ? providerError.code : undefined,
        responseCode: typeof providerError.responseCode === "number"
          && Number.isInteger(providerError.responseCode)
          && providerError.responseCode >= 100 && providerError.responseCode <= 599
          ? providerError.responseCode
          : undefined,
        command: typeof providerError.command === "string" && SMTP_COMMANDS.includes(providerError.command)
          ? providerError.command : undefined,
      });
      // Never propagate provider responses, recipient addresses or credentials to logs.
      throw new ApplicationError(503, ERROR_CODE.SERVICE_UNAVAILABLE,
        "No pudimos enviar el correo. Intentá nuevamente más tarde.");
    }
  }
}
