import type { Camera } from "@prisma/client";
import { prisma } from "../db/prisma";
import { notFound } from "../utils/errors";

export const cameraInclude = {
  stats: true,
  alerts: {
    orderBy: { timestamp: "desc" as const },
    take: 5
  }
};

export const getUserCameraOrThrow = async (userId: string, cameraId: string) => {
  const camera = await prisma.camera.findFirst({
    where: { id: cameraId, userId },
    include: cameraInclude
  });

  if (!camera) {
    throw notFound("Camera not found");
  }

  return camera;
};

export const serializeCamera = (
  camera: Camera & {
    stats?: { fps: number; detectionsPerMinute: number; updatedAt: Date } | null;
    alerts?: Array<{
      id: string;
      eventType: string;
      confidence: number;
      timestamp: Date;
      imageUrl: string | null;
    }>;
  }
) => ({
  id: camera.id,
  name: camera.name,
  rtspUrl: camera.rtspUrl,
  location: camera.location,
  enabled: camera.enabled,
  status: camera.status,
  createdAt: camera.createdAt,
  stats: camera.stats
    ? {
        fps: camera.stats.fps,
        detectionsPerMinute: camera.stats.detectionsPerMinute,
        updatedAt: camera.stats.updatedAt
      }
    : null,
  recentAlerts:
    camera.alerts?.map((alert) => ({
      id: alert.id,
      eventType: alert.eventType,
      confidence: alert.confidence,
      timestamp: alert.timestamp,
      imageUrl: alert.imageUrl
    })) ?? []
});
