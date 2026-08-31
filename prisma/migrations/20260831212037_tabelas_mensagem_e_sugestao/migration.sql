-- CreateTable
CREATE TABLE "mensagens" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "nome" TEXT,
    "texto" TEXT NOT NULL,
    "tipo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mensagens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sugestoes" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "nome" TEXT,
    "texto" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sugestoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mensagens_id_key" ON "mensagens"("id");

-- CreateIndex
CREATE UNIQUE INDEX "sugestoes_id_key" ON "sugestoes"("id");
