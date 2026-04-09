import { NextFunction, Request, Response, Router } from "express";
import { PrismaClient } from "@prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/client";
import z, { treeifyError } from "zod";
import { db as prisma } from "../../db/index";
import { randomBytes } from "node:crypto";

const CreateSubscriberSchema = z.object({
   name: z.string().min(1).max(100),
   targetUrl: z.url(),
   eventTypes: z.array(z.string().min(1)).min(1),
});

const UpdateSubscriberSchema = CreateSubscriberSchema.partial().extend({
   isActive: z.boolean().optional(),
});

export function createSubscribersRouter(db: PrismaClient = prisma) {
   const router = Router();

   router.post('/', async (req: Request, res: Response, next: NextFunction) => {
      try {
         const parsed = CreateSubscriberSchema.safeParse(req.body);
         if (!parsed.success) {
            res.status(400).json({ error: "Invalid request body", details: treeifyError(parsed.error) });
            return;
         }

         const subscriber = await db.subscriber.create({
            data: {
               ...parsed.data,
               secret: randomBytes(32).toString("hex"),
            },
         });
         const { secret: _secret, ...subscriberWithoutSecret } = subscriber;
         res.status(201).json(subscriberWithoutSecret);
      } catch (e) {
         next(e);
      }
   });

   router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
      try {
         const subscribers = await db.subscriber.findMany({
            select: {
               id: true,
               name: true,
               targetUrl: true,
               eventTypes: true,
               isActive: true,
               createdAt: true,
               updatedAt: true,
            },
            orderBy: { createdAt: 'desc' },
         });
         res.json(subscribers);
      } catch (e) {
         next(e);
      }
   });

   router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
      try {
         const subscriber = await db.subscriber.findUnique({
            select: {
               id: true,
               name: true,
               targetUrl: true,
               eventTypes: true,
               isActive: true,
               createdAt: true,
               updatedAt: true,
            },
            where: { id: req.params.id },
         });
         if (!subscriber) {
            res.status(404).json({ error: "Subscriber not found" });
            return;
         }
         res.json(subscriber);
      } catch (e) {
         next(e);
      }
   });

   router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
      try {
         const parsed = UpdateSubscriberSchema.safeParse(req.body);
         if (!parsed.success) {
            res.status(400).json({ error: "Invalid request body", details: treeifyError(parsed.error) });
            return;
         }

         const subscriber = await db.subscriber.update({
            select: {
               id: true,
               name: true,
               targetUrl: true,
               eventTypes: true,
               isActive: true,
               createdAt: true,
               updatedAt: true,
            },
            where: { id: req.params.id },
            data: parsed.data,
         });

         res.json(subscriber);
      } catch (e) {
         next(e);
      }
   });

   router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
      try {
         await db.subscriber.delete({ where: { id: req.params.id } });
         res.status(204).send();
      } catch (e) {
         const error = e as any;
         if ((error instanceof PrismaClientKnownRequestError || error?.code) && error.code === 'P2025') {
            res.status(404).json({ error: "Subscriber not found" });
            return;
         }
         next(e);
      }
   });

   return router;
}

export const subscribersRouter = createSubscribersRouter();
