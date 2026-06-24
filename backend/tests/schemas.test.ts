import { describe, expect, test } from "bun:test";
import {
  alertsQuerySchema,
  cameraCreateSchema,
  cameraUpdateSchema,
  loginSchema,
  signupSchema
} from "../src/routes/schemas";
import { workerEventSchema } from "../src/types/events";

describe("auth schemas", () => {
  test("accepts valid signup and login payloads", () => {
    expect(signupSchema.safeParse({ username: "admin", password: "password123" }).success).toBe(
      true
    );
    expect(loginSchema.safeParse({ username: "admin", password: "password123" }).success).toBe(
      true
    );
  });

  test("rejects short passwords", () => {
    expect(signupSchema.safeParse({ username: "admin", password: "short" }).success).toBe(false);
  });
});

describe("camera schemas", () => {
  test("defaults enabled when creating a camera", () => {
    const parsed = cameraCreateSchema.parse({
      name: "Front Gate",
      rtspUrl: "rtsp://example.local/front",
      location: "Entrance"
    });

    expect(parsed.enabled).toBe(true);
  });

  test("requires at least one update field", () => {
    expect(cameraUpdateSchema.safeParse({}).success).toBe(false);
  });
});

describe("alert query schema", () => {
  test("coerces pagination defaults", () => {
    const parsed = alertsQuerySchema.parse({});

    expect(parsed.page).toBe(1);
    expect(parsed.limit).toBe(20);
  });
});

describe("worker event schema", () => {
  const cameraId = "550e8400-e29b-41d4-a716-446655440000";

  test("accepts person detection events", () => {
    expect(
      workerEventSchema.safeParse({
        type: "person_detected",
        cameraId,
        confidence: 0.94,
        timestamp: "2026-06-23T10:00:00Z"
      }).success
    ).toBe(true);
  });

  test("rejects non-person detection event types", () => {
    expect(
      workerEventSchema.safeParse({
        type: "car_detected",
        cameraId,
        confidence: 0.94,
        timestamp: "2026-06-23T10:00:00Z"
      }).success
    ).toBe(false);
  });

  test("accepts stats and state events", () => {
    expect(
      workerEventSchema.safeParse({
        type: "stats",
        cameraId,
        fps: 24,
        detectionsPerMinute: 5
      }).success
    ).toBe(true);

    expect(
      workerEventSchema.safeParse({
        type: "state",
        cameraId,
        status: "live"
      }).success
    ).toBe(true);
  });
});
