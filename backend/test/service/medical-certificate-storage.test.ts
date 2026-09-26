import { ApplicationError } from "../../src/error/application-error.js";
import {
  normalizeMedicalCertificateObjectPath,
  SupabaseMedicalCertificateStorage,
} from "../../src/service/medical-certificate-storage.js";

describe("private medical certificate storage", () => {
  afterEach(() => jest.restoreAllMocks());

  test("uploads privately and creates expiring signed URLs", async () => {
    const fetchMock = jest.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(Response.json({
        signedURL: "/storage/v1/object/sign/private/member/file.pdf?token=x",
      }));
    const storage = new SupabaseMedicalCertificateStorage({
      url: "https://project.supabase.co", serviceRoleKey: "server-only", bucket: "private",
    });

    await storage.upload("private/member/file.pdf", { buffer: Buffer.from("pdf"), mimeType: "application/pdf" });
    await expect(storage.createSignedUrl("https://project.supabase.co/storage/v1/object/private/member/file.pdf"))
      .resolves.toBe("https://project.supabase.co/storage/v1/object/sign/private/member/file.pdf?token=x");
    expect(fetchMock).toHaveBeenNthCalledWith(1,
      new URL("https://project.supabase.co/storage/v1/object/private/member/file.pdf"),
      expect.objectContaining({ method: "POST", headers: expect.objectContaining({ authorization: "Bearer server-only" }) }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(2,
      "https://project.supabase.co/storage/v1/object/sign/private/member/file.pdf",
      expect.objectContaining({ body: JSON.stringify({ expiresIn: 300 }) }),
    );
  });

  test.each([
    ["member/file.pdf", "member/file.pdf"],
    ["private/member/file.pdf", "member/file.pdf"],
    ["/storage/v1/object/sign/private/member/file.pdf?token=x", "member/file.pdf"],
    ["https://project.supabase.co/storage/v1/object/private/member/file.pdf", "member/file.pdf"],
  ])("normalizes %s to a path relative to the bucket", (storedPath, expectedPath) => {
    expect(normalizeMedicalCertificateObjectPath(storedPath, "private")).toBe(expectedPath);
  });

  test("fails closed when private storage configuration is absent", async () => {
    const storage = new SupabaseMedicalCertificateStorage({ url: undefined, serviceRoleKey: undefined, bucket: undefined });
    await expect(storage.createSignedUrl("file.pdf"))
      .rejects.toEqual(expect.objectContaining<ApplicationError>({ statusCode: 503 }));
  });
});
