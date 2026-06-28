import type { Camera } from "@prisma/client";

export type StartCameraCommand = {
  type: "start_camera";
  commandId: string;
  camera: Pick<Camera, "id" | "name" | "rtspUrl" | "location" | "enabled">;
};

export type StopCameraCommand = {
  type: "stop_camera";
  commandId: string;
  cameraId: string;
};

export type CameraCommand = StartCameraCommand | StopCameraCommand;
