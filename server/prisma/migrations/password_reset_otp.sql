-- Password Reset OTP table for OTP flow (email OTP -> verify -> reset)
CREATE TABLE IF NOT EXISTS "password_reset_otp" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "employeeId" UUID NOT NULL REFERENCES employee(id) ON DELETE CASCADE,
    "otpHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    attempts INT DEFAULT 0,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "verifiedAt" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "password_reset_otp_employeeId_idx" ON "password_reset_otp"("employeeId");
CREATE INDEX IF NOT EXISTS "password_reset_otp_expiresAt_idx" ON "password_reset_otp"("expiresAt");
