import * as dotenv from 'dotenv';

dotenv.config();

function requireEnv(key: string): string {
   const value = process.env[key]
   if (!value) throw new Error(`Missing required environment variable: ${key}`);
   return value;
}

export const config = {
   nodeEnv: process.env.NODE_ENV ?? 'development',
   port: parseInt(requireEnv('NODE_PORT'), 10),

   redis: {
      host: process.env.REDIS_HOST ?? 'localhost',
      port: parseInt(requireEnv('REDIS_PORT'), 10),
      password: process.env.REDIS_PASSWORD ?? undefined,
   },

   delivery: {
      concurrency: parseInt(requireEnv('DELIVERY_CONCURRENCY'), 10),
      maxAttempts: parseInt(requireEnv('DELIVERY_MAX_ATTEMPTS'), 10),
      initialRetryDelayMs: parseInt(requireEnv('DELIVERY_INITIAL_RETRY_DELAY_MS'), 10),
   },

} as const;