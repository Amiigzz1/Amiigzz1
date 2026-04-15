/**
 * Majlis coin packages (prices anchored to the USD side of Tap; final
 * local-currency breakdown is resolved at checkout by the provider).
 *
 * Tier strategy:
 *   - Entry price points ($0.99, $4.99, $9.99) to qualify as IAP
 *     "consumables" on Apple/Google without friction.
 *   - Bonus coins scale with purchase amount — classic retention lever.
 */
export interface CoinPackage {
  id: string;
  coins: bigint;
  bonusCoins: bigint;
  priceUsd: string; // kept as string so we never lose precision.
  currency: 'USD';
}

export const COIN_PACKAGES: readonly CoinPackage[] = [
  { id: 'starter',   coins: 100n,     bonusCoins: 0n,       priceUsd: '0.99',  currency: 'USD' },
  { id: 'small',     coins: 500n,     bonusCoins: 50n,      priceUsd: '4.99',  currency: 'USD' },
  { id: 'medium',    coins: 1_100n,   bonusCoins: 150n,     priceUsd: '9.99',  currency: 'USD' },
  { id: 'large',     coins: 2_500n,   bonusCoins: 500n,     priceUsd: '19.99', currency: 'USD' },
  { id: 'huge',      coins: 6_000n,   bonusCoins: 1_500n,   priceUsd: '49.99', currency: 'USD' },
  { id: 'whale',     coins: 15_000n,  bonusCoins: 5_000n,   priceUsd: '99.99', currency: 'USD' },
];

export function findPackage(id: string): CoinPackage | undefined {
  return COIN_PACKAGES.find((p) => p.id === id);
}
