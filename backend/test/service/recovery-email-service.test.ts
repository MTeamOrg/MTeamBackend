import {
  RecoveryEmailService,
  type RecoveryMailTransportFactory,
} from "../../src/service/recovery-email-service.js";
import type { SendMailOptions } from "nodemailer";

describe("recovery email transport", () => {
  test("sends the recovery link through Gmail without including a password", async () => {
    const transportOptions: unknown[] = [];
    const sentMessages: SendMailOptions[] = [];
    const createTransport: RecoveryMailTransportFactory = options => {
      transportOptions.push(options);
      return {
        sendMail: async message => { sentMessages.push(message); },
      };
    };

    await new RecoveryEmailService(
      "mteam.test@gmail.com",
      "abcd efgh ijkl mnop",
      createTransport,
    ).send("recipient@example.com", "http://localhost:5173/restablecer-contrasena#token=test");

    expect(transportOptions).toEqual([{
      service: "gmail",
      auth: { user: "mteam.test@gmail.com", pass: "abcdefghijklmnop" },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 10_000,
    }]);
    expect(sentMessages).toHaveLength(1);
    expect(sentMessages[0]).toMatchObject({
      from: { name: "M-Team", address: "mteam.test@gmail.com" },
      to: "recipient@example.com",
      subject: "Recuperá tu acceso a M-Team",
      text: expect.stringContaining("#token=test"),
    });
    expect(sentMessages[0]).not.toHaveProperty("password");
  });
  test("SMTP failures yield a safe recoverable error", async () => {
    const createTransport: RecoveryMailTransportFactory = () => ({
      sendMail: async () => { throw new Error("private SMTP credentials and token"); },
    });

    await expect(new RecoveryEmailService(
      "mteam.test@gmail.com",
      "application-password",
      createTransport,
    ).send("recipient@example.com", "link")).rejects.toMatchObject({
      statusCode: 503,
      code: "SERVICE_UNAVAILABLE",
      message: "No pudimos enviar el correo. Intentá nuevamente más tarde.",
    });
  });

  test("logs the recovery link alongside email only for the allowlisted staging test account", async () => {
    const loggedLinks: string[] = [];
    const sentMessages: SendMailOptions[] = [];
    const createTransport: RecoveryMailTransportFactory = () => ({
      sendMail: async message => { sentMessages.push(message); },
    });
    const service = new RecoveryEmailService(
      "sender@example.com",
      "app-password",
      createTransport,
      {
        appEnvironment: "staging",
        testAccountEmail: "recovery-test@example.com",
        logRecoveryLink: link => loggedLinks.push(link),
      },
    );

    await service.send("RECOVERY-TEST@example.com", "https://frontend.example/reset#token=single-use");

    expect(sentMessages).toHaveLength(1);
    expect(loggedLinks).toEqual(["https://frontend.example/reset#token=single-use"]);
  });

  test("uses the allowlisted staging log as fallback when SMTP fails", async () => {
    const loggedLinks: string[] = [];
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const createTransport: RecoveryMailTransportFactory = () => ({
      sendMail: async () => { throw Object.assign(new Error("SMTP unavailable"), { code: "ETIMEDOUT" }); },
    });
    const service = new RecoveryEmailService(
      "sender@example.com",
      "app-password",
      createTransport,
      {
        appEnvironment: "staging",
        testAccountEmail: "recovery-test@example.com",
        logRecoveryLink: link => loggedLinks.push(link),
      },
    );

    try {
      await expect(service.send("recovery-test@example.com", "https://frontend.example/reset#token=fallback"))
        .resolves.toBeUndefined();
      expect(loggedLinks).toEqual(["https://frontend.example/reset#token=fallback"]);
    } finally {
      consoleError.mockRestore();
    }
  });

  test("never logs recovery links in production or for another staging recipient", async () => {
    const loggedLinks: string[] = [];
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const createTransport: RecoveryMailTransportFactory = () => ({
      sendMail: async () => { throw new Error("SMTP unavailable"); },
    });
    const productionService = new RecoveryEmailService(
      "sender@example.com",
      "app-password",
      createTransport,
      {
        appEnvironment: "production",
        testAccountEmail: "recovery-test@example.com",
        logRecoveryLink: link => loggedLinks.push(link),
      },
    );
    const otherStagingRecipientService = new RecoveryEmailService(
      "sender@example.com",
      "app-password",
      createTransport,
      {
        appEnvironment: "staging",
        testAccountEmail: "recovery-test@example.com",
        logRecoveryLink: link => loggedLinks.push(link),
      },
    );

    try {
      await expect(productionService.send("recovery-test@example.com", "production-secret"))
        .rejects.toMatchObject({ statusCode: 503 });
      await expect(otherStagingRecipientService.send("member@example.com", "member-secret"))
        .rejects.toMatchObject({ statusCode: 503 });
      expect(loggedLinks).toEqual([]);
    } finally {
      consoleError.mockRestore();
    }
  });

  test("missing configuration fails without a network request", async () => {
    const createTransport = jest.fn();
    await expect(new RecoveryEmailService(undefined, undefined, createTransport)
      .send("recipient@example.com", "link")).rejects.toMatchObject({ statusCode: 503 });
    expect(createTransport).not.toHaveBeenCalled();
  });
});
