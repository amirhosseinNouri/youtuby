import { chromium, type Browser, type BrowserContext } from "playwright";
import type { SearchResponse, SearchResult } from "./types.js";

export class SearchBackendError extends Error {
  constructor(
    message: string,
    public readonly detail: string
  ) {
    super(message);
    this.name = "SearchBackendError";
  }
}

type YtTextNode = {
  runs?: Array<{ text?: unknown }>;
  simpleText?: unknown;
};

type YtVideoRenderer = {
  videoId?: unknown;
  title?: YtTextNode;
  longBylineText?: YtTextNode;
  ownerText?: YtTextNode;
  lengthText?: YtTextNode;
  publishedTimeText?: YtTextNode;
  viewCountText?: YtTextNode;
  shortViewCountText?: YtTextNode;
  descriptionSnippet?: YtTextNode;
  detailedMetadataSnippets?: Array<{ snippetText?: YtTextNode }>;
};

function firstText(node: YtTextNode | undefined): string | undefined {
  if (!node) {
    return undefined;
  }

  if (typeof node.simpleText === "string" && node.simpleText.length > 0) {
    return node.simpleText;
  }

  if (Array.isArray(node.runs)) {
    const parts: string[] = [];
    for (const run of node.runs) {
      if (run && typeof run.text === "string") {
        parts.push(run.text);
      }
    }
    const joined = parts.join("");
    if (joined.length > 0) {
      return joined;
    }
  }

  return undefined;
}

function collectVideoRenderers(root: unknown): YtVideoRenderer[] {
  const out: YtVideoRenderer[] = [];
  const seen = new WeakSet<object>();

  const walk = (node: unknown): void => {
    if (!node || typeof node !== "object") {
      return;
    }
    if (seen.has(node as object)) {
      return;
    }
    seen.add(node as object);

    if (Array.isArray(node)) {
      for (const item of node) {
        walk(item);
      }
      return;
    }

    const record = node as Record<string, unknown>;

    const renderer = record.videoRenderer;
    if (renderer && typeof renderer === "object") {
      out.push(renderer as YtVideoRenderer);
    }

    for (const key of Object.keys(record)) {
      walk(record[key]);
    }
  };

  walk(root);
  return out;
}

export function parseYtInitialData(
  query: string,
  data: unknown,
  limit: number
): SearchResponse {
  const videos = collectVideoRenderers(data);
  const results: SearchResult[] = [];
  const seenIds = new Set<string>();

  for (const v of videos) {
    if (typeof v.videoId !== "string" || v.videoId.length === 0) {
      continue;
    }
    if (seenIds.has(v.videoId)) {
      continue;
    }

    const title = firstText(v.title);
    if (!title) {
      continue;
    }

    const thumbnailUrl = `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`;

    const channel = firstText(v.longBylineText) ?? firstText(v.ownerText);
    const duration = firstText(v.lengthText);
    const publishedText = firstText(v.publishedTimeText);
    const viewCountText = firstText(v.viewCountText) ?? firstText(v.shortViewCountText);
    const description =
      firstText(v.descriptionSnippet) ??
      firstText(v.detailedMetadataSnippets?.[0]?.snippetText);

    seenIds.add(v.videoId);
    results.push({
      id: v.videoId,
      title,
      url: `https://www.youtube.com/watch?v=${v.videoId}`,
      thumbnailUrl,
      duration,
      channel,
      publishedText,
      viewCountText,
      description
    });

    if (results.length >= limit) {
      break;
    }
  }

  return { query, results };
}

export class YouTubeSearcher {
  private browser: Browser | null = null;
  private initPromise: Promise<void> | null = null;

  constructor(private readonly timeoutMs: number) {}

  async init(): Promise<void> {
    if (this.browser) {
      return;
    }

    if (!this.initPromise) {
      this.initPromise = chromium
        .launch({
          headless: true,
          args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu"
          ]
        })
        .then((browser) => {
          this.browser = browser;
        });
    }

    try {
      await this.initPromise;
    } finally {
      this.initPromise = null;
    }
  }

  async close(): Promise<void> {
    const browser = this.browser;
    this.browser = null;
    if (browser) {
      await browser.close().catch(() => {});
    }
  }

  async search(query: string, limit: number): Promise<SearchResponse> {
    await this.init();
    const browser = this.browser;
    if (!browser) {
      throw new SearchBackendError("Headless browser not initialized", "no-browser");
    }

    let context: BrowserContext | null = null;

    try {
      context = await browser.newContext({
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        locale: "en-US",
        viewport: { width: 1280, height: 800 }
      });

      await context.addCookies([
        { name: "CONSENT", value: "YES+1", domain: ".youtube.com", path: "/" },
        { name: "SOCS", value: "CAI", domain: ".youtube.com", path: "/" }
      ]);

      const page = await context.newPage();
      page.setDefaultTimeout(this.timeoutMs);
      page.setDefaultNavigationTimeout(this.timeoutMs);

      await page.route("**/*", (route) => {
        const type = route.request().resourceType();
        if (type === "image" || type === "media" || type === "font" || type === "stylesheet") {
          route.abort().catch(() => {});
          return;
        }
        route.continue().catch(() => {});
      });

      const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&hl=en&gl=US`;
      await page.goto(url, { waitUntil: "domcontentloaded" });

      const data = await page.evaluate(() => {
        const w = window as unknown as { ytInitialData?: unknown };
        return w.ytInitialData ?? null;
      });

      if (!data) {
        throw new SearchBackendError(
          "YouTube returned no search payload",
          "ytInitialData missing"
        );
      }

      return parseYtInitialData(query, data, limit);
    } catch (error) {
      if (error instanceof SearchBackendError) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new SearchBackendError("Headless browser search failed", message);
    } finally {
      if (context) {
        await context.close().catch(() => {});
      }
    }
  }
}
