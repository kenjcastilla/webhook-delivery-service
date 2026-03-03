import { Redis } from 'ioredis';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';


export const redis = new Redis({
   host: config.redis.host,
   port: config.redis.port,
   password: config.redis.password,
   maxRetriesPerRequest: null,   // null per BullMQ requirements
});

redis.on('error', (e) => logger.error('Redis error', e));
redis.on('connect', () => logger.info('Redis connected'));
