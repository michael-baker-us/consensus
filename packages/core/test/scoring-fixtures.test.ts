import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { scoreRound, type ScoreRoundInput } from "../src/scoring.ts";
import type { RoundResults } from "../src/types.ts";

// The shared parity suite (docs/04): these same files are asserted against
// the SQL scoring implementation in M6. If a rule changes, it changes here
// first, and both implementations follow.
type Fixture = {
  name: string;
  description: string;
  input: ScoreRoundInput;
  expected: RoundResults;
};

const dir = fileURLToPath(new URL("../../../fixtures/scoring/", import.meta.url));
const fixtures = readdirSync(dir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(readFileSync(dir + f, "utf8")) as Fixture);

describe("scoring parity fixtures", () => {
  it("found the suite", () => {
    expect(fixtures.length).toBeGreaterThan(0);
  });

  it.each(fixtures.map((f) => [f.name, f] as const))("%s", (_name, fixture) => {
    expect(scoreRound(fixture.input), fixture.description).toEqual(fixture.expected);
  });
});
