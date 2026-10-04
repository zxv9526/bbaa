#!/bin/bash

# =========================================================
# Serv00 一键启动 / 重启对讲服务脚本
# 用法: ./start.sh [端口号]
# 示例: ./start.sh 28542
# =========================================================

cd "$(dirname "$0")"

PORT=${1:-$PORT}
if [ -z "$PORT" ]; then
  PORT=3000
fi

echo "=========================================================="
echo "🎯 正在启动 十三水 · Serv00 战术语音与聊天节点..."
echo "📡 端口号: $PORT"
echo "=========================================================="

# 检查 node_modules 是否存在
if [ ! -d "node_modules" ]; then
  echo "📦 正在安装依赖包 (express, ws, cors)..."
  npm install --production
fi

# 检查 PM2 是否可用
if command -v pm2 &> /dev/null; then
  echo "🚀 使用 PM2 后台守护运行..."
  PORT=$PORT pm2 restart "triple-voice-chat" 2>/dev/null || PORT=$PORT pm2 start ecosystem.config.cjs --name "triple-voice-chat"
  pm2 save
  echo "✅ PM2 守护启动/更新成功！使用 'pm2 logs triple-voice-chat' 查看实时日志。"
else
  echo "🚀 PM2 未全局安装，使用 nohup 后台持久化运行..."
  pkill -f "node.*server.js" 2>/dev/null
  nohup node server.js --port $PORT > server.log 2>&1 &
  echo "✅ 服务已在后台启动！PID: $!"
  echo "📝 实时日志保存在: $(pwd)/server.log (可使用 tail -f server.log 查看)"
fi

echo ""
echo "🎉 部署完成！"
echo "👉 当前运行端点:"
echo "   http://0.0.0.0:$PORT"
echo "   已与 Cloudflare Pages 前端实现全自动无缝连接！"
echo "=========================================================="
