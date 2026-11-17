CREATE TABLE "SecureShareChunk" (
  "fileId" TEXT NOT NULL,
  "index" INTEGER NOT NULL,
  "storageKey" TEXT NOT NULL,
  CONSTRAINT "SecureShareChunk_pkey" PRIMARY KEY ("fileId", "index"),
  CONSTRAINT "SecureShareChunk_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "SecureShareFile"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
