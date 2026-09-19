import { describe, it, expect } from 'vitest';
import { afterFailure, lockRemainingMs, CLEAN_STATE, MAX_ATTEMPTS, LOCKOUT_MS } from '../src/domain/lockout.js';

describe('MPIN lockout', () => {
  it('does not lock before the tenth wrong attempt', () => {
    let s = CLEAN_STATE;
    for (let i = 0; i < MAX_ATTEMPTS - 1; i++) s = afterFailure(s, 1000);
    expect(s.fails).toBe(MAX_ATTEMPTS - 1);
    expect(lockRemainingMs(s, 1000)).toBe(0);
  });

  it('locks for 60 seconds on the tenth wrong attempt, then counts afresh', () => {
    let s = CLEAN_STATE;
    for (let i = 0; i < MAX_ATTEMPTS; i++) s = afterFailure(s, 5000);
    expect(lockRemainingMs(s, 5000)).toBe(LOCKOUT_MS);
    expect(lockRemainingMs(s, 5000 + 30000)).toBe(30000);
    expect(lockRemainingMs(s, 5000 + LOCKOUT_MS)).toBe(0);
    expect(s.fails).toBe(0);
  });
});
