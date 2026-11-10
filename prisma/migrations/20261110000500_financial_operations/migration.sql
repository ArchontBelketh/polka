CREATE TYPE "FinancialOperationStatus" AS ENUM ('PREPARED', 'IN_FLIGHT', 'UNKNOWN', 'CONFIRMED', 'APPLIED');

CREATE TABLE "FinancialOperation" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "status" "FinancialOperationStatus" NOT NULL DEFAULT 'PREPARED',
    "amount" INTEGER NOT NULL,
    "actorId" TEXT NOT NULL,
    "providerId" TEXT,
    "providerStatus" TEXT,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "appliedAt" TIMESTAMP(3),
    CONSTRAINT "FinancialOperation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FinancialOperation_kind_referenceId_idx" ON "FinancialOperation"("kind", "referenceId");
CREATE INDEX "FinancialOperation_status_updatedAt_idx" ON "FinancialOperation"("status", "updatedAt");
