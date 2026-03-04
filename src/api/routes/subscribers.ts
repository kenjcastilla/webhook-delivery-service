import { NextFunction, Request, Response, Router } from "express";
import z, { treeifyError } from "zod";
import { db } from "../../db/index.js";
import { randomUUID } from "node:crypto";


export const subscribersRouter = Router();

const CreateSubscriberSchema = z.object({
   name: z.string().min(1).max(100),
   targetUrl: z.url(),
   eventTypes: z.array(z.string().min(1)).min(1),
});

const UpdateSubscriberSchema = CreateSubscriberSchema.partial().extend({
   isActive: z.boolean().optional(),
});

/**
 * POST api/v1/subscribers
 * Register a new webhook subscriber
 */
subscribersRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
   try {
      const parsed = CreateSubscriberSchema.safeParse(req.body);
      if (!parsed.success) {
         res.status(400).json({ error: "Invalid request body", details: treeifyError(parsed.error) });
         return;
      }

      const subscriber = await db.subscriber.create({
         data: {
            ...parsed.data,
            secret: randomUUID().replace(/-/g, ''),  //Generate secret      
         },
      });

      res.status(201).json(subscriber);
   } catch (e) {
      
   }
});

/**
 * GET /api/v1/subscribers
 * List all subscribers
 */
subscribersRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
   try {
    const subscribers = await db.subscriber.findMany({
      orderBy: { createdAt: 'desc'},
    });
    res.json(subscribers);
   } catch (e) {
      next(e);
   }
});

/**
 * GET /api/v1/subscribers/:id
 * Get a single subscriber using id
 */
subscribersRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
   try { 
      const subscriber = await db.subscriber.findUnique({ where: { id: req.params.id }});
      if (!subscriber) {
         res.status(400).json({ error: "Subscriber not found" });
         return;
      }
      res.json(subscriber);
   } catch (e) {
      next(e);
   }
});

/**
 * PATCH /api/v1/subscribers/:id
 * Update subscriber using subscriber id
 */
subscribersRouter.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
   try {
      const parsed = UpdateSubscriberSchema.safeParse(req.body);
      if (!parsed.success) {
         res.status(400).json({ error: "Invalid request body", details: treeifyError(parsed.error) });
         return;
      }

      const subscriber = await db.subscriber.update({
         where: { id: req.params.id},
         data: parsed.data,
      });

      res.json(subscriber);
   } catch (e) {
      next(e);
   }
});

/**
 * DELETE /api/v1/subscribers/:id
 * Remove subscriber using subscriber id
 */
subscribersRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
   try {
      const subscriber = await db.subscriber.delete({ where: { id: req.params.id } });
      res.status(204).send();
   } catch (e) {
      next(e);
   }
});
