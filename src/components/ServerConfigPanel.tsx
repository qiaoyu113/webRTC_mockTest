// src/components/ServerConfigPanel.tsx
import React, { useState, useEffect } from 'react';
import styled from 'styled-components';

// 保持原有的样式组件
const ConfigContainer = styled.div`
  background: white;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
`;

const ConfigGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
  margin-top: 20px;
`;

const ConfigItem = styled.div`
  display: flex;
  flex-direction: column;
`;

const Label = styled.label`
  margin-bottom: 8px;
  color: #666;
`;

const Input = styled.input`
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  width: 100%;
  box-sizing: border-box;
`;

const Button = styled.button<{ variant?: 'primary' | 'warning' }>`
  padding: 8px 16px;
  border-radius: 4px;
  border: none;
  background-color: ${props => props.variant === 'warning' ? '#f0ad4e' : '#007bff'};
  color: white;
  cursor: pointer;
  margin-right: 10px;
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const StatusIndicator = styled.div<{ isActive: boolean }>`
  padding: 8px;
  border-radius: 4px;
  background-color: ${props => props.isActive ? '#dff0d8' : '#f2dede'};
  color: ${props => props.isActive ? '#3c763d' : '#a94442'};
  margin-bottom: 20px;
`;

// 新增的样式组件
const ResponseConfigSection = styled.div`
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #eee;
`;

const ResponsePatternGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
  margin-top: 10px;
`;

const ResponsePattern = styled.div`
  display: grid;
  grid-template-columns: 2fr 3fr auto;
  gap: 10px;
  align-items: center;
  padding: 10px;
  background: #f8f9fa;
  border-radius: 4px;
