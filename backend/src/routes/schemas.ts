import { z } from "zod";

export const signupSchema = z.object({
  username: z.string().trim().min(3).max(100),
  password: z.string().min(8).max(128)
});

export const loginSchema = signupSchema;

const cameraBaseSchema = z.object({
  name: z.string().trim().min(1).max(150),
  rtspUrl: z.string().trim().min(1),
  location: z.string().trim().min(1).max(150),
  enabled: z.boolean()
});

export const cameraCreateSchema = cameraBaseSchema.extend({
  enabled: z.boolean().default(true)
});

export const cameraUpdateSchema = cameraBaseSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "At least one field must be provided"
);

export const alertsQuerySchema = z.object({
  cameraId: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20)
});
