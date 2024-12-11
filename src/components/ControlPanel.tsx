// src/components/ControlPanel.tsx
import React from 'react';
import styled from 'styled-components';

const Panel = styled.div`
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
`;

const Button = styled.button`
  padding: 10px 20px;
  margin: 5px;
  border: none;
  border-radius: 4px;
  background: #2196f3;
  color: white;
  cursor: pointer;

  &:hover {
    background: #1976d2;
  }
`;

interface Props {
  onReconnect: () => void;
  onSimulateError: () => void;
}

const ControlPanel: React.FC<Props> = ({ onReconnect, onSimulateError }) => (
  <Panel>
    <h2>Controls</h2>
    <Button onClick={onReconnect}>Reconnect</Button>
    <Button onClick={onSimulateError}>Simulate Error</Button>
  </Panel>
);

export default ControlPanel;