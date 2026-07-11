import type { DecisionItem } from "@consensus/core";

// Invented movies: no TMDb dependency, no rights questions, and obviously
// fake in screenshots. Real fixture posters/details arrive in M3.
const TITLES = [
  ["The Midnight Heist", "2023 · Thriller"],
  ["Paper Lanterns", "2021 · Drama"],
  ["Gravity's Edge", "2024 · Sci-Fi"],
  ["The Last Diner on Route 9", "2019 · Indie"],
  ["Copper & Wine", "2022 · Romance"],
  ["Static", "2020 · Horror"],
  ["The Umbrella Committee", "2023 · Comedy"],
  ["North of Nowhere", "2018 · Adventure"],
  ["Glass Harbor", "2024 · Mystery"],
  ["Second Sunrise", "2021 · Sci-Fi"],
  ["The Long Thursday", "2017 · Crime"],
  ["Marigold City", "2022 · Animation"],
  ["Echo Park Sessions", "2020 · Music"],
  ["The Cartographer's Daughter", "2023 · Drama"],
  ["Runaway Renaissance", "2019 · Comedy"],
] as const;

export function demoDeck(size: number): DecisionItem[] {
  return TITLES.slice(0, Math.max(1, Math.min(size, TITLES.length))).map(
    ([title, subtitle], i) => ({
      id: `demo:${i + 1}`,
      title,
      subtitle,
      details: { kind: "movie", genres: [], watchProviderIds: [] },
    }),
  );
}
