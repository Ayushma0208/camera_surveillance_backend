import { Hono } from "hono";
import { env } from "../config/env";
import { processWorkerEvent } from "../services/workerEvents";
import { workerEventSchema } from "../types/events";
import { unauthorized } from "../utils/errors";
import { parseJsonBody } from "../utils/validation";

export const workerRoutes = new Hono();

workerRoutes.use("*", async (c, next) => {
  if (env.WORKER_API_KEY && c.req.header("x-worker-api-key") !== env.WORKER_API_KEY) {
    throw unauthorized("Invalid worker API key");
  }

  await next();
});

workerRoutes.post("/events", async (c) => {
  const event = await parseJsonBody(c, workerEventSchema);
  const result = await processWorkerEvent(event);
  const status = event.type === "person_detected" && result.stored ? 201 : 200;

  return c.json({ data: result }, status);
});
