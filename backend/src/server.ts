import { createBunWebSocket } from "hono/bun";
import { app } from "./app";
import { env } from "./config/env";
import { verifyAuthToken } from "./services/tokens";
import { wsHub } from "./services/wsHub";
import { startWorkerEventConsumer } from "./services/workerEventConsumer";

const { upgradeWebSocket, websocket } = createBunWebSocket();

app.get(
  "/ws",
  upgradeWebSocket((c) => {
    const token = c.req.query("token");

    if (!token) {
      return {
        onOpen: (_event, ws) => ws.close(1008, "Missing token")
      };
    }

    try {
      const payload = verifyAuthToken(token);
      let cleanup: (() => void) | undefined;

      return {
        onOpen: (_event, ws) => {
          cleanup = wsHub.add(payload.sub, ws);
          ws.send(JSON.stringify({ type: "connected" }));
        },
        onClose: () => cleanup?.(),
        onError: () => cleanup?.()
      };
    } catch {
      return {
        onOpen: (_event, ws) => ws.close(1008, "Invalid token")
      };
    }
  })
);

const server = Bun.serve({
  port: env.PORT,
  fetch: app.fetch,
  websocket
});

console.log(`Backend API listening on http://localhost:${server.port}`);

startWorkerEventConsumer().catch((error) => {
  console.error("Worker event consumer failed to start", error);
});
