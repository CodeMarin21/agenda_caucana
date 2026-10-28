/*
  Warnings:

  - A unique constraint covering the columns `[jugadorId,lugarId,semanaIso]` on the table `VisitaJugador` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `puntosOtorgados` to the `VisitaJugador` table without a default value. This is not possible if the table is not empty.
  - Added the required column `semanaIso` to the `VisitaJugador` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Jugador_puntajeSemanal_idx";

-- DropIndex
DROP INDEX "VisitaJugador_jugadorId_lugarId_key";

-- AlterTable
ALTER TABLE "Jugador" ADD COLUMN     "puntajeTemporada" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Logro" ADD COLUMN     "esTemporal" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "LogroJugador" ADD COLUMN     "descripcionExtra" TEXT,
ADD COLUMN     "temporadaId" INTEGER;

-- AlterTable
ALTER TABLE "VisitaJugador" ADD COLUMN     "puntosOtorgados" INTEGER NOT NULL,
ADD COLUMN     "semanaIso" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "Temporada" (
    "id" SERIAL NOT NULL,
    "numero" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3) NOT NULL,
    "cerrada" BOOLEAN NOT NULL DEFAULT false,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Temporada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HallOfFame" (
    "id" SERIAL NOT NULL,
    "temporadaId" INTEGER NOT NULL,
    "jugadorId" INTEGER NOT NULL,
    "posicion" INTEGER NOT NULL,
    "puntajeTemporada" INTEGER NOT NULL,
    "visitasTemporada" INTEGER NOT NULL DEFAULT 0,
    "archivadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HallOfFame_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Temporada_numero_key" ON "Temporada"("numero");

-- CreateIndex
CREATE INDEX "Temporada_cerrada_fechaFin_idx" ON "Temporada"("cerrada", "fechaFin");

-- CreateIndex
CREATE INDEX "HallOfFame_temporadaId_posicion_idx" ON "HallOfFame"("temporadaId", "posicion");

-- CreateIndex
CREATE INDEX "HallOfFame_jugadorId_archivadoEn_idx" ON "HallOfFame"("jugadorId", "archivadoEn" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "HallOfFame_temporadaId_jugadorId_key" ON "HallOfFame"("temporadaId", "jugadorId");

-- CreateIndex
CREATE UNIQUE INDEX "HallOfFame_temporadaId_posicion_key" ON "HallOfFame"("temporadaId", "posicion");

-- CreateIndex
CREATE INDEX "Jugador_puntajeTemporada_puntajeTotal_idx" ON "Jugador"("puntajeTemporada" DESC, "puntajeTotal" DESC);

-- CreateIndex
CREATE INDEX "Logro_esTemporal_activo_idx" ON "Logro"("esTemporal", "activo");

-- CreateIndex
CREATE INDEX "LogroJugador_temporadaId_idx" ON "LogroJugador"("temporadaId");

-- CreateIndex
CREATE INDEX "VisitaJugador_jugadorId_semanaIso_idx" ON "VisitaJugador"("jugadorId", "semanaIso");

-- CreateIndex
CREATE UNIQUE INDEX "VisitaJugador_jugadorId_lugarId_semanaIso_key" ON "VisitaJugador"("jugadorId", "lugarId", "semanaIso");

-- AddForeignKey
ALTER TABLE "LogroJugador" ADD CONSTRAINT "LogroJugador_temporadaId_fkey" FOREIGN KEY ("temporadaId") REFERENCES "Temporada"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HallOfFame" ADD CONSTRAINT "HallOfFame_temporadaId_fkey" FOREIGN KEY ("temporadaId") REFERENCES "Temporada"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HallOfFame" ADD CONSTRAINT "HallOfFame_jugadorId_fkey" FOREIGN KEY ("jugadorId") REFERENCES "Jugador"("id") ON DELETE CASCADE ON UPDATE CASCADE;
