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

// 添加消息解析器类
class MessageParser {
    static readonly HEADER = 'XZYH';
  
    static parseMessage(buffer: Buffer): any {
      try {
        // 验证头部
        const header = buffer.slice(0, 4).toString();
        if (header !== this.HEADER) {
          throw new Error('Invalid message header');
        }
  
        // 提取 JSON 部分
        const jsonStartIndex = buffer.indexOf('{');
        if (jsonStartIndex === -1) {
          // 如果没有找到 JSON，返回原始消息
          return {
            header,
            raw: buffer
          };
        }
  
        const jsonPart = buffer.slice(jsonStartIndex).toString();
        const jsonData = JSON.parse(jsonPart);
  
        return {
          header,
          cmd: jsonData.cmd,
          data: jsonData,
          raw: buffer
        };
      } catch (error) {
        console.error('Parse message error:', error);
        return {
          header: 'XZYH',
          raw: buffer,
          error: true
        };
      }
    }

    static constructVideoFrame(frameData: Buffer): Buffer {
        const header = Buffer.from('XZYH');
        const type = Buffer.from([0x46]); // 'F'
        const length = Buffer.alloc(2);
        length.writeUInt16LE(frameData.length);
        const padding = Buffer.alloc(6, 0);
        const flags = Buffer.from([0xff, 0x00, 0x00, 0x00]);
    
        return Buffer.concat([
          header,
          type,
          length,
          padding,
          flags,
          frameData
        ]);
      }

      static createVideoResponse(frameNumber: number): Buffer {
        const videoData = {
          cmd: 6205,
          account_id: "",
          payload: {
            video_data: Buffer.alloc(1024).fill(frameNumber % 256).toString('base64'), // 模拟视频数据
            frame_number: frameNumber,
            timestamp: Date.now(),
            video_type: 1
          }
        };
    
        const jsonStr = JSON.stringify(videoData);
        return this.constructVideoFrame(Buffer.from(jsonStr));
      }
  
    static constructResponse(cmd: number, payload: any = {}): Buffer {
        let jsonData;

        // 处理视频流请求
        if (payload.command_id === 1350 && payload.cmd === 1306) {
            jsonData = {
            command_id: 1350,
            cmd: 1306,
            account_id: payload.account_id || '',
            channel_id: payload.channel_id || 0,
            payload: {
                cmd: payload.payload.cmd,
                data: [], // 根据实际需求填充数据
                table: payload.payload.table,
                transaction: payload.payload.transaction,
                result: 0
            }
            };
        }
        // 处理视频流配置
        else if (payload.command_id === 1350 && payload.cmd === 6205) {
            jsonData = {
            command_id: 1350,
            cmd: 6205,
            channel_id: payload.channel_id || 0,
            payload: {
                result: 0,
                video_type: payload.payload?.video_type || 1,
                station_video_type: payload.payload?.station_video_type || 1,
                pip_cord: payload.payload?.pip_cord || {
                x1: 50,
                y1: 50,
                x2: 250,
                y2: 190
                },
                restore: payload.payload?.restore || 1
            }
            };
        }
        
        // 对于 9100 命令的特殊处理
        if (cmd === 9100) {
          jsonData = {
            cmd: 9100,
            payload: {
              result: 0
            }
          };
        }
        // 对于 1306 命令的处理
        else if (cmd === 1306) {
          jsonData = {
            cmd: 1306,
            payload: {
              result: 0,
              cmd: payload.payload?.cmd || 10000,
              data: [],
              table: payload.payload?.table || "push_event_info",
              transaction: payload.payload?.transaction
            }
          };
        }
        // 默认响应格式
        else {
          jsonData = {
            cmd,
            payload: {
              result: 0,
              ...payload
            }
          };
        }
    
        const jsonStr = JSON.stringify(jsonData);
        const jsonBuffer = Buffer.from(jsonStr);
    
        return this.constructBuffer(jsonBuffer);
    }
    
