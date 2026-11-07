import express, { Application, Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";
import { env } from "./config/env";
import { checkRedisHealth } from "./config/redis";
import { checkDatabaseHealth } from "./config/database";
import { requestLogger } from "./middleware/logger.middleware";
import { errorHandler } from "./middleware/error.middleware";

export function createApp(): Application {
  const app = express();

  // Security Headers
  app.use(helmet());

  // CORS Configuration
  app.use(
    cors({
      origin: [env.FRONTEND_URL, "http://localhost:5173", "http://127.0.0.1:5173"],
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  );

  // Body Parsing
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Request Logging
  app.use(requestLogger);

  // Health Endpoint: GET /health
  app.get("/health", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const [redisHealth, dbHealth] = await Promise.all([
        checkRedisHealth(),
        checkDatabaseHealth(),
      ]);

      const allHealthy =
        redisHealth.status === "connected" && dbHealth.status === "connected";

      const statusCode = allHealthy ? 200 : 200; // Return 200 with service details in development, or 503 if strictly required
      
      res.status(statusCode).json({
        status: allHealthy ? "ok" : "degraded",
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        environment: env.NODE_ENV,
        services: {
          redis: redisHealth,
          database: dbHealth,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  // 404 Handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      error: "NotFound",
      message: `Route ${req.method} ${req.originalUrl} not found`,
    });
  });

  // Centralized Error Handling
  app.use(errorHandler);

  return app;
}
