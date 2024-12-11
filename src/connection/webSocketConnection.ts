import { PacketParser } from '../packetParser/base';
import { Connection } from './connection';
import type { ConnectionConfig } from './connection';

export class WebSocketConnection extends Connection {
  // private static instance: WebSocketConnection | null = null;
  public socket: WebSocket | null = null;

  public constructor({url, packetParser=PacketParser}:ConnectionConfig) {
    super({url, packetParser});
  }
  
  public async connect(): Promise<void> {
    if (this.socket) {
      console.log('WebSocket已经连接');
      return;
    }

    return new Promise((resolve, reject) => {
      this.socket = new WebSocket(this.url);

      this.socket.onopen = () => {
        console.log('WebSocket连接已建立');
        this.startHeartbeat();
        resolve();
      };

      this.socket.onerror = (error) => {
        console.error('WebSocket连接错误:', error);
        this.scheduleReconnect();
        reject(error);
      };

      this.socket.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      this.socket.onclose = () => {
        console.log('WebSocket连接已关闭');
        this.socket = null;
        this.stopHeartbeat();
        this.scheduleReconnect();
      };
    });
  }

  public disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.stopHeartbeat();
    this.cancelReconnect();
  }

  public async sendData(data: ArrayBuffer) {
    // 转base64
    const binaryString = String.fromCharCode.apply(null, data as any);
  
    const base64Data = btoa(binaryString);
    console.log('发送报文:',base64Data);
    
    //WFpZSEYFMwAAAAAA/wAAAHsiY21kIjoxMzA2LCJhY2NvdW50X2lkIjoiIiwicGF5bG9hZCI6eyJjbWQiOjkwMTZ9fQ==
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.error('WebSocket未连接，无法发送报文');
      return;
    }
    this.socket.send(data);
  }
}