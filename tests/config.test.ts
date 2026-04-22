import { describe, expect, test } from "bun:test";
import { parseConfig } from "../src/config.js";

describe("parseConfig", () => {
  test("applies defaults and trims trailing slash", () => {
    const config = parseConfig({
      BOT_TOKEN: "token",
      INVIDIOUS_BASE_URL: "https://yewtu.be/"
    });

    expect(config.resultLimit).toBe(10);
    expect(config.invidiousBaseUrl).toBe("https://yewtu.be");
  });

  test("throws when required values are missing", () => {
    expect(() => parseConfig({ INVIDIOUS_BASE_URL: "https://yewtu.be" })).toThrow();
  });
});
