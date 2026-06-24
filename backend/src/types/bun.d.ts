type BunEnv = Record<string, string | undefined>;

declare const Bun: {
  env: BunEnv;
  serve(options: {
    port: number;
    fetch: (request: Request) => Response | Promise<Response>;
    websocket?: unknown;
  }): {
    port: number;
  };
};

declare module "bun" {
  export type ServerWebSocket<T = unknown> = T;
  export type WebSocketHandler<T = unknown> = {
    open?: (ws: ServerWebSocket<T>) => void;
    message?: (ws: ServerWebSocket<T>, message: string | ArrayBuffer) => void;
    close?: (ws: ServerWebSocket<T>, code?: number, reason?: string) => void;
  };
  export const serve: typeof Bun.serve;
}

declare module "bun:test" {
  export const describe: (name: string, fn: () => void) => void;
  export const test: (name: string, fn: () => void | Promise<void>) => void;
  export const expect: <T>(actual: T) => {
    toBe(expected: T): void;
  };
}
