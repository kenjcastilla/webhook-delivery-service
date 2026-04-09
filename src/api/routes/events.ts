import { Router, Request, Response, NextFunction } from "express";
import { Prisma, PrismaClient } from "@prisma/client";
import { treeifyError, z } from "zod";
import { db as prisma } from "../../db/index";
import { deliveryQueue } from "../../queue/deliveryQueue";
import { logger } from "../../utils/logger";
import { config } from "../../config/index";

const IngestEventSchema = z.object({
   eventType: z.string().min(1).max(100),
   payload: z.record(z.string(), z.unknown()),
});

export function createEventsRouter(
   db: PrismaClient = prisma,
   queue = deliveryQueue
) {
   const router = Router();

   router.post('/', async (req: Request, res: Response, next: NextFunction) => {
      try {
         const parsed = IngestEventSchema.safeParse(req.body);
         if (!parsed.success) {
            res.status(400).json({ error: 'Invalid request body', details: treeifyError(parsed.error) });
            return;
         }

         const { eventType, payload } = parsed.data;

         const subscribers = await db.subscriber.findMany({
            where: {
               isActive: true,
               eventTypes: { has: eventType },
            },
         });

         const event = await db.event.create({
            data: {
               eventType,
               payload: payload as Prisma.InputJsonValue,
               deliveries: {
                  create: subscribers.map((subscriber) => ({
                     subscriberId: subscriber.id,
                     maxAttempts: config.delivery.maxAttempts,
                  })),
               },
            },
            include: { deliveries: true },
         });

         if (subscribers.length === 0) {
            res.status(202).json({ message: "Event accepted; no active subscribers matched" });
            return;
         }

         await queue.addBulk(
            event.deliveries.map((delivery) => ({
               name: 'deliver',
               data: { deliveryId: delivery.id },
            }))
         );

         logger.info(`Event ${event.id} (${eventType}) queued for ${subscribers.length} subscriber(s)`);

         res.status(202).json({
            eventId: event.id,
            deliveriesCreated: event.deliveries.length,
         });
      } catch (e) {
         next(e);
      }
   });

   router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
      try {
         const event = await db.event.findUnique({
            where: { id: req.params.id },
            include: {
               deliveries: {
                  include: { logs: { orderBy: { createdAt: 'asc' } } },
               },
            },
         });

         if (!event) {
            res.status(404).json({ error: "Event not found" });
            return;
         }

         res.json(event);
      } catch (e) {
         next(e);
      }
   });

   return router;
}

export const eventsRouter = createEventsRouter();
