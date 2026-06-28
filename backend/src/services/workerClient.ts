import { randomUUID } from "node:crypto";
import type { Camera } from "@prisma/client";
import { env } from "../config/env";
import { isQueueEnabled, publishJson } from "./messageQueue";
import type { CameraCommand } from "../types/queues";
import { badGateway } from "../utils/errors";

type WorkerCameraPayload = Pick<
  Camera,
  "id" | "name" | "rtspUrl" | "location" | "enabled" | "status"
>;

const postToWorker = async (path: string, body: unknown) => {
  const response = await fetch(`${env.WORKER_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(env.WORKER_API_KEY ? { "x-worker-api-key": env.WORKER_API_KEY } : {})
    },
    body: JSON.stringify(body)
  }).catch((error: unknown) => {
    throw badGateway("Worker service is unavailable", error);
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw badGateway("Worker service rejected the command", {
      status: response.status,
      body: text
    });
  }
};

export const startCameraWorker = async (camera: WorkerCameraPayload) => {
  if (isQueueEnabled()) {
    const command: CameraCommand = {
      type: "start_camera",
      commandId: randomUUID(),
      camera: {
        id: camera.id,
        name: camera.name,
        rtspUrl: camera.rtspUrl,
        location: camera.location,
        enabled: camera.enabled
      }
    };

    await publishJson(env.CAMERA_COMMANDS_QUEUE, command);
    return;
  }

  await postToWorker("/cameras/start", {
    cameraId: camera.id,
    name: camera.name,
    rtspUrl: camera.rtspUrl,
    location: camera.location,
    enabled: camera.enabled
  });
};

export const stopCameraWorker = async (cameraId: string) => {
  if (isQueueEnabled()) {
    const command: CameraCommand = {
      type: "stop_camera",
      commandId: randomUUID(),
      cameraId
    };

    await publishJson(env.CAMERA_COMMANDS_QUEUE, command);
    return;
  }

  await postToWorker("/cameras/stop", {
    cameraId
  });
};
