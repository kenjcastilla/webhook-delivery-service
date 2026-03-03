import { Router, Response, Request, NextFunction } from 'express';
import { db } from '../../db/index.js';
import { deliveryQueue } from '../../queue/deliveryQueue.js';
import { DeliveryStatus } from '@prisma/client';

export const deliveriesRouter = Router();


/**GET request to api/v1/deliveries
 * List deliveries with optional status filter
 */
deliveriesRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
   try {
      const { status, subscriberId } = req.query; 
      const deliveries = await db.delivery.findMany({
         where: {
            ...(status ? { status: status as DeliveryStatus } : {}),
            ...(subscriberId ? { subscriberId: String(subscriberId)} : {}),
         },
         include: { event: true },
         orderBy: { createdAt: 'desc'},
         take: 100,
      });
      res.json(deliveries);
   } catch (e) {
      next(e);
   }
});

/**GET request to api/v1/deliveries:id
 * Show a delivery (given an ID) with all associated attempt logs
 */
deliveriesRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
   try {
   const delivery = await db.delivery.findUnique({
      where: { id: req.params.id },
      include: {
         event: true,
         subscriber: true,
         logs: { orderBy: { createdAt: 'desc' } },
      },
   })
   if (!delivery) {
      res.status(400).json({ error: 'Delivery not found' });
      return;
   }
   res.json(delivery);
} catch (e) {
   next(e);
}
});

/**POST request to api/v1/deliveries/:id/retry
 * Manually retry a dead of failed delivery
 */
deliveriesRouter.post('/:id/retry', async (req: Request, res: Response, next: NextFunction) => {
   try {
      const delivery = await db.delivery.findUnique({
         where: { id: req.params.id },
      });

      if (!delivery) {
         res.status(400).json({ error: 'Delivery not found'});
         return;
      }

      if (delivery.status === DeliveryStatus.DELIVERED) {
         res.status(400).json({ error: 'Delivery already succeeded' });
         return;
      }

      //Reset delivery state and re-queue
      await deliveryQueue.add('deliver', { deliveryId: delivery.id });

      res.json({ message: 'Delivery re-queued', deliveryId: delivery.id });
      
   } catch (e) {
      next(e);
   }
});
