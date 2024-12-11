// src/server/heartbeatServer.ts
import WebSocket from 'ws';

interface HeartbeatServerConfig {
  port: number;
  simulateLatency?: boolean;
  latencyMs?: number;
  heartbeatTimeout?: number;  // 心跳超时时间
  disconnectTimeout?: number; // 断开连接超时时间
}

interface ClientInfo {
  id: string;
  lastHeartbeat: number;
  connectionTime: number;
  heartbeatCount: number;
  missedHeartbeats: number;
}

export class HeartbeatServer {
  private server: WebSocket.Server;
  private clients: Map<WebSocket, ClientInfo>;
  private heartbeatCheckers: Map<string, NodeJS.Timeout>;

  constructor(private config: HeartbeatServerConfig) {
    this.server = new WebSocket.Server({ port: config.port });
    this.clients = new Map();
    this.heartbeatCheckers = new Map();
    this.init();
    this.handleGracefulShutdown();
  }

  private init() {
    console.log(`Heartbeat Server started on port ${this.config.port}`);
    console.log(`Configuration:`, {
      simulateLatency: this.config.simulateLatency,
      latencyMs: this.config.latencyMs,
      heartbeatTimeout: this.config.heartbeatTimeout || 30000,
      disconnectTimeout: this.config.disconnectTimeout || 60000
    });

    this.server.on('connection', this.handleConnection.bind(this));
  }

  private handleConnection(ws: WebSocket) {
    const clientId = this.generateClientId();
    const clientInfo: ClientInfo = {
      id: clientId,
      lastHeartbeat: Date.now(),
      connectionTime: Date.now(),
      heartbeatCount: 0,
      missedHeartbeats: 0
    };

    this.clients.set(ws, clientInfo);
    console.log(`Client ${clientId} connected`);

    // 开始心跳检查
    this.startHeartbeatCheck(ws, clientId);

    ws.on('message', (message: Buffer) => this.handleMessage(ws, message));
    ws.on('close', () => this.handleDisconnect(ws, clientId));
    ws.on('error', (error) => this.handleError(ws, clientId, error));

    // 发送欢迎消息
    this.sendToClient(ws, JSON.stringify({
      type: 'welcome',
      clientId,
      config: {
        heartbeatTimeout: this.config.heartbeatTimeout,
        disconnectTimeout: this.config.disconnectTimeout
      }
    }));
  }

  private startHeartbeatCheck(ws: WebSocket, clientId: string) {
    const interval = setInterval(() => {
      const clientInfo = this.clients.get(ws);
      if (!clientInfo) return;

      const now = Date.now();
      const timeSinceLastHeartbeat = now - clientInfo.lastHeartbeat;

      if (timeSinceLastHeartbeat > (this.config.heartbeatTimeout || 30000)) {
        clientInfo.missedHeartbeats++;
        console.log(`Client ${clientId} missed heartbeat (${clientInfo.missedHeartbeats} times)`);

        if (timeSinceLastHeartbeat > (this.config.disconnectTimeout || 60000)) {
          console.log(`Client ${clientId} timed out, closing connection`);
          ws.close();
          return;
        }
      }
    }, 5000); // 每5秒检查一次

    this.heartbeatCheckers.set(clientId, interval);
  }

  private handleMessage(ws: WebSocket, message: Buffer) {
    const clientInfo = this.clients.get(ws);
    if (!clientInfo) return;

    try {
      const data = message.toString();
      console.log(`Received from client ${clientInfo.id}:`, data);

      if (data === 'ping') {
        clientInfo.lastHeartbeat = Date.now();
        clientInfo.heartbeatCount++;
        clientInfo.missedHeartbeats = 0;

        // 模拟延迟响应
        if (this.config.simulateLatency) {
          setTimeout(() => {
            this.sendToClient(ws, 'pong');
          }, this.config.latencyMs || 1000);
        } else {
          this.sendToClient(ws, 'pong');
        }
      }
    } catch (error) {
      console.error(`Error handling message from client ${clientInfo.id}:`, error);
    }
  }

  private handleDisconnect(ws: WebSocket, clientId: string) {
    const clientInfo = this.clients.get(ws);
    if (clientInfo) {
      console.log(`Client ${clientId} disconnected after ${
        this.formatDuration(Date.now() - clientInfo.connectionTime)
      }`);
      console.log(`Statistics for client ${clientId}:`, {
        totalHeartbeats: clientInfo.heartbeatCount,
        missedHeartbeats: clientInfo.missedHeartbeats
      });
    }

    // 清理资源
    this.clients.delete(ws);
    const checker = this.heartbeatCheckers.get(clientId);
    if (checker) {
      clearInterval(checker);
      this.heartbeatCheckers.delete(clientId);
    }
  }

  private handleError(ws: WebSocket, clientId: string, error: Error) {
    console.error(`Error with client ${clientId}:`, error);
    ws.close();
  }

  private sendToClient(ws: WebSocket, data: string) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  }

  private generateClientId(): string {
    return `client-${Math.random().toString(36).substr(2, 9)}`;
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  }

  private handleGracefulShutdown() {
    const shutdown = () => {
      console.log('Shutting down server...');
      
      // 关闭所有客户端连接
      this.clients.forEach((info, ws) => {
        console.log(`Closing connection for client ${info.id}`);
        ws.close();
      });

      // 清理所有心跳检查器
      this.heartbeatCheckers.forEach((checker) => {
        clearInterval(checker);
      });

      // 关闭服务器
      this.server.close(() => {
        console.log('Server shutdown complete');
        process.exit(0);
      });
    };

    // 监听进程信号
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  }

  // 获取服务器状态
  public getStatus() {
    return {
      clientCount: this.clients.size,
      uptime: process.uptime(),
      clients: Array.from(this.clients.entries()).map(([ws, info]) => ({
        id: info.id,
        connectionTime: info.connectionTime,
        lastHeartbeat: info.lastHeartbeat,
        heartbeatCount: info.heartbeatCount,
        missedHeartbeats: info.missedHeartbeats
      }))
    };
  }
}