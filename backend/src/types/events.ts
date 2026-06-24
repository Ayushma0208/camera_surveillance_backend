import { z } from "zod";

export const cameraStatusSchema = z.enum(["connecting", "live", "stopped", "error"]);

export const personDetectedEventSchema = z.object({
  type: z.literal("person_detected"),
  cameraId: z.string().uuid(),
  confidence: z.number().min(0).max(1),
  timestamp: z.string().datetime(),
  imageUrl: z.string().url().nullable().optional()
});

export const statsEventSchema = z.object({
  type: z.literal("stats"),
  cameraId: z.string().uuid(),
  fps: z.number().int().nonnegative(),
  detectionsPerMinute: z.number().int().nonnegative()
});

export const stateEventSchema = z.object({
  type: z.literal("state"),
  cameraId: z.string().uuid(),
  status: cameraStatusSchema
});

export const workerEventSchema = z.discriminatedUnion("type", [
  personDetectedEventSchema,
  statsEventSchema,
  stateEventSchema
]);

export type CameraStatusValue = z.infer<typeof cameraStatusSchema>;
export type PersonDetectedEvent = z.infer<typeof personDetectedEventSchema>;
export type StatsEvent = z.infer<typeof statsEventSchema>;
export type StateEvent = z.infer<typeof stateEventSchema>;
export type WorkerEvent = z.infer<typeof workerEventSchema>;

export type WebSocketEvent =
  | {
      type: "alert";
      cameraId: string;
      confidence: number;
      timestamp: string;
      imageUrl?: string | null;
    }
  | StatsEvent
  | StateEvent;
