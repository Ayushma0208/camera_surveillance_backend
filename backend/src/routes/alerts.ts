import { Hono } from "hono";
import type { AppVariables } from "../types/app";
import { prisma } from "../db/prisma";
import { authMiddleware } from "../middleware/auth";
import { getUserCameraOrThrow } from "../services/cameras";
import { badRequest } from "../utils/errors";
import { parseQuery } from "../utils/validation";
import { alertsQuerySchema } from "./schemas";

export const alertRoutes = new Hono<{ Variables: AppVariables }>();

alertRoutes.use("*", authMiddleware);

alertRoutes.get("/", async (c) => {
  const user = c.get("user");
  const query = parseQuery(c.req.query(), alertsQuerySchema);

  if (query.from && query.to && new Date(query.from) > new Date(query.to)) {
    throw badRequest("from must be before to");
  }

  if (query.cameraId) {
    await getUserCameraOrThrow(user.id, query.cameraId);
  }

  const where = {
    camera: {
      userId: user.id
    },
    ...(query.cameraId ? { cameraId: query.cameraId } : {}),
    ...(query.from || query.to
      ? {
          timestamp: {
            ...(query.from ? { gte: new Date(query.from) } : {}),
            ...(query.to ? { lte: new Date(query.to) } : {})
          }
        }
      : {})
  };

  const [total, alerts] = await Promise.all([
    prisma.alert.count({ where }),
    prisma.alert.findMany({
      where,
      orderBy: { timestamp: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit
    })
  ]);

  return c.json({
    data: {
      alerts,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit)
      }
    }
  });
});
