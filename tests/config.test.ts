import { describe, expect, test } from "bun:test";
import { parseConfig } from "../src/config.js";

describe("parseConfig", () => {
  test("applies defaults", () => {
    const config = parseConfig({
      BOT_TOKEN: "token"
    });

    expect(config.botToken).toBe("token");
    expect(config.resultLimit).toBe(10);
    expect(config.requestTimeoutMs).toBe(20000);
    expect(config.sessionTtlSec).toBe(600);
    expect(config.rateLimitWindowSec).toBe(60);
    expect(config.rateLimitMaxRequests).toBe(6);
  });

  test("coerces numeric env values", () => {
    const config = parseConfig({
      BOT_TOKEN: "token",
      RESULT_LIMIT: "5",
      REQUEST_TIMEOUT_MS: "15000"
    });

    expect(config.resultLimit).toBe(5);
    expect(config.requestTimeoutMs).toBe(15000);
  });

  test("throws when required values are missing", () => {
    expect(() => parseConfig({})).toThrow();
  });
});
