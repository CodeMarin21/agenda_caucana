// Seed de los 42 municipios del Cauca.
// Idempotente: usa upsert por nombre único.
// Uso: node prisma/seed-ciudades.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const MUNICIPIOS_CAUCA = [
  'Popayán',
  'Almaguer',
  'Argelia',
  'Balboa',
  'Bolívar',
  'Buenos Aires',
  'Cajibío',
  'Caldono',
  'Caloto',
  'Corinto',
  'El Tambo',
  'Florencia',
  'Guachené',
  'Guapi',
  'Inzá',
  'Jambaló',
  'La Sierra',
  'La Vega',
  'López de Micay',
  'Mercaderes',
  'Miranda',
  'Morales',
  'Padilla',
  'Páez (Belalcázar)',
  'Patía (El Bordo)',
  'Piamonte',
  'Piendamó',
  'Puerto Tejada',
  'Puracé (Coconuco)',
  'Rosas',
  'San Sebastián',
  'Santa Rosa',
  'Santander de Quilichao',
  'Silvia',
  'Sotará (Paispamba)',
  'Suárez',
  'Sucre',
  'Timbío',
  'Timbiquí',
  'Toribío',
  'Totoró',
  'Villa Rica'
];

(async () => {
  const antes = await prisma.ciudad.count();
  console.log(`Ciudades antes: ${antes}`);

  for (const nombre of MUNICIPIOS_CAUCA) {
    await prisma.ciudad.upsert({
      where: { nombre },
      update: {},
      create: { nombre, departamento: 'Cauca', activa: true }
    });
  }

  const despues = await prisma.ciudad.count();
  console.log(`Ciudades después: ${despues}`);
  console.log(`Creadas: ${despues - antes}`);
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});