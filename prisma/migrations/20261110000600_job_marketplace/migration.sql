-- CreateEnum
CREATE TYPE "JobPublicationStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('OPEN', 'EXECUTOR_SELECTED', 'IN_PROGRESS', 'ACCEPTANCE', 'COMPLETED', 'CANCELLED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "JobProposalStatus" AS ENUM ('ACTIVE', 'WITHDRAWN', 'SELECTED', 'DECLINED');

-- CreateEnum
CREATE TYPE "JobDeliveryStatus" AS ENUM ('PENDING', 'ACCEPTED', 'CHANGES_REQUESTED');

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "submissionHash" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "specialization" TEXT NOT NULL,
    "budgetMin" INTEGER NOT NULL,
    "budgetMax" INTEGER NOT NULL,
    "deadline" TIMESTAMP(3) NOT NULL,
    "publicationStatus" "JobPublicationStatus" NOT NULL DEFAULT 'DRAFT',
    "status" "JobStatus" NOT NULL DEFAULT 'OPEN',
    "revision" INTEGER NOT NULL DEFAULT 0,
    "moderationReason" TEXT,
    "cancellationRequestedBy" TEXT,
    "cancellationReason" TEXT,
    "publishedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobProposal" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "developerId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "approach" TEXT NOT NULL,
    "status" "JobProposalStatus" NOT NULL DEFAULT 'ACTIVE',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobContract" (
    "jobId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "developerId" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "specialization" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "approach" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "agreedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobContract_pkey" PRIMARY KEY ("jobId")
);

-- CreateTable
CREATE TABLE "JobMessage" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobAttachment" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "s3Key" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobDelivery" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "developerId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "attachmentIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "JobDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "customerFeedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "JobDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobReview" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobStatusLog" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "reason" TEXT,
    "data" JSONB,
    "proposalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobStatusLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobDispute" (
    "jobId" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "previousStatus" "JobStatus" NOT NULL,
    "openedById" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "resolution" TEXT,
    "resolvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "JobDispute_pkey" PRIMARY KEY ("jobId")
);

-- CreateTable
CREATE TABLE "JobNotification" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Job_customerId_createdAt_idx" ON "Job"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "Job_publicationStatus_status_publishedAt_idx" ON "Job"("publicationStatus", "status", "publishedAt");

-- CreateIndex
CREATE INDEX "Job_specialization_idx" ON "Job"("specialization");

-- CreateIndex
CREATE INDEX "JobProposal_developerId_updatedAt_idx" ON "JobProposal"("developerId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "JobProposal_jobId_developerId_key" ON "JobProposal"("jobId", "developerId");

-- CreateIndex
CREATE UNIQUE INDEX "JobContract_proposalId_key" ON "JobContract"("proposalId");

-- CreateIndex
CREATE INDEX "JobContract_developerId_idx" ON "JobContract"("developerId");

-- CreateIndex
CREATE INDEX "JobContract_customerId_idx" ON "JobContract"("customerId");

-- CreateIndex
CREATE INDEX "JobMessage_jobId_createdAt_idx" ON "JobMessage"("jobId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "JobAttachment_s3Key_key" ON "JobAttachment"("s3Key");

-- CreateIndex
CREATE INDEX "JobAttachment_jobId_createdAt_idx" ON "JobAttachment"("jobId", "createdAt");

-- CreateIndex
CREATE INDEX "JobDelivery_jobId_createdAt_idx" ON "JobDelivery"("jobId", "createdAt");

-- CreateIndex
CREATE INDEX "JobReview_recipientId_idx" ON "JobReview"("recipientId");

-- CreateIndex
CREATE UNIQUE INDEX "JobReview_jobId_authorId_key" ON "JobReview"("jobId", "authorId");

-- CreateIndex
CREATE INDEX "JobStatusLog_jobId_createdAt_idx" ON "JobStatusLog"("jobId", "createdAt");

-- CreateIndex
CREATE INDEX "JobStatusLog_proposalId_idx" ON "JobStatusLog"("proposalId");

-- CreateIndex
CREATE UNIQUE INDEX "JobDispute_ticketId_key" ON "JobDispute"("ticketId");

-- CreateIndex
CREATE INDEX "JobNotification_userId_createdAt_idx" ON "JobNotification"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobProposal" ADD CONSTRAINT "JobProposal_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobProposal" ADD CONSTRAINT "JobProposal_developerId_fkey" FOREIGN KEY ("developerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobContract" ADD CONSTRAINT "JobContract_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobContract" ADD CONSTRAINT "JobContract_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobContract" ADD CONSTRAINT "JobContract_developerId_fkey" FOREIGN KEY ("developerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobContract" ADD CONSTRAINT "JobContract_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "JobProposal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobMessage" ADD CONSTRAINT "JobMessage_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobMessage" ADD CONSTRAINT "JobMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobAttachment" ADD CONSTRAINT "JobAttachment_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobAttachment" ADD CONSTRAINT "JobAttachment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobDelivery" ADD CONSTRAINT "JobDelivery_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobDelivery" ADD CONSTRAINT "JobDelivery_developerId_fkey" FOREIGN KEY ("developerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobReview" ADD CONSTRAINT "JobReview_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobReview" ADD CONSTRAINT "JobReview_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobReview" ADD CONSTRAINT "JobReview_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobStatusLog" ADD CONSTRAINT "JobStatusLog_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobStatusLog" ADD CONSTRAINT "JobStatusLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobStatusLog" ADD CONSTRAINT "JobStatusLog_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "JobProposal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobDispute" ADD CONSTRAINT "JobDispute_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobDispute" ADD CONSTRAINT "JobDispute_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobNotification" ADD CONSTRAINT "JobNotification_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobNotification" ADD CONSTRAINT "JobNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

