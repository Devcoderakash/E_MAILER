import Redis from "ioredis";
import { env } from "./env";

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: false,
  retryStrategy(times) {
    const delay = Math.min(times * 100, 3000);
    return delay;
  },
  lazyConnect: true,
});

redis.on("error", (err) => {
  console.error("❌ Redis Connection Error:", err.message);
});

redis.on("connect", () => {
  console.log("⚡ Redis Client connected successfully");
});

export interface RedisHealthResult {
  status: "connected" | "disconnected" | "error";
  latencyMs?: number;
  error?: string;
}

export async function checkRedisHealth(timeoutMs = 3000): Promise<RedisHealthResult> {
  const start = Date.now();
  try {
    if (redis.status !== "ready" && redis.status !== "connect") {
      await Promise.race([
        redis.connect().catch(() => {}),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Redis connection timed out")), timeoutMs)
        ),
      ]);
    }
    const response = await Promise.race([
      redis.ping(),
      new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error("Redis ping timed out")), timeoutMs)
      ),
    ]);
    if (response === "PONG") {
      const latencyMs = Date.now() - start;
      return { status: "connected", latencyMs };
    }
    return { status: "disconnected", error: "Did not receive PONG" };
  } catch (err: any) {
    return {
      status: "disconnected",
      error: err?.message || "Redis ping failed",
    };
  }
}

