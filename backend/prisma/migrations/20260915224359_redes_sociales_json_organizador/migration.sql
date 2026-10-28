/*
  Warnings:

  - The `redesSociales` column on the `Organizador` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Organizador" DROP COLUMN "redesSociales",
ADD COLUMN     "redesSociales" JSONB;
