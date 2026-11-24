ALTER TABLE "Organizador"
ADD COLUMN "negocioCreado" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Organizador" AS organizador
SET "negocioCreado" = true
WHERE EXISTS (
  SELECT 1
  FROM "Negocio" AS negocio
  WHERE negocio."organizadorId" = organizador.id
);

CREATE UNIQUE INDEX "Negocio_organizadorId_key" ON "Negocio"("organizadorId");
