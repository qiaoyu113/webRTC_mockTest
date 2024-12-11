// src/components/LogViewer.tsx
import React from 'react';
import styled from 'styled-components';
import { LogMessage } from '../types';

const LogContainer = styled.div`
  background: white;
  border-radius: 8px;
  padding: 20px;
  height: calc(100vh - 40px);
  overflow-y: auto;
`;

const LogEntry = styled.div<{ type: LogMessage['type'] }>`
  padding: 8px;
  margin: 4px 0;
  border-left: 4px solid ${({ type }) => {
    switch (type) {
      case 'error': return '#f44336';
      case 'warning': return '#ff9800';
      case 'success': return '#4caf50';
      default: return '#2196f3';
    }
  }};
  background: #f5f5f5;
  font-family: monospace;
`;

interface Props {
  logs: LogMessage[];
}

export const LogViewer: React.FC<Props> = ({ logs }) => (
  <LogContainer>
    <h2>Connection Logs</h2>
    {logs.map(log => (
      <LogEntry key={log.id} type={log.type}>
        <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
        {log.clientId && <span> [{log.clientId}]</span>}
        <span> - </span>
        <span>{log.message}</span>
      </LogEntry>
    ))}
  </LogContainer>
);