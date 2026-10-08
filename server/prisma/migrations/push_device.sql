-- Push device tokens for FCM targeted notifications (additive-only migration)
-- Apply with: npx prisma db execute --file ./prisma/migrations/push_device.sql --schema ./prisma/schema.prisma
CREATE TABLE IF NOT EXISTS "push_device" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employeeId" UUID NOT NULL,
    "fcmToken" TEXT NOT NULL,
    "platform" TEXT,
    "deviceName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_device_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'push_device_employeeId_fkey'
    ) THEN
        ALTER TABLE "push_device"
            ADD CONSTRAINT "push_device_employeeId_fkey"
            FOREIGN KEY ("employeeId") REFERENCES "employee"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "push_device_fcmToken_key" ON "push_device"("fcmToken");

CREATE INDEX IF NOT EXISTS "push_device_employeeId_isActive_idx" ON "push_device"("employeeId", "isActive");
