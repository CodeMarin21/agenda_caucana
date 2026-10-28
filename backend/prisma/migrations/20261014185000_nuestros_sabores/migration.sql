-- CreateEnum
CREATE TYPE "CategoriaNegocio" AS ENUM ('TRADICIONAL_CAUCANA', 'COMIDA_RAPIDA', 'PARRILLA', 'PIZZA', 'SUSHI', 'POSTRES', 'CAFETERIA', 'BEBIDAS', 'VEGETARIANA', 'OTRO');

-- CreateEnum
CREATE TYPE "EstadoNegocio" AS ENUM ('PENDIENTE', 'APROBADO', 'RECHAZADO');

-- AlterEnum
ALTER TYPE "TipoNotificacion" ADD VALUE 'NEGOCIO_APROBADO';
ALTER TYPE "TipoNotificacion" ADD VALUE 'NEGOCIO_RECHAZADO';

-- CreateTable
CREATE TABLE "Negocio" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "direccion" TEXT NOT NULL,
    "ciudadId" INTEGER NOT NULL,
    "telefono" TEXT,
    "whatsapp" TEXT,
    "instagram" TEXT,
    "horarioAtencion" TEXT,
    "categoria" "CategoriaNegocio" NOT NULL,
    "precioPromedio" INTEGER,
    "imagenPrincipalUrl" TEXT,
    "imagenesAdicionales" JSONB,
    "destacado" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "estadoPublicacion" "EstadoNegocio" NOT NULL DEFAULT 'PENDIENTE',
    "motivoRechazo" TEXT,
    "organizadorId" INTEGER,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Negocio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalificacionNegocio" (
    "id" SERIAL NOT NULL,
    "negocioId" INTEGER NOT NULL,
    "estrellas" INTEGER NOT NULL,
    "comentario" TEXT,
    "ipHash" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalificacionNegocio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Negocio_slug_key" ON "Negocio"("slug");

-- CreateIndex
CREATE INDEX "Negocio_estadoPublicacion_activo_idx" ON "Negocio"("estadoPublicacion", "activo");

-- CreateIndex
CREATE INDEX "Negocio_categoria_estadoPublicacion_idx" ON "Negocio"("categoria", "estadoPublicacion");

-- CreateIndex
CREATE INDEX "Negocio_ciudadId_estadoPublicacion_idx" ON "Negocio"("ciudadId", "estadoPublicacion");

-- CreateIndex
CREATE INDEX "Negocio_organizadorId_estadoPublicacion_idx" ON "Negocio"("organizadorId", "estadoPublicacion");

-- CreateIndex
CREATE INDEX "CalificacionNegocio_negocioId_creadoEn_idx" ON "CalificacionNegocio"("negocioId", "creadoEn");

-- CreateIndex
CREATE INDEX "CalificacionNegocio_negocioId_ipHash_creadoEn_idx" ON "CalificacionNegocio"("negocioId", "ipHash", "creadoEn");

-- AddForeignKey
ALTER TABLE "Negocio" ADD CONSTRAINT "Negocio_ciudadId_fkey" FOREIGN KEY ("ciudadId") REFERENCES "Ciudad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Negocio" ADD CONSTRAINT "Negocio_organizadorId_fkey" FOREIGN KEY ("organizadorId") REFERENCES "Organizador"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalificacionNegocio" ADD CONSTRAINT "CalificacionNegocio_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
