import { UserAccount, PointsTransaction } from '../types';

const CURRENT_USER_KEY = 'thirteen_current_user_phone';
const ACCOUNTS_DB_KEY = 'thirteen_phone_accounts_db';
const TRANSACTIONS_KEY_PREFIX = 'thirteen_tx_';
const AUTHORIZED_PHONES_KEY = 'thirteen_authorized_phones';

const AVATARS = ['👑', '🦊', '🐯', '🐉', '🥷', '🐼', '🦁', '⚡', '💎', '🎲', '🏆', '🎯', '🔥', '⚔️'];

export const AVAILABLE_AVATARS = AVATARS;

type AccountListener = (account: UserAccount) => void;
const listeners: AccountListener[] = [];

export function subscribeAccount(listener: AccountListener) {
  listeners.push(listener);
  return () => {
    const idx = listeners.indexOf(listener);
    if (idx !== -1) listeners.splice(idx, 1);
  };
}

function notifyListeners(account: UserAccount) {
  listeners.forEach(cb => {
    try {
      cb(account);
    } catch {
      // ignore
    }
  });
}

// ----------------------------------------------------
// 1. 授权手机号白名单管理 (Bot 授权注册机制)
// ----------------------------------------------------
const INITIAL_AUTHORIZED_PHONES: string[] = [];

export function normalizePhone(phone: string): string {
  if (!phone) return '';
  let cleaned = phone.trim().replace(/[^\d]/g, '');
  // 如果带有86且为13位，剥离86前缀
  if (cleaned.length === 13 && cleaned.startsWith('861')) {
    cleaned = cleaned.substring(2);
  }
  return cleaned;
}

export function getAuthorizedPhones(): string[] {
  try {
    const raw = localStorage.getItem(AUTHORIZED_PHONES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map(normalizePhone).filter(Boolean);
      }
    }
  } catch {
    // ignore
  }
  return [];
}

export function isPhoneAuthorized(phone: string): boolean {
  const norm = normalizePhone(phone);
  if (!norm) return false;
  const list = getAuthorizedPhones();
  return list.includes(norm);
}

export async function checkOrSyncPhoneAuthorization(phone: string): Promise<boolean> {
  const norm = normalizePhone(phone);
  if (!norm) return false;

  // 1. 本地已授权
  if (isPhoneAuthorized(norm)) {
    return true;
  }

  // 2. 向服务端 API 查询授权状态 (D1 / Bot 授权同步)
  try {
    const res = await fetch(`/api/telegram?action=checkAuth&phone=${encodeURIComponent(norm)}`);
    if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
      const data = await res.json();
      if (data.authorized) {
        authorizePhone(norm);
        return true;
      }
    }
  } catch {
    // ignore
  }

  // 3. 兜底拉取完整授权名录同步
  try {
    const res = await fetch('/api/telegram?action=authlist');
    if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
      const data = await res.json();
      if (Array.isArray(data.list) && data.list.length > 0) {
        data.list.forEach((p: string) => authorizePhone(p));
        if (isPhoneAuthorized(norm)) return true;
      }
    }
  } catch {
    // ignore
  }

  return false;
}

export function authorizePhone(phone: string): { success: boolean; message: string; list: string[] } {
  const norm = normalizePhone(phone);
  if (!norm) {
    return { success: false, message: '手机号不能为空', list: getAuthorizedPhones() };
  }
  if (!/^\d{5,15}$/.test(norm)) {
    return { success: false, message: '手机号格式不正确（5-15位数字）', list: getAuthorizedPhones() };
  }

  const list = getAuthorizedPhones();
  if (!list.includes(norm)) {
    list.push(norm);
    localStorage.setItem(AUTHORIZED_PHONES_KEY, JSON.stringify(list));
  }

  try {
    fetch(`/api/telegram?action=auth&phone=${encodeURIComponent(norm)}`);
  } catch {}

  return { success: true, message: `✅ 成功授权手机号: ${norm}，现可正常注册`, list };
}

