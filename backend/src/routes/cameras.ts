import { Hono } from "hono";
import { z } from "zod";
import type { AppVariables } from "../types/app";
import { prisma } from "../db/prisma";
import { authMiddleware } from "../middleware/auth";
import { cameraInclude, getUserCameraOrThrow, serializeCamera } from "../services/cameras";
import { startCameraWorker, stopCameraWorker } from "../services/workerClient";
import { wsHub } from "../services/wsHub";
import { badRequest } from "../utils/errors";
import { parseJsonBody } from "../utils/validation";
import { cameraCreateSchema, cameraUpdateSchema } from "./schemas";

export const cameraRoutes = new Hono<{ Variables: AppVariables }>();

const cameraIdSchema = z.string().uuid();

const parseCameraId = (value: string) => {
  const parsed = cameraIdSchema.safeParse(value);
  if (!parsed.success) {
    throw badRequest("Invalid camera id");
  }
  return parsed.data;
};

cameraRoutes.use("*", authMiddleware);

cameraRoutes.post("/", async (c) => {
  const user = c.get("user");
  const body = await parseJsonBody(c, cameraCreateSchema);

  const camera = await prisma.camera.create({
    data: {
      userId: user.id,
      name: body.name,
      rtspUrl: body.rtspUrl,
      location: body.location,
      enabled: body.enabled
    },
    include: cameraInclude
  });

  return c.json({ data: { camera: serializeCamera(camera) } }, 201);
});

cameraRoutes.get("/", async (c) => {
  const user = c.get("user");
  const cameras = await prisma.camera.findMany({
    where: { userId: user.id },
    include: cameraInclude,
    orderBy: { createdAt: "desc" }
  });

  return c.json({ data: { cameras: cameras.map(serializeCamera) } });
});

cameraRoutes.get("/:id", async (c) => {
  const user = c.get("user");
  const cameraId = parseCameraId(c.req.param("id"));
  const camera = await getUserCameraOrThrow(user.id, cameraId);

  return c.json({ data: { camera: serializeCamera(camera) } });
});

cameraRoutes.put("/:id", async (c) => {
  const user = c.get("user");
  const cameraId = parseCameraId(c.req.param("id"));
  const body = await parseJsonBody(c, cameraUpdateSchema);

  await getUserCameraOrThrow(user.id, cameraId);

  const camera = await prisma.camera.update({
    where: { id: cameraId },
    data: body,
    include: cameraInclude
  });

  return c.json({ data: { camera: serializeCamera(camera) } });
});

cameraRoutes.delete("/:id", async (c) => {
  const user = c.get("user");
  const cameraId = parseCameraId(c.req.param("id"));

  await getUserCameraOrThrow(user.id, cameraId);
  await prisma.camera.delete({ where: { id: cameraId } });

  return c.json({ data: { deleted: true } });
});

cameraRoutes.post("/:id/start", async (c) => {
  const user = c.get("user");
  const cameraId = parseCameraId(c.req.param("id"));

  await getUserCameraOrThrow(user.id, cameraId);

  const connectingCamera = await prisma.camera.update({
    where: { id: cameraId },
    data: { status: "connecting" },
    include: cameraInclude
  });

  wsHub.broadcastToUser(user.id, {
    type: "state",
    cameraId,
    status: "connecting"
  });

  try {
    await startCameraWorker(connectingCamera);
  } catch (error) {
    await prisma.camera.update({
      where: { id: cameraId },
      data: { status: "error" }
    });
    wsHub.broadcastToUser(user.id, {
      type: "state",
      cameraId,
      status: "error"
    });
    throw error;
  }

  return c.json({ data: { camera: serializeCamera(connectingCamera) } });
});

cameraRoutes.post("/:id/stop", async (c) => {
  const user = c.get("user");
  const cameraId = parseCameraId(c.req.param("id"));

  await getUserCameraOrThrow(user.id, cameraId);
  await stopCameraWorker(cameraId);

  const camera = await prisma.camera.update({
    where: { id: cameraId },
    data: { status: "stopped" },
    include: cameraInclude
  });

  wsHub.broadcastToUser(user.id, {
    type: "state",
    cameraId,
    status: "stopped"
  });

  return c.json({ data: { camera: serializeCamera(camera) } });
});
