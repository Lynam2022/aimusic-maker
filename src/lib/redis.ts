import Redis from 'ioredis';

// Singleton Redis client
const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

function createRedisClient(): Redis {
  const url = process.env.REDIS_URL || 'redis://localhost:6379';
  
  const client = new Redis(url, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: false,
    lazyConnect: true,
    reconnectOnError: (err) => {
      const targetErrors = ['READONLY', 'ECONNRESET'];
      return targetErrors.some(e => err.message.includes(e));
    }
  });

  let hasLoggedError = false;
  client.on('error', () => {
    if (process.env.NODE_ENV === 'development' && !hasLoggedError) {
      console.warn('[Redis] Connection warning: Redis server is offline. Cache features will be disabled. (Spam prevention active)');
      hasLoggedError = true;
    }
  });

  client.on('connect', () => {
    hasLoggedError = false;
    console.log('[Redis] Connected successfully.');
  });

  return client;
}

export const redis: Redis =
  globalForRedis.redis ?? createRedisClient();

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.redis = redis;
}

// ── Cache helpers ─────────────────────────────────────────────
export const CACHE_TTL = {
  userSession: 3600,    // 1 hour
  songStatus: 300,      // 5 min
  userCredits: 60,      // 1 min
} as const;

export async function getCached<T>(key: string): Promise<T | null> {
  if (redis.status !== 'ready') return null;
  try {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export async function setCache(key: string, value: unknown, ttl: number): Promise<void> {
  if (redis.status !== 'ready') return;
  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttl);
  } catch {
    // Cache failures are non-fatal
  }
}

export async function deleteCache(key: string): Promise<void> {
  if (redis.status !== 'ready') return;
  try {
    await redis.del(key);
  } catch {}
}
