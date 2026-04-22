export type SearchResult = {
  id: string;
  title: string;
  url: string;
  thumbnailUrl: string;
  duration?: string;
  channel?: string;
  publishedText?: string;
};

export type SearchResponse = {
  query: string;
  results: SearchResult[];
};

export type BotConfig = {
  botToken: string;
  invidiousBaseUrl: string;
  invidiousBaseUrls: string[];
  resultLimit: number;
  requestTimeoutMs: number;
  sessionTtlSec: number;
  rateLimitWindowSec: number;
  rateLimitMaxRequests: number;
};