export async function revokePhone(phone: string): Promise<{ success: boolean; message: string; list: string[] }> {
  const norm = normalizePhone(phone);
  let list = getAuthorizedPhones();

  if (norm) {
    list = list.filter(p => p !== norm);
    localStorage.setItem(AUTHORIZED_PHONES_KEY, JSON.stringify(list));
  }

  try {
    await fetch(`/api/telegram?action=unauth&phone=${encodeURIComponent(norm || phone)}`);
  } catch {}

  return { success: true, message: `🚫 已取消对手机号 ${norm || phone} 的注册授权`, list };
}

export async function syncWithServerAuth(): Promise<string[]> {
  try {
    const res = await fetch('/api/telegram?action=authlist');
    if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
      const data = await res.json();
      if (Array.isArray(data.list) && data.list.length > 0) {
        const currentList = getAuthorizedPhones();
        let updated = false;
        data.list.forEach((p: string) => {
          const cleanP = normalizePhone(p);
          if (cleanP && !currentList.includes(cleanP)) {
            currentList.push(cleanP);
            updated = true;
          }
        });
        if (updated) {
          localStorage.setItem(AUTHORIZED_PHONES_KEY, JSON.stringify(currentList));
        }
        return currentList;
      }
    }
  } catch {}
  return getAuthorizedPhones();
}

export async function deleteAccount(phoneOrNickname: string): Promise<{ success: boolean; message: string }> {
  const query = phoneOrNickname.trim();
  if (!query) {
    return { success: false, message: '请输入要删除的手机号或玩家昵称' };
  }

  const normPhone = normalizePhone(query);
  const db = getAllAccounts();
  
  let targetKey = Object.keys(db).find(k => normalizePhone(k) === normPhone);
  if (!targetKey) {
    targetKey = Object.keys(db).find(
      k => db[k].account.nickname.toLowerCase() === query.toLowerCase() || db[k].account.phone === query
    );
  }

  if (!targetKey) {
    try {
      await fetch(`/api/telegram?action=deluser&user=${encodeURIComponent(query)}`);
    } catch {}
    return { success: false, message: `未找到与 "${query}" 匹配的玩家账号` };
  }

  const targetAcc = db[targetKey].account;
  const targetPhone = targetAcc.phone;

  // 1. 从本地数据库抹除账号
  delete db[targetKey];
  saveAllAccounts(db);

  // 2. 撤销手机号授权
  await revokePhone(targetPhone);

  // 3. 删除对局流水日志
  try {
    localStorage.removeItem(`${TRANSACTIONS_KEY_PREFIX}${targetPhone}`);
  } catch {}

  // 4. 发送服务端 D1 完全擦除数据
  try {
    await fetch(`/api/telegram?action=deluser&user=${encodeURIComponent(targetPhone)}`);
    if (targetAcc.nickname) {
      await fetch(`/api/telegram?action=deluser&user=${encodeURIComponent(targetAcc.nickname)}`);
    }
  } catch {}

  // 5. 如果删除的是当前登录用户，进行重置/切换
  const currentPhone = localStorage.getItem(CURRENT_USER_KEY);
  if (currentPhone === targetPhone) {
    localStorage.removeItem(CURRENT_USER_KEY);
    const remainingKeys = Object.keys(db);
    if (remainingKeys.length > 0) {
      const nextAcc = db[remainingKeys[0]].account;
      localStorage.setItem(CURRENT_USER_KEY, nextAcc.phone);
      localStorage.setItem('thirteen_player_name', nextAcc.nickname);
      notifyListeners(nextAcc);
    } else {
      getCurrentAccount();
    }
  }

  return {
    success: true,
    message: `玩家 "${targetAcc.nickname}" (${targetPhone}) 及其战绩流水与注册授权已完全删除！`
  };
}

