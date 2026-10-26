import {
  RecoveryEmailService,
  type RecoveryMailTransportFactory,
} from "../../src/service/recovery-email-service.js";
import type { SendMailOptions } from "nodemailer";
import nodemailer from "nodemailer";

describe("recovery email transport", () => {
  const originalEnvironment = { ...process.env };
  const logSpies: jest.SpyInstance[] = [];
  beforeEach(() => {
    for (const method of ["log", "info", "warn", "error", "debug", "trace"] as const) {
      logSpies.push(jest.spyOn(console, method).mockImplementation(() => undefined));
    }
  });
  afterEach(() => {
    process.env = { ...originalEnvironment };
    jest.restoreAllMocks();
    logSpies.length = 0;
  });

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
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
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
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined);
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
    expect(consoleError).toHaveBeenCalledWith("Password recovery email delivery failed", {
      code: undefined, responseCode: undefined, command: undefined,
    });
  });

  test("missing configuration fails without a network request", async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    const createTransport = jest.fn();
    await expect(new RecoveryEmailService(undefined, undefined, createTransport)
      .send("recipient@example.com", "link")).rejects.toMatchObject({ statusCode: 503 });
    expect(createTransport).not.toHaveBeenCalled();
  });

  test.each([
    [undefined, "app-password"],
    ["sender@example.com", undefined],
  ])("rejects incomplete SMTP configuration case %#", async (user, appPassword) => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    const createTransport = jest.fn();
    await expect(new RecoveryEmailService(user, appPassword, createTransport).send("recipient@example.com", "link"))
      .rejects.toMatchObject({ statusCode: 503 });
    expect(createTransport).not.toHaveBeenCalled();
  });

  test("uses the default Gmail transport without opening a network connection", async () => {
    const sendMail = jest.fn().mockResolvedValue(undefined);
    const createTransport = jest.spyOn(nodemailer, "createTransport")
      .mockReturnValue({ sendMail } as unknown as ReturnType<typeof nodemailer.createTransport>);
    await new RecoveryEmailService("sender@example.com", "app-password").send("recipient@example.com", "link");
    expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
    }));
    expect(sendMail).toHaveBeenCalledTimes(1);
  });

  test("logs only SMTP metadata when the provider includes private details", async () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const createTransport: RecoveryMailTransportFactory = () => ({
      sendMail: async () => {
        throw Object.assign(new Error("private provider details"), {
          code: "EAUTH", responseCode: 535, command: "AUTH", response: "private provider response",
        });
      },
    });
    await expect(new RecoveryEmailService("sender@example.com", "app-password", createTransport)
      .send("recipient@example.com", "link")).rejects.toMatchObject({ statusCode: 503 });
    expect(consoleError).toHaveBeenCalledWith("Password recovery email delivery failed", {
      code: "EAUTH", responseCode: 535, command: "AUTH",
    });
  });
  test.each(["development", "test", "staging", "production"])(
    "never logs recovery secrets and always rejects failed delivery in %s",
    async appEnvironment => {
      process.env.APP_ENV = appEnvironment;
      // A leftover deployment variable must never enable the removed fallback.
      process.env.PASSWORD_RECOVERY_LOG_TEST_EMAIL = "recovery-test@example.com";
      const recipient = "recovery-test@example.com";
      const token = "private-single-use-token";
      const link = `https://frontend.example/reset#token=${token}`;
      const password = "private-app-password";
      const sendMail = jest.fn().mockResolvedValue(undefined);
      const createTransport: RecoveryMailTransportFactory = () => ({ sendMail });
      const service = new RecoveryEmailService("sender@example.com", password, createTransport);

      await expect(service.send(recipient, link)).resolves.toBeUndefined();
      expect(logSpies.every(spy => spy.mock.calls.length === 0)).toBe(true);
      sendMail.mockRejectedValue(Object.assign(new Error(`${recipient} ${link} ${password}`), {
        code: "EAUTH", command: "AUTH", responseCode: 535,
        response: `${recipient} ${token} ${password}`,
      }));
      await expect(service.send(recipient, link)).rejects.toMatchObject({ statusCode: 503, code: "SERVICE_UNAVAILABLE" });
      const unconfiguredService = new RecoveryEmailService(undefined, undefined, jest.fn());
      await expect(unconfiguredService.send(recipient, link)).rejects.toMatchObject({ statusCode: 503 });
      const loggedOutput = JSON.stringify(logSpies.flatMap(spy => spy.mock.calls));
      for (const secret of [recipient, link, token, password]) {
        expect(loggedOutput.includes(secret)).toBe(false);
      }
    },
  );

  test.each([null, undefined, "private-error", {
    code: "private-token", command: "AUTH private-password", responseCode: "private-recipient",
  }])("rejects malformed provider errors without leaking them, case %#", async providerError => {
    const createTransport: RecoveryMailTransportFactory = () => ({ sendMail: async () => { throw providerError; } });
    await expect(new RecoveryEmailService("sender@example.com", "app-password", createTransport)
      .send("recipient@example.com", "link")).rejects.toMatchObject({ statusCode: 503 });
    expect(console.error).toHaveBeenCalledWith("Password recovery email delivery failed", {
      code: undefined, responseCode: undefined, command: undefined,
    });
  });
});
