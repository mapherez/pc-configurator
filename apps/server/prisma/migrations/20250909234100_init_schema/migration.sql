/*
  Warnings:

  - A unique constraint covering the columns `[slug]` on the table `Part` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `brand` to the `Part` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sku` to the `Part` table without a default value. This is not possible if the table is not empty.
  - Added the required column `slug` to the `Part` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Part" ADD COLUMN     "brand" TEXT NOT NULL,
ADD COLUMN     "images" TEXT[],
ADD COLUMN     "sku" TEXT NOT NULL,
ADD COLUMN     "slug" TEXT NOT NULL,
ADD COLUMN     "specs" JSONB;

-- CreateIndex
CREATE UNIQUE INDEX "Part_slug_key" ON "Part"("slug");
