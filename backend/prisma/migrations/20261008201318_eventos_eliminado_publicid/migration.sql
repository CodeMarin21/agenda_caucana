-- AlterEnum
ALTER TYPE "TipoNotificacion" ADD VALUE 'EVENTO_ELIMINADO';

-- AlterTable
ALTER TABLE "Evento" ADD COLUMN "publicIdImagen" TEXT;
