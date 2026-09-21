import {
  DuplicateUserError,
  type OwnProfile,
  type OwnProfileRepositoryPort,
  type UpdateOwnProfileData,
} from "../../src/repository/user-repository.js";
import { UserService } from "../../src/service/user-service.js";
import type { ProfilePhotoStorage } from "../../src/service/profile-photo-storage.js";

const memberProfile: OwnProfile = {
  id: "83cd902e-0475-4c92-943c-129b751dacee",
  firstName: "Lara",
  lastName: "Frenkel",
  documentNumber: "12345678",
  birthDate: new Date("2000-05-20T00:00:00.000Z"),
  email: "lara@example.com",
  phone: "1122334455",
  photoUrl: null,
  role: "MEMBER",
  status: "ACTIVE",
  isPasswordChangeRequired: false,
  memberProfile: {
    emergencyContactName: "Contacto",
    emergencyContactPhone: "1199999999",
  },
  trainerProfile: null,
};

class FakeOwnProfileRepository implements OwnProfileRepositoryPort {
  profile: OwnProfile | null = memberProfile;
  emailOwnerId: string | null = null;
  updateError: Error | null = null;
  updatedData: UpdateOwnProfileData | null = null;

  async findOwnProfileById(): Promise<OwnProfile | null> {
    return this.profile;
  }

  async findEmailOwnerId(): Promise<string | null> {
    return this.emailOwnerId;
  }

  async updateOwnProfile(
    _id: string,
    _role: "MEMBER" | "TRAINER" | "ADMIN",
    data: UpdateOwnProfileData,
  ): Promise<OwnProfile> {
    if (this.updateError) throw this.updateError;
    this.updatedData = data;
    return { ...memberProfile, ...data };
  }

  async updateOwnPhoto(_id: string, photoUrl: string): Promise<OwnProfile> {
    return { ...memberProfile, photoUrl };
  }
}

const profilePhotoStorage: ProfilePhotoStorage = {
  upload: jest.fn().mockResolvedValue("https://storage.example/profile-photo/user"),
};

function createService(repository = new FakeOwnProfileRepository()): UserService {
  return new UserService(repository, profilePhotoStorage);
}

describe("UserService own profile", () => {
  test("returns a safe identity without role-specific profiles", async () => {
    const service = createService();

    await expect(service.getCurrentIdentity(memberProfile.id)).resolves.toEqual(
      expect.not.objectContaining({ memberProfile: expect.anything(), trainerProfile: expect.anything() }),
    );
  });

  test("returns 404 when the authenticated user disappears", async () => {
    const repository = new FakeOwnProfileRepository();
    repository.profile = null;

    await expect(createService(repository).getOwnProfile(memberProfile.id)).rejects.toMatchObject({
      statusCode: 404,
      code: "NOT_FOUND",
    });
  });

  test("normalizes allowed member contact fields", async () => {
    const repository = new FakeOwnProfileRepository();
    const service = createService(repository);

    await service.updateOwnProfile(
      { id: memberProfile.id, role: "MEMBER" },
      { email: " NEW@EXAMPLE.COM ", phone: " 1100000000 ", emergencyContactName: " Familiar " },
    );

    expect(repository.updatedData).toEqual({
      email: "new@example.com",
      phone: "1100000000",
      emergencyContactName: "Familiar",
    });
  });

  test("rejects another user's email before updating", async () => {
    const repository = new FakeOwnProfileRepository();
    repository.emailOwnerId = "694891d5-df1c-4a29-89ae-4ef2625d7ea0";

    await expect(
      createService(repository).updateOwnProfile(
        { id: memberProfile.id, role: "MEMBER" },
        { email: "used@example.com" },
      ),
    ).rejects.toMatchObject({ statusCode: 409, code: "CONFLICT" });
  });

  test("converts a concurrent duplicate email into the same conflict", async () => {
    const repository = new FakeOwnProfileRepository();
    repository.updateError = new DuplicateUserError("email");

    await expect(
      createService(repository).updateOwnProfile(
        { id: memberProfile.id, role: "MEMBER" },
        { email: "used@example.com" },
      ),
    ).rejects.toMatchObject({ statusCode: 409, code: "CONFLICT" });
  });

  test("does not allow non-members to change emergency contact data", async () => {
    const repository = new FakeOwnProfileRepository();

    await expect(
      createService(repository).updateOwnProfile(
        { id: memberProfile.id, role: "TRAINER" },
        { emergencyContactPhone: "1188888888" },
      ),
    ).rejects.toMatchObject({ statusCode: 400, code: "VALIDATION_ERROR" });
    expect(repository.updatedData).toBeNull();
  });

  test("uploads a profile photo and persists only its URL", async () => {
    const repository = new FakeOwnProfileRepository();
    const storage: jest.Mocked<ProfilePhotoStorage> = {
      upload: jest.fn().mockResolvedValue("https://storage.example/profile-photo/user"),
    };
    const service = new UserService(repository, storage);
    const file = { buffer: Buffer.from("photo"), mimeType: "image/png" };

    const result = await service.updateOwnPhoto(memberProfile.id, file);

    expect(storage.upload).toHaveBeenCalledWith(memberProfile.id, file);
    expect(result.photoUrl).toBe("https://storage.example/profile-photo/user");
  });
});
