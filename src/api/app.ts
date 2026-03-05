import compression from "compression";
import cors from "cors";
import express, { Application } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import morgan from "morgan";
import { eventsRouter } from "./routes/events.js";
import { subscribersRouter } from "./routes/subscribers.js";
import { deliveriesRouter } from "./routes/deliveries.js";
import { logger } from "../utils/logger.js";


export function createApp(): Application {
   const app = express();

   // Security and parsing
   app.use(helmet);
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
   app.get("/health", (req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));

   // Routes
   app.use("/api/v1/events", eventsRouter);
   app.use("/api/v1/subscribers", subscribersRouter);
   app.use("/api/v1/deliveries", deliveriesRouter);

   // Error handling
   /**
    * TODO: Building this in middleware
    */

   return app;
}

