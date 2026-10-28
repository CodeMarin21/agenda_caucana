// Este archivo existe como referencia del patrón Singleton aplicado a la BD
// La instancia real vive en src/config/database.ts
// Este archivo documenta el patrón para que quede explícito en la carpeta patterns/

// Patrón Singleton — garantiza que solo exista UNA instancia de PrismaClient
// en toda la aplicación, sin importar cuántos módulos lo importen.
//
// SIN Singleton:
//   módulo A → new PrismaClient() → conexión 1
//   módulo B → new PrismaClient() → conexión 2
//   módulo C → new PrismaClient() → conexión 3
//   → agota el pool de conexiones de PostgreSQL
//
// CON Singleton (lo que hacemos):
//   módulo A → Database.getInstance() → conexión 1
//   módulo B → Database.getInstance() → conexión 1 (misma instancia)
//   módulo C → Database.getInstance() → conexión 1 (misma instancia)
//   → una sola conexión compartida de forma segura
//
// La implementación real está en: src/config/database.ts
// Todos los módulos importan desde ahí:
//   import { prisma } from '../../config/database';

export const SINGLETON_NOTE = 'Ver implementación en src/config/database.ts';