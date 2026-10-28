// Crea un ADMIN si no existe. Idempotente: si ya existe, no hace nada.
// Uso: node prisma/seed-admin.js [email] [password]
// Ej:  node prisma/seed-admin.js admin@agendacaucana.com MiClaveSegura123
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

const EMAIL = process.argv[2] || 'admin@agendacaucana.com';
const PASSWORD = process.argv[3] || 'CambiarEstaClave123!';

(async () => {
  const existente = await prisma.usuario.findUnique({ where: { email: EMAIL } });
  if (existente) {
    if (existente.rol === 'ADMIN') {
      console.log(`ℹ️  Ya existe admin: ${EMAIL} (id=${existente.id}). No hago nada.`);
    } else {
      console.error(`❌ Ya existe usuario con email ${EMAIL} con rol ${existente.rol}. No lo toco.`);
      process.exit(1);
    }
    return;
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const admin = await prisma.usuario.create({
    data: {
      email: EMAIL,
      passwordHash,
      rol: 'ADMIN',
      activo: true,
      nombre: 'Administrador'
    }
  });
  console.log(`✅ Admin creado: ${admin.email} (id=${admin.id})`);
  console.log(`   Contraseña: ${PASSWORD}`);
  console.log(`   ⚠️  Cámbiala en producción.`);
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});