import { createLogger, format, transports } from "winston";

const { combine, timestamp, printf, colorize, errors } = format;

const logFormat = printf(({ level, message, timestamp, stack }) => {
   return `${timestamp} [${level}]: ${stack ?? message} }`;
});

export const logger = createLogger({
   level: process.env.NODE_ENV === 'production' ? 'info' : 'config',
   format: combine(
      timestamp({ format: 'YYYY-MM-DD hh:mm:ss' }),
      errors({ stack: true }),
      process.env.NODE_ENV !== 'production' ? colorize() : format.json(),
      logFormat
   ),
   transports: [new transports.Console()],
})
