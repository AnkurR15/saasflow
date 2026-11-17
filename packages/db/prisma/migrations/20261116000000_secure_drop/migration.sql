CREATE TABLE "FileDrop" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "ciphertext" BYTEA NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "downloadedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "FileDrop_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FileDrop_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "FileDrop_tokenHash_key" ON "FileDrop"("tokenHash");
CREATE INDEX "FileDrop_organizationId_createdAt_idx" ON "FileDrop"("organizationId", "createdAt");
CREATE INDEX "FileDrop_expiresAt_idx" ON "FileDrop"("expiresAt");
