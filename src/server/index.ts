// src/server/index.ts
import { HeartbeatServer } from './heartbeatTestServer';

async function startServer() {
  try {
    const server = new HeartbeatServer({
      port: 50100,
      simulateLatency: false
    });

    console.log('Server started successfully');
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();