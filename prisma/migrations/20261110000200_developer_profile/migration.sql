CREATE TYPE "DeveloperAvailability" AS ENUM ('AVAILABLE', 'LIMITED', 'UNAVAILABLE');

CREATE TABLE "DeveloperProfile" (
    "userId" TEXT NOT NULL,
    "headline" TEXT,
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "specializations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "availability" "DeveloperAvailability" NOT NULL DEFAULT 'UNAVAILABLE',
    "portfolio" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DeveloperProfile_pkey" PRIMARY KEY ("userId"),
    CONSTRAINT "DeveloperProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
