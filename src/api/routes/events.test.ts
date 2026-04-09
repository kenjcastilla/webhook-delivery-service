import express from 'express';
import request from 'supertest';
import { prismaMock } from '../../../singleton';
import { createEventsRouter } from './events';
import { config } from '../../config/index';


jest.mock('../../queue/deliveryQueue.ts', () => ({
   deliveryQueue: {
      addBulk: jest.fn(),
   },
}));

const deliveryQueueMock = {
   addBulk: jest.fn(),
};

const app = express();
app.use(express.json());
app.use('/api/v1/events', createEventsRouter(prismaMock as any, deliveryQueueMock as any));

describe('Events Route Test Suite', () => {
   beforeEach(() => {
      jest.clearAllMocks();
   });

   describe('POST /api/v1/events', () => {
      it('should create an event and enqueue deliveries for active subscribers', async () => {
         const subscribers = [
            { id: 'subscriber-1' },
            { id: 'subscriber-2' },
         ] as any[];

         const createdEvent = {
            id: 'event-1',
            eventType: 'test.event',
            payload: { foo: 'bar' },
            deliveries: [
               { id: 'delivery-1' },
               { id: 'delivery-2' },
            ],
         } as any;

         prismaMock.subscriber.findMany.mockResolvedValue(subscribers);
         prismaMock.event.create.mockResolvedValue(createdEvent);

         const response = await request(app)
            .post('/api/v1/events')
            .send({ eventType: 'test.event', payload: { foo: 'bar' } });

         expect(response.status).toBe(202);
         expect(response.body).toEqual({ eventId: 'event-1', deliveriesCreated: 2 });
         expect(prismaMock.subscriber.findMany).toHaveBeenCalledWith({
            where: {
               isActive: true,
               eventTypes: { has: 'test.event' },
            },
         });
         expect(prismaMock.event.create).toHaveBeenCalledWith({
            data: {
               eventType: 'test.event',
               payload: { foo: 'bar' },
               deliveries: {
                  create: [
                     {
                        subscriberId: 'subscriber-1',
                        maxAttempts: config.delivery.maxAttempts,
                     },
                     {
                        subscriberId: 'subscriber-2',
                        maxAttempts: config.delivery.maxAttempts,
                     },
                  ],
               },
            },
            include: { deliveries: true },
         });
         expect(deliveryQueueMock.addBulk).toHaveBeenCalledWith([
            { name: 'deliver', data: { deliveryId: 'delivery-1' } },
            { name: 'deliver', data: { deliveryId: 'delivery-2' } },
         ]);
      });

      it('should accept the event when there are no active subscribers', async () => {
         prismaMock.subscriber.findMany.mockResolvedValue([]);
         prismaMock.event.create.mockResolvedValue({ id: 'event-1', deliveries: [] } as any);

         const response = await request(app)
            .post('/api/v1/events')
            .send({ eventType: 'test.event', payload: { foo: 'bar' } });

         expect(response.status).toBe(202);
         expect(response.body).toEqual({ message: 'Event accepted; no active subscribers matched' });
         expect(deliveryQueueMock.addBulk).not.toHaveBeenCalled();
      });

      it('should return 400 for invalid request body', async () => {
         const response = await request(app)
            .post('/api/v1/events')
            .send({ eventType: '', payload: 'not-an-object' });

         expect(response.status).toBe(400);
         expect(response.body).toHaveProperty('error', 'Invalid request body');
         expect(prismaMock.subscriber.findMany).not.toHaveBeenCalled();
      });

      it('should handle database errors when finding subscribers', async () => {
         prismaMock.subscriber.findMany.mockRejectedValue(new Error('Database error'));

         const response = await request(app)
            .post('/api/v1/events')
            .send({ eventType: 'test.event', payload: { foo: 'bar' } });

         expect(response.status).toBe(500);
      });
   });

   describe('GET /api/v1/events/:id', () => {
      it('should return an event with deliveries and logs', async () => {
         const mockEvent = {
            id: 'event-1',
            eventType: 'test.event',
            payload: { foo: 'bar' },
            deliveries: [
               {
                  id: 'delivery-1',
                  logs: [
                     { id: 'log-1', statusCode: 200, createdAt: new Date().toISOString() },
                  ],
               },
            ],
         } as any;

         prismaMock.event.findUnique.mockResolvedValue(mockEvent);

         const response = await request(app).get('/api/v1/events/event-1');

         expect(response.status).toBe(200);
         expect(response.body).toEqual(mockEvent);
         expect(prismaMock.event.findUnique).toHaveBeenCalledWith({
            where: { id: 'event-1' },
            include: {
               deliveries: {
                  include: { logs: { orderBy: { createdAt: 'asc' } } },
               },
            },
         });
      });

      it('should return 404 when event is not found', async () => {
         prismaMock.event.findUnique.mockResolvedValue(null);

         const response = await request(app).get('/api/v1/events/missing-event');

         expect(response.status).toBe(404);
         expect(response.body).toEqual({ error: 'Event not found' });
      });

      it('should handle database errors when fetching an event', async () => {
         prismaMock.event.findUnique.mockRejectedValue(new Error('Database error'));

         const response = await request(app).get('/api/v1/events/event-1');

         expect(response.status).toBe(500);
      });
   });
});