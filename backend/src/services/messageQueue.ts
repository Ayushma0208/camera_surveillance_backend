import { randomUUID } from "node:crypto";
import amqp, { type Channel, type ConsumeMessage } from "amqplib";
import { env } from "../config/env";

let channelPromise: Promise<Channel> | undefined;

const getChannel = async () => {
  if (!env.RABBITMQ_URL) {
    throw new Error("RABBITMQ_URL is not configured");
  }

  channelPromise ??= amqp
    .connect(env.RABBITMQ_URL)
    .then(async (connection) => {
      connection.on("close", () => {
        channelPromise = undefined;
      });
      connection.on("error", () => {
        channelPromise = undefined;
      });

      const channel = await connection.createChannel();
      await channel.assertQueue(env.CAMERA_COMMANDS_QUEUE, { durable: true });
      await channel.assertQueue(env.DETECTION_EVENTS_QUEUE, { durable: true });
      return channel;
    })
    .catch((error) => {
      channelPromise = undefined;
      throw error;
    });

  return channelPromise;
};

export const isQueueEnabled = () => Boolean(env.RABBITMQ_URL);

export const publishJson = async (queue: string, payload: unknown) => {
  const channel = await getChannel();
  const message = Buffer.from(JSON.stringify(payload));

  channel.sendToQueue(queue, message, {
    contentType: "application/json",
    messageId: randomUUID(),
    persistent: true,
    timestamp: Date.now()
  });
};

export const consumeJson = async (
  queue: string,
  handler: (payload: unknown) => Promise<void>
) => {
  const channel = await getChannel();
  await channel.prefetch(10);

  await channel.consume(queue, async (message: ConsumeMessage | null) => {
    if (!message) {
      return;
    }

    try {
      const payload = JSON.parse(message.content.toString("utf8")) as unknown;
      await handler(payload);
      channel.ack(message);
    } catch (error) {
      console.error(`Failed to process queue message from ${queue}`, error);
      channel.nack(message, false, false);
    }
  });
};
