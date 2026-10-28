require('dotenv').config({
  path: require('node:path').resolve(__dirname, '../.env'),
});

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const LUGARES_EVENTOS = [
  'Land Disco',
  'La Industria Disco Club',
  'Discoteca Sandunga VIP',
  'Discoteca New York',
  'Arena Rose',
  'Rogelio Bar',
  'Kukaramakara Popayán',
  'Soul-Makossa Social Club',
  'Bruma The Authentic Pub',
  'URBANcocktails',
  'Discoteca Señora Lola',
  'Discoteca Oasis VIP',
  'La Iguana Salsa Video Bar',
  'Motivos Video Bar',
  'Wipala Galería Café Bar',
  'Gotica Bar',
  'Ana Kaona Café Bar',
  'Narguile Terraza',
  'Rumba Del Norte',
  'Vulcano Bar',
  'Célebre Centro de Eventos',
  'Centro Recreativo Pisojé - Comfacauca',
  'La Castellana Campestre',
  'Villa Alejandra Eventos y Hospedaje',
  'La Torre Centro Recreacional',
  'IBIZA Salón de Eventos',
  'Salón de Eventos Dorado',
  'Hotel Terraza Club',
  'Corporación Club Campestre Popayán',
  'Club Popayán',
  'Casa de Eventos El Edén de Mis Abuelos',
  'Salón Fiestas',
  'Estadero y Salón de Eventos El Fogón Llanero',
  'Eduardo Santos Restaurante y Centro de Eventos',
  'Ecoparque Rayos del Sol Cauca',
].map((nombre) => ({
  nombre,
  direccion: 'Popayán, Cauca',
  ciudadId: 1,
  activo: true,
}));

async function main() {
  let creados = 0;
  let omitidos = 0;

  for (const lugar of LUGARES_EVENTOS) {
    const existente = await prisma.lugar.findFirst({
      where: { nombre: lugar.nombre, ciudadId: lugar.ciudadId },
    });

    if (existente) {
      omitidos++;
      continue;
    }

    await prisma.lugar.create({ data: lugar });
    creados++;
  }

  console.log(`Lugares de eventos: ${creados} creados, ${omitidos} omitidos, ${LUGARES_EVENTOS.length} total.`);
}

main()
  .catch((error) => {
    console.error('Error al crear los lugares de eventos:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
