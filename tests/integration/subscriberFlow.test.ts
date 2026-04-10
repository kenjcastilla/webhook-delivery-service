import request from 'supertest';
import { app, prisma } from './setup';

describe('Subscriber Integration', () => {
  it('should create and retrieve a subscriber', async () => {
    const subscriberData = { name: "Test Subscriber", targetUrl: 'https://example.com/webhook', eventTypes: ['subscriber.created'] };

    // Create via API
    const createRes = await request(app)
      .post('/api/v1/subscribers')
      .send(subscriberData)
      .expect(201);

    const subscriberId = createRes.body.id;

    // Retrieve via API
    const getRes = await request(app)
      .get(`/api/v1/subscribers/${subscriberId}`)
      .expect(200);

    expect(getRes.body.targetUrl).toBe(subscriberData.targetUrl);

    // Verify in DB
    const dbSubscriber = await prisma.subscriber.findUnique({ where: { id: subscriberId } });
    expect(dbSubscriber?.targetUrl).toBe(subscriberData.targetUrl);
  });
});