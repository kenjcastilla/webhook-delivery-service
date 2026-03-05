import { NextFunction, Request, Response } from "express";
import { logger } from "../../utils/logger.js";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/client";


export function errorHandler(
   e: Error,
   _req: Request,
   res: Response,
   _next: NextFunction
): void {
   logger.error(e.message, { stack: e.stack });

   // Prisma not found
   if (e instanceof PrismaClientKnownRequestError && e.code === "P2025") {
      res.status(404).json({ error: "Resource not found" });
      return;
   }

   // Prisma unique constraint violation
   if (e instanceof PrismaClientKnownRequestError && e.code === "P2002") {
      res.status(402).json({ error: "Unique constraint violated; resource already exists" });
      return;
   }

   res.status(500).json({ error: "Internal server error" });
}