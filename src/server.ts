// src/server.ts
import { HeartbeatServer } from './server/heartbeatTestServer';
import { isPortAvailable, getAvailablePort } from './utils/portCheck';

async function startServer() {
  const desiredPort = 8081;
  let port = desiredPort;

  try {
    if (!(await isPortAvailable(desiredPort))) {
      console.log(`Port ${desiredPort} is in use`);
      port = await getAvailablePort(desiredPort);
      console.log(`Using alternative port: ${port}`);
    }

    const server = new HeartbeatServer({
      port,
      simulateLatency: false,
      latencyMs: 1000,
      heartbeatTimeout: 30000,    // 30 秒无心跳视为超时
      disconnectTimeout: 60000    // 60 秒无心跳断开连接
    });

    // 定期打印服务器状态
    setInterval(() => {
      const status = server.getStatus();
      console.log('\nServer Status:', JSON.stringify(status, null, 2));
    }, 30000);

    // 保存服务器实例
    (global as any).serverInstance = server;

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