import axios from "axios";
import { DeliveryService } from "./deliveryService";
import { config } from "../config";
import { prismaMock } from "../../singleton";
import { DeliveryStatus } from "@prisma/client";
import { UnrecoverableError } from "bullmq";


jest.mock("axios", () => ({
   ...jest.requireActual("axios"),
   post: jest.fn(),
}));

describe("DeliveryService Test Suite", () => {
   const service = new DeliveryService();

   test("should set DeliveryStatus to DEAD upon failed final attempt", async () => {
      prismaMock.delivery.findUniqueOrThrow.mockResolvedValue({
         id: "test-delivery-id",
         eventId: "test-event-id",
         subscriberId: "test-subscriber-id",
         status: "PENDING",
         attempts: config.delivery.maxAttempts - 1, // Simulate this being the final attempt
         maxAttempts: config.delivery.maxAttempts,
         nextRetryAt: null,
         lastAttemptAt: null,
         createdAt: new Date(),
         updatedAt: new Date(),
         event: {
            payload: { orderId: "test-order-id" },
            eventType: "test.order.created",
         },
         subscriber: {
            targetUrl: "https://example.com/webhook",
            secret: "test-secret"
         }
      } as any);

      (axios.post as jest.Mock).mockRejectedValue(new Error("Connection refused"));
      prismaMock.$transaction.mockResolvedValue([]);
      prismaMock.deliveryLog.create.mockResolvedValue({} as any);
      prismaMock.delivery.update.mockResolvedValue({} as any);

      await expect(service.attemptDelivery("test-delivery-id", config.delivery.maxAttempts, prismaMock)).rejects.toThrow(UnrecoverableError);

      expect(prismaMock.delivery.update).toHaveBeenCalledWith(
         expect.objectContaining({
            where: { id: "test-delivery-id" },
            data: expect.objectContaining({ status: DeliveryStatus.DEAD }),
         }),
      );
   });

   test("should set DeliveryStatus to DEAD after receiving 4xx response", async () => {
      prismaMock.delivery.findUniqueOrThrow.mockResolvedValue({
         id: "test-delivery-id",
         eventId: "test-event-id",
         subscriberId: "test-subscriber-id",
         status: "PENDING",
         attempts: 0,
         maxAttempts: config.delivery.maxAttempts,
         nextRetryAt: null,
         lastAttemptAt: null,
         createdAt: new Date(),
         updatedAt: new Date(),
         event: {
            payload: { orderId: "test-order-id" },
            eventType: "test.order.created",
         },
         subscriber: {
            targetUrl: "https://example.com/webhook",
            secret: "test-secret"
         }
      } as any);

      (axios.post as jest.Mock).mockResolvedValue({ status: 400, data: { error: "Bad Request" } });
      prismaMock.$transaction.mockResolvedValue([]);
      prismaMock.deliveryLog.create.mockResolvedValue({} as any);
      prismaMock.delivery.update.mockResolvedValue({} as any);

      await expect(service.attemptDelivery("test-delivery-id", 1, prismaMock)).rejects.toThrow(UnrecoverableError);

      expect(prismaMock.delivery.update).toHaveBeenCalledWith(
         expect.objectContaining({
            where: { id: "test-delivery-id" },
            data: expect.objectContaining({ status: DeliveryStatus.DEAD }),
         }),
      );
   });

   test("should set DeliveryStatus to DEAD after receiving 3xx response", async () => {
      prismaMock.delivery.findUniqueOrThrow.mockResolvedValue({
         id: "test-delivery-id",
         eventId: "test-event-id",
         subscriberId: "test-subscriber-id",
         status: "PENDING",
         attempts: 0,
         maxAttempts: config.delivery.maxAttempts,
         nextRetryAt: null,
         lastAttemptAt: null,
         createdAt: new Date(),
         updatedAt: new Date(),
         event: {
            payload: { orderId: "test-order-id" },
            eventType: "test.order.created",
         },
         subscriber: {
            targetUrl: "https://example.com/webhook",
            secret: "test-secret"
         }
      } as any);

      (axios.post as jest.Mock).mockRejectedValue({
         isAxiosError: true,
         response: { status: 302, data: {} },
      });

      prismaMock.$transaction.mockResolvedValue([]);
      prismaMock.deliveryLog.create.mockResolvedValue({} as any);
      prismaMock.delivery.update.mockResolvedValue({} as any);

      await expect(service.attemptDelivery("test-delivery-id", 1, prismaMock)).rejects.toThrow(UnrecoverableError);

      expect(prismaMock.delivery.update).toHaveBeenCalledWith(
         expect.objectContaining({
            where: { id: "test-delivery-id" },
            data: expect.objectContaining({ status: DeliveryStatus.DEAD }),
         }),
      );
   });

   test("should set DeliveryStatus to FAILED after failed but not final attempt", async () => {
      prismaMock.delivery.findUniqueOrThrow.mockResolvedValue({
         id: "test-delivery-id",
         eventId: "test-event-id",
         subscriberId: "test-subscriber-id",
         status: "PENDING",
         attempts: 0, // Simulate this being the first attempt
         maxAttempts: config.delivery.maxAttempts,
         nextRetryAt: null,
         lastAttemptAt: null,
         createdAt: new Date(),
         updatedAt: new Date(),
         event: {
            payload: { orderId: "test-order-id" },
            eventType: "test.order.created",
         },
         subscriber: {
            targetUrl: "https://example.com/webhook",
            secret: "test-secret"
         }
      } as any);

      (axios.post as jest.Mock).mockRejectedValue(new Error("Connection refused"));
      prismaMock.$transaction.mockResolvedValue([]);
      prismaMock.deliveryLog.create.mockResolvedValue({} as any);
      prismaMock.delivery.update.mockResolvedValue({} as any);

      await expect(service.attemptDelivery("test-delivery-id", 1, prismaMock)).rejects.toThrow();

      expect(prismaMock.delivery.update).toHaveBeenCalledWith(
         expect.objectContaining({
            where: { id: "test-delivery-id" },
            data: expect.objectContaining({ status: DeliveryStatus.FAILED }),
         }),
      );
   });

   test("should set DeliveryStatus to DELIVERED after successful attempt", async () => {
      prismaMock.delivery.findUniqueOrThrow.mockResolvedValue({
         id: "test-delivery-id",
         eventId: "test-event-id",
         subscriberId: "test-subscriber-id",
         status: "PENDING",
         attempts: 0,
         maxAttempts: config.delivery.maxAttempts,
         nextRetryAt: null,
         lastAttemptAt: null,
         createdAt: new Date(),
         updatedAt: new Date(),
         event: {
            payload: { orderId: "test-order-id" },
            eventType: "test.order.created",
         },
         subscriber: {
            targetUrl: "https://example.com/webhook",
            secret: "test-secret"
         }
      } as any);

      (axios.post as jest.Mock).mockResolvedValue({ status: 200, data: { success: true } });
      prismaMock.$transaction.mockResolvedValue([]);
      prismaMock.deliveryLog.create.mockResolvedValue({} as any);
      prismaMock.delivery.update.mockResolvedValue({} as any);

      await service.attemptDelivery("test-delivery-id", 1, prismaMock);

      expect(prismaMock.delivery.update).toHaveBeenCalledWith(
         expect.objectContaining({
            where: { id: "test-delivery-id" },
            data: expect.objectContaining({ status: DeliveryStatus.DELIVERED }),
         }),
      );
   });

});
