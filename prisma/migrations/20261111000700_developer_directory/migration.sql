-- CreateTable
CREATE TABLE "DeveloperListing" (
    "userId" TEXT NOT NULL,
    "sortKey" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "listedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeveloperListing_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "ExposureEvent" (
    "id" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "cohort" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExposureEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobInvitation" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "developerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeveloperListing_sortKey_key" ON "DeveloperListing"("sortKey");

-- CreateIndex
CREATE INDEX "DeveloperListing_enabled_sortKey_idx" ON "DeveloperListing"("enabled", "sortKey");

-- CreateIndex
CREATE INDEX "ExposureEvent_day_kind_cohort_idx" ON "ExposureEvent"("day", "kind", "cohort");

-- CreateIndex
CREATE INDEX "ExposureEvent_createdAt_idx" ON "ExposureEvent"("createdAt");

-- CreateIndex
CREATE INDEX "JobInvitation_developerId_createdAt_idx" ON "JobInvitation"("developerId", "createdAt");

-- CreateIndex
CREATE INDEX "JobInvitation_jobId_createdAt_idx" ON "JobInvitation"("jobId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "JobInvitation_jobId_developerId_key" ON "JobInvitation"("jobId", "developerId");

-- AddForeignKey
ALTER TABLE "DeveloperListing" ADD CONSTRAINT "DeveloperListing_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobInvitation" ADD CONSTRAINT "JobInvitation_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobInvitation" ADD CONSTRAINT "JobInvitation_developerId_fkey" FOREIGN KEY ("developerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
