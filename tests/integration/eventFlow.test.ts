import request from 'supertest';
import { deliveryQueue } from "../../src/queue/deliveryQueue";
import { app, prisma } from './setup';
import { logger } from "../../src/utils/logger";

describe.only('Event and Delivery Integration', () => {
  it('should create an event and queue deliveries', async () => {
    // Create a subscriber first
    const subscriber = await prisma.subscriber.create({
      data: { 
        name: 'Test Subscriber', 
        targetUrl: 'https://example.com/webhook', 
        secret: 'secret-123',
        eventTypes: ['user.created'],},
    });

    logger.info(`Created test subscriber: ${JSON.stringify(subscriber)}`);

    const eventData = { eventType: 'user.created', payload: { userId: subscriber.id } };

    // Create event via API
    const res = await request(app)
      .post('/api/v1/events')
      .send(eventData)
      .expect(202);

    // Verify deliveries are queued
    const jobs = await deliveryQueue.getJobs(['waiting', 'active']);
    expect(jobs.length).toBeGreaterThan(0);

    // Check DB for delivery records
    const deliveries = await prisma.delivery.findMany({ where: { eventId: res.body.eventId } });
    expect(deliveries.length).toBe(1);
    expect(deliveries[0]?.subscriberId).toBe(subscriber.id);
  });
});