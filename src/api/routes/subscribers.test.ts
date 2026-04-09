import express from 'express';
import request from 'supertest';
import { prismaMock } from '../../../singleton';
import { createSubscribersRouter } from './subscribers';


const app = express();
app.use(express.json());
app.use('/api/v1/subscribers', createSubscribersRouter(prismaMock as any));

const dateNow = new Date().toISOString();

describe('Subscribers Route Test Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/v1/subscribers', () => {
    it('should create a new subscriber with generated secret', async () => {
      const createdSubscriber = {
        id: 'subscriber-1',
        name: 'Test Subscriber',
        targetUrl: 'https://example.com/webhook',
        eventTypes: ['test.event', 'order.created'],
        isActive: true,
        secret: 'generated-secret-key',
        createdAt: dateNow,
        updatedAt: dateNow,
      } as any;

      prismaMock.subscriber.create.mockResolvedValue(createdSubscriber);

      const response = await request(app)
        .post('/api/v1/subscribers')
        .send({
          name: 'Test Subscriber',
          targetUrl: 'https://example.com/webhook',
          eventTypes: ['test.event', 'order.created'],
        });

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        id: 'subscriber-1',
        name: 'Test Subscriber',
        targetUrl: 'https://example.com/webhook',
        eventTypes: ['test.event', 'order.created'],
        isActive: true,
        createdAt: dateNow,
        updatedAt: dateNow,
      });
      expect(response.body).not.toHaveProperty('secret');
      expect(prismaMock.subscriber.create).toHaveBeenCalled();
    });

    it('should return 400 for invalid request body', async () => {
      const response = await request(app)
        .post('/api/v1/subscribers')
        .send({
          name: '',
          targetUrl: 'not-a-url',
          eventTypes: [],
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Invalid request body');
      expect(prismaMock.subscriber.create).not.toHaveBeenCalled();
    });

    it('should handle database errors during creation', async () => {
      prismaMock.subscriber.create.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/v1/subscribers')
        .send({
          name: 'Test Subscriber',
          targetUrl: 'https://example.com/webhook',
          eventTypes: ['test.event'],
        });

      expect(response.status).toBe(500);
    });
  });

  describe('GET /api/v1/subscribers', () => {
    it('should return all subscribers without secrets', async () => {
      const mockSubscribers = [
        {
          id: 'subscriber-1',
          name: 'Test Subscriber 1',
          targetUrl: 'https://example.com/webhook1',
          eventTypes: ['test.event'],
          isActive: true,
          createdAt: dateNow,
          updatedAt: dateNow,
        },
        {
          id: 'subscriber-2',
          name: 'Test Subscriber 2',
          targetUrl: 'https://example.com/webhook2',
          eventTypes: ['order.created'],
          isActive: false,
          createdAt: dateNow,
          updatedAt: dateNow,
        },
      ] as any[];

      prismaMock.subscriber.findMany.mockResolvedValue(mockSubscribers);

      const response = await request(app).get('/api/v1/subscribers');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockSubscribers);
      expect(prismaMock.subscriber.findMany).toHaveBeenCalledWith({
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
    });

    it('should handle database errors when listing subscribers', async () => {
      prismaMock.subscriber.findMany.mockRejectedValue(new Error('Database error'));

      const response = await request(app).get('/api/v1/subscribers');

      expect(response.status).toBe(500);
    });
  });

  describe('GET /api/v1/subscribers/:id', () => {
    it('should return a single subscriber without secret', async () => {
      const mockSubscriber = {
        id: 'subscriber-1',
        name: 'Test Subscriber',
        targetUrl: 'https://example.com/webhook',
        eventTypes: ['test.event', 'order.created'],
        isActive: true,
        createdAt: dateNow,
        updatedAt: dateNow,
      } as any;

      prismaMock.subscriber.findUnique.mockResolvedValue(mockSubscriber);

      const response = await request(app).get('/api/v1/subscribers/subscriber-1');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockSubscriber);
      expect(response.body).not.toHaveProperty('secret');
      expect(prismaMock.subscriber.findUnique).toHaveBeenCalledWith({
        select: {
          id: true,
          name: true,
          targetUrl: true,
          eventTypes: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
        where: { id: 'subscriber-1' },
      });
    });

    it('should return 404 when subscriber is not found', async () => {
      prismaMock.subscriber.findUnique.mockResolvedValue(null);

      const response = await request(app).get('/api/v1/subscribers/missing-subscriber');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Subscriber not found' });
    });

    it('should handle database errors when fetching a subscriber', async () => {
      prismaMock.subscriber.findUnique.mockRejectedValue(new Error('Database error'));

      const response = await request(app).get('/api/v1/subscribers/subscriber-1');

      expect(response.status).toBe(500);
    });
  });

  describe('PATCH /api/v1/subscribers/:id', () => {
    it('should update subscriber with partial data', async () => {
      const updatedSubscriber = {
        id: 'subscriber-1',
        name: 'Updated Subscriber',
        targetUrl: 'https://updated.com/webhook',
        eventTypes: ['test.event'],
        isActive: false,
        createdAt: dateNow,
        updatedAt: new Date().toISOString(),
      } as any;

      prismaMock.subscriber.update.mockResolvedValue(updatedSubscriber);

      const response = await request(app)
        .patch('/api/v1/subscribers/subscriber-1')
        .send({
          name: 'Updated Subscriber',
          targetUrl: 'https://updated.com/webhook',
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(updatedSubscriber);
      expect(prismaMock.subscriber.update).toHaveBeenCalledWith({
        select: {
          id: true,
          name: true,
          targetUrl: true,
          eventTypes: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
        where: { id: 'subscriber-1' },
        data: {
          name: 'Updated Subscriber',
          targetUrl: 'https://updated.com/webhook',
        },
      });
    });

    it('should allow updating only isActive field', async () => {
      const updatedSubscriber = {
        id: 'subscriber-1',
        name: 'Test Subscriber',
        targetUrl: 'https://example.com/webhook',
        eventTypes: ['test.event'],
        isActive: false,
        createdAt: dateNow,
        updatedAt: dateNow,
      } as any;

      prismaMock.subscriber.update.mockResolvedValue(updatedSubscriber);

      const response = await request(app)
        .patch('/api/v1/subscribers/subscriber-1')
        .send({ isActive: false });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(updatedSubscriber);
      expect(prismaMock.subscriber.update).toHaveBeenCalledWith({
        select: {
          id: true,
          name: true,
          targetUrl: true,
          eventTypes: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
        where: { id: 'subscriber-1' },
        data: { isActive: false },
      });
    });

    it('should return 400 for invalid update data', async () => {
      const response = await request(app)
        .patch('/api/v1/subscribers/subscriber-1')
        .send({ targetUrl: 'not-a-url' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Invalid request body');
      expect(prismaMock.subscriber.update).not.toHaveBeenCalled();
    });

    it('should handle database errors during update', async () => {
      prismaMock.subscriber.update.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .patch('/api/v1/subscribers/subscriber-1')
        .send({ name: 'Updated Name' });

      expect(response.status).toBe(500);
    });
  });

  describe('DELETE /api/v1/subscribers/:id', () => {
    it('should delete a subscriber', async () => {
      prismaMock.subscriber.delete.mockResolvedValue({
         name: "",
         targetUrl: "",
         eventTypes: [],
         isActive: false,
         id: "",
         secret: "",
         createdAt: new Date(),
         updatedAt: new Date(),
      });

      const response = await request(app).delete('/api/v1/subscribers/subscriber-1');

      expect(response.status).toBe(204);
      expect(response.body).toEqual({});
      expect(prismaMock.subscriber.delete).toHaveBeenCalledWith({
        where: { id: 'subscriber-1' },
      });
    });

    it('should return 404 when subscriber to delete is not found', async () => {
      const error = new Error('Record not found') as any;
      error.code = 'P2025';
      prismaMock.subscriber.delete.mockRejectedValue(error);

      const response = await request(app).delete('/api/v1/subscribers/missing-subscriber');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Subscriber not found' });
    });

    it('should handle other database errors during deletion', async () => {
      prismaMock.subscriber.delete.mockRejectedValue(new Error('Database error'));

      const response = await request(app).delete('/api/v1/subscribers/subscriber-1');

      expect(response.status).toBe(500);
    });
  });
});
