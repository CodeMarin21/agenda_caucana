-- AlterTable
ALTER TABLE "Lugar" ADD COLUMN     "latitud" DOUBLE PRECISION,
ADD COLUMN     "longitud" DOUBLE PRECISION,
ADD COLUMN     "radioMetros" INTEGER NOT NULL DEFAULT 100;

-- AlterTable
ALTER TABLE "Ruta" ADD COLUMN     "categoria" TEXT;

-- AlterTable
ALTER TABLE "VisitaJugador" ADD COLUMN     "accuracyGps" DOUBLE PRECISION,
ADD COLUMN     "distanciaValidada" DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "Boleta_eventoId_estado_idx" ON "Boleta"("eventoId", "estado");

-- CreateIndex
CREATE INDEX "ChatLog_creadoEn_idx" ON "ChatLog"("creadoEn" DESC);

-- CreateIndex
CREATE INDEX "Evento_destacado_estadoPublicacion_fechaInicio_idx" ON "Evento"("destacado", "estadoPublicacion", "fechaInicio");

-- CreateIndex
CREATE INDEX "Jugador_puntajeSemanal_puntajeTotal_idx" ON "Jugador"("puntajeSemanal" DESC, "puntajeTotal" DESC);

-- CreateIndex
CREATE INDEX "Logro_activo_categoria_idx" ON "Logro"("activo", "categoria");

-- CreateIndex
CREATE INDEX "LogroJugador_jugadorId_desbloqueadoEn_idx" ON "LogroJugador"("jugadorId", "desbloqueadoEn" DESC);

-- CreateIndex
CREATE INDEX "Lugar_ciudadId_activo_idx" ON "Lugar"("ciudadId", "activo");

-- CreateIndex
CREATE INDEX "ProgresoRuta_rutaId_completada_idx" ON "ProgresoRuta"("rutaId", "completada");

-- CreateIndex
CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");

-- CreateIndex
CREATE INDEX "Ruta_categoria_activa_idx" ON "Ruta"("categoria", "activa");

-- CreateIndex
CREATE INDEX "RutaPunto_lugarId_idx" ON "RutaPunto"("lugarId");

-- CreateIndex
CREATE INDEX "Suscripcion_categoriaId_activa_idx" ON "Suscripcion"("categoriaId", "activa");

-- CreateIndex
CREATE INDEX "VisitaJugador_jugadorId_creadoEn_idx" ON "VisitaJugador"("jugadorId", "creadoEn");
