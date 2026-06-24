import { Hono } from "hono";
import { prisma } from "../db/prisma";

export const healthRoutes = new Hono();

healthRoutes.get("/", async (c) => {
  await prisma.$queryRaw`SELECT 1`;

  return c.json({
    data: {
      status: "ok",
      timestamp: new Date().toISOString()
    }
  });
});
