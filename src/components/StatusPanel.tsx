// src/components/StatusPanel.tsx
import React from 'react';
import styled from 'styled-components';
import { ConnectionStatus } from '../types';

const Panel = styled.div`
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
`;

const StatusIndicator = styled.div<{ status: ConnectionStatus['status'] }>`
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background-color: ${({ status }) => {
    switch (status) {
      case 'connected': return '#4caf50';
      case 'disconnected': return '#ff9800';
      case 'error': return '#f44336';
      default: return '#grey';
    }
  }};
`;

const StatusInfo = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-top: 16px;
`;

interface Props {
  status: ConnectionStatus;
}

const StatusPanel: React.FC<Props> = ({ status }) => (
  <Panel>
    <h2>Connection Status</h2>
    <StatusInfo>
      <div>
        <StatusIndicator status={status.status} />
        <span>Status: {status.status}</span>
      </div>
      <div>Last Heartbeat: {new Date(status.lastHeartbeat).toLocaleTimeString()}</div>
      <div>Reconnect Attempts: {status.reconnectAttempts}</div>
      <div>Latency: {status.latency}ms</div>
    </StatusInfo>
  </Panel>
);

export default StatusPanel;