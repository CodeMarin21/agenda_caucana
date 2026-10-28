-- AlterTable
ALTER TABLE "Jugador" ADD COLUMN     "cuentaPrivada" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mostrarEnRanking" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "permitirMensajes" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "recomendarAOtros" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "Follow" (
    "id" SERIAL NOT NULL,
    "seguidorId" INTEGER NOT NULL,
    "seguidoId" INTEGER NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Follow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" SERIAL NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usado" BOOLEAN NOT NULL DEFAULT false,
    "ipSolicitante" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecoveryCode" (
    "id" SERIAL NOT NULL,
    "codeHash" TEXT NOT NULL,
    "jugadorId" INTEGER NOT NULL,
    "usado" BOOLEAN NOT NULL DEFAULT false,
    "usadoEn" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecoveryCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Follow_seguidorId_idx" ON "Follow"("seguidorId");

-- CreateIndex
CREATE INDEX "Follow_seguidoId_idx" ON "Follow"("seguidoId");

-- CreateIndex
CREATE UNIQUE INDEX "Follow_seguidorId_seguidoId_key" ON "Follow"("seguidorId", "seguidoId");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_usuarioId_expiresAt_idx" ON "PasswordResetToken"("usuarioId", "expiresAt");

-- CreateIndex
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "RecoveryCode_codeHash_key" ON "RecoveryCode"("codeHash");

-- CreateIndex
CREATE INDEX "RecoveryCode_jugadorId_usado_idx" ON "RecoveryCode"("jugadorId", "usado");

-- CreateIndex
CREATE INDEX "Jugador_cuentaPrivada_recomendarAOtros_idx" ON "Jugador"("cuentaPrivada", "recomendarAOtros");

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_seguidorId_fkey" FOREIGN KEY ("seguidorId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_seguidoId_fkey" FOREIGN KEY ("seguidoId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecoveryCode" ADD CONSTRAINT "RecoveryCode_jugadorId_fkey" FOREIGN KEY ("jugadorId") REFERENCES "Jugador"("id") ON DELETE CASCADE ON UPDATE CASCADE;
