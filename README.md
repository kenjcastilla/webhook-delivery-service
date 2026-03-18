# Webhook Delivery Service
A webhook delivery service built to disseminate events to subscribers. Equipped with an automatic retry feature, exponential backoff, HMAC-256 signature verification, and delivery audit logs.

## Major Dependencies
Typescript, Express, PostgreSQL via Prisma, and BullMQ with Redis.

---
## Getting Started
#### PostgreSQL
Set up a local [PostgreSQL](https://www.postgresql.org/download/) database, put url and login information in your .env file, and update any db info in the [Docker compose file](docker-compose.yml).
### 1. Install dependencies
```bash
npm install
```

### 2. Start infrastructure
```bash
docker compose up -d
```

### 3. Configure environment
```bash
cp .env.example .env
```

### 4. Run migrations
```bash
npm run db:migrate
npm run db:generate
```

### 5. Start development server
```bash
npm run dev
```

### 6. Start delivery worker (in a separate terminal)
```bash
npm run worker
```

---
## Flow of the Delivery Service
An *event* (e.g. the creation of a food order) is ingested at an API endpoint (e.g. "api/v1/events") using an Express router. The event arrives at the endpoint as an [object](src/api/routes/events.ts#L28) with the *event type* (e.g. order creation) and the *payload* (e.g. "order id" and "total cost of the order"). 

After the event is ingested, as long as there is at least one subscriber to this event type, an [event *record*](prisma/schema.prisma#L25) is created. If there are no subscribers to the event type, this entire delivery process is abandoned.

If subscribers have been identified and the event record has been [created](src/api/routes/events.ts#L43) in the database, for each delivery, a [delivery *job*](src/workers/deliveryWorker.ts#L13) is [generated and enqueued](src/api/routes/events.ts#L58). 

During each [delivery attempt](src/services/deliveryService.ts#L14), 
```
1. The delivery information ("subscriber" and "event" objects) is retrieved 
    from its respective record in the database's "Delivery" table.
2. A webhook signature is created by applying HMAC-SHA256 
    encryption to the payload using the Subscriber's secret.
3. The encrypted delivery attempt is executed via an Axios POST request to 
    the given Subscriber's targetUrl.
4. A deliveryLog record is created in the database, and the current 
    delivery record's status and attemptNumber are updated as well.
```
If the delivery fails, it is re-attempted by notifying the BullMQ instance via an error throw. The BullMQ worker runs the job again (up to 5 times per the [deliveryQueue settings](src/queue/deliveryQueue.ts#L13)) until it succeeds. If it doesn't succeed after the max number of attempts, the delivery is removed from the queue. It is currently kept in the "failed" set until the set's max capacity is reached.

---
## Webhook Signature Validation
Here's a script for the "X-Webhook-Signature" header verification:
```typescript
import crypto from 'crypto';

function verifySignature(body: string, secret: string, signature: string): boolean {
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
```
