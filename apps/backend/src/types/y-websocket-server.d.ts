declare module '@y/websocket-server/utils' {
  import type { IncomingMessage } from 'node:http';
  import type { WebSocket } from 'ws';

  export interface WSSharedDoc {
    conns: Map<WebSocket, Set<number>>;
    destroy(): void;
  }

  export const docs: Map<string, WSSharedDoc>;

  export function setupWSConnection(
    connection: WebSocket,
    request: IncomingMessage,
    options?: { docName?: string; gc?: boolean },
  ): void;
}
