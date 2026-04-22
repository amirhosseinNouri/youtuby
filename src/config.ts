import { z } from "zod";
import type { BotConfig } from "./types.js";

const configSchema = z.object({
  BOT_TOKEN: z.string().min(1),
  INVIDIOUS_BASE_URL: z.string().url(),
  RESULT_LIMIT: z.coerce.number().int().min(1).max(25).default(10),
  REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1000).max(30000).default(8000),
  SESSION_TTL_SEC: z.coerce.number().int().min(30).max(3600).default(600),
  RATE_LIMIT_WINDOW_SEC: z.coerce.number().int().min(10).max(3600).default(60),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().min(1).max(100).default(6)
});

export function parseConfig(env: NodeJS.ProcessEnv): BotConfig {
  const parsed = configSchema.parse(env);

  return {
    botToken: parsed.BOT_TOKEN,
    invidiousBaseUrl: parsed.INVIDIOUS_BASE_URL.replace(/\/$/, ""),
    resultLimit: parsed.RESULT_LIMIT,
    requestTimeoutMs: parsed.REQUEST_TIMEOUT_MS,
    sessionTtlSec: parsed.SESSION_TTL_SEC,
    rateLimitWindowSec: parsed.RATE_LIMIT_WINDOW_SEC,
    rateLimitMaxRequests: parsed.RATE_LIMIT_MAX_REQUESTS
  };
}
