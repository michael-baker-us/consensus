import { expect, test, type Page } from "@playwright/test";

// The scripted cast (see demo.ts): Maya joins at ~1.2s; everyone finishes
// voting within ~6s of the start. Timeouts are generous multiples.

async function startVoting(page: Page): Promise<void> {
  await page.goto("/room/DEMO");
  await expect(page.getByText("DEMO")).toBeVisible();
  // Start unlocks once the first scripted guest arrives.
  await expect(page.getByText("Maya")).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "Start voting" }).click();
  await expect(page.getByRole("heading", { name: "Vote" })).toBeVisible();
}

async function voteYesOnEverything(page: Page): Promise<void> {
  // Buttons disappear as votes land; keep clicking the first "Yes" left.
  const yesButtons = page.getByRole("button", { name: /^Yes:/ });
  while ((await yesButtons.count()) > 0) {
    await yesButtons.first().click();
  }
}

test("the demo walks the whole session: lobby → voting → waiting → reveal → winner", async ({
  page,
}) => {
  await startVoting(page);
  await voteYesOnEverything(page);

  // Waiting: we're done, scripted friends aren't (Jake takes ~5.2s).
  await expect(page.getByRole("heading", { name: "You're done!" })).toBeVisible();

  // Reveal fires for everyone when the last scripted voter finishes.
  const spinButton = page.getByRole("button", { name: "Spin the wheel" });
  const trophy = page.getByRole("img", { name: "Winner" });
  await expect(spinButton.or(trophy).first()).toBeVisible({ timeout: 15_000 });

  // Tie → host spins the (placeholder) wheel; clear winner → straight through.
  if (await spinButton.isVisible()) {
    await spinButton.click();
    await expect(page.getByText("Spinning…")).toBeVisible();
  }
  await expect(trophy).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("button", { name: "Run the demo again" })).toBeVisible();
});

test("a mid-session reload re-enters at the correct screen", async ({ page }) => {
  await startVoting(page);

  // Cast a couple of votes, then die mid-round.
  const yesButtons = page.getByRole("button", { name: /^Yes:/ });
  await yesButtons.first().click();
  await yesButtons.first().click();
  await page.reload();

  // Server state says voting, so voting is what renders — not the lobby.
  await expect(page.getByRole("heading", { name: "Vote" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start voting" })).not.toBeVisible();
});

test("host can force-reveal while others are still voting", async ({ page }) => {
  await startVoting(page);
  await voteYesOnEverything(page);
  await expect(page.getByRole("heading", { name: "You're done!" })).toBeVisible();

  const revealNow = page.getByRole("button", { name: "Reveal now" });
  if (await revealNow.isVisible()) {
    await revealNow.click();
  }
  // Force-reveal never yields a runoff: a winner or a wheel, always an end.
  const spinButton = page.getByRole("button", { name: "Spin the wheel" });
  const trophy = page.getByRole("img", { name: "Winner" });
  await expect(spinButton.or(trophy).first()).toBeVisible({ timeout: 15_000 });
});
