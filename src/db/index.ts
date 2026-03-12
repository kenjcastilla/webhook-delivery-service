import * as dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

dotenv.config();

declare global {
   var __prisma: PrismaClient | undefined;
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL || '' });

export const db: PrismaClient = global.__prisma ?? new PrismaClient({
   log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['warn', 'error'],
   adapter
});

if (process.env.NODE_ENV !== 'production') {
   global.__prisma = db;
}
