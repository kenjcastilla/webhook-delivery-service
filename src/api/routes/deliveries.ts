import { Router, Response, Request, NextFunction } from 'express';
import { db as prisma } from '../../db/index';
import { deliveryQueue } from '../../queue/deliveryQueue';
import { DeliveryStatus } from '@prisma/client';

export function createDeliveriesRouter(db = prisma, queue = deliveryQueue) {
  const router = Router();

  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status, subscriberId } = req.query;
      const deliveries = await db.delivery.findMany({
        where: {
          ...(status ? { status: status as DeliveryStatus } : {}),
          ...(subscriberId ? { subscriberId: String(subscriberId) } : {}),
        },
        include: { event: true },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
      res.json(deliveries);
    } catch (e) {
      next(e);
    }
  });

  router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const delivery = await db.delivery.findUnique({
        where: { id: req.params.id },
        include: {
          event: true,
          subscriber: true,
          logs: { orderBy: { createdAt: 'desc' } },
        },
      });

      if (!delivery) {
        res.status(400).json({ error: 'Delivery not found' });
        return;
      }

      res.json(delivery);
    } catch (e) {
      next(e);
    }
  });

  router.post('/:id/retry', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const delivery = await db.delivery.findUnique({
        where: { id: req.params.id },
      });

      if (!delivery) {
        res.status(400).json({ error: 'Delivery not found' });
        return;
      }

      if (delivery.status === DeliveryStatus.DELIVERED) {
        res.status(400).json({ error: 'Delivery already succeeded' });
        return;
      }

      await queue.add('deliver', { deliveryId: delivery.id });

      res.json({ message: 'Delivery re-queued', deliveryId: delivery.id });
    } catch (e) {
      next(e);
    }
  });

  return router;
}

export const deliveriesRouter = createDeliveriesRouter();
