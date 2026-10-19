import { SupabaseProfilePhotoStorage } from "../../src/service/profile-photo-storage.js";

const userId = "83cd902e-0475-4c92-943c-129b751dacee";

describe("SupabaseProfilePhotoStorage", () => {
  afterEach(() => jest.restoreAllMocks());

  test("uploads with service credentials and returns the public object URL", async () => {
    const fetchMock = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 200 }));
    const storage = new SupabaseProfilePhotoStorage({
      url: "https://project.supabase.co",
      apiKey: "test-service-role-key",
      bucket: "profile-photos",
    });

    const result = await storage.upload(userId, {
      buffer: Buffer.from("photo"),
      mimeType: "image/png",
    });

    expect(result).toBe(
      `https://project.supabase.co/storage/v1/object/public/profile-photos/profile-photo/${userId}`,
    );
    expect(fetchMock).toHaveBeenCalledWith(
      new URL(
        `https://project.supabase.co/storage/v1/object/profile-photos/profile-photo/${userId}`,
      ),
      expect.objectContaining({ method: "POST" }),
    );
  });

  test("sends a new secret API key on apikey without a Bearer JWT header", async () => {
    const fetchMock = jest.spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 200 }));
    const storage = new SupabaseProfilePhotoStorage({
      url: "https://project.supabase.co",
      apiKey: "sb_secret_test",
      bucket: "profile-photos",
    });

    await storage.upload(userId, { buffer: Buffer.from("photo"), mimeType: "image/png" });

    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(headers.apikey).toBe("sb_secret_test");
    expect(headers).not.toHaveProperty("authorization");
  });

  test("fails clearly when storage is not configured", async () => {
    const storage = new SupabaseProfilePhotoStorage({
      url: undefined,
      apiKey: undefined,
      bucket: undefined,
    });

    await expect(
      storage.upload(userId, {
        buffer: Buffer.from("photo"),
        mimeType: "image/png",
      }),
    ).rejects.toMatchObject({
      statusCode: 503,
      code: "SERVICE_UNAVAILABLE",
    });
  });

  test("maps an upstream failure to a uniform storage error", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 500 }));
    const storage = new SupabaseProfilePhotoStorage({
      url: "https://project.supabase.co",
      apiKey: "test-service-role-key",
      bucket: "profile-photos",
    });

    await expect(
      storage.upload(userId, {
        buffer: Buffer.from("photo"),
        mimeType: "image/png",
      }),
    ).rejects.toMatchObject({ statusCode: 502, code: "STORAGE_ERROR" });
  });
});
