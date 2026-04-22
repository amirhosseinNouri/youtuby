import { z } from "zod";
import type { BotConfig } from "./types.js";

const defaultInvidiousBaseUrl = "https://inv.nadeko.net";
const defaultInvidiousFallbacks = [
  "http://inv.nadekonw7plitnjuawu6ytjsl7jlglk2t6pyq6eftptmiv3dvqndwvyd.onion",
  "http://nerdvpneaggggfdiurknszkbmhvjndks5z5k3g5yp4nhphflh3n3boad.onion",
  "http://nadekoohummkxncchcsylr3eku36ze4waq4kdrhcqupckc3pe5qq.b32.i2p",
  "http://invidious-nerdvpn.i2p",
  "https://inv-ygg.nadeko.net",
  "http://inv.nadeko.ygg"
].join(",");

const configSchema = z.object({
  BOT_TOKEN: z.string().min(1),
  INVIDIOUS_BASE_URL: z.string().url().default(defaultInvidiousBaseUrl),
  INVIDIOUS_BASE_URLS: z.string().default(defaultInvidiousFallbacks),
  RESULT_LIMIT: z.coerce.number().int().min(1).max(25).default(10),
  REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1000).max(30000).default(8000),
  SESSION_TTL_SEC: z.coerce.number().int().min(30).max(3600).default(600),
  RATE_LIMIT_WINDOW_SEC: z.coerce.number().int().min(10).max(3600).default(60),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().min(1).max(100).default(6)
});

export function parseConfig(env: NodeJS.ProcessEnv): BotConfig {
  const parsed = configSchema.parse(env);
  const baseUrl = parsed.INVIDIOUS_BASE_URL.replace(/\/$/, "");
  const extraBaseUrls = (parsed.INVIDIOUS_BASE_URLS ?? "")
    .split(",")
    .map((url) => url.trim())
    .filter((url) => url.length > 0)
    .map((url) => url.replace(/\/$/, ""));
  const invidiousBaseUrls = Array.from(new Set([baseUrl, ...extraBaseUrls]));

  return {
    botToken: parsed.BOT_TOKEN,
    invidiousBaseUrl: baseUrl,
    invidiousBaseUrls,
    resultLimit: parsed.RESULT_LIMIT,
    requestTimeoutMs: parsed.REQUEST_TIMEOUT_MS,
    sessionTtlSec: parsed.SESSION_TTL_SEC,
    rateLimitWindowSec: parsed.RATE_LIMIT_WINDOW_SEC,
    rateLimitMaxRequests: parsed.RATE_LIMIT_MAX_REQUESTS
  };
}
