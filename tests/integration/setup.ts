import { PrismaClient } from "@prisma/client";
import { createApp } from "../../src/api/app";
import { deliveryQueue } from "../../src/queue/deliveryQueue";

export const prisma = new PrismaClient();
export const app = createApp();


beforeAll(async () => {
   await prisma.$connect();
});

afterAll(async () => {
   await prisma.$disconnect();
   await deliveryQueue.close();
});

beforeEach(async () => {
   // Clear database tables before each test
   await prisma.delivery.deleteMany();
   await prisma.event.deleteMany();
   await prisma.subscriber.deleteMany();
   await deliveryQueue.obliterate({ force: true });
});