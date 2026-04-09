import request from 'supertest';
import { deliveryQueue } from "../../src/queue/deliveryQueue";
import { app, prisma } from './setup';

describe('Event and Delivery Integration', () => {
  it('should create an event and queue deliveries', async () => {
    // Create a subscriber first
    const subscriber = await prisma.subscriber.create({
      data: { name: 'Test Subscriber', targetUrl: 'https://example.com/webhook', secret: 'secret123' },
    });

    const eventData = { type: 'user.created', data: { userId: 123 } };

    // Create event via API
    const res = await request(app)
      .post('/api/v1/events')
      .send(eventData)
      .expect(201);

    // Verify deliveries are queued
    const jobs = await deliveryQueue.getJobs(['waiting', 'active']);
    expect(jobs.length).toBeGreaterThan(0);

    // Check DB for delivery records
    const deliveries = await prisma.delivery.findMany({ where: { eventId: res.body.id } });
    expect(deliveries.length).toBe(1);
    expect(deliveries[0]?.subscriberId).toBe(subscriber.id);
  });
});