import { GameRecord, PlayerStats, TelegramBotStatus } from './types';
import {
  authorizePhone,
  revokePhone,
  deleteAccount,
  getAuthorizedPhones,
  searchUserByPhone,
  adminAdjustPoints,
  adminSetPoints,
  getAllUsersList,
  getPointsTransactions
} from './lib/accountManager';

export interface InitResponse {
  ok: boolean;
  d1Bound: boolean;
  tablesCreated?: boolean;
  message?: string;
  setupGuide?: string;
  stats?: {
    totalGames: number;
    totalPlayers: number;
    totalAdmins?: number;
  };
}

export interface StatsResponse {
  ok: boolean;
  d1Bound: boolean;
  leaderboard: PlayerStats[];
  global?: {
    totalMatches: number;
    totalSpecialHands: number;
  };
}

// Local Storage Fallback keys
const LOCAL_STORAGE_KEY_HISTORY = 'thirteen_water_history';
const LOCAL_STORAGE_KEY_PLAYERS = 'thirteen_water_players';

export class ApiClient {
  private static isD1Available: boolean | null = null;

  // 1. 初始化并自动建表
  public static async initializeDatabase(): Promise<InitResponse> {
    try {
      const res = await fetch('/api/init', { method: 'GET' });
      if (res.ok) {
        const data = (await res.json()) as InitResponse;
        this.isD1Available = data.d1Bound;
        return data;
      }
    } catch {
      // Offline / Static Preview Mode
    }

    this.isD1Available = false;
    return {
      ok: true,
      d1Bound: false,
      message: 'Running in Local Storage preview mode. On Cloudflare Pages, bind D1 database as "DB".'
    };
  }

