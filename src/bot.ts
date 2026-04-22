import { Telegraf, Markup } from "telegraf";
import type { BotConfig, SearchResult } from "./types.js";
import { SearchBackendError, searchYouTube } from "./youtube-search.js";
import { SessionStore } from "./session-store.js";
import { UserRateLimiter } from "./rate-limit.js";

function makeSessionId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function compactText(input: string, maxLen = 80): string {
  if (input.length <= maxLen) {
    return input;
  }

  return `${input.slice(0, maxLen - 1)}…`;
}

function formatResultCaption(result: SearchResult, index: number): string {
  const lines = [`${index + 1}. ${compactText(result.title, 90)}`];

  if (result.channel) {
    lines.push(`Channel: ${result.channel}`);
  }
  if (result.duration) {
    lines.push(`Duration: ${result.duration}`);
  }
  if (result.publishedText) {
    lines.push(`Published: ${result.publishedText}`);
  }

  return lines.join("\n");
}

async function sendSearchResults(
  chatId: number,
  query: string,
  results: SearchResult[],
  bot: Telegraf,
  sessionStore: SessionStore<SearchResult[]>
): Promise<void> {
  if (results.length === 0) {
    await bot.telegram.sendMessage(chatId, `No results found for: ${query}`);
    return;
  }

  const sessionId = makeSessionId();
  sessionStore.set(sessionId, results);

  await bot.telegram.sendMessage(chatId, `Results for: ${query}\nTap one item to continue.`);

  for (const [index, result] of results.entries()) {
    try {
      await bot.telegram.sendPhoto(chatId, result.thumbnailUrl, {
        caption: formatResultCaption(result, index),
        reply_markup: Markup.inlineKeyboard([
          Markup.button.callback("Select", `pick:${sessionId}:${index}`)
        ]).reply_markup
      });
    } catch {
      await bot.telegram.sendMessage(chatId, formatResultCaption(result, index), {
        reply_markup: Markup.inlineKeyboard([
          Markup.button.callback("Select", `pick:${sessionId}:${index}`)
        ]).reply_markup
      });
    }
  }
}

function extractQueryFromCommand(text: string): string {
  const parts = text.trim().split(/\s+/);
  parts.shift();
  return parts.join(" ").trim();
}

export function createBot(config: BotConfig): Telegraf {
  const bot = new Telegraf(config.botToken);
  const sessionStore = new SessionStore<SearchResult[]>(config.sessionTtlSec * 1000);
  const rateLimiter = new UserRateLimiter(
    config.rateLimitWindowSec * 1000,
    config.rateLimitMaxRequests
  );

  setInterval(() => sessionStore.cleanup(), 60_000).unref();

  async function handleQuery(chatId: number, userId: number, query: string): Promise<void> {
    if (!rateLimiter.allow(userId)) {
      await bot.telegram.sendMessage(
        chatId,
        "Too many search requests. Please wait a moment and try again."
      );
      return;
    }

    try {
      const response = await searchYouTube(
        query,
        config.resultLimit,
        config.invidiousBaseUrls,
        config.requestTimeoutMs
      );

      await sendSearchResults(chatId, response.query, response.results, bot, sessionStore);
    } catch (error) {
      if (error instanceof SearchBackendError) {
        console.error("Search backend failure", error.details.join(" | "));
        await bot.telegram.sendMessage(
          chatId,
          "Search backend is blocked right now (provider returned 403/failed). Please try again later."
        );
        return;
      }

      console.error("Search error", error);
      await bot.telegram.sendMessage(chatId, "Search failed. Please try again in a bit.");
    }
  }

  bot.start(async (ctx) => {
    await ctx.reply(
      [
        "Send /search <query> or just type your query.",
        "I will show YouTube video results with thumbnails.",
        "Select one result and I will prepare a handoff to @MegaSaverBot."
      ].join("\n")
    );
  });

  bot.command("search", async (ctx) => {
    const text = "text" in ctx.message ? ctx.message.text : "";
    const query = extractQueryFromCommand(text);

    if (!query) {
      await ctx.reply("Usage: /search <keywords>");
      return;
    }

    await handleQuery(ctx.chat.id, ctx.from.id, query);
  });

  bot.on("text", async (ctx) => {
    const text = ctx.message.text.trim();

    if (!text || text.startsWith("/")) {
      return;
    }

    await handleQuery(ctx.chat.id, ctx.from.id, text);
  });

  bot.on("callback_query", async (ctx) => {
    const data = "data" in ctx.callbackQuery ? ctx.callbackQuery.data : "";

    if (!data.startsWith("pick:")) {
      return;
    }

    const [, sessionId, indexRaw] = data.split(":");
    const index = Number(indexRaw);
    const results = sessionStore.get(sessionId);

    if (!results || Number.isNaN(index) || index < 0 || index >= results.length) {
      await ctx.answerCbQuery("This result expired. Please search again.", { show_alert: true });
      return;
    }

    const selected = results[index];

    await ctx.answerCbQuery("Selected");
    await ctx.reply(
      [
        `Selected: ${selected.title}`,
        "Open MegaSaver and send this URL:",
        selected.url
      ].join("\n"),
      Markup.inlineKeyboard([
        Markup.button.url("Open @MegaSaverBot", "https://t.me/MegaSaverBot")
      ])
    );
  });

  return bot;
}
