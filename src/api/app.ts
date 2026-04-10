import compression from "compression";
import cors from "cors";
import express, { Application } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import morgan from "morgan";
import { createEventsRouter } from "./routes/events";
import { createSubscribersRouter } from "./routes/subscribers";
import { createDeliveriesRouter } from "./routes/deliveries";
import { db } from "../db/index";
import { deliveryQueue } from "../queue/deliveryQueue";
import { logger } from "../utils/logger";
import { notFound } from "./middleware/notFound";
import { errorHandler } from "./middleware/errorHandler";


export function createApp(): Application {
   const app = express();

   // Security and parsing
   app.use(helmet());
   app.use(cors());
   app.use(compression());
   app.use(express.json());

   // Logging
   app.use(morgan("combined", { stream: { write: (msg) => logger.http(msg.trim()) } }));

   // Rate limiting
   app.use(rateLimit({
      windowMs: 60 * 1000,  // one minute
      max: 100,
      standardHeaders: true,
      legacyHeaders: false,
   }));

   // Health check
   app.get("/health", (_req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));

   // Routes
   app.use("/api/v1/events", createEventsRouter(db, deliveryQueue));
   app.use("/api/v1/subscribers", createSubscribersRouter(db));
   app.use("/api/v1/deliveries", createDeliveriesRouter(db, deliveryQueue));

   // Error handling
   app.use(notFound);
   app.use(errorHandler);

   return app;
}

