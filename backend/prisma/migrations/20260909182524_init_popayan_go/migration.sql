/*
  Warnings:

  - A unique constraint covering the columns `[username]` on the table `Usuario` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "Rol" ADD VALUE 'JUGADOR';

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "username" TEXT,
ALTER COLUMN "nombre" DROP NOT NULL,
ALTER COLUMN "email" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Jugador" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "avatarUrl" TEXT,
    "nivel" INTEGER NOT NULL DEFAULT 1,
    "puntajeTotal" INTEGER NOT NULL DEFAULT 0,
    "puntajeSemanal" INTEGER NOT NULL DEFAULT 0,
    "progresoGlobal" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Jugador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ruta" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "colorTema" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ruta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RutaPunto" (
    "id" SERIAL NOT NULL,
    "rutaId" INTEGER NOT NULL,
    "lugarId" INTEGER NOT NULL,
    "orden" INTEGER,

    CONSTRAINT "RutaPunto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitaJugador" (
    "id" SERIAL NOT NULL,
    "jugadorId" INTEGER NOT NULL,
    "lugarId" INTEGER NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VisitaJugador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Logro" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "icono" TEXT,
    "categoria" TEXT NOT NULL,
    "meta" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Logro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogroJugador" (
    "id" SERIAL NOT NULL,
    "jugadorId" INTEGER NOT NULL,
    "logroId" INTEGER NOT NULL,
    "desbloqueadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LogroJugador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgresoRuta" (
    "id" SERIAL NOT NULL,
    "jugadorId" INTEGER NOT NULL,
    "rutaId" INTEGER NOT NULL,
    "porcentaje" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "completada" BOOLEAN NOT NULL DEFAULT false,
    "actualizado" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgresoRuta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Jugador_usuarioId_key" ON "Jugador"("usuarioId");

-- CreateIndex
CREATE INDEX "Jugador_puntajeSemanal_idx" ON "Jugador"("puntajeSemanal" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Ruta_nombre_key" ON "Ruta"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "RutaPunto_rutaId_lugarId_key" ON "RutaPunto"("rutaId", "lugarId");

-- CreateIndex
CREATE UNIQUE INDEX "VisitaJugador_jugadorId_lugarId_key" ON "VisitaJugador"("jugadorId", "lugarId");

-- CreateIndex
CREATE UNIQUE INDEX "Logro_nombre_key" ON "Logro"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "LogroJugador_jugadorId_logroId_key" ON "LogroJugador"("jugadorId", "logroId");

-- CreateIndex
CREATE UNIQUE INDEX "ProgresoRuta_jugadorId_rutaId_key" ON "ProgresoRuta"("jugadorId", "rutaId");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_username_key" ON "Usuario"("username");

-- AddForeignKey
ALTER TABLE "Jugador" ADD CONSTRAINT "Jugador_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RutaPunto" ADD CONSTRAINT "RutaPunto_rutaId_fkey" FOREIGN KEY ("rutaId") REFERENCES "Ruta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RutaPunto" ADD CONSTRAINT "RutaPunto_lugarId_fkey" FOREIGN KEY ("lugarId") REFERENCES "Lugar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitaJugador" ADD CONSTRAINT "VisitaJugador_jugadorId_fkey" FOREIGN KEY ("jugadorId") REFERENCES "Jugador"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitaJugador" ADD CONSTRAINT "VisitaJugador_lugarId_fkey" FOREIGN KEY ("lugarId") REFERENCES "Lugar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogroJugador" ADD CONSTRAINT "LogroJugador_jugadorId_fkey" FOREIGN KEY ("jugadorId") REFERENCES "Jugador"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogroJugador" ADD CONSTRAINT "LogroJugador_logroId_fkey" FOREIGN KEY ("logroId") REFERENCES "Logro"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgresoRuta" ADD CONSTRAINT "ProgresoRuta_jugadorId_fkey" FOREIGN KEY ("jugadorId") REFERENCES "Jugador"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgresoRuta" ADD CONSTRAINT "ProgresoRuta_rutaId_fkey" FOREIGN KEY ("rutaId") REFERENCES "Ruta"("id") ON DELETE CASCADE ON UPDATE CASCADE;
