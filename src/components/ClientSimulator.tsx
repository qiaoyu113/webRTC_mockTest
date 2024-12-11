// src/components/ClientSimulator.tsx
import React from 'react';
import styled from 'styled-components';
import { ClientSimulation } from '../types';

const SimulatorContainer = styled.div`
  background: white;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
`;

const ControlGroup = styled.div`
  margin: 10px 0;
  display: flex;
  align-items: center;
  gap: 10px;
`;

interface Props {
  client: ClientSimulation;
  onUpdate: (client: ClientSimulation) => void;
  onSendMessage: (message: string) => void;
}
const AdvancedSettings = styled.div`
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #eee;
`;

const ControlGroupTitle = styled.h4`
  margin: 10px 0;
  color: #666;
`;

export const ClientSimulator: React.FC<Props> = ({
  client,
  onUpdate,
  onSendMessage
}) => {
  return (
    <SimulatorContainer>
      <h3>客户端 (Client): {client.id}</h3>
      
      {/* 状态和基本控制 */}
      <ControlGroup>
        <label>状态 (Status):</label>
        <span>{client.status}</span>
        <button onClick={() => onSendMessage('ping')}>
          发送心跳包 (Send Ping)
        </button>
      </ControlGroup>
      
      {/* 网络模拟设置 */}
      <ControlGroupTitle>网络模拟 (Network Simulation)</ControlGroupTitle>
      <ControlGroup>
        <label>丢包率 (Package Loss):</label>
        <input
          type="range"
          min="0"
          max="100"
          value={client.packageLoss}
          onChange={(e) => onUpdate({
            ...client,
            packageLoss: parseInt(e.target.value)
          })}
        />
        <span>{client.packageLoss}%</span>
      </ControlGroup>

      <ControlGroup>
        <label>延迟 (Latency):</label>
        <input
          type="range"
          min="0"
          max="5000"
          step="100"
          value={client.latency}
          onChange={(e) => onUpdate({
            ...client,
            latency: parseInt(e.target.value)
          })}
        />
        <span>{client.latency}ms</span>
      </ControlGroup>

      {/* 心跳配置 */}
      <ControlGroupTitle>心跳设置 (Heartbeat Settings)</ControlGroupTitle>
      <ControlGroup>
        <label>心跳间隔 (Heartbeat Interval):</label>
        <input
          type="number"
          min="1000"
          max="60000"
          step="1000"
          value={client.heartbeatInterval}
          onChange={(e) => onUpdate({
            ...client,
            heartbeatInterval: parseInt(e.target.value)
          })}
        />
        <span>ms</span>
      </ControlGroup>

      <ControlGroup>
        <label>自动回复 (Auto Reply):</label>
        <input
          type="checkbox"
          checked={client.autoReply}
          onChange={(e) => onUpdate({
            ...client,
            autoReply: e.target.checked
          })}
        />
      </ControlGroup>

      {/* 重连配置 */}
      <ControlGroupTitle>重连设置 (Reconnection Settings)</ControlGroupTitle>
      <ControlGroup>
        <label>最大重连次数 (Max Reconnect Attempts):</label>
        <input
          type="number"
          min="1"
          max="10"
          value={client.maxReconnectAttempts}
          onChange={(e) => onUpdate({
            ...client,
            maxReconnectAttempts: parseInt(e.target.value)
          })}
        />
      </ControlGroup>

      <ControlGroup>
        <label>当前重连次数 (Current Attempts):</label>
        <span>{client.currentReconnectAttempts}</span>
        <button 
          onClick={() => onUpdate({
            ...client,
            currentReconnectAttempts: 0
          })}
        >
          重置 (Reset)
        </button>
      </ControlGroup>

      <ControlGroup>
        <label>重连间隔 (Reconnect Interval):</label>
        <input
          type="number"
          min="1000"
          max="30000"
          step="1000"
          value={client.reconnectInterval}
          onChange={(e) => onUpdate({
            ...client,
            reconnectInterval: parseInt(e.target.value)
          })}
        />
        <span>ms</span>
      </ControlGroup>

      {/* 状态指示器 */}
      <ControlGroupTitle>连接状态 (Connection Status)</ControlGroupTitle>
      <ControlGroup>
        <label>重连状态:</label>
        <span>
          {client.currentReconnectAttempts}/{client.maxReconnectAttempts}
          {client.status === 'error' && ' (正在重连...)'}
        </span>
      </ControlGroup>

      {/* 帮助信息 */}
      <div style={{ fontSize: '12px', color: '#666', marginTop: '20px' }}>
        <p>* 心跳间隔：发送心跳包的时间间隔 (Heartbeat interval: time between heartbeat messages)</p>
        <p>* 最大重连次数：连接断开后尝试重连的最大次数 (Max reconnect attempts: maximum number of reconnection attempts)</p>
        <p>* 重连间隔：每次重连之间的等待时间 (Reconnect interval: waiting time between reconnection attempts)</p>
      </div>
    </SimulatorContainer>
  );
};