CREATE TABLE "SecureShare" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "createdById" TEXT NOT NULL,
  "projectId" TEXT REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "tokenHash" TEXT UNIQUE,
  "downloadOnce" BOOLEAN NOT NULL DEFAULT true,
  "expiryHours" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "publishedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3)
);
CREATE INDEX "SecureShare_organizationId_createdAt_idx" ON "SecureShare"("organizationId", "createdAt");
CREATE INDEX "SecureShare_expiresAt_idx" ON "SecureShare"("expiresAt");
CREATE TABLE "SecureShareFile" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "shareId" TEXT NOT NULL REFERENCES "SecureShare"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "path" TEXT NOT NULL,
  "size" BIGINT NOT NULL CHECK ("size" > 0 AND "size" <= 5368709120),
  "uploadedSize" BIGINT NOT NULL DEFAULT 0 CHECK ("uploadedSize" >= 0 AND "uploadedSize" <= "size"),
  "downloadedAt" TIMESTAMP(3),
  "downloadCount" INTEGER NOT NULL DEFAULT 0,
  UNIQUE ("shareId", "path")
);
CREATE INDEX "SecureShareFile_shareId_idx" ON "SecureShareFile"("shareId");
