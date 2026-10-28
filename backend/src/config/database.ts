import { PrismaClient } from '@prisma/client';

class Database {
  private static instance: PrismaClient;

  static getInstance(): PrismaClient {
    if (!Database.instance) {
      Database.instance = new PrismaClient({
        log: process.env.NODE_ENV === 'development'
          ? ['query', 'info', 'warn', 'error']
          : ['error'],
      });
    }
    return Database.instance;
  }
}

export const prisma = Database.getInstance();