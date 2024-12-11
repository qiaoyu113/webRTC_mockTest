/*
    组件名: Heartbeat心跳检测机
    描述: 包含功能如下: 
            1. 心跳检测机制
            2. 可配置的心跳间隔和超时时间
            3. 自动重连机制
            4. 详细的状态监控和日志
            5. 错误处理和恢复策略
    开发者: Joey Qiao
    日期: 2024-12-11
*/
export interface HeartbeatConfig {
    heartbeatInterval: number;
    heartbeatTimeout: number;
    maxReconnectAttempts: number;
    reconnectInterval: number;
  }
  
export interface HeartbeatCallbacks {
    onSendHeartbeat: () => void;
    onHeartbeatTimeout: () => void;
    onStatusChange?: (status: ConnectionStatus) => void;
  }
  
export type ConnectionStatus = 'connected' | 'disconnected' | 'error';
  
export class HeartbeatController {
  private lastHeartbeatTime: number = 0;
  private lastHeartbeatResponse: number = 0;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private heartbeatCheckTimer: NodeJS.Timeout | null = null;
  private currentReconnectAttempts: number = 0;
  private status: ConnectionStatus = 'disconnected';
  
  constructor(
      private config: HeartbeatConfig,
      private callbacks: HeartbeatCallbacks
  ) {}
  
  public start(): void {
    this.stop();
    this.lastHeartbeatTime = Date.now();
    this.lastHeartbeatResponse = Date.now();
    this.setStatus('connected');
    this.currentReconnectAttempts = 0;
    this.startHeartbeat();
    this.startHeartbeatCheck();
  }
  
  public stop(): void {
    this.stopHeartbeat();
    this.stopHeartbeatCheck();
    this.setStatus('disconnected');
  }
  
  public updateResponse(): void {
    this.lastHeartbeatResponse = Date.now();
  }
  
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, this.config.heartbeatInterval);
  }
  
  private startHeartbeatCheck(): void {
    this.heartbeatCheckTimer = setInterval(() => {
      this.checkHeartbeat();
    }, this.config.heartbeatInterval);
  }
  
  private sendHeartbeat(): void {
    this.lastHeartbeatTime = Date.now();
    console.log(`[${new Date().toLocaleString()}] 发送心跳包`);
    this.callbacks.onSendHeartbeat();
  }
  
  private checkHeartbeat(): void {
    const now = Date.now();
    const timeSinceLastResponse = now - this.lastHeartbeatResponse;
  
    if (timeSinceLastResponse > this.config.heartbeatTimeout) {
      console.error(`[${new Date().toLocaleString()}] 心跳超时!`);
      this.handleHeartbeatTimeout();
    }
  }
  
  private handleHeartbeatTimeout(): void {
    this.setStatus('error');
    if (this.currentReconnectAttempts >= this.config.maxReconnectAttempts) {
      console.error('达到最大重连次数，停止重连');
      this.stop();
      return;
    }
  
    this.currentReconnectAttempts++;
    console.log(`尝试第 ${this.currentReconnectAttempts} 次重连...`);
    this.callbacks.onHeartbeatTimeout();
  }
  
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
  
  private stopHeartbeatCheck(): void {
    if (this.heartbeatCheckTimer) {
      clearInterval(this.heartbeatCheckTimer);
      this.heartbeatCheckTimer = null;
    }
  }
  
  private setStatus(status: ConnectionStatus): void {
    this.status = status;
    this.callbacks.onStatusChange?.(status);
  }
  
  public getStatus(): ConnectionStatus {
    return this.status;
  }
  
  public getMetrics() {
    return {
      lastHeartbeatTime: this.lastHeartbeatTime,
      lastHeartbeatResponse: this.lastHeartbeatResponse,
      reconnectAttempts: this.currentReconnectAttempts,
      status: this.status
    };
  }
}