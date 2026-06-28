import { describe, expect, test } from "bun:test";

describe("worker event integration", () => {
  test("deduplicates person detection alerts for the same camera", async () => {
    if (Bun.env.RUN_INTEGRATION_TESTS !== "true") {
      return;
    }

    const { prisma } = await import("../src/db/prisma");
    const { processWorkerEvent } = await import("../src/services/workerEvents");

    const username = `integration-${crypto.randomUUID()}`;
    const user = await prisma.user.create({
      data: {
        username,
        passwordHash: "not-used-in-this-test"
      }
    });

    const camera = await prisma.camera.create({
      data: {
        userId: user.id,
        name: "Integration Camera",
        rtspUrl: "rtsp://example.local/stream",
        location: "Test Lab",
        enabled: true
      }
    });

    try {
      const event = {
        type: "person_detected" as const,
        cameraId: camera.id,
        confidence: 0.91,
        timestamp: "2026-06-23T10:00:00.000Z",
        imageUrl: null
      };

      const first = await processWorkerEvent(event);
      const second = await processWorkerEvent({
        ...event,
        confidence: 0.92,
        timestamp: "2026-06-23T10:00:05.000Z"
      });

      const alertCount = await prisma.alert.count({ where: { cameraId: camera.id } });

      expect(first.stored).toBe(true);
      expect(second.stored).toBe(false);
      expect(alertCount).toBe(1);
    } finally {
      await prisma.user.delete({ where: { id: user.id } });
    }
  });
});
