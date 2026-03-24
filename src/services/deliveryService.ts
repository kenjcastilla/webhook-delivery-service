import crypto from "crypto";
import { db } from "../db/index.js";
import axios from "axios";
import { logger } from "../utils/logger.js";
import { DeliveryStatus } from "@prisma/client";
import { UnrecoverableError } from "bullmq";


export class DeliveryService {
   /**
    * Attempts an HTTP delivery for a given deliveryId and records the result in DeliveryLog.
    */

   async attemptDelivery(deliveryId: string, attemptNumber: number): Promise<void> {
      const delivery = await db.delivery.findUniqueOrThrow({
         where: { id: deliveryId },
         include: {
            event: { select: { payload: true, eventType: true } },
            subscriber: { select: { targetUrl: true, secret: true } }
         }
      });

      const { subscriber, event } = delivery;
      const startTime = Date.now();

      // Sign the payload
      const body = JSON.stringify(event.payload);
      const signature = this.sign(body, subscriber.secret);

      let statusCode: number | null = null;
      let responseBody: string | null = null;
      let errorMessage: string | null = null;
      let success = false;

      try {
         const response = await axios.post(subscriber.targetUrl, event.payload, {
            headers: {
               "Content-Type": "application/json",
               "X-Webhook-Signature": signature,
               "X-Webhook-Event": event.eventType,
               "X-Webhook-Delivery": deliveryId,
            },
            timeout: 10 * 1000, // 10s
            validateStatus: (status) => status < 500, // only server error codes (5xx) are relevant here
         });

         statusCode = response.status;
         responseBody = JSON.stringify(response.data).slice(0, 1000);
         success = response.status >= 200 && response.status < 300;
      } catch (e: unknown) {
         errorMessage = e instanceof Error ? e.message : String(e);
         logger.warn(`Delivery attempt failed for ${deliveryId}: ${errorMessage}`);
      }

      const duration = Date.now() - startTime;
      const isLastAttempt = attemptNumber >= delivery.maxAttempts;

      // Configure new delivery status
      let newStatus: DeliveryStatus;
      if (success) {
         newStatus = DeliveryStatus.DELIVERED;
      }
      // Won't retry a delivery after last attempt or upon receiving a 4xx response (client error)
      else if (isLastAttempt || (statusCode && statusCode >= 400 && statusCode < 500)) {
         newStatus = DeliveryStatus.DEAD;
      } else {
         newStatus = DeliveryStatus.FAILED;
      }

      // Persist attempt log and update delivery automatically
      await db.$transaction([
         db.deliveryLog.create({
            data: {
               deliveryId,
               attemptNumber,
               statusCode,
               responseBody,
               errorMessage,
               duration,
            },
         }),
         db.delivery.update({
            where: { id: deliveryId },
            data: {
               status: newStatus,
               attempts: attemptNumber,
               lastAttemptAt: new Date(),
            },
         }),
      ]);

      // Re-throw to notify BullMQ (notification to retry or mark as failed)
      if (!success) {
         if (isLastAttempt || (statusCode && statusCode >= 400 && statusCode < 500)) {
            throw new UnrecoverableError(errorMessage ?? `Delivery failed with status ${statusCode} and will not be retried`); // Won't retry
         }
         throw new Error(errorMessage ?? `Non-2xx response: ${statusCode}`); // Will retry
      }

      logger.info(`Delivery ${deliveryId} succeeded on attempt ${attemptNumber}`);
   }

   private sign(body: string, secret: string): string {
      return "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("hex");
   }
}