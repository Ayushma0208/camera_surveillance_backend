import { describe, expect, test } from "bun:test";
import {
  getAlertDedupSince,
  getAlertRateLimitSince,
  isAlertRateLimited
} from "../src/services/alertPolicy";

describe("alert policy", () => {
  test("calculates deduplication window from event timestamp", () => {
    const eventTimestamp = new Date("2026-06-23T10:00:10.000Z");

    expect(getAlertDedupSince(eventTimestamp, 10).toISOString()).toBe(
      "2026-06-23T10:00:00.000Z"
    );
  });

  test("calculates per-minute rate-limit window", () => {
    const eventTimestamp = new Date("2026-06-23T10:01:00.000Z");

    expect(getAlertRateLimitSince(eventTimestamp).toISOString()).toBe(
      "2026-06-23T10:00:00.000Z"
    );
  });

  test("blocks alerts once the camera limit is reached", () => {
    expect(isAlertRateLimited(5, 6)).toBe(false);
    expect(isAlertRateLimited(6, 6)).toBe(true);
  });
});
