import { describe, expect, test } from "bun:test";
import { parseYtInitialData } from "../src/youtube-search.js";

describe("parseYtInitialData", () => {
  test("extracts video renderers from ytInitialData", () => {
    const payload = {
      contents: {
        twoColumnSearchResultsRenderer: {
          primaryContents: {
            sectionListRenderer: {
              contents: [
                {
                  itemSectionRenderer: {
                    contents: [
                      {
                        videoRenderer: {
                          videoId: "abc123",
                          title: { runs: [{ text: "Funny Cats" }] },
                          longBylineText: { runs: [{ text: "CatTV" }] },
                          lengthText: { simpleText: "2:05" },
                          publishedTimeText: { simpleText: "2 weeks ago" },
                          thumbnail: {
                            thumbnails: [
                              { url: "https://img.example/large.jpg", width: 640 },
                              { url: "https://img.example/small.jpg", width: 120 }
                            ]
                          }
                        }
                      },
                      { adSlotRenderer: { foo: "bar" } }
                    ]
                  }
                }
              ]
            }
          }
        }
      }
    };

    const output = parseYtInitialData("cats", payload, 10);

    expect(output.results).toHaveLength(1);
    expect(output.results[0].id).toBe("abc123");
    expect(output.results[0].url).toBe("https://www.youtube.com/watch?v=abc123");
    expect(output.results[0].thumbnailUrl).toBe("https://i.ytimg.com/vi/abc123/hqdefault.jpg");
    expect(output.results[0].duration).toBe("2:05");
    expect(output.results[0].channel).toBe("CatTV");
    expect(output.results[0].publishedText).toBe("2 weeks ago");
  });

  test("respects the limit and de-duplicates video ids", () => {
    const payload = {
      items: [
        {
          videoRenderer: {
            videoId: "one",
            title: { runs: [{ text: "One" }] },
            thumbnail: { thumbnails: [{ url: "https://img/one.jpg", width: 100 }] }
          }
        },
        {
          videoRenderer: {
            videoId: "two",
            title: { runs: [{ text: "Two" }] },
            thumbnail: { thumbnails: [{ url: "https://img/two.jpg", width: 100 }] }
          }
        },
        {
          videoRenderer: {
            videoId: "one",
            title: { runs: [{ text: "One again" }] },
            thumbnail: { thumbnails: [{ url: "https://img/one-again.jpg", width: 100 }] }
          }
        },
        {
          videoRenderer: {
            videoId: "three",
            title: { runs: [{ text: "Three" }] },
            thumbnail: { thumbnails: [{ url: "https://img/three.jpg", width: 100 }] }
          }
        }
      ]
    };

    const output = parseYtInitialData("q", payload, 2);

    expect(output.results.map((r) => r.id)).toEqual(["one", "two"]);
  });

  test("falls back to a default thumbnail when none are provided", () => {
    const payload = {
      videoRenderer: {
        videoId: "xyz",
        title: { simpleText: "No Thumbs" }
      }
    };

    const output = parseYtInitialData("q", payload, 5);
    expect(output.results).toHaveLength(1);
    expect(output.results[0].thumbnailUrl).toBe("https://i.ytimg.com/vi/xyz/hqdefault.jpg");
  });
});
