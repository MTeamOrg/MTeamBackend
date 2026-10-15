import { ApplicationError } from "../error/application-error.js";
import { ERROR_CODE } from "../error/error-code.js";

export interface RecoveryEmailSender {
  send(email: string, link: string): Promise<void>;
}

export class RecoveryEmailService implements RecoveryEmailSender {
  constructor(private readonly apiKey: string | undefined, private readonly from: string | undefined) {}

  async send(email: string, link: string): Promise<void> {
    try {
      if (!this.apiKey || !this.from) throw new Error();
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: this.from, to: [email], subject: "Recuperá tu acceso a M-Team",
          text: `Si tenés una cuenta activa en M-Team, usá este enlace para elegir una nueva contraseña. Vence en 30 minutos y se puede usar una sola vez.\n\n${link}\n\nSi no solicitaste este correo, ignoralo.`,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error();
      const receipt = await response.json() as { id?: unknown };
      if (typeof receipt.id !== "string" || !receipt.id) throw new Error();
    } catch {
      // Never propagate provider responses, recipient addresses or credentials to logs.
      throw new ApplicationError(503, ERROR_CODE.SERVICE_UNAVAILABLE,
        "No pudimos enviar el correo. Intentá nuevamente más tarde.");
    }
  }
}
