import { Telegraf, Markup } from "telegraf";
import type { InputMediaPhoto } from "telegraf/types";
import type { BotConfig, SearchResult } from "./types.js";
import { SearchBackendError, type YouTubeSearcher } from "./youtube-search.js";
import { SessionStore } from "./session-store.js";
import { UserRateLimiter } from "./rate-limit.js";

const TELEGRAM_CAPTION_LIMIT = 1024;
const PAGE_SIZE = 3;

type SearchSession = {
  query: string;
  results: SearchResult[];
  offset: number;
};

function makeSessionId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function compactText(input: string, maxLen: number): string {
  if (input.length <= maxLen) {
    return input;
  }
  return `${input.slice(0, maxLen - 1)}…`;
}

function formatResultCaption(result: SearchResult, index: number): string {
  const lines = [`${index + 1}. ${result.title}`];

  if (result.channel) {
    lines.push(`Channel: ${result.channel}`);
  }
  if (result.duration) {
    lines.push(`Duration: ${result.duration}`);
  }
  if (result.viewCountText) {
    lines.push(`Views: ${result.viewCountText}`);
  }
  if (result.publishedText) {
    lines.push(`Published: ${result.publishedText}`);
  }
  if (result.description) {
    lines.push("", result.description);
  }
  lines.push("", result.url);

  return compactText(lines.join("\n"), TELEGRAM_CAPTION_LIMIT);
}

async function sendPage(
  chatId: number,
  session: SearchSession,
  bot: Telegraf,
  sessionId: string
): Promise<void> {
  const slice = session.results.slice(session.offset, session.offset + PAGE_SIZE);

  if (slice.length === 0) {
    return;
  }

  const media: InputMediaPhoto[] = slice.map((result, i) => ({
    type: "photo",
    media: result.thumbnailUrl,
    caption: formatResultCaption(result, session.offset + i)
  }));

  try {
    await bot.telegram.sendMediaGroup(chatId, media);
  } catch {
    for (const [i, result] of slice.entries()) {
      const caption = formatResultCaption(result, session.offset + i);
      try {
        await bot.telegram.sendPhoto(chatId, result.thumbnailUrl, { caption });
      } catch {
        await bot.telegram.sendMessage(chatId, caption);
      }
    }
  }

  const hasMore = session.offset + slice.length < session.results.length;
  if (hasMore) {
    await bot.telegram.sendMessage(chatId, "Want more results?", {
      reply_markup: Markup.inlineKeyboard([
        Markup.button.callback("More", `more:${sessionId}`)
      ]).reply_markup
    });
  }
}

function extractQueryFromCommand(text: string): string {
  const parts = text.trim().split(/\s+/);
  parts.shift();
  return parts.join(" ").trim();
}

export function createBot(config: BotConfig, searcher: YouTubeSearcher): Telegraf {
  const bot = new Telegraf(config.botToken);
  const sessionStore = new SessionStore<SearchSession>(config.sessionTtlSec * 1000);
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

    const searchingMessage = await bot.telegram.sendMessage(chatId, "Searching...");

    try {
      const response = await searcher.search(query, config.resultLimit);

      if (response.results.length === 0) {
        await bot.telegram.sendMessage(chatId, `No results found for: ${query}`);
        return;
      }

      const sessionId = makeSessionId();
      const session: SearchSession = {
        query: response.query,
        results: response.results,
        offset: 0
      };
      sessionStore.set(sessionId, session);

      await bot.telegram.sendMessage(chatId, `Results for: ${response.query}`);
      await sendPage(chatId, session, bot, sessionId);
      session.offset += PAGE_SIZE;
      sessionStore.set(sessionId, session);
    } catch (error) {
      if (error instanceof SearchBackendError) {
        console.error("Search backend failure", error.detail);
        await bot.telegram.sendMessage(
          chatId,
          "Search failed — the headless browser could not fetch results. Please try again in a bit."
        );
        return;
      }

      console.error("Search error", error);
      await bot.telegram.sendMessage(chatId, "Search failed. Please try again in a bit.");
    } finally {
      try {
        await bot.telegram.deleteMessage(chatId, searchingMessage.message_id);
      } catch {
        // Ignore if message was already removed or can't be deleted.
      }
    }
  }

  bot.start(async (ctx) => {
    await ctx.reply(
      [
        "Send /search <query> or just type your query.",
        "I will reply with 3 YouTube results at a time, with thumbnails and full metadata.",
        "Tap More to fetch the next 3."
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

    if (!data.startsWith("more:")) {
      return;
    }

    const [, sessionId] = data.split(":");
    const session = sessionStore.get(sessionId);

    if (!session) {
      await ctx.answerCbQuery("This search expired. Please search again.", { show_alert: true });
      return;
    }

    if (session.offset >= session.results.length) {
      await ctx.answerCbQuery("No more results.");
      return;
    }

    await ctx.answerCbQuery();

    try {
      await ctx.editMessageReplyMarkup(undefined);
    } catch {
      // Ignore if the message can't be edited.
    }

    await sendPage(ctx.chat!.id, session, bot, sessionId);
    session.offset += PAGE_SIZE;
    sessionStore.set(sessionId, session);
  });

  return bot;
}
