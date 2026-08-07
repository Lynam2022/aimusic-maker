import { redis } from './redis';

// DDoS Protection: Track requests per IP
// Limit: 60 requests per minute per IP.
// If exceeded, block initially for 10 seconds, escalating by 2x on each subsequent block.
export async function checkIpRateLimit(ip: string): Promise<{ allowed: boolean; blockDuration: number }> {
  if (redis.status !== 'ready') {
    return { allowed: true, blockDuration: 0 };
  }

  const cleanIp = ip.replace(/[^a-zA-Z0-9.:_-]/g, '');
  const blockedKey = `blocked:ip:${cleanIp}`;
  const countKey = `rate:ip:${cleanIp}`;
  const blockCountKey = `block_count:ip:${cleanIp}`;

  try {
    // Check if IP is currently blocked
    const isBlocked = await redis.get(blockedKey);
    if (isBlocked) {
      const ttl = await redis.ttl(blockedKey);
      return { allowed: false, blockDuration: ttl > 0 ? ttl : 10 };
    }

    // Increment request count in a 1-minute window
    const current = await redis.incr(countKey);
    if (current === 1) {
      await redis.expire(countKey, 60);
    }

    // Threshold: 60 requests per minute
    if (current > 60) {
      // Get previous block counts to escalate block duration
      const blockCountStr = await redis.get(blockCountKey);
      const blockCount = blockCountStr ? parseInt(blockCountStr, 10) : 0;      
      const newBlockCount = blockCount + 1;
      
      // Calculate escalating block duration: 10s, 20s, 40s, 80s, ...
      const blockDuration = 10 * Math.pow(2, blockCount);
      
      await redis.set(blockedKey, '1', 'EX', blockDuration);
      await redis.set(blockCountKey, String(newBlockCount), 'EX', 86400); // Reset block count history after 1 day

      console.warn(`[Security] IP ${cleanIp} blocked for ${blockDuration}s due to rate limit violation.`);
      return { allowed: false, blockDuration };
    }
  } catch (err: any) {
    // Redis down: log error and allow access
    console.error('[Security] Rate limit check error:', err.message);
  }

  return { allowed: true, blockDuration: 0 };
}

// Login Brute Force Prevention (Anti credential stuffing)
// Threshold: 5 failed attempts per email/IP combination.
// If exceeded, block login attempts for 60 seconds (escalating with 2x multiplier).
export async function checkLoginAttempts(email: string, ip: string): Promise<void> {
  if (redis.status !== 'ready') return;

  const cleanEmail = email.toLowerCase().trim().replace(/[^a-zA-Z0-9@._-]/g, '');
  const cleanIp = ip.replace(/[^a-zA-Z0-9.:_-]/g, '');
  
  const blockKey = `blocked:login:${cleanEmail}:${cleanIp}`;

  try {
    const isBlocked = await redis.get(blockKey);
    if (isBlocked) {
      const ttl = await redis.ttl(blockKey);
      throw new Error(`Đăng nhập bị tạm khóa do nhập sai mật khẩu quá nhiều lần. Vui lòng thử lại sau ${ttl} giây.`);
    }
  } catch (err: any) {
    if (err.message.includes('Đăng nhập bị tạm khóa')) {
      throw err;
    }
    console.error('[Security] Login check attempts error:', err.message);
  }
}

export async function recordLoginFailure(email: string, ip: string): Promise<void> {
  if (redis.status !== 'ready') return;

  const cleanEmail = email.toLowerCase().trim().replace(/[^a-zA-Z0-9@._-]/g, '');
  const cleanIp = ip.replace(/[^a-zA-Z0-9.:_-]/g, '');

  const attemptsKey = `attempts:login:${cleanEmail}:${cleanIp}`;
  const blockKey = `blocked:login:${cleanEmail}:${cleanIp}`;
  const blockCountKey = `block_count:login:${cleanEmail}:${cleanIp}`;

  try {
    const current = await redis.incr(attemptsKey);
    if (current === 1) {
      await redis.expire(attemptsKey, 600); // 10 minute window to accumulate failures
    }

    if (current >= 5) {
      const blockCountStr = await redis.get(blockCountKey);
      const blockCount = blockCountStr ? parseInt(blockCountStr, 10) : 0;
      const newBlockCount = blockCount + 1;

      // Escalating block duration: 60s, 120s, 240s...
      const blockDuration = 60 * Math.pow(2, blockCount);

      await redis.set(blockKey, '1', 'EX', blockDuration);
      await redis.set(blockCountKey, String(newBlockCount), 'EX', 86400); // Reset block history after 1 day
      await redis.del(attemptsKey); // Reset attempts since they are now blocked

      console.warn(`[Security] Login blocked for ${cleanEmail} from IP ${cleanIp} for ${blockDuration}s.`);
      throw new Error(`Đăng nhập bị khóa ${blockDuration} giây do nhập sai 5 lần.`);
    }
  } catch (err: any) {
    if (err.message.includes('Đăng nhập bị khóa')) {
      throw err;
    }
    console.error('[Security] Record login failure error:', err.message);
  }
}

export async function resetLoginAttempts(email: string, ip: string): Promise<void> {
  if (redis.status !== 'ready') return;

  const cleanEmail = email.toLowerCase().trim().replace(/[^a-zA-Z0-9@._-]/g, '');
  const cleanIp = ip.replace(/[^a-zA-Z0-9.:_-]/g, '');

  const attemptsKey = `attempts:login:${cleanEmail}:${cleanIp}`;
  const blockKey = `blocked:login:${cleanEmail}:${cleanIp}`;
  const blockCountKey = `block_count:login:${cleanEmail}:${cleanIp}`;

  try {
    await redis.del(attemptsKey);
    await redis.del(blockKey);
    await redis.del(blockCountKey);
  } catch (err: any) {
    console.error('[Security] Reset login attempts error:', err.message);
  }
}
