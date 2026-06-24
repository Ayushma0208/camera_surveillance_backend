import type { Context } from "hono";
import type { z } from "zod";
import { badRequest } from "./errors";

export const parseJsonBody = async <T extends z.ZodType>(c: Context, schema: T) => {
  let body: unknown;

  try {
    body = await c.req.json();
  } catch {
    throw badRequest("Request body must be valid JSON");
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw badRequest("Validation failed", parsed.error.flatten());
  }

  return parsed.data as z.infer<T>;
};

export const parseQuery = <T extends z.ZodType>(value: unknown, schema: T) => {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw badRequest("Invalid query parameters", parsed.error.flatten());
  }

  return parsed.data as z.infer<T>;
};
