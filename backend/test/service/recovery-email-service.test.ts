import { RecoveryEmailService } from "../../src/service/recovery-email-service.js";

describe("recovery email transport", () => {
  afterEach(() => jest.restoreAllMocks());
  test("uses Resend HTTP API with a text link, no password", async () => {
    const fetchMock = jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ id: "message-id" }), { status: 200 }));
    await new RecoveryEmailService("test-key", "M-Team <sender@example.com>").send("recipient@example.com", "http://localhost:5173/restablecer-contrasena#token=test");
    expect(fetchMock).toHaveBeenCalledWith("https://api.resend.com/emails", expect.objectContaining({ method: "POST" }));
    const body = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string);
    expect(body.text).toContain("#token=test");
    expect(body).not.toHaveProperty("password");
  });
  test.each([429, 500])("provider status %s yields a safe recoverable error", async status => {
    jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response("private-provider-details", { status }));
    await expect(new RecoveryEmailService("secret-key", "sender@example.com").send("recipient@example.com", "link")).rejects.toMatchObject({ statusCode: 503, code: "SERVICE_UNAVAILABLE" });
  });
  test("network failure never exposes the original error", async () => {
    jest.spyOn(globalThis, "fetch").mockRejectedValue(new Error("secret-key and token"));
    await expect(new RecoveryEmailService("secret-key", "sender@example.com").send("recipient@example.com", "link")).rejects.toThrow("No pudimos enviar el correo");
  });
  test.each([
    [undefined, undefined],
    [undefined, "sender@example.com"],
    ["secret-key", undefined],
  ])("missing configuration case %# fails without a network request", async (apiKey, from) => {
    const fetchMock = jest.spyOn(globalThis, "fetch");
    await expect(new RecoveryEmailService(apiKey, from).send("recipient@example.com", "link")).rejects.toMatchObject({ statusCode: 503 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  test.each([{}, { id: "" }, { id: 123 }, null])("rejects an invalid successful receipt: %j", async receipt => {
    jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(receipt), { status: 200 }));
    await expect(new RecoveryEmailService("secret-key", "sender@example.com").send("recipient@example.com", "link"))
      .rejects.toMatchObject({ statusCode: 503, code: "SERVICE_UNAVAILABLE" });
  });
  test("rejects a successful response containing malformed JSON", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response("invalid-json", { status: 200 }));
    await expect(new RecoveryEmailService("secret-key", "sender@example.com").send("recipient@example.com", "link"))
      .rejects.toMatchObject({ statusCode: 503, code: "SERVICE_UNAVAILABLE" });
  });
});
