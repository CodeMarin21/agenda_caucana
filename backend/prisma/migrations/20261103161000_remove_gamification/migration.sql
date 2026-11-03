-- La migración se basa en backend/backup_gamificacion.json.
-- Detenerse si alguna tabla contiene más filas que el respaldo verificado.
BEGIN;

DO $$
BEGIN
  IF (SELECT COUNT(*) FROM "Jugador") > 6
    OR (SELECT COUNT(*) FROM "VisitaJugador") > 2
    OR (SELECT COUNT(*) FROM "Logro") > 6
    OR (SELECT COUNT(*) FROM "LogroJugador") > 2
    OR (SELECT COUNT(*) FROM "Ruta") > 4
    OR (SELECT COUNT(*) FROM "RutaPunto") > 12
    OR (SELECT COUNT(*) FROM "ProgresoRuta") > 2
    OR (SELECT COUNT(*) FROM "Temporada") > 1
    OR (SELECT COUNT(*) FROM "HallOfFame") > 0
    OR (SELECT COUNT(*) FROM "Follow") > 1
    OR (SELECT COUNT(*) FROM "RecoveryCode") > 16
    OR (SELECT COUNT(*) FROM "Usuario" WHERE "rol" = 'JUGADOR') > 6
    OR (SELECT COUNT(*) FROM "Usuario" WHERE "username" IS NOT NULL) > 6
    OR (SELECT COUNT(*) FROM "RefreshToken" WHERE "usuarioId" IN (
      SELECT "id" FROM "Usuario" WHERE "rol" = 'JUGADOR'
    )) > 2
    OR EXISTS (
      SELECT 1 FROM "Suscripcion" s
      JOIN "Usuario" u ON u."id" = s."usuarioId"
      WHERE u."rol" = 'JUGADOR'
    )
    OR EXISTS (
      SELECT 1 FROM "PasswordResetToken" p
      JOIN "Usuario" u ON u."id" = p."usuarioId"
      WHERE u."rol" = 'JUGADOR'
    )
    OR EXISTS (
      SELECT 1 FROM "Notificacion" n
      JOIN "Usuario" u ON u."id" = n."usuarioId"
      WHERE u."rol" = 'JUGADOR'
    )
    OR EXISTS (
      SELECT 1 FROM "Organizador" o
      JOIN "Usuario" u ON u."id" = o."usuarioId"
      WHERE u."rol" = 'JUGADOR'
    )
    OR EXISTS (
      SELECT 1 FROM "Organizador" o
      JOIN "Usuario" u ON u."id" = o."vetadoPorId"
      WHERE u."rol" = 'JUGADOR'
    )
    OR EXISTS (
      SELECT 1 FROM "Organizador" o
      JOIN "Usuario" u ON u."id" = o."reactivadoPorId"
      WHERE u."rol" = 'JUGADOR'
    )
  THEN
    RAISE EXCEPTION 'Player-related data changed or has non-gamification dependencies; review and back up before migrating';
  END IF;
END;
$$;

-- Retirar las seis cuentas de jugador. Sus tablas de gamificación están respaldadas.
DELETE FROM "Usuario" WHERE "rol" = 'JUGADOR';

DROP TABLE "LogroJugador";
DROP TABLE "HallOfFame";
DROP TABLE "ProgresoRuta";
DROP TABLE "VisitaJugador";
DROP TABLE "RutaPunto";
DROP TABLE "RecoveryCode";
DROP TABLE "Follow";
DROP TABLE "Logro";
DROP TABLE "Temporada";
DROP TABLE "Ruta";
DROP TABLE "Jugador";

ALTER TABLE "Usuario" DROP COLUMN "username";

ALTER TABLE "Usuario" ALTER COLUMN "rol" DROP DEFAULT;
CREATE TYPE "Rol_new" AS ENUM ('ADMIN', 'ORGANIZADOR', 'USUARIO');
ALTER TABLE "Usuario"
  ALTER COLUMN "rol" TYPE "Rol_new"
  USING ("rol"::text::"Rol_new");
DROP TYPE "Rol";
ALTER TYPE "Rol_new" RENAME TO "Rol";
ALTER TABLE "Usuario" ALTER COLUMN "rol" SET DEFAULT 'USUARIO'::"Rol";

COMMIT;
