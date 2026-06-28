import { env } from "../config/env";
import { consumeJson, isQueueEnabled } from "./messageQueue";
import { processWorkerEvent } from "./workerEvents";
import { workerEventSchema } from "../types/events";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const startWorkerEventConsumer = async () => {
  if (!isQueueEnabled()) {
    return;
  }

  while (true) {
    try {
      await consumeJson(env.DETECTION_EVENTS_QUEUE, async (payload) => {
        const event = workerEventSchema.parse(payload);
        await processWorkerEvent(event);
      });

      console.log(`Consuming worker events from queue '${env.DETECTION_EVENTS_QUEUE}'`);
      return;
    } catch (error) {
      console.error("Worker event consumer is waiting for RabbitMQ", error);
      await delay(5000);
    }
  }
};
