import { PacketParser } from '../packetParser/base';
import { HeartbeatController, HeartbeatConfig } from './heartbeat';

export type ConnectionConfig = {
  url: string;
  packetParser?: typeof PacketParser;
  heartbeatInterval?: number;
}
export abstract class Connection {
  protected url: string;
  protected subscribers: Map<number | string, Set<(data: ArrayBuffer) => void>> = new Map();
  protected heartbeatInterval: number = 30000; // 30秒
  protected reconnectInterval: number = 5000; // 5秒
  protected heartbeatTimer: NodeJS.Timeout | null = null;
  protected reconnectTimer: NodeJS.Timeout | null = null;
  protected PacketParser: typeof PacketParser;
  protected messageQueue: Array<{ type: number | string; data: any }> = [];
  protected isProcessingQueue = false;
  protected heartbeatController: HeartbeatController;


  constructor({ url, packetParser, heartbeatInterval }: ConnectionConfig) {
    this.url = url;
    this.PacketParser = packetParser || PacketParser;
    this.heartbeatInterval = heartbeatInterval || 0; // 默认不发送心跳包

    const heartbeatConfig: HeartbeatConfig = {
      heartbeatInterval: heartbeatInterval || 30000,
      heartbeatTimeout: 60000, // 超时时间设置
      maxReconnectAttempts: 5, // 重新连接最大次数
      reconnectInterval: 5000 // 重新连接间隔
    };

    // 实例化心跳检测机制
    this.heartbeatController = new HeartbeatController(
      heartbeatConfig,
      {
        onSendHeartbeat: () => {
          this.sendPacket(0, 'ping');
        },
        onHeartbeatTimeout: () => {
          // 超时重新连接
          this.scheduleReconnect();
        },
        onStatusChange: (status) => {
          // 心跳状态机发生变更
          console.log(`Connection status changed to: ${status}`);
        }
      }
    );
  }

  public abstract connect(): Promise<void>;
  public abstract disconnect(): void;
  protected abstract sendData(data: ArrayBuffer | string | ArrayBuffer[]): Promise<void>;

  public subscribe(type: number | string, callback: (data: ArrayBuffer) => void): void {
    if (!this.subscribers.has(type)) {
      this.subscribers.set(type, new Set());
    }
    this.subscribers.get(type)!.add(callback);
  }

  public unsubscribe(type: number | string, callback: (data: ArrayBuffer) => void): void {
    const callbacks = this.subscribers.get(type);
    if (callbacks) {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        this.subscribers.delete(type);
      }
    }
  }

  public sendPacket(type: number | string, data: any): void {
    if(type === 0 && data === 'ping'){
      // console.log('发送ping包333');
      const packet = this.PacketParser.create(data);
      this.sendData(packet);
      return;
    }
    this.messageQueue.push({ type, data });
    this.processMessageQueue();
  }

  protected async handleMessage(data: Blob): Promise<void> {

    // todo 心跳包处理
    // todo 记录接收包数据和时间
    try {
      const { type, data: packetData } = await this.PacketParser.parse(data);
      if (type === 'ping') return;
      // console.log('接收报文解析后:', { type, dataLength: packetData }, this.subscribers);

      /**
       * 增加pong的心跳检测
       */
      if (type === 'pong') {
        this.heartbeatController.updateResponse();
        console.log(`[${new Date().toLocaleString()}] 收到心跳响应`);
        return;
      }

      const callbacks = this.subscribers.get(type);
      if (callbacks) {
        callbacks.forEach((callback) => callback(packetData));
      }
    } catch (error) {
      console.error('解析报文失败:', error);
    }
  }

  protected startHeartbeat(): void {
    /**
     *  之前版本
     */
    // this.stopHeartbeat();
    // // console.log('发送ping包',this.heartbeatInterval);
    // if (this.heartbeatInterval === 0) return;
    // this.heartbeatTimer = setInterval(() => {
    //   const str = 'ping';
    //   // console.log('发送ping包');
      
    //   this.sendPacket(0, str);
    // }, this.heartbeatInterval);

    /**
     *  Joey Qiao封装版本
     */
    this.heartbeatController.start();
  }

  protected stopHeartbeat(): void {
    /**
     *  之前版本
     */
    // if (this.heartbeatTimer) {
    //   clearInterval(this.heartbeatTimer);
    //   this.heartbeatTimer = null;
    // }

    /**
     *  Joey Qiao封装版本
     */
    this.heartbeatController.stop();
  }

  protected scheduleReconnect(): void {
    if (!this.reconnectTimer) {
      this.reconnectTimer = setTimeout(() => {
        console.log('尝试重新连接...');
        this.connect();
      }, this.reconnectInterval);
    }
  }

  protected cancelReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
  private async processMessageQueue(): Promise<void> {
    if (this.isProcessingQueue) return;

    this.isProcessingQueue = true;

    while (this.messageQueue.length > 0) {
      const message = this.messageQueue[0];
      try {
        const packet = this.PacketParser.create(message.data);
        // console.log('发送报文1:', packet);

        await this.sendData(packet);
        console.log('发送报文:', { dataLength: message.data.byteLength });

        // todo 记录发送包数据和时间

      } catch (error) {
        // this.messageQueue.shift(); // 移除已发送的消息
        console.error('发送报文失败:', error);
        // break; // 发送失败时停止处理队列
      } finally {
        this.messageQueue.shift(); // 移除已发送的消息
      }
    }

    this.isProcessingQueue = false;
  }
}