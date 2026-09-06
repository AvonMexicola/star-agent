/** Mining skill records collected mineral mass, never trigger time or tool hits.
 * Call awardMiningXP only in the prospective transaction that accepts the cargo.
 * Fractional XP is retained so splitting a cut into tiny cuts gives the same XP.
 * Levels are informational in this slice: no yield multiplier or equipment gate.
 */
export const MINING_XP_PER_KG = 100;
export const MAX_MINING_LEVEL = 50;
const threshold = level => 500 * level * (level - 1);
export const MAX_MINING_XP = threshold(MAX_MINING_LEVEL);

export const defaultMiningProgression = () => ({ mining: { xp: 0 } });

export function validMiningProgression(progression) {
  const mining = progression?.mining;
  return Boolean(progression && typeof progression === 'object' && !Array.isArray(progression)
    && mining && typeof mining === 'object' && !Array.isArray(mining)
    && Number.isFinite(mining.xp) && mining.xp >= 0 && mining.xp <= MAX_MINING_XP);
}

export function awardMiningXP(progression, acceptedKg) {
  if (!validMiningProgression(progression)) throw new TypeError('Invalid mining progression.');
  if (!Number.isFinite(acceptedKg) || acceptedKg < 0) throw new TypeError('Accepted mining mass must be finite and nonnegative.');
  const xp = Math.min(MAX_MINING_XP, progression.mining.xp + acceptedKg * MINING_XP_PER_KG);
  if (xp === progression.mining.xp) return progression;
  return { ...progression, mining: { ...progression.mining, xp } };
}

/** UI snapshot: xp and nextLevelXP are cumulative; levelXP/requiredXP describe
 * this level's bar. At the final level the bar is full and nextLevelXP is null.
 */
export function miningSkill(progression) {
  if (!validMiningProgression(progression)) throw new TypeError('Invalid mining progression.');
  const xp = progression.mining.xp;
  let level = 1;
  while (level < MAX_MINING_LEVEL && xp >= threshold(level + 1)) level++;
  const atMaxLevel = level === MAX_MINING_LEVEL;
  const levelXP = xp - threshold(level);
  const requiredXP = atMaxLevel ? 0 : threshold(level + 1) - threshold(level);
  return { level, xp, levelXP, requiredXP, nextLevelXP: atMaxLevel ? null : threshold(level + 1),
    progress: atMaxLevel ? 1 : levelXP / requiredXP, atMaxLevel };
}
