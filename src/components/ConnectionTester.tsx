// src/components/ConnectionTester.tsx
import React, { useState, useCallback } from 'react';
import styled from 'styled-components';
import { WebSocketConnection } from '../connection/webSocketConnection';
import { ConnectionStatus } from '../connection/heartbeat';
import { PacketParser } from '../packetParser/base';

const Container = styled.div`
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
`;

const ControlPanel = styled.div`
  background: white;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
`;

const ConfigSection = styled.div`
  margin-bottom: 20px;
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 10px;
  margin-top: 20px;
`;

const Button = styled.button<{ variant?: 'primary' | 'danger' }>`
  padding: 8px 16px;
  border-radius: 4px;
  border: none;
  background-color: ${props => props.variant === 'danger' ? '#dc3545' : '#007bff'};
  color: white;
  cursor: pointer;
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const LogViewer = styled.div`
  background: white;
  border-radius: 8px;
  padding: 20px;
  height: 400px;
  overflow-y: auto;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
`;

const LogEntry = styled.div<{ type: 'info' | 'error' | 'success' | 'warning' }>`
  padding: 8px;
  margin: 4px 0;
  border-left: 4px solid;
  border-left-color: ${props => {
    switch (props.type) {
      case 'error': return '#dc3545';
      case 'success': return '#28a745';
      case 'warning': return '#ffc107';
      default: return '#007bff';
    }
  }};
  background: #f8f9fa;
`;

const Input = styled.input`
  padding: 8px;
  margin-right: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  width: 100px;
`;

const Label = styled.label`
  display: inline-block;
  width: 150px;
  margin-right: 10px;
`;

interface Log {
  id: number;
  message: string;
  timestamp: Date;
  type: 'info' | 'error' | 'success' | 'warning';
}

const ConnectionTester: React.FC = () => {
  const [connection, setConnection] = useState<WebSocketConnection | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [logs, setLogs] = useState<Log[]>([]);
  
  // 配置状态
  const [config, setConfig] = useState({
    heartbeatInterval: 5000,
    heartbeatTimeout: 15000,
    maxReconnectAttempts: 3,
    reconnectInterval: 3000
  });

  const addLog = useCallback((message: string, type: Log['type'] = 'info') => {
    setLogs(prev => [...prev, {
      id: Date.now(),
      message,
      timestamp: new Date(),
      type
    }]);
  }, []);

  const handleConfigChange = (key: keyof typeof config) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setConfig(prev => ({
      ...prev,
      [key]: parseInt(e.target.value)
    }));
  };

  const connect = useCallback(() => {
    if (connection) return;

    const wsConnection = new WebSocketConnection({
      url: 'ws://localhost:50100',
      packetParser: PacketParser,
      heartbeatInterval: config.heartbeatInterval
    });

    wsConnection.subscribe('pong', () => {
      addLog('收到心跳响应', 'success');
    });

    // 添加状态变化监听
    wsConnection.subscribe('status', (data) => {
      const status = new TextDecoder().decode(data) as ConnectionStatus;
      setStatus(status);
      addLog(`连接状态变更: ${status}`, status === 'connected' ? 'success' : 'warning');
    });

    wsConnection.connect()
      .then(() => {
        setConnection(wsConnection);
        addLog('连接成功建立', 'success');
      })
      .catch(error => {
        addLog(`连接失败: ${error}`, 'error');
      });
  }, [config, addLog]);

  const disconnect = useCallback(() => {
    if (!connection) return;
    
    connection.disconnect();
    setConnection(null);
    addLog('连接已断开', 'warning');
  }, [connection, addLog]);

  const simulateError = useCallback(() => {
    addLog('模拟错误情况...', 'warning');
    // 可以在这里添加错误模拟逻辑
  }, [addLog]);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  return (
    <Container>
      <ControlPanel>
        <h2>心跳测试控制面板</h2>
        
        <ConfigSection>
          <h3>配置参数</h3>
          <div>
            <Label>心跳间隔 (ms):</Label>
            <Input
              type="number"
              value={config.heartbeatInterval}
              onChange={handleConfigChange('heartbeatInterval')}
              min="1000"
              step="1000"
            />
          </div>
          <div>
            <Label>心跳超时 (ms):</Label>
            <Input
              type="number"
              value={config.heartbeatTimeout}
              onChange={handleConfigChange('heartbeatTimeout')}
              min="1000"
              step="1000"
            />
          </div>
          <div>
            <Label>最大重连次数:</Label>
            <Input
              type="number"
              value={config.maxReconnectAttempts}
              onChange={handleConfigChange('maxReconnectAttempts')}
              min="1"
            />
          </div>
          <div>
            <Label>重连间隔 (ms):</Label>
            <Input
              type="number"
              value={config.reconnectInterval}
              onChange={handleConfigChange('reconnectInterval')}
              min="1000"
              step="1000"
            />
          </div>
        </ConfigSection>

        <ButtonGroup>
          <Button
            onClick={connect}
            disabled={!!connection}
          >
            连接
          </Button>
          <Button
            variant="danger"
            onClick={disconnect}
            disabled={!connection}
          >
            断开
          </Button>
          <Button onClick={simulateError}>
            模拟错误
          </Button>
          <Button onClick={clearLogs}>
            清除日志
          </Button>
        </ButtonGroup>
      </ControlPanel>

      <div>
        <h3>当前状态: {status}</h3>
      </div>

      <LogViewer>
        <h3>操作日志</h3>
        {logs.map(log => (
          <LogEntry key={log.id} type={log.type}>
            <span>[{log.timestamp.toLocaleTimeString()}] </span>
            {log.message}
          </LogEntry>
        ))}
      </LogViewer>
    </Container>
  );
};

export default ConnectionTester;