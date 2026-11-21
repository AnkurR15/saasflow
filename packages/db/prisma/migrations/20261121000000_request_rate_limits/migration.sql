CREATE TABLE "RequestRateLimit" (
  "bucket" TEXT PRIMARY KEY,
  "hits" INTEGER NOT NULL,
  "expiresAt" TIMESTAMPTZ NOT NULL
);
CREATE INDEX "RequestRateLimit_expiresAt_idx" ON "RequestRateLimit" ("expiresAt");
