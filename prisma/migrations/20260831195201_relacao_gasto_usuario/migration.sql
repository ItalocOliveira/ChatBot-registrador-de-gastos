/*
  Warnings:

  - Added the required column `usuarioId` to the `gastos` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "gastos" ADD COLUMN     "usuarioId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
