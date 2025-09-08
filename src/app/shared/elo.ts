export type Outcome = 'white' | 'black' | 'draw';
export type TcKey = '5' | '10' | '20';
export type EloBlock = { rating: number; games: number };

export const ELO_FLOOR = 350; // rating floor

export function expectedScore(ra: number, rb: number, cap = 400) {
  const diff = Math.max(-cap, Math.min(cap, rb - ra));
  return 1 / (1 + Math.pow(10, diff / 400));
}

export function kFactor(games: number, rating: number) {
  if (games < 20) return 40;
  if (rating >= 2000) return 16;
  return 24;
}

/**
 * Elo with a rating floor. Deltas reflect the clamped result.
 */
export function applyElo(
  ra: number,
  rb: number,
  outcome: Outcome,
  ka: number,
  kb: number,
  floor = ELO_FLOOR
) {
  const Ea = expectedScore(ra, rb);
  const Sa = outcome === 'white' ? 1 : outcome === 'draw' ? 0.5 : 0;

  // raw deltas
  let deltaA = ka * (Sa - Ea);
  let deltaB = -deltaA * (ka / kb);

  // tentative ratings
  let newA = ra + deltaA;
  let newB = rb + deltaB;

  // clamp to floor
  if (newA < floor) newA = floor;
  if (newB < floor) newB = floor;

  // recompute deltas to match applied ratings
  deltaA = newA - ra;
  deltaB = newB - rb;

  return { newA, newB, Ea, Eb: 1 - Ea, deltaA, deltaB };
}
