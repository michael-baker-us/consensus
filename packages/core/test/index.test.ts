import { describe, expect, it } from "vitest";

import { assertNever } from "../src/index.ts";

describe("assertNever", () => {
  it("throws on values that should be unreachable", () => {
    expect(() => assertNever("surprise" as never)).toThrow(/surprise/);
  });
});
