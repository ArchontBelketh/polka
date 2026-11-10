CREATE TYPE "ProductUploadStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED');

CREATE TABLE "ProductSubmission" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductSubmission_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductSubmission_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ProductSubmission_productId_key" ON "ProductSubmission"("productId");
CREATE INDEX "ProductSubmission_userId_idx" ON "ProductSubmission"("userId");

CREATE TABLE "ProductUpload" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "slot" INTEGER NOT NULL DEFAULT 0,
  "fileName" TEXT NOT NULL,
  "fileSize" INTEGER NOT NULL,
  "contentType" TEXT NOT NULL,
  "stagingKey" TEXT NOT NULL,
  "artifactKey" TEXT,
  "status" "ProductUploadStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  "stagingDeletedAt" TIMESTAMP(3),
  CONSTRAINT "ProductUpload_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductUpload_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ProductUpload_stagingKey_key" ON "ProductUpload"("stagingKey");
CREATE INDEX "ProductUpload_productId_idx" ON "ProductUpload"("productId");
CREATE INDEX "ProductUpload_status_createdAt_idx" ON "ProductUpload"("status", "createdAt");
