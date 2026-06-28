import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  WORKER_BASE_URL: z.string().url().default("http://localhost:8001"),
  WORKER_API_KEY: z.string().optional(),
  CORS_ORIGIN: z.string().default("*"),
  RABBITMQ_URL: z.string().url().optional(),
  CAMERA_COMMANDS_QUEUE: z.string().default("camera.commands"),
  DETECTION_EVENTS_QUEUE: z.string().default("detection.events"),
  ALERT_DEDUP_WINDOW_SECONDS: z.coerce.number().int().nonnegative().default(10),
  ALERT_RATE_LIMIT_PER_CAMERA_PER_MINUTE: z.coerce.number().int().positive().default(6)
});

export type Env = z.infer<typeof envSchema>;

export const env = envSchema.parse({
  NODE_ENV: Bun.env.NODE_ENV,
  PORT: Bun.env.PORT,
  DATABASE_URL: Bun.env.DATABASE_URL,
  JWT_SECRET: Bun.env.JWT_SECRET,
  JWT_EXPIRES_IN: Bun.env.JWT_EXPIRES_IN,
  WORKER_BASE_URL: Bun.env.WORKER_BASE_URL,
  WORKER_API_KEY: Bun.env.WORKER_API_KEY,
  CORS_ORIGIN: Bun.env.CORS_ORIGIN,
  RABBITMQ_URL: Bun.env.RABBITMQ_URL,
  CAMERA_COMMANDS_QUEUE: Bun.env.CAMERA_COMMANDS_QUEUE,
  DETECTION_EVENTS_QUEUE: Bun.env.DETECTION_EVENTS_QUEUE,
  ALERT_DEDUP_WINDOW_SECONDS: Bun.env.ALERT_DEDUP_WINDOW_SECONDS,
  ALERT_RATE_LIMIT_PER_CAMERA_PER_MINUTE: Bun.env.ALERT_RATE_LIMIT_PER_CAMERA_PER_MINUTE
});
