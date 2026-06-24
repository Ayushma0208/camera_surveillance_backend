import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import type { AppVariables } from "./types/app";
import { env } from "./config/env";
import { ApiError, type ApiStatusCode } from "./utils/errors";
import { authRoutes } from "./routes/auth";
import { cameraRoutes } from "./routes/cameras";
import { alertRoutes } from "./routes/alerts";
import { workerRoutes } from "./routes/worker";
import { healthRoutes } from "./routes/health";

export const app = new Hono<{ Variables: AppVariables }>();

app.use("*", logger());
app.use(
  "*",
  cors({
    origin: env.CORS_ORIGIN === "*" ? "*" : env.CORS_ORIGIN.split(","),
    allowHeaders: ["authorization", "content-type", "x-worker-api-key"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
  })
);

app.route("/health", healthRoutes);
app.route("/auth", authRoutes);
app.route("/cameras", cameraRoutes);
app.route("/alerts", alertRoutes);
app.route("/worker", workerRoutes);

app.notFound((c) =>
  c.json(
    {
      error: {
        message: "Route not found"
      }
    },
    404
  )
);

app.onError((error, c) => {
  if (error instanceof ApiError) {
    return c.json(
      {
        error: {
          message: error.message,
          details: error.details
        }
      },
      error.status as ApiStatusCode
    );
  }

  console.error(error);

  return c.json(
    {
      error: {
        message: "Internal server error"
      }
    },
    500
  );
});
