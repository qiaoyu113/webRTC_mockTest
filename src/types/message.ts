// src/types/message.ts
export interface HeartbeatMessage {
    type: 'heartbeat';
    timestamp: number;
    clientId: string;
    data: {
      status: 'ping' | 'pong';
      sequence?: number;
      latency?: number;
    };
  }
  
  export interface SystemMessage {
    type: 'system';
    timestamp: number;
    clientId: string;
    data: {
      action: 'connect' | 'disconnect' | 'error';
      message: string;
    };
  }
  
  export interface CustomMessage {
    type: 'custom';
    timestamp: number;
    clientId: string;
    data: {
      content: string;
      metadata?: any;
    };
  }
  
  export type WebSocketMessage = HeartbeatMessage | SystemMessage | CustomMessage;