    static createResponse(cmd: number, payload: any = {}, sequence?: number) {
        // 对于 9100 命令的特殊处理
        if (cmd === 9100) {
          const simpleResponse = {
            cmd: 9100,
            payload: {
              result: 0
            }
          };
          const jsonBuffer = Buffer.from(JSON.stringify(simpleResponse));
          return this.constructBuffer(jsonBuffer);
        }
    
        // 对于 1306 命令的处理
        if (cmd === 1306) {
          // 保持原始请求中的 transaction 和其他字段
          const response = {
            cmd: 1306,
            payload: {
              result: 0,
              cmd: payload.cmd || 10000,
              data: [],
              table: payload.table || "push_event_info",
              transaction: payload.transaction
            }
          };
          const jsonBuffer = Buffer.from(JSON.stringify(response));
          return this.constructBuffer(jsonBuffer);
        }
    
        // 默认响应格式
        const defaultResponse = {
          cmd,
          payload: {
            result: 0,
            ...payload
          }
        };
        const jsonBuffer = Buffer.from(JSON.stringify(defaultResponse));
        return this.constructBuffer(jsonBuffer);
      }
    
      private static constructBuffer(jsonBuffer: Buffer): Buffer {
        const header = Buffer.from('XZYH');
        const type = Buffer.from([0x46]); // 'F'
        const length = Buffer.alloc(2);
        length.writeUInt16LE(jsonBuffer.length);
        const padding = Buffer.alloc(6, 0);
        const flags = Buffer.from([0xff, 0x00, 0x00, 0x00]);
    
        return Buffer.concat([
          header,       // XZYH
          type,        // F
          length,      // 长度（2字节）
          padding,     // 6字节填充
          flags,       // 标志位
          jsonBuffer   // JSON数据
        ]);
      }
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

//   private async handleMessage(ws: WebSocket, message: Buffer) {
//     console.log('handleMessage message', message)
//     try {
//       const clientInfo = this.clients.get(ws);
//       if (!clientInfo) return;

//       const data = JSON.parse(message.toString());
//       console.log(`Received from client ${clientInfo.id}:`, data);

//       // 根据消息类型处理
//       switch (data.type) {
//         case 'heartbeat':
//           await this.handleHeartbeat(ws, clientInfo, data);
//           break;
//         case 'custom':
//           await this.handleCustomMessage(ws, clientInfo, data);
//           break;
//         case 'system':
//           await this.handleSystemMessage(ws, clientInfo, data);
//           break;
//         default:
//           // 处理原始字符串消息（向后兼容）
//           await this.handleLegacyMessage(ws, clientInfo, message.toString());
//       }
//     } catch (error) {
//       console.error('Error handling message:', error);
//     }
//   }

    private videoStreams: Map<string, ReturnType<typeof setInterval>> = new Map();
    
    private async handleMessage(ws: WebSocket, message: Buffer) {
    try {
      const clientInfo = this.clients.get(ws);
      if (!clientInfo) return;

      // 解析消息
      const parsedMessage = MessageParser.parseMessage(message);
      console.log('Parsed message:', parsedMessage);

      if (parsedMessage.error) {
        console.warn('Invalid message format');
        ws.send('Invalid message format');
        return;
      }

      // 处理请求
      const { data } = parsedMessage;
      if (data.cmd === 6205) {
        // 处理视频流配置请求
        await this.handleVideoStreamRequest(ws, clientInfo, data);
      }
      if (data.command_id === 1350) {
        switch (data.cmd) {
          case 1306: // 处理数据请求
            await this.handleDataRequest(ws, clientInfo, data);
            break;
          case 6205: // 处理视频流配置
            await this.handleVideoConfig(ws, clientInfo, data);
            break;
        }
      } else {

        // 根据 cmd 处理不同类型的消息
        switch (parsedMessage.cmd) {
            case 1350:
            await this.handle1350Message(ws, clientInfo, parsedMessage.data);
            break;
            case 1306:
            await this.handle1306Message(ws, clientInfo, parsedMessage.data);
            break;
            case 9100:
            await this.handle9100Message(ws, clientInfo, parsedMessage.data);
            break;
            default:
            // 处理其他类型的消息
            if (parsedMessage.data) {
                // 如果是 JSON 消息，按原有逻辑处理
                await this.handleJsonMessage(ws, clientInfo, parsedMessage.data);
            } else {
                // 处理非 JSON 消息
                await this.handleLegacyMessage(ws, clientInfo, message.toString());
            }
        }
      }
    } catch (error) {
      console.error('Error handling message:', error);
    }
  }

