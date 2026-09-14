-- Rules that Prisma Schema cannot represent as native model attributes.

ALTER TABLE "membership_price"
ADD CONSTRAINT "membership_price_amount_positive"
CHECK ("amount" > 0);

ALTER TABLE "payment"
ADD CONSTRAINT "payment_amount_positive"
CHECK ("amount" > 0),
ADD CONSTRAINT "payment_expiration_thirty_days"
CHECK ("expires_at" = "accredited_at" + INTERVAL '30 days'),
ADD CONSTRAINT "payment_void_data_consistent"
CHECK (
  (
    "status" = 'ACCREDITED'
    AND "voided_by_id" IS NULL
    AND "voided_at" IS NULL
    AND "void_reason" IS NULL
  )
  OR
  (
    "status" = 'VOIDED'
    AND "voided_by_id" IS NOT NULL
    AND "voided_at" IS NOT NULL
    AND NULLIF(BTRIM("void_reason"), '') IS NOT NULL
  )
);

ALTER TABLE "medical_certificate"
ADD CONSTRAINT "medical_certificate_review_consistent"
CHECK (
  (
    "status" = 'PENDING'
    AND "reviewed_by_id" IS NULL
    AND "reviewed_at" IS NULL
    AND "review_comment" IS NULL
  )
  OR
  (
    "status" = 'APPROVED'
    AND "reviewed_by_id" IS NOT NULL
    AND "reviewed_at" IS NOT NULL
  )
  OR
  (
    "status" = 'REJECTED'
    AND "reviewed_by_id" IS NOT NULL
    AND "reviewed_at" IS NOT NULL
    AND NULLIF(BTRIM("review_comment"), '') IS NOT NULL
  )
);

ALTER TABLE "access_log"
ADD CONSTRAINT "access_log_result_consistent"
CHECK (
  ("result" = 'ALLOWED' AND "denial_reason" IS NULL)
  OR ("result" = 'DENIED' AND "denial_reason" IS NOT NULL)
),
ADD CONSTRAINT "access_log_location_consistent"
CHECK (
  ("branch_id" IS NOT NULL AND "access_point_id" IS NOT NULL)
  OR "denial_reason" = 'INVALID_QR'
);
