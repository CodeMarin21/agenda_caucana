CREATE TYPE "EspecialidadOrganizador" AS ENUM ('EVENTOS', 'GASTRONOMIA', 'POR_DEFINIR');

ALTER TABLE "Organizador"
ADD COLUMN "especialidad" "EspecialidadOrganizador" NOT NULL DEFAULT 'POR_DEFINIR';

UPDATE "Organizador" AS organizador
SET "especialidad" = CASE
  WHEN EXISTS (
    SELECT 1 FROM "Evento" AS evento
    WHERE evento."organizadorId" = organizador.id
  ) AND NOT EXISTS (
    SELECT 1 FROM "Negocio" AS negocio
    WHERE negocio."organizadorId" = organizador.id
  ) THEN 'EVENTOS'::"EspecialidadOrganizador"
  WHEN EXISTS (
    SELECT 1 FROM "Negocio" AS negocio
    WHERE negocio."organizadorId" = organizador.id
  ) AND NOT EXISTS (
    SELECT 1 FROM "Evento" AS evento
    WHERE evento."organizadorId" = organizador.id
  ) THEN 'GASTRONOMIA'::"EspecialidadOrganizador"
  ELSE 'POR_DEFINIR'::"EspecialidadOrganizador"
END;
