// @consensus/core — pure domain logic. Zero runtime dependencies, by rule
// (docs/04).

export * from "./types.ts";
export { SCORING, scoreRound, type ScoreRoundInput } from "./scoring.ts";

/** Exhaustiveness guard for discriminated unions. */
export function assertNever(value: never): never {
  throw new Error(`Unhandled variant: ${JSON.stringify(value)}`);
}
