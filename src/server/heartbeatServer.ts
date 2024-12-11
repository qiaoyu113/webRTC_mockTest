// src/server/heartbeatServer.ts
import WebSocket from 'ws';

interface HeartbeatServerConfig {
  port: number;
  heartbeatTimeout: number;
  disconnectTimeout: number;
  simulateLatency: boolean;
  latencyMs: number;
  responsePatterns: ResponsePattern[];
}

interface ResponsePattern {
  id: string;
  messageType: 'heartbeat' | 'custom' | 'system';
  pattern: string;
  response: string;
}

interface ClientInfo {
  id: string;
  connectionTime: number;
  lastHeartbeat: number;
  heartbeatCount: number;
  missedHeartbeats: number;
}

export class HeartbeatServer {
  private server: WebSocket.Server;
  private config: HeartbeatServerConfig;
  private clients: Map<WebSocket, ClientInfo>;
  private heartbeatCheckers: Map<string, NodeJS.Timeout>;

  constructor(config: HeartbeatServerConfig) {
    this.config = config;
    this.server = new WebSocket.Server({ port: config.port });
    this.clients = new Map();
    this.heartbeatCheckers = new Map();
    this.init();
  }

  private init() {
    console.log(`WebSocket Server started on port ${this.config.port}`);
    console.log('Current config:', this.config);

    this.server.on('connection', this.handleConnection.bind(this));
  }

  private handleConnection(ws: WebSocket) {
    const clientId = this.generateClientId();
    const clientInfo: ClientInfo = {
      id: clientId,
      connectionTime: Date.now(),
      lastHeartbeat: Date.now(),
      heartbeatCount: 0,
      missedHeartbeats: 0
    };

    this.clients.set(ws, clientInfo);
    console.log(`Client ${clientId} connected`);

    this.startHeartbeatCheck(ws, clientId);
    ws.on('message', (message: Buffer) => this.handleMessage(ws, message));
    ws.on('close', () => this.handleDisconnect(ws, clientId));
    ws.on('error', (error) => this.handleError(ws, clientId, error));
  }

  private async handleMessage(ws: WebSocket, message: Buffer) {
    console.log('handleMessage message', message)
    try {
      const clientInfo = this.clients.get(ws);
      if (!clientInfo) return;

      const data = JSON.parse(message.toString());
      console.log(`Received from client ${clientInfo.id}:`, data);

      // 根据消息类型处理
      switch (data.type) {
        case 'heartbeat':
          await this.handleHeartbeat(ws, clientInfo, data);
          break;
        case 'custom':
          await this.handleCustomMessage(ws, clientInfo, data);
          break;
        case 'system':
          await this.handleSystemMessage(ws, clientInfo, data);
          break;
        default:
          // 处理原始字符串消息（向后兼容）
          await this.handleLegacyMessage(ws, clientInfo, message.toString());
      }
    } catch (error) {
      console.error('Error handling message:', error);
    }
  }

  private async handleHeartbeat(ws: WebSocket, clientInfo: ClientInfo, data: any) {
    clientInfo.lastHeartbeat = Date.now();
    clientInfo.heartbeatCount++;
    clientInfo.missedHeartbeats = 0;

    // 从配置中查找匹配的响应模式
    const response = this.findMatchingResponse('heartbeat', data.data?.status || '');
    
    // 构建响应消息
    const responseMessage = {
      type: 'heartbeat',
      timestamp: Date.now(),
      clientId: clientInfo.id,
      data: {
        status: response || '暂无配置返回内容', // 如果没有匹配的响应，返回默认消息
        sequence: data.data?.sequence,
        latency: Date.now() - data.timestamp
      }
    };

    await this.sendResponse(ws, responseMessage);
  }

