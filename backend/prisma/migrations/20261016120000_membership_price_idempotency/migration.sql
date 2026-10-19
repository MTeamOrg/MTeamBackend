ALTER TABLE "membership_price"
ADD COLUMN "idempotency_key" UUID;

CREATE UNIQUE INDEX "membership_price_idempotency_key_key"
ON "membership_price"("idempotency_key");
