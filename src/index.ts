import "dotenv/config";
import { createBot } from "./bot.js";
import { parseConfig } from "./config.js";
import { YouTubeSearcher } from "./youtube-search.js";

const config = parseConfig(process.env);
const searcher = new YouTubeSearcher(config.requestTimeoutMs);

await searcher.init();
console.log("Headless browser ready.");

const bot = createBot(config, searcher);
await bot.launch();
console.log("Bot is running.");

const shutdown = async (signal: string): Promise<void> => {
  bot.stop(signal);
  await searcher.close();
};

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
