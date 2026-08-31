/*
  Warnings:

  - A unique constraint covering the columns `[numero]` on the table `usuarios` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "usuarios_numero_key" ON "usuarios"("numero");
