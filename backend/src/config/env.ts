import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  WORKER_BASE_URL: z.string().url().default("http://localhost:8001"),
  WORKER_API_KEY: z.string().optional(),
  CORS_ORIGIN: z.string().default("*")
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
  CORS_ORIGIN: Bun.env.CORS_ORIGIN
});
