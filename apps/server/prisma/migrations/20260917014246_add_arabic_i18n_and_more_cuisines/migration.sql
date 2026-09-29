-- AlterTable
ALTER TABLE "Cuisine" ADD COLUMN     "nameAr" TEXT;

-- AlterTable
ALTER TABLE "Ingredient" ADD COLUMN     "nameAr" TEXT;

-- AlterTable
ALTER TABLE "Recipe" ADD COLUMN     "descriptionAr" TEXT,
ADD COLUMN     "titleAr" TEXT;

-- AlterTable
ALTER TABLE "RecipeStep" ADD COLUMN     "instructionAr" TEXT;