`;

const Select = styled.select`
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  width: 100%;
`;

// 扩展接口定义
interface ResponsePattern {
  id: string;
  messageType: 'heartbeat' | 'custom' | 'system';
  pattern: string;
  response: string;
}

interface ServerConfig {
  heartbeatTimeout: number;
  disconnectTimeout: number;
  simulateLatency: boolean;
  latencyMs: number;
  responsePatterns: ResponsePattern[];
}

interface ServerStatus {
  clientCount: number;
  uptime: number;
  clients: Array<{
    id: string;
    connectionTime: number;
    lastHeartbeat: number;
    heartbeatCount: number;
    missedHeartbeats: number;
  }>;
}

const ServerConfigPanel: React.FC = () => {
  const [config, setConfig] = useState<ServerConfig>({
    heartbeatTimeout: 30000,
    disconnectTimeout: 60000,
    simulateLatency: false,
    latencyMs: 1000,
    responsePatterns: [
        {
          id: '1',
          messageType: 'heartbeat',
          pattern: 'ping',
          response: 'pong'
        }
    ]
  });

  const [serverStatus, setServerStatus] = useState<ServerStatus | null>(null);
  const [isConfiguring, setIsConfiguring] = useState(false);

  // 获取服务器状态
  const fetchServerStatus = async () => {
    try {
      const response = await fetch('http://localhost:8082/status');
      const data = await response.json();
      setServerStatus(data);
    } catch (error) {
      console.error('Failed to fetch server status:', error);
    }
  };

  // 更新服务器配置
  const updateServerConfig = async () => {
    setIsConfiguring(true);
    try {
      const response = await fetch('http://localhost:8082/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update config');
      }

      const updatedConfig = await response.json();
      setConfig(updatedConfig);
      alert('配置更新成功！');
    } catch (error) {
      console.error('Failed to update server config:', error);
      alert('配置更新失败！');
    } finally {
      setIsConfiguring(false);
    }
  };

  // 响应模式相关函数
  const addResponsePattern = () => {
    const newPattern: ResponsePattern = {
      id: Date.now().toString(),
      messageType: 'custom',
      pattern: '',
      response: ''
    };

    setConfig(prev => ({
      ...prev,
      responsePatterns: [...prev.responsePatterns, newPattern]
    }));
  };

  const removeResponsePattern = (id: string) => {
    setConfig(prev => ({
      ...prev,
      responsePatterns: prev.responsePatterns.filter(pattern => pattern.id !== id)
    }));
  };

  const updateResponsePattern = (id: string, field: keyof ResponsePattern, value: string) => {
    setConfig(prev => ({
      ...prev,
      responsePatterns: prev.responsePatterns.map(pattern =>
        pattern.id === id ? { ...pattern, [field]: value } : pattern
      )
    }));
  };

  // 定期刷新服务器状态
  useEffect(() => {
    fetchServerStatus();
    const interval = setInterval(fetchServerStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <ConfigContainer>
      <h2>服务器配置</h2>
      
      {serverStatus && (
        <StatusIndicator isActive={true}>
          <div>当前连接数: {serverStatus.clientCount}</div>
          <div>运行时间: {Math.floor(serverStatus.uptime / 60)}分钟</div>
        </StatusIndicator>
      )}

      {/* 保持原有的基础配置部分 */}
      <ConfigGrid>
        <ConfigItem>
          <Label>心跳超时时间 (ms)</Label>
          <Input
            type="number"
            value={config.heartbeatTimeout}
            onChange={(e) => setConfig(prev => ({
              ...prev,
              heartbeatTimeout: parseInt(e.target.value)
            }))}
            min="1000"
            step="1000"
          />
        </ConfigItem>

        <ConfigItem>
          <Label>断开超时时间 (ms)</Label>
          <Input
            type="number"
            value={config.disconnectTimeout}
            onChange={(e) => setConfig(prev => ({
              ...prev,
              disconnectTimeout: parseInt(e.target.value)
            }))}
            min="1000"
            step="1000"
          />
        </ConfigItem>

        <ConfigItem>
          <Label>模拟网络延迟</Label>
          <input
            type="checkbox"
            checked={config.simulateLatency}
            onChange={(e) => setConfig(prev => ({
              ...prev,
              simulateLatency: e.target.checked
            }))}
          />
        </ConfigItem>

        <ConfigItem>
          <Label>延迟时间 (ms)</Label>
          <Input
            type="number"
            value={config.latencyMs}
            onChange={(e) => setConfig(prev => ({
              ...prev,
              latencyMs: parseInt(e.target.value)
            }))}
            min="0"
            step="100"
            disabled={!config.simulateLatency}
          />
        </ConfigItem>
      </ConfigGrid>

      {/* 添加自定义响应配置部分 */}
      <ResponseConfigSection>
        <h3>自定义响应配置</h3>
        <Button onClick={addResponsePattern}>添加响应规则</Button>
        
        <ResponsePatternGrid>
          {config.responsePatterns.map(pattern => (
            <ResponsePattern key={pattern.id}>
              <Select
                value={pattern.messageType}
                onChange={(e) => updateResponsePattern(pattern.id, 'messageType', e.target.value as any)}
              >
                <option value="heartbeat">心跳消息</option>
                <option value="custom">自定义消息</option>
                <option value="system">系统消息</option>
              </Select>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <Input
                  placeholder="触发条件"
                  value={pattern.pattern}
                  onChange={(e) => updateResponsePattern(pattern.id, 'pattern', e.target.value)}
                />
                <Input
                  placeholder="响应内容"
                  value={pattern.response}
                  onChange={(e) => updateResponsePattern(pattern.id, 'response', e.target.value)}
                />
              </div>
              
              <Button
                variant="warning"
                onClick={() => removeResponsePattern(pattern.id)}
              >
                删除
              </Button>
            </ResponsePattern>
          ))}
        </ResponsePatternGrid>
      </ResponseConfigSection>

      <div style={{ marginTop: '20px' }}>
        <Button 
          onClick={updateServerConfig}
          disabled={isConfiguring}
        >
          {isConfiguring ? '更新中...' : '更新配置'}
        </Button>
        <Button 
          variant="warning"
          onClick={() => setConfig({
            heartbeatTimeout: 30000,
            disconnectTimeout: 60000,
            simulateLatency: false,
            latencyMs: 1000,
            responsePatterns: [
              {
                id: '1',
                messageType: 'heartbeat',
                pattern: 'ping',
                response: 'pong'
              }
            ]
          })}
        >
          重置默认值
        </Button>
      </div>

      {serverStatus && serverStatus.clients.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <h3>已连接客户端</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th>ID</th>
                <th>连接时长</th>
                <th>心跳次数</th>
                <th>丢失心跳</th>
              </tr>
            </thead>
            <tbody>
              {serverStatus.clients.map(client => (
                <tr key={client.id}>
                  <td>{client.id}</td>
                  <td>{Math.floor((Date.now() - client.connectionTime) / 1000)}秒</td>
                  <td>{client.heartbeatCount}</td>
                  <td>{client.missedHeartbeats}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ConfigContainer>
  );
};

export default ServerConfigPanel;