-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('PLATFORM_MANAGER', 'USER');

-- AlterEnum
ALTER TYPE "ProjectRole" ADD VALUE 'ADMIN';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "platformRole" "PlatformRole" NOT NULL DEFAULT 'USER';
