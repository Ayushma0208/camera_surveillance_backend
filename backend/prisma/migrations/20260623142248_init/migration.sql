-- CreateEnum
CREATE TYPE "public"."CameraStatus" AS ENUM ('connecting', 'live', 'stopped', 'error');

-- CreateTable
CREATE TABLE "public"."users" (
    "id" UUID NOT NULL,
    "username" VARCHAR(100) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."cameras" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "rtsp_url" TEXT NOT NULL,
    "location" VARCHAR(150) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "status" "public"."CameraStatus" NOT NULL DEFAULT 'stopped',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cameras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."alerts" (
    "id" UUID NOT NULL,
    "camera_id" UUID NOT NULL,
    "event_type" VARCHAR(100) NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "image_url" TEXT,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."camera_stats" (
    "camera_id" UUID NOT NULL,
    "fps" INTEGER NOT NULL,
    "detections_per_minute" INTEGER NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "camera_stats_pkey" PRIMARY KEY ("camera_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "public"."users"("username");

-- CreateIndex
CREATE INDEX "cameras_user_id_idx" ON "public"."cameras"("user_id");

-- CreateIndex
CREATE INDEX "cameras_status_idx" ON "public"."cameras"("status");

-- CreateIndex
CREATE INDEX "alerts_camera_id_timestamp_idx" ON "public"."alerts"("camera_id", "timestamp");

-- AddForeignKey
ALTER TABLE "public"."cameras" ADD CONSTRAINT "cameras_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."alerts" ADD CONSTRAINT "alerts_camera_id_fkey" FOREIGN KEY ("camera_id") REFERENCES "public"."cameras"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."camera_stats" ADD CONSTRAINT "camera_stats_camera_id_fkey" FOREIGN KEY ("camera_id") REFERENCES "public"."cameras"("id") ON DELETE CASCADE ON UPDATE CASCADE;
