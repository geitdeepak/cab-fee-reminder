// FR-12: ten wrong MPIN attempts impose a 60-second lockout. Nothing is ever
// wiped — losing the register is a bigger risk to this operator than someone
// guessing a PIN. Pure functions so the rule can be unit-tested.
export const MAX_ATTEMPTS = 10;
export const LOCKOUT_MS = 60 * 1000;
export const CLEAN_STATE = { fails: 0, lockedUntil: 0 };

export function lockRemainingMs(state, now) {
  return Math.max(0, (state.lockedUntil || 0) - now);
}

export function afterFailure(state, now) {
  const fails = (state.fails || 0) + 1;
  if (fails >= MAX_ATTEMPTS) return { fails: 0, lockedUntil: now + LOCKOUT_MS };
  return { fails, lockedUntil: state.lockedUntil || 0 };
}
