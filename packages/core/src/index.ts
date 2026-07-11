// @consensus/core — pure domain logic. Zero runtime dependencies, by rule
// (docs/04). Domain types, scoring, and the state machine arrive in M1.

/** Exhaustiveness guard for discriminated unions. */
export function assertNever(value: never): never {
  throw new Error(`Unhandled variant: ${JSON.stringify(value)}`);
}
