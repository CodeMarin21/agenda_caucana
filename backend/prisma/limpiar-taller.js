// Limpia los usuarios del taller (username ~ '^u[0-9]+_[0-9]+$').
// Uso:  node prisma/limpiar-taller.js           (dry-run: solo cuenta)
//       node prisma/limpiar-taller.js --apply   (borra de verdad)
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const APLICAR = process.argv.includes('--apply');
const PATRON = /^u[0-9]+_[0-9]+$/;

(async () => {
  const todos = await prisma.usuario.findMany({
    select: { id: true, username: true, email: true, rol: true, creadoEn: true }
  });

  const aBorrar = todos.filter(u => u.username && PATRON.test(u.username));
  const aConservar = todos.filter(u => !u.username || !PATRON.test(u.username));

  console.log(`\nTotal usuarios: ${todos.length}`);
  console.log(`Se BORRARÍAN:  ${aBorrar.length}`);
  console.log(`Se CONSERVAN:  ${aConservar.length}`);

  console.log('\n=== Usuarios que se CONSERVAN ===');
  console.table(aConservar.map(u => ({
    id: u.id,
    username: u.username,
    email: u.email,
    rol: u.rol
  })));

  if (!APLICAR) {
    console.log('\n⚠️  DRY-RUN — no se borró nada.');
    console.log('   Corre con --apply para ejecutar el borrado.');
    await prisma.$disconnect();
    return;
  }

  const ids = aBorrar.map(u => u.id);
  console.log(`\nBorrando ${ids.length} usuarios y dependencias...`);

  const resultado = await prisma.usuario.deleteMany({
    where: { id: { in: ids } }
  });

  console.log(`\n✅ Borrados: ${resultado.count}`);
  const restantes = await prisma.usuario.count();
  console.log(`Usuarios restantes: ${restantes}`);

  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});