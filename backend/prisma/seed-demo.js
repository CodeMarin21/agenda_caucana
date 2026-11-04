const fs = require('node:fs');
const path = require('node:path');
const { Prisma, PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const catalogPath = path.resolve(__dirname, '../../frontend/assets/demo-catalog.json');

function nullableJson(value) {
  return value == null ? Prisma.DbNull : value;
}

async function getOrCreateCity(cityData) {
  return prisma.ciudad.upsert({
    where: { nombre: cityData.nombre },
    create: {
      nombre: cityData.nombre,
      departamento: cityData.departamento,
      activa: true,
    },
    update: { departamento: cityData.departamento, activa: true },
  });
}

async function seedEvent(eventData) {
  const [city, category] = await Promise.all([
    getOrCreateCity(eventData.ciudad),
    prisma.categoria.upsert({
      where: { slug: eventData.categoria.slug },
      create: {
        nombre: eventData.categoria.nombre,
        slug: eventData.categoria.slug,
        icono: eventData.categoria.icono,
        activa: true,
      },
      update: {
        nombre: eventData.categoria.nombre,
        icono: eventData.categoria.icono,
        activa: true,
      },
    }),
  ]);

  const locationData = eventData.lugar || {
    nombre: eventData.direccion || eventData.ciudad.nombre,
    direccion: eventData.direccion || eventData.ciudad.nombre,
  };
  const placeData = {
    direccion: locationData.direccion || eventData.direccion || locationData.nombre,
    latitud: locationData.latitud,
    longitud: locationData.longitud,
    activo: true,
  };
  const existingPlace = await prisma.lugar.findFirst({
    where: { nombre: locationData.nombre, ciudadId: city.id },
    select: { id: true },
  });
  const place = existingPlace
    ? await prisma.lugar.update({ where: { id: existingPlace.id }, data: placeData })
    : await prisma.lugar.create({
        data: {
          ...placeData,
          nombre: locationData.nombre,
          ciudadId: city.id,
        },
      });

  const data = {
    titulo: eventData.titulo,
    descripcion: eventData.descripcion,
    imagenUrl: eventData.imagenUrl,
    fechaInicio: new Date(eventData.fechaInicio),
    fechaFin: eventData.fechaFin ? new Date(eventData.fechaFin) : null,
    horaApertura: eventData.horaApertura,
    horaCierre: eventData.horaCierre,
    direccion: eventData.direccion,
    precioReferencial: eventData.precioReferencial,
    esMayorDeEdad: eventData.esMayorDeEdad,
    urlExternaBoletas: eventData.urlExternaBoletas,
    gestionaTaquillaInterna: eventData.gestionaTaquillaInterna,
    estadoPublicacion: 'APROBADO',
    slug: eventData.slug,
    destacado: eventData.destacado,
    ciudadId: city.id,
    categoriaId: category.id,
    lugarId: place.id,
    organizadorId: null,
  };

  await prisma.evento.upsert({
    where: { slug: eventData.slug },
    create: data,
    update: data,
  });
}

async function seedBusiness(businessData) {
  const city = await getOrCreateCity(businessData.ciudad);
  const data = {
    nombre: businessData.nombre,
    descripcion: businessData.descripcion,
    direccion: businessData.direccion,
    ciudadId: city.id,
    telefono: businessData.telefono,
    whatsapp: businessData.whatsapp,
    instagram: businessData.instagram,
    horarioAtencion: businessData.horarioAtencion,
    categoria: businessData.categoria,
    precioPromedio: businessData.precioPromedio,
    imagenPrincipalUrl: businessData.imagenPrincipalUrl,
    imagenesAdicionales: nullableJson(businessData.imagenesAdicionales),
    platos: nullableJson(businessData.platos),
    destacado: businessData.destacado,
    activo: true,
    estadoPublicacion: 'APROBADO',
    organizadorId: null,
  };

  await prisma.negocio.upsert({
    where: { slug: businessData.slug },
    create: { slug: businessData.slug, ...data },
    update: data,
  });
}

async function main() {
  if (!fs.existsSync(catalogPath)) {
    throw new Error(`No se encontró el catálogo de demostración: ${catalogPath}`);
  }

  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  if (!Array.isArray(catalog.eventos) || !Array.isArray(catalog.negocios)) {
    throw new Error('El catálogo de demostración no tiene listas válidas de eventos y negocios.');
  }

  for (const event of catalog.eventos) {
    await seedEvent(event);
  }
  for (const business of catalog.negocios) {
    await seedBusiness(business);
  }

  console.log(
    `Catálogo de demostración aplicado: ${catalog.eventos.length} eventos y ${catalog.negocios.length} negocios aprobados.`
  );
}

main()
  .catch((error) => {
    console.error('No se pudo aplicar el catálogo de demostración:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