  private async handleVideoStreamRequest(ws: WebSocket, clientInfo: ClientInfo, config: any) {
    try {
      // 停止可能存在的旧视频流
      this.stopVideoStream(clientInfo.id);

      // 发送配置确认响应
      const response = MessageParser.constructResponse(6205, config);
      await this.sendBinaryResponse(ws, response);

      // 开始发送视频流
      let frameNumber = 0;
      const streamInterval = setInterval(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          this.stopVideoStream(clientInfo.id);
          return;
        }

        try {
          const videoFrame = MessageParser.createVideoResponse(frameNumber++);
          ws.send(videoFrame);
        } catch (error) {
          console.error('Error sending video frame:', error);
          this.stopVideoStream(clientInfo.id);
        }
      }, 33); // 约30fps

      this.videoStreams.set(clientInfo.id, streamInterval);
      console.log(`Started video stream for client ${clientInfo.id}`);

    } catch (error) {
      console.error('Error handling video stream request:', error);
    }
  }

  private stopVideoStream(clientId: string) {
    const existingStream = this.videoStreams.get(clientId);
    if (existingStream) {
      clearInterval(existingStream);
      this.videoStreams.delete(clientId);
      console.log(`Stopped video stream for client ${clientId}`);
    }
  }

   // 处理数据请求
   private async handleDataRequest(ws: WebSocket, clientInfo: ClientInfo, data: any) {
    // 首先发送数据响应
    const response = MessageParser.constructResponse(1306, data);
    await this.sendBinaryResponse(ws, response);

    // 如果需要持续推送数据
    if (data.hasData) {
      this.startDataPush(ws, clientInfo, data);
    }
  }

  // 启动数据推送
  private startDataPush(ws: WebSocket, clientInfo: ClientInfo, config: any) {
    const pushKey = `push_${clientInfo.id}`;
    
    // 清理可能存在的旧推送
    const oldPush = this.heartbeatCheckers.get(pushKey);
    if (oldPush) {
      clearInterval(oldPush);
    }

    // 创建新的推送
    const pushInterval = setInterval(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        clearInterval(pushInterval);
        return;
      }

      try {
        // 创建推送数据
        const pushData = {
          command_id: 1351,
          cmd: config.reciveCmd,
          payload: {
            // 这里填充实际的推送数据
            cmd: config.payload.cmd,
            data: [],
            table: config.payload.table,
            transaction: config.payload.transaction,
            result: 0
          }
        };

        const response = MessageParser.constructResponse(config.reciveCmd, pushData);
        ws.send(response);
      } catch (error) {
        console.error('Error sending push data:', error);
        clearInterval(pushInterval);
      }
    }, 1000); // 每秒推送一次

    this.heartbeatCheckers.set(pushKey, pushInterval);
  }

  // 处理视频流配置
  private async handleVideoConfig(ws: WebSocket, clientInfo: ClientInfo, data: any) {
    // 发送配置确认
    const response = MessageParser.constructResponse(6205, data);
    await this.sendBinaryResponse(ws, response);

    // 开始发送视频流
    this.startVideoStream(ws, clientInfo, data);
  }

  // 启动视频流
  private startVideoStream(ws: WebSocket, clientInfo: ClientInfo, config: any) {
    const streamKey = `video_${clientInfo.id}`;
    
    // 清理可能存在的旧流
    const oldStream = this.heartbeatCheckers.get(streamKey);
    if (oldStream) {
      clearInterval(oldStream);
    }

    // 创建新的视频流
    const streamInterval = setInterval(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        clearInterval(streamInterval);
        return;
      }

      try {
        // 创建视频帧
        const frameData = {
          command_id: 1351,
          cmd: 6205,
          channel_id: config.channel_id,
          payload: {
            // 这里填充实际的视频数据
            video_data: Buffer.alloc(1024).toString('base64'), // 示例数据
            timestamp: Date.now(),
            frame_type: 'I', // 或 'P'
            video_type: config.payload.video_type
          }
        };

        const response = MessageParser.constructResponse(6205, frameData);
        ws.send(response);
      } catch (error) {
        console.error('Error sending video frame:', error);
        clearInterval(streamInterval);
      }
    }, 33); // 约30fps

    this.heartbeatCheckers.set(streamKey, streamInterval);
  }

  private async handle1306Message(ws: WebSocket, clientInfo: ClientInfo, data: any) {
    const response = MessageParser.constructResponse(1306, data);
    await this.sendBinaryResponse(ws, response);
  }
  

  private async handle9100Message(ws: WebSocket, clientInfo: ClientInfo, data: any) {
    const response = MessageParser.constructResponse(9100);
    await this.sendBinaryResponse(ws, response);
  }

  private async handle1350Message(ws: WebSocket, clientInfo: ClientInfo, data: any) {
    // 首先发送配置确认响应
    const configResponse = MessageParser.constructResponse(1350, data);
    await this.sendBinaryResponse(ws, configResponse);

    // 开始模拟发送视频流数据
    this.startStreamingVideo(ws, clientInfo, data);
  }

  private startStreamingVideo(ws: WebSocket, clientInfo: ClientInfo, config: any) {
    // 创建一个定时器来模拟视频流
    const streamInterval = setInterval(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        clearInterval(streamInterval);
        return;
      }

      // 创建模拟的视频帧数据
      const frameData = this.createVideoFrame();
      
      try {
        // 发送视频帧
        ws.send(frameData);
      } catch (error) {
        console.error('Error sending video frame:', error);
        clearInterval(streamInterval);
      }
    }, 33); // 约30fps

    // 保存定时器引用以便清理
    const streamKey = `stream_${clientInfo.id}`;
    this.heartbeatCheckers.set(streamKey, streamInterval);
  }

  private createVideoFrame(): Buffer {
    // 这里创建一个简单的视频帧格式
    // 实际应用中需要根据具体的视频编码格式来构造
    const header = Buffer.from('XZYH');
    const type = Buffer.from([0x46]); // 'F'
    
    // 创建模拟的视频数据
    const frameData = Buffer.alloc(1024); // 示例大小
    frameData.fill(0); // 填充示例数据
    
    const length = Buffer.alloc(2);
    length.writeUInt16LE(frameData.length);
    
    return Buffer.concat([
      header,
      type,
      length,
      Buffer.alloc(6, 0), // padding
      Buffer.from([0xff, 0x00, 0x00, 0x00]), // flags
      frameData
    ]);
  }

  private async handleJsonMessage(ws: WebSocket, clientInfo: ClientInfo, data: any) {
    // 处理 JSON 格式的消息（原有逻辑）
    if (data.type === 'heartbeat') {
      await this.handleHeartbeat(ws, clientInfo, data);
    } else if (data.type === 'custom') {
      await this.handleCustomMessage(ws, clientInfo, data);
    } else if (data.type === 'system') {
      await this.handleSystemMessage(ws, clientInfo, data);
    }
  }

  private async sendBinaryResponse(ws: WebSocket, response: Buffer) {
    if (ws.readyState !== WebSocket.OPEN) return;

    const send = () => {
      ws.send(response);
    };

    if (this.config.simulateLatency) {
      await new Promise(resolve => setTimeout(resolve, this.config.latencyMs));
      send();
    } else {
      send();
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
    // 停止视频流
    this.stopVideoStream(clientId);
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

    // 清理视频流
    const streamKey = `video_${clientId}`;
    const streamInterval = this.heartbeatCheckers.get(streamKey);
    if (streamInterval) {
      clearInterval(streamInterval);
      this.heartbeatCheckers.delete(streamKey);
    }

    // 清理数据推送
    const pushKey = `push_${clientId}`;
    const pushInterval = this.heartbeatCheckers.get(pushKey);
    if (pushInterval) {
      clearInterval(pushInterval);
      this.heartbeatCheckers.delete(pushKey);
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