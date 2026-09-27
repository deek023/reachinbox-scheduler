import "dotenv/config";
import Redis, { RedisOptions } from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

let isConnected = false;
let lastError: string | null = null;

const defaultOptions: RedisOptions = {
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: false,
  retryStrategy(times) {
    // Retry every 2 seconds up to a reasonable interval
    return Math.min(times * 200, 3000);
  },
};

export function createRedisClient(): Redis {
  const client = new Redis(REDIS_URL, defaultOptions);

  client.on('connect', () => {
    isConnected = true;
    lastError = null;
  });

  client.on('ready', () => {
    isConnected = true;
    lastError = null;
  });

  client.on('error', (err) => {
    isConnected = false;
    lastError = err.message;
  });

  client.on('close', () => {
    isConnected = false;
  });

  return client;
}

// Global shared client for rate-limiting and metadata
export const redis = createRedisClient();

export function isRedisConnected(): boolean {
  return isConnected && redis.status === 'ready';
}

export function getRedisStatus() {
  return {
    connected: isRedisConnected(),
    status: redis.status,
    url: REDIS_URL.replace(/:\/\/[^:]+:[^@]+@/, '://***:***@'), // Redact password if any
    error: lastError,
  };
}

/**
 * Atomic Redis Lua Script for Rate Limiting
 * Checks both:
 * 1. Minimum delay between emails per sender (inter-email spacing)
 * 2. Maximum emails per hour per sender (sliding hour window)
 *
 * KEYS[1] = email_rate_limit:{senderId}:{hourWindow}
 * KEYS[2] = sender_last_sent:{senderId}
 * ARGV[1] = maxPerHour
 * ARGV[2] = minDelayMs
 * ARGV[3] = nowTimestampMs
 *
 * Returns:
 * [1, currentCount] -> ALLOWED
 * [0, "HOURLY_LIMIT_REACHED", currentCount] -> BLOCKED (hourly limit hit)
 * [0, "MIN_DELAY_NOT_ELAPSED", remainingWaitMs] -> BLOCKED (min delay spacing)
 */
const RATE_LIMIT_LUA = `
local hourlyKey = KEYS[1]
local lastSentKey = KEYS[2]
local maxPerHour = tonumber(ARGV[1])
local minDelayMs = tonumber(ARGV[2])
local nowMs = tonumber(ARGV[3])

-- Check min delay
local lastSent = redis.call('GET', lastSentKey)
if lastSent then
  local elapsed = nowMs - tonumber(lastSent)
  if elapsed < minDelayMs then
    local remaining = minDelayMs - elapsed
    return {0, "MIN_DELAY_NOT_ELAPSED", tostring(remaining)}
  end
end

-- Check hourly count
local currentCount = redis.call('GET', hourlyKey)
local countNum = currentCount and tonumber(currentCount) or 0

if countNum >= maxPerHour then
  return {0, "HOURLY_LIMIT_REACHED", tostring(countNum)}
end

-- Slot granted: increment hourly counter and record last sent timestamp
local newCount = redis.call('INCR', hourlyKey)
if newCount == 1 then
  redis.call('EXPIRE', hourlyKey, 7200) -- expire after 2 hours
end

redis.call('SET', lastSentKey, tostring(nowMs), 'EX', 3600)

return {1, tostring(newCount)}
`;

export interface RateLimitCheckResult {
  allowed: boolean;
  reason?: 'HOURLY_LIMIT_REACHED' | 'MIN_DELAY_NOT_ELAPSED';
  currentCount?: number;
  remainingWaitMs?: number;
}

export function getHourWindow(date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  const h = String(date.getUTCHours()).padStart(2, '0');
  return `${y}${m}${d}${h}`;
}

export function getNextHourWindowDate(date = new Date()): Date {
  const next = new Date(date);
  next.setUTCHours(next.getUTCHours() + 1, 0, 0, 0);
  return next;
}

export async function checkAndAcquireRateLimitSlot(
  senderId: string,
  maxPerHour: number,
  minDelayMs: number
): Promise<RateLimitCheckResult> {
  if (!isRedisConnected()) {
    throw new Error('Redis connection is not available for rate limiting verification.');
  }

  const hourWindow = getHourWindow();
  const hourlyKey = `email_rate_limit:${senderId}:${hourWindow}`;
  const lastSentKey = `sender_last_sent:${senderId}`;
  const nowMs = Date.now();

  try {
    const res = (await redis.eval(
      RATE_LIMIT_LUA,
      2,
      hourlyKey,
      lastSentKey,
      maxPerHour,
      minDelayMs,
      nowMs
    )) as [number, string, string?];

    const isAllowed = res[0] === 1;
    if (isAllowed) {
      return {
        allowed: true,
        currentCount: parseInt(res[1], 10),
      };
    }

    const reason = res[1] as 'HOURLY_LIMIT_REACHED' | 'MIN_DELAY_NOT_ELAPSED';
    if (reason === 'HOURLY_LIMIT_REACHED') {
      return {
        allowed: false,
        reason: 'HOURLY_LIMIT_REACHED',
        currentCount: parseInt(res[2] || res[1], 10),
      };
    } else {
      return {
        allowed: false,
        reason: 'MIN_DELAY_NOT_ELAPSED',
        remainingWaitMs: parseInt(res[2] || '1000', 10),
      };
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[Redis Rate Limiting Error]:', errorMsg);
    throw err;
  }
}

export async function getHourlyRateLimitCount(senderId: string, hourWindow = getHourWindow()): Promise<number> {
  if (!isRedisConnected()) return 0;
  const countStr = await redis.get(`email_rate_limit:${senderId}:${hourWindow}`);
  return countStr ? parseInt(countStr, 10) : 0;
}
