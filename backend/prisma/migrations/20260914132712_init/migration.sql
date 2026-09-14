-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('MEMBER', 'TRAINER', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('ACCREDITED', 'VOIDED');

-- CreateEnum
CREATE TYPE "MedicalCertificateStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AccessResult" AS ENUM ('ALLOWED', 'DENIED');

-- CreateEnum
CREATE TYPE "AccessDenialReason" AS ENUM ('INVALID_QR', 'INACTIVE_USER', 'INACTIVE_BRANCH', 'INACTIVE_ACCESS_POINT', 'EXPIRED_MEMBERSHIP', 'MEDICAL_CERTIFICATE_REQUIRED');

-- CreateEnum
CREATE TYPE "UserAuditAction" AS ENUM ('CREATED', 'UPDATED', 'ACTIVATED', 'DEACTIVATED', 'PASSWORD_RESET');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PublicationAudience" AS ENUM ('ALL', 'MEMBERS', 'TRAINERS');

-- CreateEnum
CREATE TYPE "PublicationStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('MEMBERSHIP_PRICE_CHANGED', 'MEMBERSHIP_EXPIRING', 'MEMBERSHIP_EXPIRED', 'MEDICAL_CERTIFICATE_REVIEWED', 'CLASS_CHANGED', 'EVENT_CANCELLED', 'GENERAL');

-- CreateTable
CREATE TABLE "user" (
    "id" UUID NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "document_number" VARCHAR(30) NOT NULL,
    "birth_date" DATE NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(30) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "photo_url" VARCHAR(2048),
    "role" "UserRole" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "is_password_change_required" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_profile" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "emergency_contact_name" VARCHAR(200) NOT NULL,
    "emergency_contact_phone" VARCHAR(30) NOT NULL,

    CONSTRAINT "member_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trainer_profile" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "specialty" VARCHAR(150) NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "trainer_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membership_price" (
    "id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "effective_from" TIMESTAMPTZ(3) NOT NULL,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "membership_price_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment" (
    "id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" VARCHAR(50) NOT NULL,
    "receipt_number" VARCHAR(100),
    "status" "PaymentStatus" NOT NULL DEFAULT 'ACCREDITED',
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmed_by_id" UUID NOT NULL,
    "accredited_at" TIMESTAMPTZ(3) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "voided_by_id" UUID,
    "voided_at" TIMESTAMPTZ(3),
    "void_reason" TEXT,

    CONSTRAINT "payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medical_certificate" (
    "id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "file_url" VARCHAR(2048) NOT NULL,
    "status" "MedicalCertificateStatus" NOT NULL DEFAULT 'PENDING',
    "uploaded_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMPTZ(3),
    "review_comment" TEXT,

    CONSTRAINT "medical_certificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branch" (
    "id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT NOT NULL,
    "image_url" VARCHAR(2048) NOT NULL,
    "address" VARCHAR(255) NOT NULL,
    "opening_hours" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(30) NOT NULL,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_point" (
    "id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "qr_token" VARCHAR(255) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "access_point_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_log" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role_at_attempt" "UserRole" NOT NULL,
    "branch_id" UUID,
    "access_point_id" UUID,
    "result" "AccessResult" NOT NULL,
    "denial_reason" "AccessDenialReason",
    "attempted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "access_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_schedule" (
    "id" UUID NOT NULL,
    "week_starts_on" DATE NOT NULL,
    "copied_from_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weekly_schedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_class" (
    "id" UUID NOT NULL,
    "schedule_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "trainer_id" UUID,
    "activity" VARCHAR(150) NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "scheduled_class_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trainer_branch" (
    "id" UUID NOT NULL,
    "trainer_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,

    CONSTRAINT "trainer_branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_audit_log" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "performed_by_id" UUID NOT NULL,
    "action" "UserAuditAction" NOT NULL,
    "reason" TEXT,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event" (
    "id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "location" VARCHAR(255) NOT NULL,
    "image_url" VARCHAR(2048) NOT NULL,
    "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
    "created_by_id" UUID NOT NULL,

    CONSTRAINT "event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_post" (
    "id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "content" TEXT NOT NULL,
    "image_url" VARCHAR(2048),
    "audience" "PublicationAudience" NOT NULL,
    "status" "PublicationStatus" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMPTZ(3),
    "created_by_id" UUID NOT NULL,

    CONSTRAINT "news_post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "message" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMPTZ(3),

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_document_number_key" ON "user"("document_number");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "member_profile_user_id_key" ON "member_profile"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "trainer_profile_user_id_key" ON "trainer_profile"("user_id");

-- CreateIndex
CREATE INDEX "membership_price_effective_from_idx" ON "membership_price"("effective_from");

-- CreateIndex
CREATE INDEX "payment_member_id_accredited_at_idx" ON "payment"("member_id", "accredited_at");

-- CreateIndex
CREATE INDEX "payment_status_expires_at_idx" ON "payment"("status", "expires_at");

-- CreateIndex
CREATE INDEX "medical_certificate_member_id_status_idx" ON "medical_certificate"("member_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "branch_name_key" ON "branch"("name");

-- CreateIndex
CREATE UNIQUE INDEX "branch_address_key" ON "branch"("address");

-- CreateIndex
CREATE UNIQUE INDEX "access_point_qr_token_key" ON "access_point"("qr_token");

-- CreateIndex
CREATE INDEX "access_point_branch_id_is_active_idx" ON "access_point"("branch_id", "is_active");

-- CreateIndex
CREATE INDEX "access_log_user_id_attempted_at_idx" ON "access_log"("user_id", "attempted_at");

-- CreateIndex
CREATE INDEX "access_log_branch_id_attempted_at_idx" ON "access_log"("branch_id", "attempted_at");

-- CreateIndex
CREATE UNIQUE INDEX "weekly_schedule_week_starts_on_key" ON "weekly_schedule"("week_starts_on");

-- CreateIndex
CREATE INDEX "scheduled_class_schedule_id_starts_at_idx" ON "scheduled_class"("schedule_id", "starts_at");

-- CreateIndex
CREATE INDEX "scheduled_class_branch_id_starts_at_idx" ON "scheduled_class"("branch_id", "starts_at");

-- CreateIndex
CREATE INDEX "scheduled_class_trainer_id_starts_at_idx" ON "scheduled_class"("trainer_id", "starts_at");

-- CreateIndex
CREATE UNIQUE INDEX "trainer_branch_trainer_id_branch_id_key" ON "trainer_branch"("trainer_id", "branch_id");

-- CreateIndex
CREATE INDEX "user_audit_log_user_id_occurred_at_idx" ON "user_audit_log"("user_id", "occurred_at");

-- CreateIndex
CREATE INDEX "event_status_starts_at_idx" ON "event"("status", "starts_at");

-- CreateIndex
CREATE INDEX "news_post_status_audience_published_at_idx" ON "news_post"("status", "audience", "published_at");

-- CreateIndex
CREATE INDEX "notification_user_id_read_at_created_at_idx" ON "notification"("user_id", "read_at", "created_at");

-- AddForeignKey
ALTER TABLE "member_profile" ADD CONSTRAINT "member_profile_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trainer_profile" ADD CONSTRAINT "trainer_profile_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_price" ADD CONSTRAINT "membership_price_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_confirmed_by_id_fkey" FOREIGN KEY ("confirmed_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_voided_by_id_fkey" FOREIGN KEY ("voided_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_certificate" ADD CONSTRAINT "medical_certificate_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_certificate" ADD CONSTRAINT "medical_certificate_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_point" ADD CONSTRAINT "access_point_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_log" ADD CONSTRAINT "access_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_log" ADD CONSTRAINT "access_log_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_log" ADD CONSTRAINT "access_log_access_point_id_fkey" FOREIGN KEY ("access_point_id") REFERENCES "access_point"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_schedule" ADD CONSTRAINT "weekly_schedule_copied_from_id_fkey" FOREIGN KEY ("copied_from_id") REFERENCES "weekly_schedule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_class" ADD CONSTRAINT "scheduled_class_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "weekly_schedule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_class" ADD CONSTRAINT "scheduled_class_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_class" ADD CONSTRAINT "scheduled_class_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trainer_branch" ADD CONSTRAINT "trainer_branch_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trainer_branch" ADD CONSTRAINT "trainer_branch_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_audit_log" ADD CONSTRAINT "user_audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_audit_log" ADD CONSTRAINT "user_audit_log_performed_by_id_fkey" FOREIGN KEY ("performed_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event" ADD CONSTRAINT "event_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_post" ADD CONSTRAINT "news_post_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
