// src/components/HeartbeatMonitor.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import styled from 'styled-components';
import StatusPanel from './StatusPanel';
import { LogViewer } from './LogViewer';
import { ClientSimulator } from './ClientSimulator';
import { ConnectionStatus, LogMessage, ClientSimulation } from '../types';

const Container = styled.div`
  padding: 20px;
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 20px;
  height: 100vh;
  background-color: #f5f5f5;
`;

const Button = styled.button`
  padding: 10px 20px;
  margin-bottom: 20px;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  
  &:hover {
    background-color: #45a049;
  }
`;

export const HeartbeatMonitor: React.FC = () => {
  const [clients, setClients] = useState<ClientSimulation[]>([]);
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const websockets = useRef<Map<string, WebSocket>>(new Map());
  const heartbeatIntervals = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const addLog = (message: string, type: LogMessage['type'] = 'info', clientId?: string) => {
    setLogs(prev => [...prev, {
      id: Date.now().toString(),
      timestamp: Date.now(),
      type,
      message,
      clientId
    }]);
  };

  // 创建 WebSocket 连接
  const createWebSocketConnection = useCallback((client: ClientSimulation) => {
    const ws = new WebSocket('ws://localhost:8081');
    
    ws.onopen = () => {
      updateClient({
        ...client,
        status: 'connected',
        currentReconnectAttempts: 0
      });
      addLog(`客户端 ${client.id} 已连接`, 'success', client.id);
      startHeartbeat(client.id);
    };

    ws.onclose = () => {
      updateClient({
        ...client,
        status: 'disconnected'
      });
      addLog(`客户端 ${client.id} 已断开`, 'warning', client.id);
      stopHeartbeat(client.id);
      handleReconnect(client);
    };

    ws.onerror = (error) => {
      addLog(`客户端 ${client.id} 发生错误`, 'error', client.id);
      updateClient({
        ...client,
        status: 'error'
      });
    };

    ws.onmessage = (event) => {
      addLog(`收到消息: ${event.data}`, 'info', client.id);
      if (event.data === 'pong') {
        updateClient({
          ...client,
          lastHeartbeat: Date.now()
        });
      }
    };

    websockets.current.set(client.id, ws);
    return ws;
  }, []);

  // 开始心跳
  const startHeartbeat = useCallback((clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    if (!client || !client.heartbeatInterval) return;

    const interval = setInterval(() => {
      const ws = websockets.current.get(clientId);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send('ping');
        addLog(`发送心跳包`, 'info', clientId);
      }
    }, client.heartbeatInterval);

    heartbeatIntervals.current.set(clientId, interval);
  }, [clients]);

  // 停止心跳
  const stopHeartbeat = useCallback((clientId: string) => {
    const interval = heartbeatIntervals.current.get(clientId);
    if (interval) {
      clearInterval(interval);
      heartbeatIntervals.current.delete(clientId);
    }
  }, []);

  // 处理重连
  const handleReconnect = useCallback((client: ClientSimulation) => {
    if (client.currentReconnectAttempts >= client.maxReconnectAttempts) {
      addLog(`达到最大重连次数 (${client.maxReconnectAttempts})，停止重连`, 'error', client.id);
      return;
    }

    const newAttempts = client.currentReconnectAttempts + 1;
    updateClient({
      ...client,
      currentReconnectAttempts: newAttempts,
      status: 'error'
    });

    addLog(`尝试第 ${newAttempts} 次重连...`, 'warning', client.id);
    
    setTimeout(() => {
      createWebSocketConnection(client);
    }, client.reconnectInterval);
  }, []);

  // 创建新客户端
  const createNewClient = useCallback(() => {
    const newClient: ClientSimulation = {
      id: `client-${Date.now()}`,
      status: 'disconnected',
      packageLoss: 0,
      latency: 0,
      autoReply: true,
      heartbeatInterval: 5000,  // 默认 5 秒
      maxReconnectAttempts: 3,  // 默认 3 次
      currentReconnectAttempts: 0,
      reconnectInterval: 3000,  // 默认 3 秒
      lastHeartbeat: 0
    };

    setClients(prev => [...prev, newClient]);
    createWebSocketConnection(newClient);
  }, []);

  // 更新客户端
  const updateClient = useCallback((updatedClient: ClientSimulation) => {
    setClients(prev => prev.map(c => 
      c.id === updatedClient.id ? updatedClient : c
    ));

    // 如果心跳间隔改变，重启心跳
    const oldClient = clients.find(c => c.id === updatedClient.id);
    if (oldClient && oldClient.heartbeatInterval !== updatedClient.heartbeatInterval) {
      stopHeartbeat(updatedClient.id);
      if (updatedClient.status === 'connected') {
        startHeartbeat(updatedClient.id);
      }
    }
  }, [clients]);

  // 发送消息
  const sendMessage = useCallback((clientId: string, message: string) => {
    const ws = websockets.current.get(clientId);
    const client = clients.find(c => c.id === clientId);
    
    if (!ws || !client) return;

    if (Math.random() * 100 > client.packageLoss) {
      setTimeout(() => {
        ws.send(message);
        addLog(`发送消息: ${message}`, 'info', clientId);
      }, client.latency);
    } else {
      addLog(`消息丢失`, 'warning', clientId);
    }
  }, [clients]);

  // 清理资源
  useEffect(() => {
    return () => {
      websockets.current.forEach(ws => ws.close());
      heartbeatIntervals.current.forEach(interval => clearInterval(interval));
    };
  }, []);

  return (
    <Container>
      <div>
        <Button onClick={createNewClient}>添加新客户端 (Add New Client)</Button>
        {clients.map(client => (
          <ClientSimulator
            key={client.id}
            client={client}
            onUpdate={updateClient}
            onSendMessage={(message) => sendMessage(client.id, message)}
          />
        ))}
      </div>
      <div>
        <LogViewer logs={logs} />
      </div>
    </Container>
  );
};