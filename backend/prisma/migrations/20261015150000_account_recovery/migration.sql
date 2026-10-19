CREATE TABLE "password_recovery_token" (
  "token_hash" VARCHAR(64) NOT NULL,
  "user_id" UUID NOT NULL,
  "password_fingerprint" VARCHAR(64) NOT NULL,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "password_recovery_token_pkey" PRIMARY KEY ("token_hash"),
  CONSTRAINT "password_recovery_token_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "password_recovery_token_user_id_idx" ON "password_recovery_token"("user_id");
CREATE INDEX "password_recovery_token_expires_at_idx" ON "password_recovery_token"("expires_at");
