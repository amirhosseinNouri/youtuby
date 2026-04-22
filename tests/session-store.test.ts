import { describe, expect, test } from "bun:test";
import { SessionStore } from "../src/session-store.js";

describe("SessionStore", () => {
  test("returns stored value before expiry", () => {
    const store = new SessionStore<string>(1000);
    store.set("a", "value");

    expect(store.get("a")).toBe("value");
  });

  test("expires values", async () => {
    const store = new SessionStore<string>(50);
    store.set("a", "value");

    await new Promise((resolve) => setTimeout(resolve, 80));

    expect(store.get("a")).toBeUndefined();
  });
});
