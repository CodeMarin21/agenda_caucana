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
  ELSE "especialidad"
END
WHERE "especialidad" = 'POR_DEFINIR';
