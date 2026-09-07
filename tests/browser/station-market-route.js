import { expect } from '@playwright/test';

/** Extend an actual controller/touch terminal journey after opening Trade. The
 * caller supplies real D-pad/A activation or locator.tap(), never nav mutators.
 * Start with an empty Nomad grid. This helper does not claim an approach. */
export async function verifyStationMarketTrade({ page, activate, screenshotPath }) {
  const state = () => page.evaluate(() => window.starAgent.state.trading);
  const before = await state(), marketId = before.marketTerminals[before.terminal];
  expect(marketId).toBe('aeon-orbital');
  const ship = before.ships.find(candidate => candidate.owner === before.owner && candidate.hull === 'nomad');
  expect(ship).toBeTruthy(); expect(ship.crates).toEqual([]);
  const originalIds = new Set(ship.crates.map(crate => crate.id));
  const stock = before.markets[marketId].stock.basalt, credits = before.account.credits;
  const quoteCredits = async key => {
    const text = await page.locator(`[data-controller-key="${key}"]`).textContent();
    expect(text).toMatch(/· \d+ CR$/);
    return Number(text.match(/· (\d+) CR$/)[1]);
  };
  const fit = async () => {
    const overflow = await page.locator('#trading-dialog').evaluate(dialog => {
      const rect = dialog.getBoundingClientRect(), content = dialog.querySelector('.gameplay-content') ?? dialog;
      return { horizontal: content.scrollWidth - content.clientWidth, vertical: content.scrollHeight - content.clientHeight,
        clipped: [...dialog.querySelectorAll('button')].filter(button => button.getClientRects().length).filter(button => {
          const box = button.getBoundingClientRect();
          return box.left < rect.left - 2 || box.right > rect.right + 2 || box.top < rect.top - 2 || box.bottom > rect.bottom + 2;
        }).map(button => button.textContent) };
    });
    expect(overflow.horizontal).toBeLessThanOrEqual(2); expect(overflow.vertical).toBeLessThanOrEqual(2);
    expect(overflow.clipped).toEqual([]);
  };
  await activate('view-buy'); await activate('size-2');
  await expect(page.locator('[data-market-resource="basalt"]')).toContainText(`Station stock ${stock} / 4096 SBU`);
  const ask = await quoteCredits('purchase-basalt'); await fit();
  if (screenshotPath) await page.screenshot({ path: screenshotPath.replace('.png', '-buy.png') });
  await activate('purchase-basalt');
  await expect.poll(async () => (await state()).markets[marketId].stock.basalt).toBe(stock - 2);
  const bought = await state(), crate = bought.ships.find(candidate => candidate.id === ship.id).crates.find(candidate => !originalIds.has(candidate.id));
  expect(crate.sbu).toBe(2); expect(crate.resource).toBe('basalt'); expect(bought.account.credits).toBe(credits - ask);
  await activate('view-cargo'); const sellKey = `sell-${crate.id}`;
  const bid = await quoteCredits(sellKey); expect(bid).toBeGreaterThan(0); expect(bid).toBeLessThan(ask);
  await fit(); if (screenshotPath) await page.screenshot({ path: screenshotPath.replace('.png', '-sell.png') });
  await activate(sellKey);
  await expect.poll(async () => (await state()).markets[marketId].stock.basalt).toBe(stock);
  const after = await state(); expect(after.account.credits).toBe(credits - ask + bid);
  expect(after.ships.find(candidate => candidate.id === ship.id).crates).toEqual(ship.crates);
  await activate('view-buy'); await activate('size-1');
  return { marketId, terminal: before.terminal, stock, ask, bid, loss: ask - bid, creditsBefore: credits, creditsAfter: after.account.credits };
}
