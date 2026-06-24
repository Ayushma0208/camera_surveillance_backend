export type ApiStatusCode = 400 | 401 | 403 | 404 | 409 | 422 | 500 | 502;

export class ApiError extends Error {
  constructor(
    public readonly status: ApiStatusCode,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new ApiError(400, message, details);

export const unauthorized = (message = "Unauthorized") => new ApiError(401, message);

export const forbidden = (message = "Forbidden") => new ApiError(403, message);

export const notFound = (message = "Not found") => new ApiError(404, message);

export const conflict = (message: string) => new ApiError(409, message);

export const badGateway = (message: string, details?: unknown) =>
  new ApiError(502, message, details);
