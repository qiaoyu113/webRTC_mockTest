// src/App.tsx
import React from 'react';
import { HeartbeatMonitor } from './components/HeartbeatMonitor';
import { createGlobalStyle } from 'styled-components';

const GlobalStyle = createGlobalStyle`
  body {
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen,
      Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  }
`;

const App: React.FC = () => (
  <>
    <GlobalStyle />
    <HeartbeatMonitor />
  </>
);

export default App;