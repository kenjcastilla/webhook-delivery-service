import { NextFunction, Request, Response, Router } from "express";
import { Prisma } from "@prisma/client";
import { treeifyError, z } from "zod";
import { db } from "../../db/index.js";
import { deliveryQueue } from "../../queue/deliveryQueue.js";
import { logger } from "../../utils/logger.js";


export const eventsRouter = Router();

const IngestEventSchema = z.object({
   eventType: z.string().min(1).max(100),
   payload: z.record(z.string(), z.unknown()),
});

/**
 * POST /api/v1/events
 * Ingest a new event and attach it to respective subscribers
 */
eventsRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
   try {
      const parsed = IngestEventSchema.safeParse(req.body);
      if (!parsed.success) {
         res.status(400).json({ error: 'Invalid request body', details: treeifyError(parsed.error) });
         return;
      }

      const { eventType, payload } = parsed.data;

      // Find active subscribers listening to this event type
      const subscribers = await db.subscriber.findMany({
         where: {
            isActive: true,
            eventTypes: { has: eventType }
         },
      });

      if (subscribers.length === 0) {
         res.status(202).json({ message: "Event accepted; no active subscribers matched"});
         return;
      }

      // Persist the event; create a delivery record for each subscriber
      const event = await db.event.create({
         data: {
            eventType,
            payload: payload as Prisma.InputJsonValue,
            deliveries: {
               create: subscribers.map((s) => ({
                  subscriberId: s.id,
                  maxAttempts: 5,
               })),
            }
         },
         include: { deliveries: true },
      });

      // Enqueue a BullMQ job for each delivery
      const jobs = event.deliveries.map((d) => 
         deliveryQueue.add('deliver', { deliveryId: d.id })
      );
      await Promise.all(jobs);

      logger.info(`Event ${event.id} (${eventType}) queued for ${subscribers.length} subscriber(s)`);

      res.status(202).json({
         eventId: event.id,
         deliveriesCreated: event.deliveries.length,
      });
   } catch (e) {
      next(e);
   }
});

/**
 * GET /api/v1/events/:id
 * Retrieve a single event along with its delivery statuses
 */
eventsRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
   try {
      const event = await db.event.findUnique({
         where: { id: req.params.id },
         include: {
            deliveries: {
               include: { logs: { orderBy: { createdAt: 'asc' } } }
            }
         }
      });

      if (!event) {
         res.status(404).json({ error: "Event not found" })
      }
      res.json(event);
   } catch (e) {
      next(e);
   }
});
