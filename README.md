# 十三水 (Chinese Poker) - Cloudflare Pages + Functions + D1

基于 **React 19 + Vite + Tailwind CSS + Cloudflare Pages + Cloudflare D1 数据库** 构建的十三水棋牌游戏。

---

## 🌟 核心特性

- **经典十三水完整规则**：
  - 前墩（3张）、中墩（5张）、后墩（5张）比牌。
  - 严谨的 **后墩 ≥ 中墩 ≥ 前墩** 倒水校验机制。
  - 支持 **打枪（Gun，翻倍）** 与 **全垒打（Home Run，全胜再翻倍）** 算法。
  - 支持全部十三水**特殊牌型**（至尊青龙、一条龙、十二皇族、三同花顺、三分天下、全大、全小、凑一色、四套三条、五对三条、六对半、三同花、三顺子）。
- **智能理牌与一键推荐**：
  - 毫秒级启发式算法，自动评估并推荐 Top 3 最佳出牌方案（稳健型 / 均衡型 / 进攻型），玩家可一键自动摆满 13 张牌！
- **零配置 Cloudflare D1 自动建表**：
  - 打开游戏页面或调用 API 时，后端 Functions 会全自动执行 `CREATE TABLE IF NOT EXISTS` 语句。
  - 自动创建 `players`（玩家排行榜）、`game_records`（对局历史明细）、`rooms`（多人在线开房同步）、`system_meta` 数据表。
- **纯 Web Audio 逼真音效**：
  - 无需加载外部音频资源，内置发牌声、放牌声、一键理牌完成音、打枪音效与胜利欢呼庆祝。
- **本地与云端双引擎**：
  - 未绑定 D1 时自动降级为极速本地 LocalStorage 存储，绑定 D1 后自动无缝升级为全球分布式云数据库。

---

## 🚀 Cloudflare Pages 部署步骤

### 1. 保存代码到 GitHub 仓库
将当前项目所有文件推送至你的 GitHub 仓库（例如 `chinese-poker`）。

### 2. 在 Cloudflare 控制台新建 D1 数据库
1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)。
2. 进入 **Workers & Pages > D1**。
3. 点击 **Create database**，输入数据库名称（例如 `thirteen-poker-db`）。

### 3. 在 Cloudflare Pages 中拉取部署并绑定 D1
1. 进入 **Workers & Pages > Create application > Pages > Connect to Git**。
2. 选择你的 GitHub 仓库。
3. 配置构建设置（Build settings）：
   - **Framework preset**: `Vite`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
4. 点击 **Save and Deploy** 完成初次部署。
5. 进入该 Pages 项目的 **Settings > Functions > D1 database bindings**：
   - 点击 **Add binding**
   - **Variable name（变量名）**: 填入 `DB`
   - **D1 Database**: 选择第 2 步创建的 D1 数据库
6. 保存设置并重新部署（Redeploy）。

🎉 **部署完成！** 打开你的 Pages 域名网址，系统会自动创建好全部数据表并开始记录对局与排行榜！

---

## 🗄️ D1 数据库表结构

系统自动创建以下数据表：

```sql
-- 玩家排行与胜率表
CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  total_games INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  draws INTEGER DEFAULT 0,
  total_points INTEGER DEFAULT 0,
  special_hands_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 对局记录历史明细表
CREATE TABLE IF NOT EXISTS game_records (
  id TEXT PRIMARY KEY,
  player_name TEXT NOT NULL,
  mode TEXT NOT NULL,
  points_won INTEGER NOT NULL,
  result TEXT NOT NULL,
  special_hand TEXT,
  front_type TEXT,
  mid_type TEXT,
  back_type TEXT,
  opponents_summary TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 多人在线房间同步表
CREATE TABLE IF NOT EXISTS rooms (
  room_code TEXT PRIMARY KEY,
  host_name TEXT NOT NULL,
  max_players INTEGER DEFAULT 4,
  status TEXT DEFAULT 'waiting',
  players_json TEXT NOT NULL,
  deck_seed TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 系统迁移与元数据表
CREATE TABLE IF NOT EXISTS system_meta (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Telegram 管理员绑定表
CREATE TABLE IF NOT EXISTS bot_admins (
  chat_id TEXT PRIMARY KEY,
  username TEXT,
  first_name TEXT,
  role TEXT DEFAULT 'admin',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🤖 Telegram Bot 管理员查分配置

本项目内置专属 **Telegram Bot 管理员后端**（运行于 Cloudflare Pages Functions `/api/telegram`），支持随时在手机 Telegram 中查看玩家积分、全服排行榜与对局流水。

### 1. 申请 Telegram Bot
1. 在 Telegram 中搜索并打开 **@BotFather**。
2. 发送 `/newbot`，按提示设置机器人名称（例如 `ThirteenWaterBot`）。
3. 复制生成的 **API Token**（如 `123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ`）。

### 2. 在 Cloudflare Pages 中配置环境变量
在 Cloudflare 控制台 -> **Pages** -> 你的项目 -> **Settings** -> **Environment variables** 添加：
- `TELEGRAM_BOT_TOKEN`: 你的 Bot API Token
- `TELEGRAM_ADMIN_PASSWORD`: 管理员授权密码（例如 `13poker888` 或自定义密码）
- `TELEGRAM_ADMIN_IDS`: 可选，预授权的 Telegram Chat/User ID 列表（以逗号分隔）

### 3. 一键绑定 Webhook
- 打开游戏网页，点击顶部导航栏的 **【🤖 TG 管理员】** 按钮。
- 点击 **【一键绑定 Webhook】**（系统将自动绑定 `https://你的域名.pages.dev/api/telegram`）。

### 4. 手机端管理员指令列表

管理员在 Telegram 对话窗口中发送以下指令即可实时监控数据：

| 指令 | 说明 | 示例 |
|---|---|---|
| `/auth <密码>` | 验证管理员身份并绑定当前 TG 账号 | `/auth 13poker888` |
| `/score <玩家名>` | **精确查询指定玩家的净胜积分、胜率及近5局流水** | `/score 雀圣阿旺` |
| `/rank [数量]` | **查看全服风云积分排行榜 (Top 10)** | `/rank` 或 `/rank 20` |
| `/players` | 查看全服所有活跃玩家名录及积分 | `/players` |
| `/stats` | 查看服务器对局总量、特殊牌总数及 D1 状态 | `/stats` |
| `/history [数量]` | 查看全服最新完成的对局明细流水 | `/history` |
| `/help` | 查看所有指令及 Telegram 快捷交互按钮 | `/help` |