// ----------------------------------------------------
// 2. 账号数据库存储
// ----------------------------------------------------
function getAllAccounts(): Record<string, { password: string; account: UserAccount }> {
  try {
    const raw = localStorage.getItem(ACCOUNTS_DB_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // ignore
  }
  return {};
}

function saveAllAccounts(db: Record<string, { password: string; account: UserAccount }>) {
  localStorage.setItem(ACCOUNTS_DB_KEY, JSON.stringify(db));
}

// 获取全服所有已注册玩家账号
export function getAllUsersList(): UserAccount[] {
  const db = getAllAccounts();
  return Object.values(db).map(item => item.account).sort((a, b) => b.points - a.points);
}

// 获取供牌桌匹配/就座的真实玩家账号池（非当前玩家）
export function getRegisteredCommunityPlayers(): UserAccount[] {
  const db = getAllAccounts();
  const currentPhone = localStorage.getItem(CURRENT_USER_KEY) || '';
  
  // 确保基础真实社区玩家已注册入库 (使用独立虚拟社区 ID，不占用玩家真实手机号)
  const defaultCommunity: { phone: string; nickname: string; avatar: string; points: number }[] = [
    { phone: 'bot_player_1', nickname: '闽南雀圣·阿豪', avatar: '🦁', points: 15800 },
    { phone: 'bot_player_2', nickname: '江城赌王·老陈', avatar: '🐯', points: 12600 },
    { phone: 'bot_player_3', nickname: '金牌理手·小美', avatar: '🌸', points: 9800 },
    { phone: 'bot_player_4', nickname: '九段棋手·张弛', avatar: '🕶️', points: 18400 },
    { phone: 'bot_player_5', nickname: '岭南十三水老法师', avatar: '🐲', points: 11200 },
    { phone: 'bot_player_6', nickname: '香江牌王·阿发', avatar: '🎩', points: 14500 },
    { phone: 'bot_player_7', nickname: '姑苏第一枪', avatar: '✨', points: 20200 },
  ];

  let dbUpdated = false;
  defaultCommunity.forEach(p => {
    if (!db[p.phone] || !db[p.phone].account) {
      db[p.phone] = {
        password: 'password123',
        account: {
          id: `u_${p.phone}`,
          phone: p.phone,
          username: p.nickname,
          nickname: p.nickname,
          avatar: p.avatar,
          points: p.points,
          createdAt: new Date(Date.now() - 86400000 * 10).toISOString(),
          lastLoginAt: new Date().toISOString()
        }
      };
      dbUpdated = true;
    }
  });

  if (dbUpdated) {
    saveAllAccounts(db);
  }

  return Object.values(db)
    .map(item => item.account)
    .filter(acc => acc.phone !== currentPhone);
}

// 获取当前登录账号
export function getCurrentAccount(): UserAccount {
  const currentPhone = localStorage.getItem(CURRENT_USER_KEY);
  const db = getAllAccounts();

  let acc: UserAccount | undefined;

  if (currentPhone && db[currentPhone] && db[currentPhone].account) {
    acc = db[currentPhone].account;
  }

  if (!acc) {
    // 游客模式账号：持久化本设备的稳定独立ID，保证每次刷新与入座席位身份稳定
    let guestId = '';
    try {
      guestId = localStorage.getItem('thirteen_guest_player_id') || '';
      if (!guestId) {
        guestId = `guest_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
        localStorage.setItem('thirteen_guest_player_id', guestId);
      }
    } catch {
      guestId = `guest_${Date.now()}`;
    }

    const guestAcc: UserAccount = {
      id: guestId,
      phone: '',
      username: '游客玩家',
      nickname: '十三水雀神',
      avatar: '👑',
      points: 10000,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString()
    };
    return guestAcc;
  }

  // Ensure safe fallback values on all required properties
  if (typeof acc.points !== 'number' || isNaN(acc.points)) {
    acc.points = 10000;
  }
  if (!acc.nickname) acc.nickname = '十三水雀神';
  if (!acc.avatar) acc.avatar = '👑';
  if (!acc.id) acc.id = `u_${Date.now()}`;

  return acc;
}

export function saveAccount(account: UserAccount) {
  const db = getAllAccounts();
  if (db[account.phone]) {
    db[account.phone].account = account;
  } else {
    db[account.phone] = {
      password: '123456',
      account
    };
  }
  saveAllAccounts(db);
  if (account.phone === localStorage.getItem(CURRENT_USER_KEY)) {
    localStorage.setItem('thirteen_player_name', account.nickname);
    notifyListeners(account);
  }
}

// 注册：手机号（需Bot授权） + 昵称 + 6位数密码（不限制大小写字母字符）
export async function registerAccount(
  phone: string,
  nickname: string,
  password: string,
  avatar?: string
): Promise<{ success: boolean; message: string; account?: UserAccount }> {
  const cleanPhone = normalizePhone(phone);
  const cleanNickname = nickname.trim();

  if (!cleanPhone) {
    return { success: false, message: '请输入手机号' };
  }

  // 校验手机号格式：纯数字或手机号常用字符（5-15位）
  if (!/^\d{5,15}$/.test(cleanPhone)) {
    return { success: false, message: '请输入有效的手机号码（5-15位数字）' };
  }

  // 必须经 Bot 管理员授权后方可注册（支持本地与服务端 D1/Bot 实时同步）
  const authorized = await checkOrSyncPhoneAuthorization(cleanPhone);
  if (!authorized) {
    return {
      success: false,
      message: `手机号 ${cleanPhone} 未获得Bot管理员授权，无法注册！请先在 Telegram Bot 中发送 "/auth ${cleanPhone}" 授权。`
    };
  }

  if (!cleanNickname) {
    return { success: false, message: '请输入玩家昵称' };
  }

  // 密码必须为 6 位数字符
  if (!password || password.length !== 6) {
    return { success: false, message: '密码必须为 6 位数（可包含字母、数字及字符）' };
  }

  const db = getAllAccounts();
  const existingKey = Object.keys(db).find(k => normalizePhone(k) === cleanPhone);
  if (existingKey) {
    return { success: false, message: '该手机号已注册，请直接登录' };
  }

  const newAccount: UserAccount = {
    id: `u_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    phone: cleanPhone,
    username: cleanPhone,
    nickname: cleanNickname,
    avatar: avatar || '👑',
    points: 10000, // 注册初始赠送 10,000 体验积分
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString()
  };

  db[cleanPhone] = {
    password,
    account: newAccount
  };
  saveAllAccounts(db);

  localStorage.setItem(CURRENT_USER_KEY, newAccount.phone);
  localStorage.setItem('thirteen_player_name', newAccount.nickname);
  notifyListeners(newAccount);

  return { success: true, message: '注册成功！', account: newAccount };
}

// 登录：手机号 + 6位数密码
export function loginAccount(
  phone: string,
  password: string
): { success: boolean; message: string; account?: UserAccount } {
  const cleanPhone = normalizePhone(phone);
  if (!cleanPhone || !password) {
    return { success: false, message: '请输入手机号和 6 位密码' };
  }

  const db = getAllAccounts();
  const foundKey = Object.keys(db).find(k => normalizePhone(k) === cleanPhone) || cleanPhone;
  const found = db[foundKey];

  if (!found) {
    return { success: false, message: '该手机号尚未注册，请先注册' };
  }

  if (found.password !== password) {
    return { success: false, message: '密码错误，请输入正确的 6 位密码' };
  }

  found.account.lastLoginAt = new Date().toISOString();
  saveAllAccounts(db);
  localStorage.setItem(CURRENT_USER_KEY, found.account.phone);
  localStorage.setItem('thirteen_player_name', found.account.nickname);
  notifyListeners(found.account);

  return { success: true, message: `登录成功！欢迎回来，${found.account.nickname}`, account: found.account };
}

// 搜索手机号或昵称对应用户
export function searchUserByPhone(phoneOrNickname: string): {
  success: boolean;
  message?: string;
  user?: UserAccount;
} {
  const query = phoneOrNickname.trim().toLowerCase();
  if (!query) {
    return { success: false, message: '请输入要搜索的手机号或昵称' };
  }

  const db = getAllAccounts();
  
  // 1. 精确手机号匹配
  if (db[query]) {
    return {
      success: true,
      user: db[query].account
    };
  }

  // 2. 昵称或手机号包含匹配
  const allAccounts = Object.values(db).map(item => item.account);
  const found = allAccounts.find(
    acc => acc.phone.toLowerCase() === query || acc.nickname.toLowerCase() === query
  );

  if (found) {
    return { success: true, user: found };
  }

  // 3. 模糊匹配
  const fuzzy = allAccounts.find(
    acc => acc.phone.includes(query) || acc.nickname.toLowerCase().includes(query)
  );

  if (fuzzy) {
    return { success: true, user: fuzzy };
  }

  return {
    success: false,
    message: `未找到与 "${phoneOrNickname}" 匹配的玩家账号`
  };
}

// ----------------------------------------------------
// 3. Bot 管理员：增减或设定玩家积分
// ----------------------------------------------------
export function adminAdjustPoints(
  targetPhone: string,
  deltaAmount: number,
  reason?: string
): { success: boolean; message: string; newPoints?: number; account?: UserAccount } {
  const cleanPhone = targetPhone.trim();
  if (!cleanPhone) {
    return { success: false, message: '手机号不能为空' };
  }

  const db = getAllAccounts();
  const found = db[cleanPhone];

  if (!found) {
    return { success: false, message: `未找到手机号为 ${cleanPhone} 的玩家` };
  }

  if (isNaN(deltaAmount) || deltaAmount === 0) {
    return { success: false, message: '积分变动数值无效或为0' };
  }

  const isAdd = deltaAmount > 0;
  const oldPoints = found.account.points;
  const newPoints = Math.max(0, oldPoints + deltaAmount);
  found.account.points = newPoints;

  saveAllAccounts(db);

  // 记录流水
  const title = reason || (isAdd ? `Bot管理员调增积分` : `Bot管理员调减积分`);
  addPointsTransaction(
    cleanPhone,
    isAdd ? 'BOT_ADD' : 'BOT_DEDUCT',
    title,
    deltaAmount,
    newPoints,
    'Bot管理员'
  );

  // 如果调增/减的是当前登录用户，触发即时通知
  const currentPhone = localStorage.getItem(CURRENT_USER_KEY);
  if (currentPhone === cleanPhone) {
    notifyListeners(found.account);
  }

  const actionText = isAdd ? `增加 +${deltaAmount.toLocaleString()}` : `扣减 ${deltaAmount.toLocaleString()}`;
  return {
    success: true,
    message: `成功为玩家 ${found.account.nickname} (${cleanPhone}) ${actionText} 积分，最新余额: ${newPoints.toLocaleString()} 分`,
    newPoints,
    account: found.account
  };
}

// 设定玩家积分到指定具体数值
export function adminSetPoints(
  targetPhone: string,
  exactPoints: number,
  reason?: string
): { success: boolean; message: string; newPoints?: number; account?: UserAccount } {
  const cleanPhone = targetPhone.trim();
  const db = getAllAccounts();
  const found = db[cleanPhone];

  if (!found) {
    return { success: false, message: `未找到手机号为 ${cleanPhone} 的玩家` };
  }

  const targetValue = Math.max(0, Math.floor(exactPoints));
  const delta = targetValue - found.account.points;
  return adminAdjustPoints(cleanPhone, delta, reason || `Bot管理员重置积分为 ${targetValue.toLocaleString()}`);
}

// 相互赠送积分
export function transferPoints(
  targetPhone: string,
  amount: number
): { success: boolean; message: string; senderAccount?: UserAccount } {
  const cleanTargetPhone = targetPhone.trim();
  const current = getCurrentAccount();

  if (cleanTargetPhone === current.phone) {
    return { success: false, message: '不能给自己赠送积分' };
  }

  if (!amount || isNaN(amount) || amount <= 0) {
    return { success: false, message: '请输入有效的赠送积分数量' };
  }

  const transferAmount = Math.floor(amount);
  if (current.points < transferAmount) {
    return { success: false, message: `您的可用积分不足（当前仅有 ${current.points.toLocaleString()} 积分）` };
  }

  const db = getAllAccounts();
  const targetUserEntry = db[cleanTargetPhone];

  if (!targetUserEntry) {
    return { success: false, message: '目标手机号玩家不存在' };
  }

  // 扣减赠送方积分
  current.points -= transferAmount;
  db[current.phone].account.points = current.points;

  // 增加接收方积分
  targetUserEntry.account.points += transferAmount;
  db[cleanTargetPhone].account.points = targetUserEntry.account.points;

  saveAllAccounts(db);
  saveAccount(current);

  // 记录赠送方流水
  addPointsTransaction(
    current.phone,
    'TRANSFER_OUT',
    `赠送积分给 ${cleanTargetPhone} (${targetUserEntry.account.nickname})`,
    -transferAmount,
    current.points,
    cleanTargetPhone,
    targetUserEntry.account.nickname
  );

  // 记录接收方流水
  addPointsTransaction(
    cleanTargetPhone,
    'TRANSFER_IN',
    `收到 ${current.phone} (${current.nickname}) 赠送的积分`,
    transferAmount,
    targetUserEntry.account.points,
    current.phone,
    current.nickname
  );

  return {
    success: true,
    message: `成功向 ${cleanTargetPhone} (${targetUserEntry.account.nickname}) 赠送 ${transferAmount.toLocaleString()} 积分！`,
    senderAccount: current
  };
}

// 更新个人昵称与头像
export function updateProfile(nickname: string, avatar: string): UserAccount {
  const account = getCurrentAccount();
  if (nickname && nickname.trim()) {
    account.nickname = nickname.trim();
  }
  if (avatar) {
    account.avatar = avatar;
  }
  saveAccount(account);
  return account;
}

// 增减对局积分
export function addPoints(amount: number, type: PointsTransaction['type'], title: string): number {
  const account = getCurrentAccount();
  account.points = Math.max(0, account.points + amount);
  saveAccount(account);
  addPointsTransaction(account.phone, type, title, amount, account.points);
  return account.points;
}

// 🛡️ 破产救济金：积分归零时每日可领取一次应急救济金 (1000 积分)
const RELIEF_KEY_PREFIX = 'thirteen_daily_relief_date_';

export function canClaimDailyRelief(phone?: string): boolean {
  const targetPhone = phone || getCurrentAccount().phone;
  const account = getCurrentAccount();
  if (account.points > 0) return false;
  const lastDate = localStorage.getItem(`${RELIEF_KEY_PREFIX}${targetPhone}`);
  const todayStr = new Date().toISOString().slice(0, 10);
  return lastDate !== todayStr;
}

export function claimDailyRelief(phone?: string): { success: boolean; amount: number; message: string } {
  const targetPhone = phone || getCurrentAccount().phone;
  const account = getCurrentAccount();
  const todayStr = new Date().toISOString().slice(0, 10);

  if (account.points > 0) {
    return { success: false, amount: 0, message: '当前账户尚有积分，无需领取破产救济金' };
  }

  const lastDate = localStorage.getItem(`${RELIEF_KEY_PREFIX}${targetPhone}`);
  if (lastDate === todayStr) {
    return { success: false, amount: 0, message: '今日已领取过破产救济金，请明日再来或通过好友赠送获取积分' };
  }

  const reliefAmount = 1000;
  account.points += reliefAmount;
  saveAccount(account);
  localStorage.setItem(`${RELIEF_KEY_PREFIX}${targetPhone}`, todayStr);

  addPointsTransaction(
    targetPhone,
    'REGISTER_BONUS',
    '领取每日破产救济礼包',
    reliefAmount,
    account.points
  );

  return {
    success: true,
    amount: reliefAmount,
    message: `🎉 成功领取 ${reliefAmount.toLocaleString()} 积分破产救济金！祝您旗开得胜！`
  };
}

// 积分流水明细
export function getPointsTransactions(phone?: string): PointsTransaction[] {
  const targetPhone = phone || getCurrentAccount().phone;
  try {
    const raw = localStorage.getItem(`${TRANSACTIONS_KEY_PREFIX}${targetPhone}`);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return [];
}

function addPointsTransaction(
  phone: string,
  type: PointsTransaction['type'],
  title: string,
  amount: number,
  balanceAfter: number,
  relatedPhone?: string,
  relatedNickname?: string
) {
  try {
    const key = `${TRANSACTIONS_KEY_PREFIX}${phone}`;
    const list: PointsTransaction[] = JSON.parse(localStorage.getItem(key) || '[]');
    const item: PointsTransaction = {
      id: `tx_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      type,
      title,
      amount,
      balanceAfter,
      timestamp: new Date().toISOString(),
      relatedPhone,
      relatedNickname
    };
    list.unshift(item);
    localStorage.setItem(key, JSON.stringify(list.slice(0, 50)));
  } catch {
    // ignore
  }
}
