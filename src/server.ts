// src/server.ts
import express from 'express';
import cors from 'cors';
import { HeartbeatServer } from './server/heartbeatServer';
import { isPortAvailable, getAvailablePort } from './utils/portCheck';

async function startServer() {
  const desiredPort = 50100;
  const httpPort = 8082;
  let wsPort = desiredPort;

  try {
    if (!(await isPortAvailable(desiredPort))) {
      console.log(`Port ${desiredPort} is in use`);
      wsPort = await getAvailablePort(desiredPort);
      console.log(`Using alternative port: ${wsPort}`);
    }

    // 创建 WebSocket 服务器
    const server = new HeartbeatServer({
      port: wsPort,
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

    // 创建 HTTP 服务器处理配置请求
    const app = express();
    app.use(cors());
    app.use(express.json());

    // 获取服务器状态
    app.get('/status', (req, res) => {
      res.json(server.getStatus());
    });

    // 更新服务器配置
    app.post('/config', (req, res) => {
      try {
        const newConfig = req.body;
        const updatedConfig = server.updateConfig(newConfig);
        res.json(updatedConfig);
      } catch (error) {
        res.status(500).json({ error: 'Failed to update config' });
      }
    });

    // 启动 HTTP 服务器
    app.listen(httpPort, () => {
      console.log(`HTTP server listening on port ${httpPort}`);
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// 启动服务器
console.log('Starting Heartbeat Server...');
startServer().catch(error => {
  console.error('Fatal error starting server:', error);
  process.exit(1);
});