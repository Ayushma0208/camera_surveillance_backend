import { env } from "../config/env";
import { prisma } from "../db/prisma";
import type { WorkerEvent } from "../types/events";
import { notFound } from "../utils/errors";
import {
  getAlertDedupSince,
  getAlertRateLimitSince,
  isAlertRateLimited
} from "./alertPolicy";
import { wsHub } from "./wsHub";

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

export const processWorkerEvent = async (event: WorkerEvent) => {
  const camera = await getCameraForEvent(event.cameraId);

  if (event.type === "person_detected") {
    const timestamp = new Date(event.timestamp);

    if (env.ALERT_DEDUP_WINDOW_SECONDS > 0) {
      const duplicate = await prisma.alert.findFirst({
        where: {
          cameraId: event.cameraId,
          eventType: event.type,
          timestamp: {
            gte: getAlertDedupSince(timestamp, env.ALERT_DEDUP_WINDOW_SECONDS),
            lte: timestamp
          }
        },
        orderBy: { timestamp: "desc" }
      });

      if (duplicate) {
        return { stored: false, reason: "deduplicated" as const, alert: duplicate };
      }
    }

    const recentAlertCount = await prisma.alert.count({
      where: {
        cameraId: event.cameraId,
        eventType: event.type,
        timestamp: {
          gte: getAlertRateLimitSince(timestamp),
          lte: timestamp
        }
      }
    });

    if (isAlertRateLimited(recentAlertCount, env.ALERT_RATE_LIMIT_PER_CAMERA_PER_MINUTE)) {
      return { stored: false, reason: "rate_limited" as const };
    }

    const alert = await prisma.alert.create({
      data: {
        cameraId: event.cameraId,
        eventType: event.type,
        confidence: event.confidence,
        timestamp,
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

    return { stored: true, alert };
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

    return { stored: true, stats };
  }

  const updatedCamera = await prisma.camera.update({
    where: { id: event.cameraId },
    data: { status: event.status }
  });

  wsHub.broadcastToUser(camera.userId, event);

  return { stored: true, camera: updatedCamera };
};
