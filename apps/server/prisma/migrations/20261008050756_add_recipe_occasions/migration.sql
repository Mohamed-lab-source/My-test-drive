-- CreateEnum
CREATE TYPE "Occasion" AS ENUM ('RAMADAN_SUHOOR', 'RAMADAN_IFTAR', 'EID');

-- AlterTable
ALTER TABLE "Recipe" ADD COLUMN     "occasions" "Occasion"[] DEFAULT ARRAY[]::"Occasion"[];
