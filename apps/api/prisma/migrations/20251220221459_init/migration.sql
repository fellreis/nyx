-- AlterTable
ALTER TABLE "Goal" ADD COLUMN     "meta" JSONB;

-- AlterTable
ALTER TABLE "Review" ADD COLUMN     "meta" JSONB;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "department" TEXT,
ADD COLUMN     "progressHistory" JSONB,
ADD COLUMN     "roleTemplateId" INTEGER;
