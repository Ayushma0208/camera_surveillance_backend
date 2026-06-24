import { Prisma } from "@prisma/client";
import { Hono } from "hono";
import type { AppVariables } from "../types/app";
import { prisma } from "../db/prisma";
import { hashPassword, verifyPassword } from "../services/password";
import { signAuthToken } from "../services/tokens";
import { authMiddleware } from "../middleware/auth";
import { conflict, unauthorized } from "../utils/errors";
import { parseJsonBody } from "../utils/validation";
import { loginSchema, signupSchema } from "./schemas";

export const authRoutes = new Hono<{ Variables: AppVariables }>();

const publicUserSelect = {
  id: true,
  username: true,
  createdAt: true
} satisfies Prisma.UserSelect;

authRoutes.post("/signup", async (c) => {
  const body = await parseJsonBody(c, signupSchema);

  try {
    const user = await prisma.user.create({
      data: {
        username: body.username,
        passwordHash: await hashPassword(body.password)
      },
      select: publicUserSelect
    });

    const token = signAuthToken({ sub: user.id, username: user.username });

    return c.json({ data: { user, token } }, 201);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw conflict("Username is already taken");
    }

    throw error;
  }
});

authRoutes.post("/login", async (c) => {
  const body = await parseJsonBody(c, loginSchema);

  const user = await prisma.user.findUnique({
    where: { username: body.username }
  });

  if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
    throw unauthorized("Invalid username or password");
  }

  const token = signAuthToken({ sub: user.id, username: user.username });

  return c.json({
    data: {
      user: {
        id: user.id,
        username: user.username,
        createdAt: user.createdAt
      },
      token
    }
  });
});

authRoutes.get("/me", authMiddleware, (c) => {
  return c.json({ data: { user: c.get("user") } });
});
