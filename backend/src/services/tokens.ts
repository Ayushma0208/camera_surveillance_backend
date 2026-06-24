import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import { env } from "../config/env";
import { unauthorized } from "../utils/errors";

export type JwtPayload = {
  sub: string;
  username: string;
};

export const signAuthToken = (payload: JwtPayload) =>
  jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"]
  });

export const verifyAuthToken = (token: string): JwtPayload => {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);

    if (typeof decoded === "string" || typeof decoded.sub !== "string") {
      throw unauthorized("Invalid token");
    }

    return {
      sub: decoded.sub,
      username: String(decoded.username ?? "")
    };
  } catch {
    throw unauthorized("Invalid or expired token");
  }
};
