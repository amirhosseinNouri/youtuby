import axios from "axios";
import type { SearchResponse, SearchResult } from "./types.js";

type InvidiousThumb = {
  url?: unknown;
  width?: unknown;
  height?: unknown;
};

type InvidiousVideo = {
  type?: unknown;
  videoId?: unknown;
  title?: unknown;
  author?: unknown;
  publishedText?: unknown;
  lengthSeconds?: unknown;
  videoThumbnails?: unknown;
};

export class SearchBackendError extends Error {
  constructor(
    message: string,
    public readonly details: string[]
  ) {
    super(message);
    this.name = "SearchBackendError";
  }
}

function secondsToText(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  return `${m}:${String(s).padStart(2, "0")}`;
}

function pickSmallestThumbnail(thumbnails: InvidiousThumb[]): string | undefined {
  const valid = thumbnails
    .map((thumb) => {
      if (typeof thumb.url !== "string" || thumb.url.length === 0) {
        return undefined;
      }

      const width = typeof thumb.width === "number" ? thumb.width : Number.MAX_SAFE_INTEGER;
      return { url: thumb.url, width };
    })
    .filter((thumb): thumb is { url: string; width: number } => Boolean(thumb));

  valid.sort((a, b) => a.width - b.width);
  return valid[0]?.url;
}

function toAbsoluteUrl(url: string, baseUrl: string): string {
  try {
    return new URL(url, `${baseUrl}/`).toString();
  } catch {
    return url;
  }
}

export function normalizeInvidiousResults(
  query: string,
  rawItems: InvidiousVideo[],
  limit: number,
  baseUrl: string
): SearchResponse {
  const results: SearchResult[] = [];

  for (const item of rawItems) {
    if (item.type !== "video") {
      continue;
    }

    if (typeof item.videoId !== "string" || typeof item.title !== "string") {
      continue;
    }

    const thumbnails = Array.isArray(item.videoThumbnails)
      ? (item.videoThumbnails as InvidiousThumb[])
      : [];

    const rawThumbnailUrl =
      pickSmallestThumbnail(thumbnails) ?? `${baseUrl}/vi/${item.videoId}/default.jpg`;
    const thumbnailUrl = toAbsoluteUrl(rawThumbnailUrl, baseUrl);
    const lengthSeconds =
      typeof item.lengthSeconds === "number"
        ? item.lengthSeconds
        : typeof item.lengthSeconds === "string"
          ? Number(item.lengthSeconds)
          : undefined;

    results.push({
      id: item.videoId,
      title: item.title,
      url: `https://www.youtube.com/watch?v=${item.videoId}`,
      thumbnailUrl,
      duration:
        typeof lengthSeconds === "number" && Number.isFinite(lengthSeconds)
          ? secondsToText(lengthSeconds)
          : undefined,
      channel: typeof item.author === "string" ? item.author : undefined,
      publishedText: typeof item.publishedText === "string" ? item.publishedText : undefined
    });

    if (results.length >= limit) {
      break;
    }
  }

  return { query, results };
}

export async function searchYouTube(
  query: string,
  limit: number,
  baseUrls: string[],
  timeoutMs: number
): Promise<SearchResponse> {
  const errors: string[] = [];

  for (const baseUrl of baseUrls) {
    const url = `${baseUrl}/api/v1/search`;

    try {
      const response = await axios.get<InvidiousVideo[]>(url, {
        params: {
          q: query,
          type: "video",
          page: 1,
          sort_by: "relevance"
        },
        timeout: timeoutMs,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; YoutubyBot/1.0)",
          Accept: "application/json"
        }
      });

      return normalizeInvidiousResults(query, response.data ?? [], limit, baseUrl);
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status ?? "no_status";
        const code = error.code ?? "no_code";
        errors.push(`${baseUrl} -> status=${status}, code=${code}`);
      } else {
        errors.push(`${baseUrl} -> unknown_error`);
      }
    }
  }

  throw new SearchBackendError("All Invidious backends failed", errors);
}
