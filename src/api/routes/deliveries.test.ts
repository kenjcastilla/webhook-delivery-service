import express from 'express';
import request from 'supertest';
import { DeliveryStatus } from '@prisma/client';
import { prismaMock } from '../../../singleton';
import { createDeliveriesRouter } from './deliveries';


jest.mock('../../queue/deliveryQueue.ts', () => ({
   deliveryQueue: {
      add: jest.fn(),
   },
}));

const deliveryQueueMock = {
   add: jest.fn(),
};

const app = express();
app.use(express.json());
app.use('/api/v1/deliveries', createDeliveriesRouter(prismaMock as any, deliveryQueueMock as any));

const dateNow = new Date().toISOString();

describe('Deliveries Route Test Suite', () => {
   beforeEach(() => {
      jest.clearAllMocks();
   });

   describe('GET /api/v1/deliveries - List Deliveries', () => {
      it('should return all deliveries without filters', async () => {
         const mockDeliveries = [
            {
               id: 'delivery-1',
               status: DeliveryStatus.PENDING,
               createdAt: dateNow,
               event: { id: 'event-1', eventType: 'test.event' },
            } as any,
            {
               id: 'delivery-2',
               status: DeliveryStatus.DELIVERED,
               createdAt: dateNow,
               event: { id: 'event-2', eventType: 'test.event' },
            } as any,
         ];

         prismaMock.delivery.findMany.mockResolvedValue(mockDeliveries);

         const response = await request(app).get('/api/v1/deliveries');

         expect(response.status).toBe(200);
         expect(response.body).toEqual(mockDeliveries);
         expect(prismaMock.delivery.findMany).toHaveBeenCalledWith({
            where: {},
            include: { event: true },
            orderBy: { createdAt: 'desc' },
            take: 100,
         });
      });

      it('should filter deliveries by status', async () => {
         const mockDeliveries = [
            {
               id: 'delivery-1',
               status: DeliveryStatus.PENDING,
               createdAt: dateNow,
               event: { id: 'event-1', eventType: 'test.event' },
            } as any,
         ];

         prismaMock.delivery.findMany.mockResolvedValue(mockDeliveries);

         const response = await request(app)
            .get('/api/v1/deliveries')
            .query({ status: DeliveryStatus.PENDING });

         expect(response.status).toBe(200);
         expect(response.body).toEqual(mockDeliveries);
         expect(prismaMock.delivery.findMany).toHaveBeenCalledWith({
            where: { status: DeliveryStatus.PENDING },
            include: { event: true },
            orderBy: { createdAt: 'desc' },
            take: 100,
         });
      });

      it('should filter deliveries by subscriberId', async () => {
         const mockDeliveries = [
            {
               id: 'delivery-1',
               status: DeliveryStatus.PENDING,
               createdAt: dateNow,
               event: { id: 'event-1', eventType: 'test.event' },
            } as any,
         ];

         prismaMock.delivery.findMany.mockResolvedValue(mockDeliveries);

         const response = await request(app)
            .get('/api/v1/deliveries')
            .query({ subscriberId: 'subscriber-123' });

         expect(response.status).toBe(200);
         expect(response.body).toEqual(mockDeliveries);
         expect(prismaMock.delivery.findMany).toHaveBeenCalledWith({
            where: { subscriberId: 'subscriber-123' },
            include: { event: true },
            orderBy: { createdAt: 'desc' },
            take: 100,
         });
      });

      it('should filter deliveries by both status and subscriberId', async () => {
         const mockDeliveries = [
            {
               id: 'delivery-1',
               status: DeliveryStatus.PENDING,
               createdAt: dateNow,
               event: { id: 'event-1', eventType: 'test.event' },
            } as any,
         ];

         prismaMock.delivery.findMany.mockResolvedValue(mockDeliveries);

         const response = await request(app)
            .get('/api/v1/deliveries')
            .query({ status: DeliveryStatus.PENDING, subscriberId: 'subscriber-123' });

         expect(response.status).toBe(200);
         expect(response.body).toEqual(mockDeliveries);
         expect(prismaMock.delivery.findMany).toHaveBeenCalledWith({
            where: {
               status: DeliveryStatus.PENDING,
               subscriberId: 'subscriber-123',
            },
            include: { event: true },
            orderBy: { createdAt: 'desc' },
            take: 100,
         });
      });

      it('should handle database errors', async () => {
         prismaMock.delivery.findMany.mockRejectedValue(new Error('Database error'));

         const response = await request(app).get('/api/v1/deliveries');

         expect(response.status).toBe(500);
      });
   });

   describe('GET /api/v1/deliveries/:id - Get Single Delivery', () => {
      it('should return a delivery with all relations', async () => {
         const mockDelivery = {
            id: 'delivery-1',
            status: DeliveryStatus.PENDING,
            createdAt: dateNow,
            event: { id: 'event-1', eventType: 'test.event' },
            subscriber: { id: 'subscriber-1', targetUrl: 'https://example.com' },
            logs: [
               { id: 'log-1', statusCode: 200, createdAt: dateNow },
               { id: 'log-2', statusCode: 500, createdAt: dateNow },
            ],
         } as any;

         prismaMock.delivery.findUnique.mockResolvedValue(mockDelivery);

         const response = await request(app).get('/api/v1/deliveries/delivery-1');

         expect(response.status).toBe(200);
         expect(response.body).toEqual(mockDelivery);
         expect(prismaMock.delivery.findUnique).toHaveBeenCalledWith({
            where: { id: 'delivery-1' },
            include: {
               event: true,
               subscriber: true,
               logs: { orderBy: { createdAt: 'desc' } },
            },
         });
      });

      it('should return 400 when delivery not found', async () => {
         prismaMock.delivery.findUnique.mockResolvedValue(null);

         const response = await request(app).get('/api/v1/deliveries/non-existent-id');

         expect(response.status).toBe(400);
         expect(response.body).toEqual({ error: 'Delivery not found' });
      });

      it('should handle database errors', async () => {
         prismaMock.delivery.findUnique.mockRejectedValue(new Error('Database error'));

         const response = await request(app).get('/api/v1/deliveries/delivery-1');

         expect(response.status).toBe(500);
      });
   });

   describe('POST /api/v1/deliveries/:id/retry - Retry Delivery', () => {
      it('should successfully retry a pending delivery', async () => {
         const mockDelivery = {
            id: 'delivery-1',
            status: DeliveryStatus.PENDING,
            eventId: 'event-1',
            subscriberId: 'subscriber-1',
         } as any;

         prismaMock.delivery.findUnique.mockResolvedValue(mockDelivery);
         deliveryQueueMock.add.mockResolvedValue({ id: 'job-1' });

         const response = await request(app).post('/api/v1/deliveries/delivery-1/retry');

         expect(response.status).toBe(200);
         expect(response.body).toEqual({
            message: 'Delivery re-queued',
            deliveryId: 'delivery-1',
         });
         expect(deliveryQueueMock.add).toHaveBeenCalledWith('deliver', {
            deliveryId: 'delivery-1',
         });
      });

      it('should successfully retry a failed delivery', async () => {
         const mockDelivery = {
            id: 'delivery-1',
            status: DeliveryStatus.DEAD,
            eventId: 'event-1',
            subscriberId: 'subscriber-1',
         } as any;

         prismaMock.delivery.findUnique.mockResolvedValue(mockDelivery);
         deliveryQueueMock.add.mockResolvedValue({ id: 'job-1' });

         const response = await request(app).post('/api/v1/deliveries/delivery-1/retry');

         expect(response.status).toBe(200);
         expect(response.body).toEqual({
            message: 'Delivery re-queued',
            deliveryId: 'delivery-1',
         });
         expect(deliveryQueueMock.add).toHaveBeenCalledWith('deliver', {
            deliveryId: 'delivery-1',
         });
      });

      it('should return 400 when delivery not found', async () => {
         prismaMock.delivery.findUnique.mockResolvedValue(null);

         const response = await request(app).post('/api/v1/deliveries/non-existent-id/retry');

         expect(response.status).toBe(400);
         expect(response.body).toEqual({ error: 'Delivery not found' });
         expect(deliveryQueueMock.add).not.toHaveBeenCalled();
      });

      it('should return 400 when delivery is already delivered', async () => {
         const mockDelivery = {
            id: 'delivery-1',
            status: DeliveryStatus.DELIVERED,
            eventId: 'event-1',
            subscriberId: 'subscriber-1',
         } as any;

         prismaMock.delivery.findUnique.mockResolvedValue(mockDelivery);

         const response = await request(app).post('/api/v1/deliveries/delivery-1/retry');

         expect(response.status).toBe(400);
         expect(response.body).toEqual({ error: 'Delivery already succeeded' });
         expect(deliveryQueueMock.add).not.toHaveBeenCalled();
      });

      it('should handle database errors', async () => {
         prismaMock.delivery.findUnique.mockRejectedValue(new Error('Database error'));

         const response = await request(app).post('/api/v1/deliveries/delivery-1/retry');

         expect(response.status).toBe(500);
         expect(deliveryQueueMock.add).not.toHaveBeenCalled();
      });
   });
});