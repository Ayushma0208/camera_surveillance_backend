import type { MiddlewareHandler } from "hono";
import type { AppVariables } from "../types/app";
import { prisma } from "../db/prisma";
import { unauthorized } from "../utils/errors";
import { verifyAuthToken } from "../services/tokens";

export const authMiddleware: MiddlewareHandler<{ Variables: AppVariables }> = async (
  c,
  next
) => {
  const header = c.req.header("authorization");

  if (!header?.startsWith("Bearer ")) {
    throw unauthorized("Missing bearer token");
  }

  const token = header.slice("Bearer ".length);
  const payload = verifyAuthToken(token);

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, username: true, createdAt: true }
  });

  if (!user) {
    throw unauthorized("User no longer exists");
  }

  c.set("user", user);
  await next();
};
