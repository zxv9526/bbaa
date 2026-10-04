#!/bin/bash
# =========================================================
# Serv00 自动保活与自愈脚本 (用于 Cron 周期巡检与系统重启自启)
# 用法: ./keepalive.sh [端口号]
# =========================================================

cd "$(dirname "$0")"

PORT=${1:-$PORT}
if [ -z "$PORT" ]; then
  PORT=20888
fi

# 检查当前端口健康接口是否正常响应
STATUS=$(curl -s -m 5 "http://127.0.0.1:$PORT/health" 2>/dev/null | grep '"status":"ok"' || true)

if [ -z "$STATUS" ]; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️ 监测到对讲服务未运行，正在自动重新拉起 (PORT: $PORT)..." >> keepalive.log
  chmod +x start.sh
  ./start.sh "$PORT" >> keepalive.log 2>&1
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ 对讲服务自愈拉起完成！" >> keepalive.log
fi
