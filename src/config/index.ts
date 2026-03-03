function requireEnv(key: string): string {
   const value = process.env[key]
   if (!value) throw new Error(`Missing required environment variable: ${key}`);
   return value;
}

export const config = {
   nodeEnv: process.env.NODE_ENV ?? 'development',
   port: parseInt(process.env.PORT ?? '3000', 10),

   redis: {
      host: process.env.REDIS_HOST ?? 'localhost',
      port: parseInt(process.env.REDIS_PORT ?? '3000', 10),
      password: process.env.REDIS_PASSWORD ?? undefined,
   },

   delivery: {
      concurrency: parseInt(process.env.DELIVERY_CONCURRENCY ?? '5', 10),
      maxAttempts: parseInt(process.env.DELIVERY_MAX_ATTEMPTS ?? '5', 10),
      initialRetryDelayMs: parseInt(process.env.DELIVERY_INITIAL_RETRY_DELAY_MS ?? '5000', 10),
   },

} as const;