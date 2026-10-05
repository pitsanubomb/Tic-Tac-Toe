import { describe, it, expect } from 'vitest';
import { validateGame } from '../src/index.js';

// Helpers to build move logs. Cells 0..8, rows: 0 1 2 / 3 4 5 / 6 7 8.
describe('validateGame — accepts legitimate games', () => {
  it('human win (human first, X takes top row)', () => {
    // X:0, O:3, X:1, O:4, X:2 -> X wins
    expect(validateGame([0, 3, 1, 4, 2], 1, 'w')).toBe('ok');
  });

  it('human win (human second, O takes a line)', () => {
    // AI(X):0, human(O):4, X:1, O:3, X:8, O:5 -> O: 3,4,5 wins
    expect(validateGame([0, 4, 1, 3, 8, 5], 0, 'w')).toBe('ok');
  });

  it('AI win (human first)', () => {
    // X:0, O:3, X:1, O:4, X:8, O:5 -> O: 3,4,5 wins
    expect(validateGame([0, 3, 1, 4, 8, 5], 1, 'l')).toBe('ok');
  });

  it('draw (full board, no line)', () => {
    // X O X / X O O / O X X
    expect(validateGame([0, 1, 2, 4, 3, 5, 7, 6, 8], 1, 'd')).toBe('ok');
  });
});

describe('validateGame — rejects illegal games', () => {
  it('out-of-range cell', () => {
    expect(validateGame([9], 1, 'w')).toBe('illegal_moves');
    expect(validateGame([-1], 1, 'w')).toBe('illegal_moves');
    expect(validateGame([0.5], 1, 'w')).toBe('illegal_moves');
  });

  it('duplicate cell', () => {
    expect(validateGame([0, 0], 1, 'w')).toBe('illegal_moves');
  });

  it('moves after a win', () => {
    expect(validateGame([0, 3, 1, 4, 2, 6], 1, 'w')).toBe('illegal_moves');
  });

  it('incomplete game (not full board, no winner)', () => {
    expect(validateGame([0, 4], 1, 'd')).toBe('illegal_moves');
  });
});

describe('validateGame — anti-cheat (result mismatch)', () => {
  it('claims win but board shows AI win', () => {
    // X:0, O:3, X:1, O:4, X:8, O:5 -> O wins; claimed 'w'
    expect(validateGame([0, 3, 1, 4, 8, 5], 1, 'w')).toBe('result_mismatch');
  });

  it('claims win but game is a draw', () => {
    expect(validateGame([0, 1, 2, 4, 3, 5, 7, 6, 8], 1, 'w')).toBe('result_mismatch');
  });

  it('claims loss but human actually wins', () => {
    expect(validateGame([0, 3, 1, 4, 2], 1, 'l')).toBe('result_mismatch');
  });

  it('a faked win cannot be stored — protects winstreak integrity', () => {
    // Player lost but submits a "win": server must reject, so score/streak never grow.
    const claimed = 'w';
    const actual = validateGame([0, 3, 1, 4, 8, 5], 1, claimed);
    expect(actual).toBe('result_mismatch');
  });
});
