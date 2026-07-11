// Domain types — the shapes shared by the UI, the fake backend, and the
// mapping layer over Supabase (docs/04). Pure data, no behavior.

/** One votable option. `details` is a discriminated union: adding a new
 * category (docs/01 decision #8) means adding a variant, and the compiler
 * flags every switch that needs a decision. */
export type DecisionItem = {
  id: string; // provider-scoped, e.g. "tmdb:603"
  title: string;
  subtitle?: string; // "2024 · 2h 46m"
  imageUrl?: string;
  details: ItemDetails;
};

export type ItemDetails = { kind: "movie" } & MovieDetails;

export type MovieDetails = {
  year?: number;
  runtimeMinutes?: number;
  genres: string[];
  rating?: number; // TMDb 0–10
  synopsis?: string;
  watchProviderIds: string[];
};

export type VoteChoice = "yes" | "no" | "favorite";

export type Vote = {
  participantId: string;
  itemId: string;
  choice: VoteChoice;
};

export type Participant = {
  id: string;
  displayName: string;
  finished: boolean;
};

export type SessionStatus = "lobby" | "voting" | "runoff" | "reveal" | "resolved" | "abandoned";

export type StreamingService = {
  id: string;
  name: string;
  logoUrl?: string;
};

export type DeckFilters = {
  watchProviderIds: string[];
  genreIds: string[];
  era?: "2020s" | "2010s" | "2000s" | "classics";
  maxRuntimeMinutes?: number;
};

export type RoomConfig = {
  category: "movie";
  filters: DeckFilters;
  deckSize: number;
};

export type Room = {
  id: string;
  code: string; // 6-char join code
  hostId: string;
  status: SessionStatus;
  /** 0 for the initial vote; increments per runoff. */
  round: number;
  config: RoomConfig;
  /** Set when the decision is final — by scoring (clear winner) or by the
   * wheel (resolveTie). */
  winnerItemId?: string;
};

/** Per-item tally for one round, exposed for the reveal leaderboard. */
export type ItemScore = {
  itemId: string;
  score: number;
  yesCount: number;
  favoriteCount: number;
  noCount: number;
};

export type RoundOutcome =
  | { kind: "winner"; itemId: string }
  | { kind: "tie"; itemIds: string[] } // resolved by the wheel
  | { kind: "runoff"; itemIds: string[] }; // vote again on this mini-deck

export type RoundResults = {
  /** Ranked: score descending, deck order breaking ties. */
  scores: ItemScore[];
  /** Items every active participant approved (yes or favorite). */
  unanimousItemIds: string[];
  outcome: RoundOutcome;
};

/** The one type the UI renders from (docs/04). */
export type SessionSnapshot = {
  room: Room;
  participants: Participant[];
  deck: DecisionItem[];
  results: RoundResults | null; // null until reveal
};

/** Host's flick, broadcast so every client replays the identical spin. */
export type WheelSpin = {
  seed: number;
  velocity: number;
  startedAtMs: number;
};
