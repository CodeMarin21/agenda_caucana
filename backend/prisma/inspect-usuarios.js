// Inspección de usuarios — SOLO LECTURA, no borra nada.
// Uso: node prisma/inspect-usuarios.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const porRol = await prisma.usuario.groupBy({
    by: ['rol'],
    _count: { _all: true }
  });
  console.log('\n=== Conteo por rol ===');
  console.table(porRol.map(r => ({ rol: r.rol, cantidad: r._count._all })));

  for (const rol of ['ADMIN', 'ORGANIZADOR', 'JUGADOR', 'USUARIO']) {
    const total = porRol.find(r => r.rol === rol)?._count._all || 0;
    if (total === 0) {
      console.log(`\n=== ${rol} — sin registros ===`);
      continue;
    }

    // Los 10 más viejos
    const viejos = await prisma.usuario.findMany({
      where: { rol },
      select: { id: true, email: true, username: true, activo: true, creadoEn: true },
      orderBy: { creadoEn: 'asc' },
      take: 10
    });
    console.log(`\n=== ${rol} (total: ${total}) — 10 más ANTIGUOS ===`);
    console.table(viejos);

    // Los 10 más nuevos
    const nuevos = await prisma.usuario.findMany({
      where: { rol },
      select: { id: true, email: true, username: true, activo: true, creadoEn: true },
      orderBy: { creadoEn: 'desc' },
      take: 10
    });
    console.log(`=== ${rol} — 10 más RECIENTES ===`);
    console.table(nuevos);
  }

  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});