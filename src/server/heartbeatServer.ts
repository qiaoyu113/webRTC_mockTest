// src/server/heartbeatServer.ts
import WebSocket from 'ws';

export class HeartbeatServer {
  private server: WebSocket.Server;

  constructor(port: number) {
    this.server = new WebSocket.Server({ port });
    this.init();
  }

  private init() {
    console.log(`WebSocket Server started on port ${this.server.options.port}`);

    this.server.on('connection', (ws: WebSocket) => {
      console.log('New client connected');

      ws.on('message', (message: Buffer) => {
        try {
          const data = message.toString();
          console.log('Received:', data);
          
          // 如果收到 ping，返回 pong
          if (data === 'ping') {
            ws.send('pong');
            console.log('Sent: pong');
          }
        } catch (error) {
          console.error('Error handling message:', error);
        }
      });

      ws.on('close', () => {
        console.log('Client disconnected');
      });
    });
  }
}