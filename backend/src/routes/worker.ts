import { Hono } from "hono";
import { env } from "../config/env";
import { prisma } from "../db/prisma";
import { wsHub } from "../services/wsHub";
import { workerEventSchema } from "../types/events";
import { notFound, unauthorized } from "../utils/errors";
import { parseJsonBody } from "../utils/validation";

export const workerRoutes = new Hono();

const getCameraForEvent = async (cameraId: string) => {
  const camera = await prisma.camera.findUnique({
    where: { id: cameraId },
    select: { id: true, userId: true }
  });

  if (!camera) {
    throw notFound("Camera not found");
  }

  return camera;
};

workerRoutes.use("*", async (c, next) => {
  if (env.WORKER_API_KEY && c.req.header("x-worker-api-key") !== env.WORKER_API_KEY) {
    throw unauthorized("Invalid worker API key");
  }

  await next();
});

workerRoutes.post("/events", async (c) => {
  const event = await parseJsonBody(c, workerEventSchema);
  const camera = await getCameraForEvent(event.cameraId);

  if (event.type === "person_detected") {
    const alert = await prisma.alert.create({
      data: {
        cameraId: event.cameraId,
        eventType: event.type,
        confidence: event.confidence,
        timestamp: new Date(event.timestamp),
        imageUrl: event.imageUrl ?? null
      }
    });

    wsHub.broadcastToUser(camera.userId, {
      type: "alert",
      cameraId: event.cameraId,
      confidence: event.confidence,
      timestamp: alert.timestamp.toISOString(),
      imageUrl: alert.imageUrl
    });

    return c.json({ data: { stored: true, alert } }, 201);
  }

  if (event.type === "stats") {
    const stats = await prisma.cameraStats.upsert({
      where: { cameraId: event.cameraId },
      create: {
        cameraId: event.cameraId,
        fps: event.fps,
        detectionsPerMinute: event.detectionsPerMinute
      },
      update: {
        fps: event.fps,
        detectionsPerMinute: event.detectionsPerMinute
      }
    });

    wsHub.broadcastToUser(camera.userId, event);

    return c.json({ data: { stored: true, stats } });
  }

  const updatedCamera = await prisma.camera.update({
    where: { id: event.cameraId },
    data: { status: event.status }
  });

  wsHub.broadcastToUser(camera.userId, event);

  return c.json({ data: { stored: true, camera: updatedCamera } });
});
