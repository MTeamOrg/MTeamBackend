ALTER TABLE "payment"
ADD COLUMN "idempotency_key" UUID;

CREATE UNIQUE INDEX "payment_idempotency_key_key"
ON "payment"("idempotency_key");
