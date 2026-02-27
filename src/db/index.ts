import * as dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();

declare global {
   var __prisma: PrismaClient | undefined;
}

export const db: PrismaClient = global.__prisma ?? new PrismaClient({
   log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['warn', 'error'],
});

if (process.env.NODE_ENV !== 'production') {
   global.__prisma = db;
}
