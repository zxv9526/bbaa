# 十三水 · Serv00 独立实时战术对讲与聊天服务端部署指南

本项目采用 **双核混合云架构 (Cloudflare Pages + Serv00 Node.js)**：
- **Cloudflare Pages / Functions**: 负责托管前端极速静态资源、单人/对战游戏核心逻辑、玩家账号与安全登录。
- **Serv00 (FreeBSD/Linux VPS)**: 负责 24 小时低延迟 WebSocket 全双工对讲、多设备聊天室消息广播、WebRTC 实时点对点信令穿透与牌桌状态同步。

---

## ⚡️ 5分钟 Serv00 极速一键部署流程

### 第一步：开启 Serv00 后台进程权限与开放端口 (Devil 终端)
登录你的 Serv00 SSH 终端，运行以下命令开启后台权限并申请一个开放端口：

```bash
# 1. 开启运行后台程序权限 (重要！避免进程被系统杀掉)
devil binexec on

# 2. 申请一个 TCP 开放端口 (系统会随机分配一个端口，例如 28542，请记住该端口号)
devil port add tcp random
```

> 提示：如果使用 Serv00 Web 网页控制面板：
> 1. 点击左侧 **Port reservation** -> **Add port** -> 选择 **TCP** -> 确定。
> 2. 点击左侧 **Additional services** -> **Run your own applications** -> 设置为 **Enabled**。

---

### 第二步：拉取仓库代码并安装依赖
在 Serv00 SSH 终端中执行：

```bash
# 1. 拉取你的 GitHub 仓库代码 (替换为你的仓库地址)
git clone https://github.com/你的用户名/你的仓库名.git triple-game

# 2. 进入专门的 serv00-server 目录
cd triple-game/serv00-server

# 3. 安装轻量依赖 (仅需 express, ws, cors)
npm install --production
```

---

### 第三步：一键启动服务

#### 方案 A：使用提供的启动脚本（推荐）
```bash
# 给脚本添加执行权限
chmod +x start.sh

# 启动服务并指定你在第一步申请的端口号 (例如 28542)
./start.sh 28542
```

#### 方案 B：使用 PM2 守护进程长期运行
```bash
# 设置端口并启动 PM2
PORT=28542 npm run pm2

# 查看运行状态与日志
npm run pm2:logs
```

---

### 第四步：在 Cloudflare Pages 后台配置环境变量 (全站自动生效，玩家零配置)

管理员只需在 Cloudflare Pages 项目控制台中配置一次，所有玩家进入游戏即可**全自动连接对讲服务**，前端页面完全对玩家透明，无需任何手动输入：

1. 登录 [Cloudflare 控制台](https://dash.cloudflare.com/)，进入你的 Pages 项目。
2. 依次点击：**Settings (设置)** -> **Environment variables (环境变量)**。
3. 点击 **Add variable (添加变量)**：
   - **Variable name (变量名)**: `SERV00_SERVER_URL` (或 `VITE_SERV00_SERVER_URL`)
   - **Value (变量值)**: `http://你的用户名.serv00.net:你的端口`（或者带有反向代理 SSL 的 `https://你的域名`）
4. 保存并重新部署（或下次访问即刻生效）。
5. 玩家打开游戏后，系统自动通过 `/api/config` 获取该节点并建立毫秒级全双工对讲，**前端绝无任何繁琐的技术配置界面**！

---

## 🛠 常用维护命令

| 操作 | 命令 |
| :--- | :--- |
| **查看实时日志** | `tail -f ~/triple-game/serv00-server/server.log` 或 `pm2 logs` |
| **重启对讲服务** | `cd ~/triple-game/serv00-server && ./start.sh 你的端口` |
| **健康检查测试** | `curl http://127.0.0.1:你的端口/health` |
| **拉取 GitHub 最新代码并重启** | `git pull && ./start.sh 你的端口` |