    // 同样修改自定义消息的处理
    private async handleCustomMessage(ws: WebSocket, clientInfo: ClientInfo, data: any) {
        const response = this.findMatchingResponse('custom', data.data?.content || '');
        
        const responseMessage = {
        type: 'custom',
        timestamp: Date.now(),
        clientId: clientInfo.id,
        data: {
            content: response || '暂无配置返回内容',
            metadata: {
            originalMessageId: data.data?.metadata?.sequence,
            matchedPattern: response ? true : false
            }
        }
        };

        await this.sendResponse(ws, responseMessage);
    }

    private async handleSystemMessage(ws: WebSocket, clientInfo: ClientInfo, data: any) {
        const response =  data.data?.message || '';

        const responseMessage = {
          type: 'system',
          timestamp: Date.now(),
          clientId: clientInfo.id,
          data: {
            action: data.data.action,
            message: response || '暂无配置返回内容',
            metadata: {
              matchedPattern: response ? true : false
            }
          }
        };
    
        await this.sendResponse(ws, responseMessage);
    }

  private async handleLegacyMessage(ws: WebSocket, clientInfo: ClientInfo, message: string) {
    // 处理旧格式的消息（如简单的 'ping'）
    if (message === 'ping') {
      await this.sendResponse(ws, 'pong');
    }
  }

  private findMatchingResponse(messageType: string, content: string): string | null {
    // 在配置的响应模式中查找匹配项
    const pattern = this.config.responsePatterns.find(p => {
        if (p.messageType !== messageType) {
            return false;
        }
        
        try {
            // 使用正则表达式进行匹配
            const regex = new RegExp(p.pattern);
            return regex.test(content);
        } catch (error) {
            // 如果正则表达式无效，进行精确匹配
            return p.pattern === content;
        }
    });

    // 返回匹配的响应或 null
    return pattern ? pattern.response : null;
  }

  private async sendResponse(ws: WebSocket, data: any) {
    if (ws.readyState !== WebSocket.OPEN) return;

    const send = () => {
      const message = typeof data === 'string' ? data : JSON.stringify(data);
      ws.send(message);
    };

    if (this.config.simulateLatency) {
      await new Promise(resolve => setTimeout(resolve, this.config.latencyMs));
      send();
    } else {
      send();
    }
  }

  private startHeartbeatCheck(ws: WebSocket, clientId: string) {
    const interval = setInterval(() => {
      const clientInfo = this.clients.get(ws);
      if (!clientInfo) return;

      const now = Date.now();
      const timeSinceLastHeartbeat = now - clientInfo.lastHeartbeat;

      if (timeSinceLastHeartbeat > this.config.heartbeatTimeout) {
        clientInfo.missedHeartbeats++;
        console.log(`Client ${clientId} missed heartbeat (${clientInfo.missedHeartbeats} times)`);

        if (timeSinceLastHeartbeat > this.config.disconnectTimeout) {
          console.log(`Client ${clientId} timed out, closing connection`);
          ws.close();
        }
      }
    }, 5000);

    this.heartbeatCheckers.set(clientId, interval);
  }

  private handleDisconnect(ws: WebSocket, clientId: string) {
    const clientInfo = this.clients.get(ws);
    if (clientInfo) {
      console.log(`Client ${clientId} disconnected after ${
        this.formatDuration(Date.now() - clientInfo.connectionTime)
      }`);
    }

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

  private generateClientId(): string {
    return `client-${Math.random().toString(36).substr(2, 9)}`;
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  }

  public updateConfig(newConfig: Partial<HeartbeatServerConfig>) {
    this.config = { ...this.config, ...newConfig };
    console.log('Server configuration updated:', this.config);
    return this.config;
  }

  public getStatus() {
    return {
      clientCount: this.clients.size,
      uptime: process.uptime(),
      config: this.config,
      clients: Array.from(this.clients.entries()).map(([_, info]) => ({
        id: info.id,
        connectionTime: info.connectionTime,
        lastHeartbeat: info.lastHeartbeat,
        heartbeatCount: info.heartbeatCount,
        missedHeartbeats: info.missedHeartbeats
      }))
    };
  }
}