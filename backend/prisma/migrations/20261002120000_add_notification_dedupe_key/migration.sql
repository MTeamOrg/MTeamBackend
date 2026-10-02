-- Add a stable key so retried domain operations cannot create duplicate notices.
ALTER TABLE "notification" ADD COLUMN "dedupe_key" VARCHAR(255);

CREATE UNIQUE INDEX "notification_dedupe_key_key" ON "notification"("dedupe_key");