  // 2. 记录比赛结果
  public static async recordGame(record: Omit<GameRecord, 'id' | 'createdAt'>): Promise<void> {
    try {
      const res = await fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.d1Bound) return;
      }
    } catch {
      // fallback
    }

    // LocalStorage Fallback
    try {
      const fullRecord: GameRecord = {
        ...record,
        id: `local_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        createdAt: new Date().toISOString()
      };
      const existingHistory: GameRecord[] = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY_HISTORY) || '[]');
      existingHistory.unshift(fullRecord);
      localStorage.setItem(LOCAL_STORAGE_KEY_HISTORY, JSON.stringify(existingHistory.slice(0, 50)));

      // Update local player stats
      const existingPlayers: Record<string, PlayerStats> = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY_PLAYERS) || '{}');
      const pName = record.playerName || 'Player';
      const isWin = record.result === 'WIN' || record.result === 'SPECIAL_WIN' ? 1 : 0;
      const isLoss = record.result === 'LOSE' ? 1 : 0;
      const isDraw = record.result === 'DRAW' ? 1 : 0;
      const isSpecial = record.specialHand ? 1 : 0;

      if (!existingPlayers[pName]) {
        existingPlayers[pName] = {
          id: pName,
          name: pName,
          totalGames: 1,
          wins: isWin,
          losses: isLoss,
          draws: isDraw,
          totalPoints: record.pointsWon,
          specialHandsCount: isSpecial
        };
      } else {
        const p = existingPlayers[pName];
        p.totalGames += 1;
        p.wins += isWin;
        p.losses += isLoss;
        p.draws += isDraw;
        p.totalPoints += record.pointsWon;
        p.specialHandsCount += isSpecial;
      }
      localStorage.setItem(LOCAL_STORAGE_KEY_PLAYERS, JSON.stringify(existingPlayers));
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }
  }

  // 3. 获取比赛记录
  public static async getGameHistory(playerName?: string, limit = 20): Promise<GameRecord[]> {
    try {
      const url = playerName ? `/api/history?player=${encodeURIComponent(playerName)}&limit=${limit}` : `/api/history?limit=${limit}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.d1Bound && data.records) {
          return data.records.map((r: any) => ({
            id: r.id,
            playerName: r.player_name,
            mode: r.mode,
            pointsWon: r.points_won,
            result: r.result,
            specialHand: r.special_hand,
            frontType: r.front_type,
            midType: r.mid_type,
            backType: r.back_type,
            opponentsSummary: r.opponents_summary,
            createdAt: r.created_at
          }));
        }
      }
    } catch {
      // fallback
    }

    try {
      const local = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY_HISTORY) || '[]');
      if (playerName) {
        return local.filter((r: GameRecord) => r.playerName === playerName).slice(0, limit);
      }
      return local.slice(0, limit);
    } catch {
      return [];
    }
  }

  // 4. 获取排行榜 & 统计
  public static async getStats(): Promise<StatsResponse> {
    try {
      const res = await fetch('/api/stats');
      if (res.ok) {
        const data = await res.json();
        if (data.d1Bound) {
          return {
            ok: true,
            d1Bound: true,
            leaderboard: data.leaderboard.map((p: any) => ({
              id: p.id,
              name: p.name,
              totalGames: p.total_games,
              wins: p.wins,
              losses: p.losses,
              draws: p.draws,
              totalPoints: p.total_points,
              specialHandsCount: p.special_hands_count
            })),
            global: data.global
          };
        }
      }
    } catch {
      // fallback
    }

    // Local fallback
    try {
      const playersObj: Record<string, PlayerStats> = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY_PLAYERS) || '{}');
      const list = Object.values(playersObj).sort((a, b) => b.totalPoints - a.totalPoints || b.wins - a.wins);
      const historyList: GameRecord[] = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY_HISTORY) || '[]');
      return {
        ok: true,
        d1Bound: false,
        leaderboard: list.slice(0, 20),
        global: {
          totalMatches: historyList.length,
          totalSpecialHands: historyList.filter(h => !!h.specialHand).length
        }
      };
    } catch {
      return { ok: true, d1Bound: false, leaderboard: [], global: { totalMatches: 0, totalSpecialHands: 0 } };
    }
  }

  // 5. 房间管理 (联机对战)
  // 6. Telegram Bot Admin Integration
  public static async getTelegramBotStatus(): Promise<TelegramBotStatus> {
    try {
      const res = await fetch('/api/telegram?action=status');
      if (res.ok) {
        return (await res.json()) as TelegramBotStatus;
      }
    } catch {
      // ignore
    }

    return {
      ok: true,
      hasBotToken: false,
      botUsername: null,
      botFirstName: null,
      webhookInfo: null,
      recommendedWebhookUrl: `${window.location.origin}/api/telegram`,
      configuredAdminIdsCount: 0,
      dbAdminsCount: 0,
      dbAdmins: [],
      d1Bound: false,
      hasAdminPassword: true
    };
  }

  public static async setTelegramWebhook(url?: string): Promise<{ ok: boolean; message?: string; description?: string }> {
    try {
      const targetUrl = url ? encodeURIComponent(url) : '';
      const res = await fetch(`/api/telegram?action=setWebhook${targetUrl ? `&url=${targetUrl}` : ''}`);
      return await res.json();
    } catch (e: any) {
      return { ok: false, message: e.message || 'Network error' };
    }
  }

  public static async simulateTelegramCommand(command: string): Promise<{ ok: boolean; response: { text: string; reply_markup?: any } }> {
    try {
      const res = await fetch(`/api/telegram?action=simulate&command=${encodeURIComponent(command)}`);
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // fallback
    }

    // Local simulator fallback when API is not running directly
    const rawCmd = (command || '').trim();
    const parts = rawCmd.split(/\s+/);
    let mainCmd = parts[0].toLowerCase();
    const arg1 = parts[1];
    const arg2 = parts[2];

    if (rawCmd === '📱 授权手机号' || rawCmd === '📱 授权名录') mainCmd = '/authlist';
    else if (rawCmd === '🚫 移除授权' || rawCmd === '🚫 取消授权') mainCmd = '/help_unauth';
    else if (rawCmd === '🗑️ 删除玩家' || rawCmd === '🗑️ 删除账号') mainCmd = '/help_deluser';
    else if (rawCmd === '💰 积分管理' || rawCmd === '💰 调整积分') mainCmd = '/help_points';
    else if (rawCmd === '👥 活跃玩家' || rawCmd === '👥 玩家名录') mainCmd = '/players';
    else if (rawCmd === '🏆 全服风云榜' || rawCmd === '🏆 排行榜') mainCmd = '/rank';
    else if (rawCmd === '📊 数据总览' || rawCmd === '📊 全局统计') mainCmd = '/stats';
    else if (rawCmd === '📜 最新对局' || rawCmd === '📜 对局流水') mainCmd = '/history';
    else if (rawCmd === '🆔 我的状态' || rawCmd === '🆔 身份信息') mainCmd = '/myid';
    else if (rawCmd === '❓ 帮助说明' || rawCmd === '❓ 指令菜单') mainCmd = '/help';

    const allUsers = getAllUsersList();
    const authPhones = getAuthorizedPhones();

    if (mainCmd === '/help_unauth') {
      return {
        ok: true,
        response: {
          text: `🚫 <b>取消手机号注册授权指南</b>\n━━━━━━━━━━━━━━━━━━\n<b>指令格式：</b>\n<code>/unauth 手机号码</code>\n\n<b>使用示例：</b>\n<code>/unauth 13912345678</code>\n\n<i>取消授权后，该手机号将无法在游戏中注册新账号。</i>`
        }
      };
    }

    if (mainCmd === '/help_deluser') {
      return {
        ok: true,
        response: {
          text: `🗑️ <b>彻底删除玩家账号与战绩指南</b>\n━━━━━━━━━━━━━━━━━━\n<b>指令格式：</b>\n<code>/deluser 手机号或玩家名字</code>\n\n<b>使用示例：</b>\n• <code>/deluser 13912345678</code>\n• <code>/deluser 雀圣阿旺</code>\n\n⚠️ <b>警告：</b>删除后该玩家的积分、战绩历史及注册授权将被完全擦除。`
        }
      };
    }

    if (mainCmd === '/help_points') {
      return {
        ok: true,
        response: {
          text: `💰 <b>管理员积分增加/扣减指南</b>\n━━━━━━━━━━━━━━━━━━\n<b>增加积分：</b>\n<code>/add 手机号或玩家名 数量</code> (例: <code>/add 雀圣阿旺 5000</code>)\n\n<b>扣减积分：</b>\n<code>/del 手机号或玩家名 数量</code> (例: <code>/del 雀圣阿旺 2000</code>)\n\n<b>设置积分：</b>\n<code>/set 手机号或玩家名 数量</code> (例: <code>/set 雀圣阿旺 10000</code>)`
        }
      };
    }

    // 1. 授权手机号注册: /auth <phone> 或 /allow <phone>
    if (mainCmd === '/auth' || mainCmd === '/allow' || mainCmd === '/authorize') {
      const targetPhone = parts.slice(1).join(' ').trim() || arg1;
      if (!targetPhone) {
        return {
          ok: true,
          response: {
            text: `📱 <b>Bot 手机号授权指令</b>\n\n使用方式：\n<code>/auth 手机号码</code>\n\n例如：<code>/auth 13912345678</code>\n\n<i>被授权的手机号方可在游戏中注册新账号。</i>`
          }
        };
      }
      const res = authorizePhone(targetPhone);
      return {
        ok: true,
        response: {
          text: `${res.message}\n\n当前已授权手机号总数: <b>${res.list.length}</b> 个\n发送 <code>/authlist</code> 可查看完整授权列表。`
        }
      };
    }

    // 2. 取消手机号授权: /unauth <phone> 或 /revoke <phone>
    if (mainCmd === '/unauth' || mainCmd === '/revoke' || mainCmd === '/delauth' || mainCmd === '/rmauth') {
      const targetPhone = parts.slice(1).join(' ').trim() || arg1;
      if (!targetPhone) {
        return {
          ok: true,
          response: {
            text: `🚫 <b>取消手机号授权指令</b>\n\n使用方式：\n<code>/unauth 手机号码</code>\n\n例如：<code>/unauth 13912345678</code>`
          }
        };
      }
      const res = await revokePhone(targetPhone);
      return {
        ok: true,
        response: {
          text: `${res.message}\n\n剩余已授权手机号: <b>${res.list.length}</b> 个`
        }
      };
    }

    // 2.5 删除玩家账号: /deluser <phone/name> 或 /deleteplayer <phone/name>
    if (mainCmd === '/deluser' || mainCmd === '/deleteplayer' || mainCmd === '/delplayer' || mainCmd === '/rmuser' || mainCmd === '/deleteuser') {
      const targetUser = parts.slice(1).join(' ').trim() || arg1;
      if (!targetUser) {
        return {
          ok: true,
          response: {
            text: `🗑️ <b>删除玩家账号指令</b>\n\n使用方式：\n<code>/deluser 手机号或玩家名字</code>\n\n例如：\n• <code>/deluser 13912345678</code>\n• <code>/deluser 雀圣阿旺</code>\n\n⚠️ <i>注意：删除后该玩家的积分、战绩历史及注册授权将被永久清除。</i>`
          }
        };
      }
      const delRes = await deleteAccount(targetUser);
      return {
        ok: true,
        response: {
          text: delRes.success
            ? `🗑️ <b>玩家账号及数据已成功删除</b>\n━━━━━━━━━━━━━━━━━━\n${delRes.message}`
            : `❌ ${delRes.message}`
        }
      };
    }

    // 3. 查看已授权手机号名录: /authlist 或 /whitelist
    if (mainCmd === '/authlist' || mainCmd === '/whitelist') {
      const listStr = authPhones.length > 0
        ? authPhones.map((p, idx) => `${idx + 1}. <code>${p}</code>`).join('\n')
        : '<i>暂无已授权手机号</i>';
      return {
        ok: true,
        response: {
          text: `📱 <b>已授权手机号白名单 (共 ${authPhones.length} 个)</b>\n━━━━━━━━━━━━━━━━━━\n${listStr}\n\n💡 提示：使用 <code>/auth 手机号</code> 可快速追加授权。`
        }
      };
    }

    // 4. 增加玩家积分: /addpoints <phone> <amount> 或 /add <phone> <amount>
    if (mainCmd === '/addpoints' || mainCmd === '/add') {
      if (!arg1 || !arg2) {
        return {
          ok: true,
          response: {
            text: `➕ <b>为玩家增加积分</b>\n\n使用方式：\n<code>/addpoints 手机号 积分数量</code>\n\n例如：<code>/add 13800138000 5000</code>`
          }
        };
      }
      const amount = parseInt(arg2, 10);
      if (isNaN(amount) || amount <= 0) {
        return {
          ok: true,
          response: {
            text: `❌ 请输入大于 0 的有效积分数量。`
          }
        };
      }
      const res = adminAdjustPoints(arg1, amount);
      return {
        ok: true,
        response: {
          text: res.success ? `✅ <b>增加积分成功</b>\n\n${res.message}` : `❌ ${res.message}`
        }
      };
    }

    // 5. 扣减玩家积分: /delpoints <phone> <amount> 或 /del <phone> <amount> 或 /sub <phone> <amount>
    if (mainCmd === '/delpoints' || mainCmd === '/del' || mainCmd === '/sub' || mainCmd === '/reduce') {
      if (!arg1 || !arg2) {
        return {
          ok: true,
          response: {
            text: `➖ <b>为玩家扣减积分</b>\n\n使用方式：\n<code>/delpoints 手机号 扣减数量</code>\n\n例如：<code>/del 13800138000 2000</code>`
          }
        };
      }
      const amount = parseInt(arg2, 10);
      if (isNaN(amount) || amount <= 0) {
        return {
          ok: true,
          response: {
            text: `❌ 请输入大于 0 的有效积分数量。`
          }
        };
      }
      const res = adminAdjustPoints(arg1, -amount);
      return {
        ok: true,
        response: {
          text: res.success ? `✅ <b>扣减积分成功</b>\n\n${res.message}` : `❌ ${res.message}`
        }
      };
    }

    // 6. 设定具体积分: /setpoints <phone> <amount>
    if (mainCmd === '/setpoints' || mainCmd === '/set') {
      if (!arg1 || !arg2) {
        return {
          ok: true,
          response: {
            text: `🎯 <b>设置玩家指定积分</b>\n\n使用方式：\n<code>/setpoints 手机号 目标积分</code>\n\n例如：<code>/set 13800138000 10000</code>`
          }
        };
      }
      const amount = parseInt(arg2, 10);
      if (isNaN(amount) || amount < 0) {
        return {
          ok: true,
          response: {
            text: `❌ 请输入大于等于 0 的有效目标积分。`
          }
        };
      }
      const res = adminSetPoints(arg1, amount);
      return {
        ok: true,
        response: {
          text: res.success ? `✅ <b>设置积分成功</b>\n\n${res.message}` : `❌ ${res.message}`
        }
      };
    }

    // 7. 搜索玩家档案与积分: /score <phone/name> 或 /user 或 /find
    if (mainCmd === '/score' || mainCmd === '/player' || mainCmd === '/user' || mainCmd === '/find' || mainCmd === '/cx') {
      const query = parts.slice(1).join(' ').trim();
      if (!query) {
        return {
          ok: true,
          response: {
            text: `🔍 <b>玩家档案与积分查询</b>\n\n使用方式：\n<code>/score 手机号或玩家昵称</code>\n\n例如：<code>/score 13800138000</code>`
          }
        };
      }

      const searchRes = searchUserByPhone(query);
      if (!searchRes.success || !searchRes.user) {
        return {
          ok: true,
          response: {
            text: `🔍 <b>未找到玩家</b>: <code>${query}</code>\n\n发送 <code>/players</code> 可查看所有已注册玩家列表。`
          }
        };
      }

      const u = searchRes.user;
      const txs = getPointsTransactions(u.phone);
      const txsStr = txs.slice(0, 3).map((t, idx) => {
        const sign = t.amount >= 0 ? `+${t.amount.toLocaleString()}` : `${t.amount.toLocaleString()}`;
        return `   ${idx + 1}. [${t.title}] <b>${sign}</b> (余额: ${t.balanceAfter.toLocaleString()})`;
      }).join('\n');

      return {
        ok: true,
        response: {
          text: `👑 <b>玩家档案 · ${u.nickname}</b>\n━━━━━━━━━━━━━━━━━━\n` +
            `👤 <b>玩家头像与昵称</b>: ${u.avatar} <b>${u.nickname}</b>\n` +
            `📱 <b>绑定手机号</b>: <code>${u.phone}</code>\n` +
            `💰 <b>当前可用积分</b>: <b>${u.points.toLocaleString()} 分</b>\n` +
            `📅 <b>注册时间</b>: ${new Date(u.createdAt).toLocaleDateString()}\n` +
            `🕒 <b>最后登录</b>: ${new Date(u.lastLoginAt).toLocaleTimeString()}\n\n` +
            `<b>📜 最近 3 笔积分流水：</b>\n${txsStr || '   暂无流水明细'}\n\n` +
            `💡 快捷操作：\n• 增加: <code>/add ${u.phone} 5000</code>\n• 扣减: <code>/del ${u.phone} 2000</code>`,
          reply_markup: {
            inline_keyboard: [
              [
                { text: `➕ 给 ${u.nickname} +1000分`, callback_data: `/add ${u.phone} 1000` },
                { text: `➕ 给 ${u.nickname} +5000分`, callback_data: `/add ${u.phone} 5000` }
              ],
              [
                { text: `➖ 给 ${u.nickname} -1000分`, callback_data: `/del ${u.phone} 1000` },
                { text: `🔄 刷新玩家档案`, callback_data: `/score ${u.phone}` }
              ]
            ]
          }
        }
      };
    }

    // 8. 查看全服所有已注册玩家: /players 或 /list
    if (mainCmd === '/players' || mainCmd === '/list') {
      if (allUsers.length === 0) {
        return {
          ok: true,
          response: {
            text: `👥 <b>已注册玩家名录</b>\n\n<i>暂无已注册玩家。</i>`
          }
        };
      }

      const rows = allUsers.map((u, idx) => {
        return `${idx + 1}. ${u.avatar} <b>${u.nickname}</b> (<code>${u.phone}</code>) · <b>${u.points.toLocaleString()} 分</b>`;
      }).join('\n');

      const quickButtons = allUsers.slice(0, 4).map(u => [
        { text: `👤 查看 ${u.nickname} (${u.points}分)`, callback_data: `/score ${u.phone}` }
      ]);

      return {
        ok: true,
        response: {
          text: `👥 <b>全服已注册玩家 (共 ${allUsers.length} 位)</b>\n━━━━━━━━━━━━━━━━━━\n${rows}\n\n🔍 点击下方快捷按钮或发送 <code>/score 手机号</code> 查分：`,
          reply_markup: { inline_keyboard: quickButtons }
        }
      };
    }

    // 9. 排行榜: /rank
    if (mainCmd === '/rank' || mainCmd === '/top') {
      if (allUsers.length === 0) {
        return {
          ok: true,
          response: { text: `🏆 <b>全服积分排行榜</b>\n\n<i>暂无积分数据。</i>` }
        };
      }
      const listStr = allUsers.slice(0, 10).map((u, i) => {
        const medal = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣'][i] || `#${i + 1}`;
        return `${medal} ${u.avatar} <b>${u.nickname}</b> (<code>${u.phone}</code>): <b>${u.points.toLocaleString()} 分</b>`;
      }).join('\n');

      return {
        ok: true,
        response: {
          text: `🏆 <b>十三水 · 全服积分排行榜 (Top ${Math.min(allUsers.length, 10)})</b>\n━━━━━━━━━━━━━━━━━━\n` + listStr
        }
      };
    }

    // 10. 统计: /stats
    if (mainCmd === '/stats') {
      const historyList: GameRecord[] = JSON.parse(localStorage.getItem('thirteen_water_history') || '[]');
      const totalPoints = allUsers.reduce((sum, u) => sum + u.points, 0);
      return {
        ok: true,
        response: {
          text: `📊 <b>十三水 · Bot 管理员数据统计</b>\n━━━━━━━━━━━━━━━━━━\n` +
            `👥 <b>已注册玩家</b>: ${allUsers.length} 位\n` +
            `📱 <b>已授权手机号</b>: ${authPhones.length} 个\n` +
            `💰 <b>全服积分总池</b>: ${totalPoints.toLocaleString()} 分\n` +
            `🎮 <b>总对局数</b>: ${historyList.length} 局`
        }
      };
    }

    // 默认指令引导
    return {
      ok: true,
      response: {
        text: `🤖 <b>十三水 Bot 管理员指令中心</b>\n✅ <b>管理员状态</b>: 已授权 (Bot Admin)\n━━━━━━━━━━━━━━━━━━\n` +
          `<b>📱 手机号授权与注册管理：</b>\n` +
          `• <code>/auth &lt;手机号&gt;</code> - 授权手机号注册\n` +
          `• <code>/unauth &lt;手机号&gt;</code> - 取消手机号授权\n` +
          `• <code>/authlist</code> - 查看已授权手机号列表\n\n` +
          `<b>💰 玩家积分管理与查询：</b>\n` +
          `• <code>/score &lt;手机号/昵称&gt;</code> - 搜索玩家并查看积分档案\n` +
          `• <code>/add &lt;手机号&gt; &lt;数量&gt;</code> - 给玩家增加积分\n` +
          `• <code>/del &lt;手机号&gt; &lt;数量&gt;</code> - 给玩家扣减积分\n` +
          `• <code>/set &lt;手机号&gt; &lt;数量&gt;</code> - 设置玩家指定积分\n` +
          `• <code>/players</code> - 列出全部玩家及积分\n` +
          `• <code>/rank</code> - 全服积分排行榜\n` +
          `• <code>/stats</code> - 游戏全局数据总览`,
        reply_markup: {
          inline_keyboard: [
            [{ text: '👥 玩家名录与积分', callback_data: '/players' }, { text: '📱 授权手机号列表', callback_data: '/authlist' }],
            [{ text: '🏆 全服风云榜', callback_data: '/rank' }, { text: '📊 统计总览', callback_data: '/stats' }]
          ]
        }
      }
    };
  }
}
