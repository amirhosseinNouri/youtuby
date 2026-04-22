import { describe, expect, test } from "bun:test";
import { normalizeInvidiousResults } from "../src/youtube-search.js";

describe("normalizeInvidiousResults", () => {
  test("filters and maps video results", () => {
    const output = normalizeInvidiousResults(
      "cats",
      [
        { type: "channel", title: "skip" },
        {
          type: "video",
          videoId: "abc123",
          title: "Funny Cats",
          author: "CatTV",
          publishedText: "2 weeks ago",
          lengthSeconds: 125,
          videoThumbnails: [
            { url: "https://img.example/large.jpg", width: 640 },
            { url: "https://img.example/small.jpg", width: 120 }
          ]
        }
      ],
      10,
      "https://yewtu.be"
    );

    expect(output.results).toHaveLength(1);
    expect(output.results[0].url).toBe("https://www.youtube.com/watch?v=abc123");
    expect(output.results[0].thumbnailUrl).toBe("https://img.example/small.jpg");
    expect(output.results[0].duration).toBe("2:05");
  });
});
