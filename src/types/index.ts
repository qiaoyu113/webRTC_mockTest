// src/types/index.ts
export interface ClientSimulation {
    id: string;
    status: 'connected' | 'disconnected' | 'error';
    packageLoss: number;
    latency: number;
    autoReply: boolean;
    heartbeatInterval: number;  // 心跳间隔时间
    maxReconnectAttempts: number;  // 最大重连次数
    currentReconnectAttempts: number;  // 当前重连次数
    reconnectInterval: number;  // 重连间隔时间
    lastHeartbeat: number;
  }
  
  export interface ConnectionStatus {
    id: string;
    status: 'connected' | 'disconnected' | 'error';
    lastHeartbeat: number;
    reconnectAttempts: number;
    latency: number;
  }
  
  export interface LogMessage {
    id: string;
    timestamp: number;
    type: 'info' | 'error' | 'warning' | 'success';
    message: string;
    clientId?: string;
  }