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
const INITIAL_AUTHORIZED_PHONES = ['13800138000', '13900000000', '18888888888'];

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
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(normalizePhone);
      }
    }
  } catch {
    // ignore
  }
  // 默认初始授权手机号
  const defaults = INITIAL_AUTHORIZED_PHONES.map(normalizePhone);
  localStorage.setItem(AUTHORIZED_PHONES_KEY, JSON.stringify(defaults));
  return defaults;
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
    if (res.ok) {
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
    if (res.ok) {
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
  return { success: true, message: `✅ 成功授权手机号: ${norm}，现可正常注册`, list };
}

export function revokePhone(phone: string): { success: boolean; message: string; list: string[] } {
  const norm = normalizePhone(phone);
  let list = getAuthorizedPhones();
  if (!list.includes(norm)) {
    return { success: false, message: `手机号 ${norm} 不在授权列表中`, list };
  }

  list = list.filter(p => p !== norm);
  localStorage.setItem(AUTHORIZED_PHONES_KEY, JSON.stringify(list));
  return { success: true, message: `🚫 已取消对手机号 ${norm} 的注册授权`, list };
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

// 获取当前登录账号
export function getCurrentAccount(): UserAccount {
  const currentPhone = localStorage.getItem(CURRENT_USER_KEY);
  const db = getAllAccounts();

  if (currentPhone && db[currentPhone]) {
    return db[currentPhone].account;
  }

  // 默认创建一个初始演示手机账号，便于开箱即用
  const defaultPhone = '13800138000';
  if (!db[defaultPhone]) {
    const defaultAcc: UserAccount = {
      id: `u_${Date.now()}`,
      phone: defaultPhone,
      username: defaultPhone,
      nickname: '十三水雀神',
      avatar: '👑',
      points: 10000,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString()
    };
    db[defaultPhone] = {
      password: '123456',
      account: defaultAcc
    };
    saveAllAccounts(db);
    authorizePhone(defaultPhone);
  }

  localStorage.setItem(CURRENT_USER_KEY, defaultPhone);
  return db[defaultPhone].account;
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
    points: 10000, // 注册初始赠送 10,000 积分
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

  addPointsTransaction(cleanPhone, 'REGISTER_BONUS', '新手初始积分', 10000, 10000);

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
