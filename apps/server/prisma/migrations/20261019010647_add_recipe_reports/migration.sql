-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('WRONG_INGREDIENTS', 'WRONG_STEPS', 'WRONG_NUTRITION', 'TRANSLATION', 'OTHER');

-- CreateTable
CREATE TABLE "RecipeReport" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "userId" TEXT,
    "reason" "ReportReason" NOT NULL,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecipeReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecipeReport_recipeId_idx" ON "RecipeReport"("recipeId");

-- AddForeignKey
ALTER TABLE "RecipeReport" ADD CONSTRAINT "RecipeReport_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeReport" ADD CONSTRAINT "RecipeReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
