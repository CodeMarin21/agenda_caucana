UPDATE "Organizador" AS organizador
SET "especialidad" = 'EVENTOS'::"EspecialidadOrganizador"
WHERE organizador."especialidad" = 'POR_DEFINIR'::"EspecialidadOrganizador"
  AND EXISTS (
    SELECT 1
    FROM "Evento" AS evento
    WHERE evento."organizadorId" = organizador.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM "Negocio" AS negocio
    WHERE negocio."organizadorId" = organizador.id
  );
