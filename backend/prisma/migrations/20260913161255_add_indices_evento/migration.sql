-- CreateIndex
CREATE INDEX "Evento_estadoPublicacion_fechaInicio_idx" ON "Evento"("estadoPublicacion", "fechaInicio");

-- CreateIndex
CREATE INDEX "Evento_categoriaId_estadoPublicacion_fechaInicio_idx" ON "Evento"("categoriaId", "estadoPublicacion", "fechaInicio");

-- CreateIndex
CREATE INDEX "Evento_ciudadId_estadoPublicacion_fechaInicio_idx" ON "Evento"("ciudadId", "estadoPublicacion", "fechaInicio");

-- CreateIndex
CREATE INDEX "Evento_organizadorId_estadoPublicacion_idx" ON "Evento"("organizadorId", "estadoPublicacion");
