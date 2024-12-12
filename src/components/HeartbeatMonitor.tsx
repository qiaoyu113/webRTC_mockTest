// src/components/HeartbeatMonitor.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import styled from 'styled-components';
import StatusPanel from './StatusPanel';
import { LogViewer } from './LogViewer';
import { ClientSimulator } from './ClientSimulator';
import ServerConfigPanel from './ServerConfigPanel';
import { ConnectionStatus, LogMessage, ClientSimulation } from '../types';
import { WebSocketMessage, HeartbeatMessage, SystemMessage, CustomMessage } from '../types/message';

const Container = styled.div`
  padding: 20px;
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 20px;
  height: 100vh;
  background-color: #f5f5f5;
`;

const LeftPanel = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  overflow-y: auto;
`;

const RightPanel = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
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
  const messageSequence = useRef<number>(0);

  const addLog = (message: string, type: LogMessage['type'] = 'info', clientId?: string) => {
    setLogs(prev => [...prev, {
      id: Date.now().toString(),
      timestamp: Date.now(),
      type,
      message,
      clientId
    }]);
  };

  const createWebSocketConnection = useCallback((client: ClientSimulation) => {
    const ws = new WebSocket('ws://localhost:50100');
    
    ws.onopen = () => {
      const connectMessage: SystemMessage = {
        type: 'system',
        timestamp: Date.now(),
        clientId: client.id,
        data: {
          action: 'connect',
          message: 'Initializing connection'
        }
      };
      ws.send(JSON.stringify(connectMessage));

      updateClient({
        ...client,
        status: 'connected',
        currentReconnectAttempts: 0
      });
      addLog(`客户端 ${client.id} 已连接`, 'success', client.id);
      startHeartbeat(client.id);
    };

    ws.onclose = () => {
      const disconnectMessage: SystemMessage = {
        type: 'system',
        timestamp: Date.now(),
        clientId: client.id,
        data: {
          action: 'disconnect',
          message: 'Connection closed'
        }
      };

      updateClient({
        ...client,
        status: 'disconnected'
      });
      addLog(`客户端 ${client.id} 已断开`, 'warning', client.id);
      stopHeartbeat(client.id);
      handleReconnect(client);
    };

    ws.onerror = (error) => {
      const errorMessage: SystemMessage = {
        type: 'system',
        timestamp: Date.now(),
        clientId: client.id,
        data: {
          action: 'error',
          message: 'Connection error occurred'
        }
      };
      ws.send(JSON.stringify(errorMessage));
      
      addLog(`客户端 ${client.id} 发生错误`, 'error', client.id);
      updateClient({
        ...client,
        status: 'error'
      });
    };

    ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        handleIncomingMessage(client.id, message);
      } catch (error) {
        addLog(`消息解析错误: ${event.data}`, 'error', client.id);
      }
    };

    websockets.current.set(client.id, ws);
    return ws;
  }, []);

  const handleIncomingMessage = useCallback((clientId: string, message: WebSocketMessage) => {
    console.log(message.data)
    switch (message.type) {
      case 'heartbeat':
        const latency = Date.now() - message.timestamp;
        addLog(`收到心跳响应 #${message.data.status}, 延迟: ${latency}ms`, 'info', clientId);
        updateClient({
          ...clients.find(c => c.id === clientId)!,
          lastHeartbeat: Date.now()
        });
        break;
      
      case 'system':
        addLog(`系统消息: ${message.data.message} (${message.data.action})`, 'warning', clientId);
        break;
      
      case 'custom':
        addLog(`收到消息: ${message.data.content}`, 'info', clientId);
        // 如果设置了自动回复
        const client = clients.find(c => c.id === clientId);
        if (client?.autoReply) {
          sendAutoReply(clientId, message);
        }
        break;
    }
  }, [clients]);

  const sendAutoReply = useCallback((clientId: string, originalMessage: CustomMessage) => {
    const replyMessage: CustomMessage = {
      type: 'custom',
      timestamp: Date.now(),
      clientId,
      data: {
        content: `Auto reply to: ${originalMessage.data.content}`,
        metadata: {
          isAutoReply: true,
          originalMessageTimestamp: originalMessage.timestamp
        }
      }
    };
    const ws = websockets.current.get(clientId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(replyMessage));
      addLog(`发送自动回复`, 'info', clientId);
    }
  }, []);

  const startHeartbeat = useCallback((clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    if (!client || !client.heartbeatInterval) return;

    const interval = setInterval(() => {
      const ws = websockets.current.get(clientId);
      if (ws && ws.readyState === WebSocket.OPEN) {
        messageSequence.current++;
        const heartbeatMessage: HeartbeatMessage = {
          type: 'heartbeat',
          timestamp: Date.now(),
          clientId,
          data: {
            status: 'ping',
            sequence: messageSequence.current
          }
        };
        ws.send(JSON.stringify(heartbeatMessage));
        addLog(`发送心跳包 #${messageSequence.current}`, 'info', clientId);
      }
    }, client.heartbeatInterval);

    heartbeatIntervals.current.set(clientId, interval);
  }, [clients]);

  const stopHeartbeat = useCallback((clientId: string) => {
    const interval = heartbeatIntervals.current.get(clientId);
    if (interval) {
      clearInterval(interval);
      heartbeatIntervals.current.delete(clientId);
    }
  }, []);

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

  const createNewClient = useCallback(() => {
    const newClient: ClientSimulation = {
      id: `client-${Date.now()}`,
      status: 'disconnected',
      packageLoss: 0,
      latency: 0,
      autoReply: true,
      heartbeatInterval: 5000,
      maxReconnectAttempts: 3,
      currentReconnectAttempts: 0,
      reconnectInterval: 3000,
      lastHeartbeat: 0
    };

    setClients(prev => [...prev, newClient]);
    createWebSocketConnection(newClient);
  }, []);

  const updateClient = useCallback((updatedClient: ClientSimulation) => {
    setClients(prev => prev.map(c => 
      c.id === updatedClient.id ? updatedClient : c
    ));

    const oldClient = clients.find(c => c.id === updatedClient.id);
    if (oldClient && oldClient.heartbeatInterval !== updatedClient.heartbeatInterval) {
      stopHeartbeat(updatedClient.id);
      if (updatedClient.status === 'connected') {
        startHeartbeat(updatedClient.id);
      }
    }
  }, [clients]);

  const sendMessage = useCallback((clientId: string, message: string) => {
    const ws = websockets.current.get(clientId);
    const client = clients.find(c => c.id === clientId);
    
    if (!ws || !client) return;
  
    if (Math.random() * 100 > client.packageLoss) {
      setTimeout(() => {
        try {
          // 解析消息
          let messageObj;
          try {
            messageObj = JSON.parse(message);
          } catch (e) {
            // 如果不是 JSON，使用默认心跳消息格式
            messageObj = {
              type: 'heartbeat',
              timestamp: Date.now(),
              clientId,
              data: {
                status: message,
                sequence: Date.now()
              }
            };
          }
  
          // 发送消息
          ws.send(JSON.stringify(messageObj));
          
          // 添加日志
          let logMessage = '';
          switch (messageObj.type) {
            case 'heartbeat':
              logMessage = `发送心跳消息: ${messageObj.data.status}`;
              break;
            case 'system':
              logMessage = `发送系统消息: ${messageObj.data.action}`;
              break;
            case 'custom':
              logMessage = `发送自定义消息: ${messageObj.data.content}`;
              break;
          }
          addLog(logMessage, 'info', clientId);
  
        } catch (error) {
          addLog(`发送消息失败: ${error}`, 'error', clientId);
        }
      }, client.latency);
    } else {
      addLog(`消息丢失`, 'warning', clientId);
    }
  }, [clients]);

  // 添加关闭连接处理函数
  const handleCloseConnection = useCallback((clientId: string) => {
    const ws = websockets.current.get(clientId);
    if (ws) {
      ws.close();
      websockets.current.delete(clientId);
      stopHeartbeat(clientId);
      updateClient({
        ...clients.find(c => c.id === clientId)!,
        status: 'disconnected'
      });
      addLog(`手动关闭客户端 ${clientId} 的连接`, 'warning', clientId);
    }
  }, [clients]);

  // 添加删除客户端处理函数
  const handleDeleteClient = useCallback((clientId: string) => {
    // 首先关闭连接
    handleCloseConnection(clientId);
    // 然后从客户端列表中移除
    setClients(prev => prev.filter(c => c.id !== clientId));
    addLog(`删除客户端 ${clientId}`, 'warning', clientId);
  }, [handleCloseConnection]);

  useEffect(() => {
    return () => {
      websockets.current.forEach(ws => ws.close());
      heartbeatIntervals.current.forEach(interval => clearInterval(interval));
    };
  }, []);

  return (
    <Container>
      <LeftPanel>
        <ServerConfigPanel />
        <Button onClick={createNewClient}>添加新客户端 (Add New Client)</Button>
        {clients.map(client => (
          <ClientSimulator
            key={client.id}
            client={client}
            onUpdate={updateClient}
            onSendMessage={(message) => sendMessage(client.id, message)}
            onClose={() => handleCloseConnection(client.id)}
            onDelete={() => handleDeleteClient(client.id)}
          />
        ))}
      </LeftPanel>
      <RightPanel>
        <LogViewer logs={logs} />
      </RightPanel>
    </Container>
  );
};