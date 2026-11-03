import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Coordenadas aproximadas de Popayán (centro histórico)
const LUGARES = [
  { nombre: 'Catedral Basílica Nuestra Señora de la Asunción', direccion: 'Parque Caldas, Centro', lat: 2.44191, lng: -76.60643, categoria: 'iglesias' },
  { nombre: 'Iglesia de San Francisco', direccion: 'Calle 4 # 9-40, Centro', lat: 2.44076, lng: -76.60831, categoria: 'iglesias' },
  { nombre: 'Iglesia La Ermita', direccion: 'Carrera 5 # 2-15, Centro', lat: 2.44254, lng: -76.60687, categoria: 'iglesias' },
  { nombre: 'Iglesia de Santo Domingo', direccion: 'Calle 4 # 5-60, Centro', lat: 2.44012, lng: -76.60747, categoria: 'iglesias' },
  { nombre: 'Puente del Humilladero', direccion: 'Carrera 5 con Calle 3, Centro', lat: 2.44132, lng: -76.60521, categoria: 'historica' },
  { nombre: 'Museo Nacional Guillermo Valencia', direccion: 'Calle 3 # 5-38, Centro', lat: 2.44185, lng: -76.60768, categoria: 'cultural' },
  { nombre: 'Teatro Municipal Guillermo Valencia', direccion: 'Calle 3 # 6-16, Centro', lat: 2.44103, lng: -76.60654, categoria: 'cultural' },
  { nombre: 'Morro de Tulcán', direccion: 'Carrera 8 con Calle 7, Norte', lat: 2.44631, lng: -76.60972, categoria: 'historica' },
  { nombre: 'Panteón de los Próceres', direccion: 'Calle 5 # 6-24, Centro', lat: 2.44255, lng: -76.60681, categoria: 'historica' },
  { nombre: 'Torre del Reloj', direccion: 'Carrera 7 con Calle 5, Centro', lat: 2.44153, lng: -76.60602, categoria: 'historica' },
  { nombre: 'Parque Caldas', direccion: 'Centro histórico', lat: 2.44141, lng: -76.60623, categoria: 'cultural' },
  { nombre: 'Mercado del Barrio Bolívar', direccion: 'Barrio Bolívar, Centro', lat: 2.44392, lng: -76.60671, categoria: 'gastronomia' },
];

async function main() {
  console.log('🌱 Iniciando seed de Agenda Caucana...');

  // 1. Ciudad
  const popayan = await prisma.ciudad.upsert({
    where: { nombre: 'Popayán' },
    update: {},
    create: { nombre: 'Popayán', departamento: 'Cauca' },
  });
  console.log(`✔ Ciudad: ${popayan.nombre}`);

  // 2. Categorías de eventos (necesarias para el módulo de eventos, no gamificación)
  const categoriasSeed = [
    { nombre: 'Música', slug: 'musica', icono: '🎵' },
    { nombre: 'Teatro', slug: 'teatro', icono: '🎭' },
    { nombre: 'Cultural', slug: 'cultural', icono: '🎨' },
    { nombre: 'Gastronomía', slug: 'gastronomia', icono: '🍽️' },
    { nombre: 'Deportes', slug: 'deportes', icono: '⚽' },
    { nombre: 'Educación', slug: 'educacion', icono: '📚' },
  ];
  for (const c of categoriasSeed) {
    await prisma.categoria.upsert({
      where: { slug: c.slug },
      update: {},
      create: c,
    });
  }
  console.log(`✔ Categorías: ${categoriasSeed.length}`);

  // 3. Lugares
  for (const l of LUGARES) {
    const existe = await prisma.lugar.findFirst({
      where: { nombre: l.nombre, ciudadId: popayan.id },
    });

    const lugar = existe ?? await prisma.lugar.create({
      data: {
        nombre: l.nombre,
        direccion: l.direccion,
        ciudadId: popayan.id,
        latitud: l.lat,
        longitud: l.lng,
        radioMetros: 100,
        activo: true,
      },
    });
  }
  console.log(`✔ Lugares: ${LUGARES.length}`);

  console.log('\n✅ Seed completado.');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error('❌ Error en seed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });