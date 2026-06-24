import type { User } from "@prisma/client";

export type AuthUser = Pick<User, "id" | "username" | "createdAt">;

export type AppVariables = {
  user: AuthUser;
};

export type ApiResponse<T> = {
  data: T;
};

export type ApiErrorBody = {
  error: {
    message: string;
    details?: unknown;
  };
};
