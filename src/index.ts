import "dotenv/config";
import { createBot } from "./bot.js";
import { parseConfig } from "./config.js";

const config = parseConfig(process.env);
const bot = createBot(config);

await bot.launch();
console.log("Bot is running.");

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
