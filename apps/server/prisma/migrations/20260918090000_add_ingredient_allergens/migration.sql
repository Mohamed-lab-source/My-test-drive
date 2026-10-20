-- CreateEnum
CREATE TYPE "Allergen" AS ENUM ('GLUTEN', 'DAIRY', 'EGGS', 'NUTS', 'PEANUTS', 'SHELLFISH', 'FISH', 'SOY', 'SESAME');

-- AlterTable
ALTER TABLE "Ingredient" ADD COLUMN     "allergens" "Allergen"[] DEFAULT ARRAY[]::"Allergen"[];

