import express from "express";
import request from "supertest";

import { errorMiddleware } from "../../src/middleware/error-middleware.js";
import {
  MAX_PROFILE_PHOTO_SIZE_BYTES,
  uploadProfilePhoto,
} from "../../src/middleware/profile-photo-upload-middleware.js";

function setup() {
  const controller = jest.fn((req, res) =>
    res.status(200).json({ mimeType: req.file?.mimetype }),
  );
  const app = express();
  app.put("/photo", uploadProfilePhoto, controller);
  app.use(errorMiddleware);
  return { app, controller };
}

describe("uploadProfilePhoto", () => {
  test.each([
    ["image/jpeg", "photo.jpg", Buffer.from([0xff, 0xd8, 0xff, 0x00])],
    ["image/png", "photo.png", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
  ])("accepts %s", async (mimeType, filename, contents) => {
    const { app, controller } = setup();

    const response = await request(app)
      .put("/photo")
      .attach("file", contents, { filename, contentType: mimeType });

    expect(response.status).toBe(200);
    expect(response.body.mimeType).toBe(mimeType);
    expect(controller).toHaveBeenCalledTimes(1);
  });

  test("rejects unsupported formats", async () => {
    const { app, controller } = setup();

    const response = await request(app)
      .put("/photo")
      .attach("file", Buffer.from("photo"), {
        filename: "photo.gif",
        contentType: "image/gif",
      });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
    expect(controller).not.toHaveBeenCalled();
  });

  test("rejects files larger than 5 MB", async () => {
    const { app, controller } = setup();

    const response = await request(app)
      .put("/photo")
      .attach("file", Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        Buffer.alloc(MAX_PROFILE_PHOTO_SIZE_BYTES),
      ]), {
        filename: "photo.png",
        contentType: "image/png",
      });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
    expect(controller).not.toHaveBeenCalled();
  });

  test("rejects a spoofed MIME type", async () => {
    const { app, controller } = setup();

    const response = await request(app)
      .put("/photo")
      .attach("file", Buffer.from("not-a-real-png"), {
        filename: "photo.png",
        contentType: "image/png",
      });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
    expect(controller).not.toHaveBeenCalled();
  });
});
