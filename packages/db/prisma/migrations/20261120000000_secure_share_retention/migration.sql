ALTER TABLE "SecureShare" ADD COLUMN "storageReleasedAt" TIMESTAMP(3);
CREATE INDEX "SecureShare_organizationId_storageReleasedAt_idx" ON "SecureShare"("organizationId", "storageReleasedAt");
