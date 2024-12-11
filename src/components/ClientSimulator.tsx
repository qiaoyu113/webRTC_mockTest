// src/components/ClientSimulator.tsx
import React, { useState } from 'react';
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

const HeaderContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
`;

const Title = styled.h3`
  margin: 0;
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 10px;
`;

const Button = styled.button<{ variant?: 'primary' | 'danger' }>`
  padding: 8px 16px;
  border-radius: 4px;
  border: none;
  background-color: ${props => props.variant === 'danger' ? '#dc3545' : '#007bff'};
  color: white;
  cursor: pointer;
  
  &:hover {
    background-color: ${props => props.variant === 'danger' ? '#c82333' : '#0056b3'};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

interface Props {
    client: ClientSimulation;
    onUpdate: (client: ClientSimulation) => void;
    onSendMessage: (message: string) => void;
    onClose?: () => void;     // 新增：关闭连接的回调
    onDelete?: () => void;    // 新增：删除客户端的回调
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

const MessageSendSection = styled.div`
  margin-top: 20px;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 4px;
`;

const MessageTypeSelect = styled.select`
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  margin-right: 10px;
`;

const MessageInput = styled.input`
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  flex: 1;
`;

const SendButton = styled(Button)`
  margin-left: 10px;
`;

export const ClientSimulator: React.FC<Props> = ({
    client,
    onUpdate,
    onSendMessage,
    onClose,
    onDelete
  }) => {
    const [messageType, setMessageType] = useState<'heartbeat' | 'custom' | 'system'>('heartbeat');
    const [messageContent, setMessageContent] = useState('ping');
    
    // 新增：确认删除对话框
    const handleDelete = () => {
      if (window.confirm('确定要删除该客户端吗？这将关闭当前连接。')) {
        onDelete?.();
      }
    };

    // 处理消息发送
    const handleSendMessage = () => {
        if (!messageContent.trim()) return;

        const message = {
        type: messageType,
        timestamp: Date.now(),
        clientId: client.id,
        data: messageType === 'heartbeat' ? {
            status: messageContent,
            sequence: Date.now()
        } : messageType === 'system' ? {
            action: messageContent,
            message: `System message: ${messageContent}`
        } : {
            content: messageContent,
            metadata: {
            source: 'user',
            timestamp: Date.now()
            }
        }
        };

        onSendMessage(JSON.stringify(message));
        // 不清空消息内容，方便重复发送
    };
  
    return (
      <SimulatorContainer>
        <HeaderContainer>
          <Title>客户端 (Client): {client.id}</Title>
          <ActionButtons>
            <Button
              onClick={() => onClose?.()}
              disabled={client.status === 'disconnected'}
            >
              关闭连接
            </Button>
            <Button
              variant="danger"
              onClick={handleDelete}
            >
              删除
            </Button>
          </ActionButtons>
        </HeaderContainer>
        
        {/* 状态和基本控制 */}
        <ControlGroup>
          <label>状态 (Status):</label>
          <span style={{
            color: client.status === 'connected' ? '#28a745' : 
                   client.status === 'error' ? '#dc3545' : '#6c757d'
          }}>
            {client.status === 'connected' ? '已连接' :
             client.status === 'disconnected' ? '已断开' : '错误'}
          </span>
          {/* <button 
            style={{
                // background: '#28a745',
                // color: '#fff',
                // border: '1px solid #dfdfdf',
                cursor: 'pointer'
            }}
            onClick={() => onSendMessage('ping')}
            disabled={client.status !== 'connected'}
          >
            发送心跳包 (Send Ping)
          </button> */}
        </ControlGroup>
        {/* 添加消息发送部分 */}
      <ControlGroupTitle>消息发送 (Message Sending)</ControlGroupTitle>
      <MessageSendSection>
        <ControlGroup>
          <label>消息类型:</label>
          <MessageTypeSelect
            value={messageType}
            onChange={(e) => {
              const newType = e.target.value as 'heartbeat' | 'custom' | 'system';
              setMessageType(newType);
              // 根据类型设置默认消息
              if (newType === 'heartbeat') setMessageContent('ping');
              else if (newType === 'system') setMessageContent('connect');
              else setMessageContent('');
            }}
          >
            <option value="heartbeat">心跳消息</option>
            <option value="custom">自定义消息</option>
            <option value="system">系统消息</option>
          </MessageTypeSelect>
        </ControlGroup>

        <ControlGroup>
          <label>消息内容:</label>
          <MessageInput
            type="text"
            value={messageContent}
            onChange={(e) => setMessageContent(e.target.value)}
            placeholder={
              messageType === 'heartbeat' ? 'Enter heartbeat message (e.g., ping)' :
              messageType === 'system' ? 'Enter system action' :
              'Enter custom message'
            }
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleSendMessage();
              }
            }}
          />
          <SendButton
            onClick={handleSendMessage}
            disabled={client.status !== 'connected'}
          >
            发送
          </SendButton>
        </ControlGroup>
      </MessageSendSection>
  
      
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

      {/* 更新状态指示器部分 */}
      <ControlGroupTitle>连接状态 (Connection Status)</ControlGroupTitle>
      <ControlGroup>
        <label>重连状态:</label>
        <span style={{
          color: client.status === 'error' ? '#dc3545' : '#28a745'
        }}>
          {client.currentReconnectAttempts}/{client.maxReconnectAttempts}
          {client.status === 'error' && ' (正在重连...)'}
        </span>
      </ControlGroup>

      <ControlGroup>
        <label>最后心跳时间:</label>
        <span>
          {client.lastHeartbeat ? 
            new Date(client.lastHeartbeat).toLocaleTimeString() : 
            '无'}
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