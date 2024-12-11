# WebSocket Heartbeat Testing Tool

一个用于测试 WebSocket 心跳机制的工具，支持可配置的心跳间隔、超时检测和自动重连机制。

## 功能特性

- 💗 可配置的心跳检测机制
- 🔄 自动重连支持
- 📊 实时状态监控
- 📝 详细的日志记录
- ⚙️ 可调节的网络模拟
- 🎮 交互式控制面板

## 项目结构

```
mockServer/
├── src/
│   ├── components/            # React 组件
│   │   ├── ConnectionTester.tsx   # 测试控制面板
│   │   └── ...
│   ├── connection/           # 连接相关实现
│   │   ├── connection.ts     # 基础连接类
│   │   ├── heartbeat.ts      # 心跳检测实现
│   │   ├── webSocketConnection.ts  # WebSocket 连接实现
│   │   └── webRTCConnection.ts     # WebRTC 连接实现
│   ├── server/              # 服务端实现
│   │   ├── heartbeatServer.ts   # 心跳测试服务器
│   │   └── ...
│   └── utils/               # 工具函数
├── package.json
└── README.md
```

## 安装

```bash
# 克隆项目
git clone 

# 安装依赖
npm install
```

## 使用方法

1. **启动服务器**
```bash
npm run start:server
```

2. **启动前端开发服务器**
```bash
npm run dev
```

3. **访问测试界面**
```
打开浏览器访问 http://localhost:3000
```

## 配置说明

### 心跳配置

```typescript
interface HeartbeatConfig {
  heartbeatInterval: number;    // 心跳间隔时间 (ms)
  heartbeatTimeout: number;     // 心跳超时时间 (ms)
  maxReconnectAttempts: number; // 最大重连次数
  reconnectInterval: number;    // 重连间隔时间 (ms)
}
```

### 连接配置

```typescript
interface ConnectionConfig {
  url: string;               // WebSocket 服务器地址
  packetParser?: PacketParser; // 数据包解析器
  heartbeatInterval?: number;  // 心跳间隔
}
```

## 主要功能模块

### HeartbeatController

心跳检测控制器，负责管理心跳机制：
- 定时发送心跳包
- 监控心跳响应
- 处理超时情况
- 触发重连机制

### Connection

基础连接类，提供：
- 消息订阅机制
- 数据包处理
- 连接状态管理
- 重连逻辑

### ConnectionTester

测试控制面板，支持：
- 参数配置
- 连接控制
- 状态监控
- 日志显示

## 使用示例

```typescript
// 创建连接
const connection = new WebSocketConnection({
  url: 'ws://localhost:8081',
  heartbeatInterval: 5000
});

// 添加心跳响应监听
connection.subscribe('pong', () => {
  console.log('收到心跳响应');
});

// 建立连接
await connection.connect();
```

## 开发说明

### 添加新功能

1. 在 `src/components` 中添加新的 UI 组件
2. 在 `src/connection` 中扩展连接功能
3. 在 `src/server` 中添加服务端功能

### 运行方式

```bash
start:server 运行服务端

start:client 运行客户端
```

## API 文档

### HeartbeatController

```typescript
class HeartbeatController {
  constructor(config: HeartbeatConfig, callbacks: HeartbeatCallbacks);
  start(): void;
  stop(): void;
  updateResponse(): void;
  getStatus(): ConnectionStatus;
}
```

### Connection

```typescript
abstract class Connection {
  connect(): Promise<void>;
  disconnect(): void;
  subscribe(type: string, callback: Function): void;
  unsubscribe(type: string, callback: Function): void;
}
```

## 调试指南

1. 使用浏览器开发者工具监控 WebSocket 连接
2. 查看控制台日志了解心跳状态
3. 使用测试面板模拟各种情况
4. 观察连接状态和日志记录

## 贡献指南

1. Fork 项目
2. 创建特性分支
3. 提交改动
4. 发起 Pull Request

## 许可证

MIT

## 作者

Joey Qiao

## 更新日志

### v1.0.0 (2024-12-11)
- 初始版本发布
- 实现基础心跳检测功能
- 添加测试控制面板

## 常见问题

Q: 如何修改心跳间隔？  
A: 在测试面板的配置参数中调整心跳间隔值。

Q: 连接断开后如何重连？  
A: 系统会根据配置的重连参数自动尝试重连。

## 相关项目

- WebSocket Client
- WebRTC Connection Tester

## 致谢

感谢所有贡献者的付出。

## 支持

如有问题，请提交 Issue 或联系作者。
