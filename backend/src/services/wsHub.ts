import type { WSContext } from "hono/ws";
import type { WebSocketEvent } from "../types/events";

type Client = {
  userId: string;
  socket: WSContext;
};

class WebSocketHub {
  private readonly clients = new Set<Client>();

  add(userId: string, socket: WSContext) {
    const client = { userId, socket };
    this.clients.add(client);
    return () => this.clients.delete(client);
  }

  broadcastToUser(userId: string, event: WebSocketEvent) {
    const payload = JSON.stringify(event);

    for (const client of this.clients) {
      if (client.userId !== userId) {
        continue;
      }

      try {
        client.socket.send(payload);
      } catch {
        this.clients.delete(client);
      }
    }
  }
}

export const wsHub = new WebSocketHub();
