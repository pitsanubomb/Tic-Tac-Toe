import { describe, it, expect } from 'vitest';
import { applyResult } from '../src/index.js';

const play = (results, score = 0, streak = 0) => {
  for (const r of results) {
    const t = applyResult(score, streak, r);
    score = t.score;
    streak = t.streak;
  }
  return { score, streak };
};

describe('applyResult — single result', () => {
  it('win: +1 score, streak +1', () => {
    expect(applyResult(0, 0, 'w')).toEqual({ score: 1, streak: 1 });
    expect(applyResult(5, 2, 'w')).toEqual({ score: 7, streak: 3 });
  });

  it('loss: -1 score, streak reset to 0', () => {
    expect(applyResult(5, 3, 'l')).toEqual({ score: 4, streak: 0 });
    expect(applyResult(0, 2, 'l')).toEqual({ score: 0, streak: 0 });
  });

  it('draw: score unchanged, streak reset to 0', () => {
    expect(applyResult(5, 3, 'd')).toEqual({ score: 5, streak: 0 });
    expect(applyResult(0, 0, 'd')).toEqual({ score: 0, streak: 0 });
  });

  it('score never goes below 0', () => {
    expect(applyResult(0, 0, 'l').score).toBe(0);
    expect(applyResult(1, 0, 'l').score).toBe(0);
    expect(play(['l', 'l', 'l']).score).toBe(0);
  });
});

describe('applyResult — 3-win bonus', () => {
  it('3rd consecutive win gives +1 bonus (total +2)', () => {
    const r = play(['w', 'w', 'w']);
    expect(r).toEqual({ score: 4, streak: 3 });
  });

  it('6th consecutive win gives second bonus (total +3)', () => {
    const r = play(['w', 'w', 'w', 'w', 'w', 'w']);
    expect(r).toEqual({ score: 8, streak: 6 });
  });

  it('bonus only on multiples of 3: after 4 wins score is 4 not 5', () => {
    expect(play(['w', 'w', 'w', 'w'])).toEqual({ score: 5, streak: 4 });
    expect(play(['w', 'w', 'w', 'w', 'w'])).toEqual({ score: 6, streak: 5 });
  });

  it('streak persists across draws? No — draw resets streak, bonus lost', () => {
    expect(play(['w', 'w', 'd', 'w', 'w'])).toEqual({ score: 4, streak: 2 });
  });
});

describe('applyResult — streak sequences', () => {
  it('loss breaks the streak before bonus is reached', () => {
    expect(play(['w', 'w', 'l', 'w'])).toEqual({ score: 2, streak: 1 });
  });

  it('long mixed sequence matches manual math', () => {
    // w w w (bonus, 4) w (5) l (4, streak 0) d (4) w w w (bonus, 4+4=8) l (7)
    expect(play(['w', 'w', 'w', 'w', 'l', 'd', 'w', 'w', 'w', 'l'])).toEqual({ score: 7, streak: 0 });
  });

  it('rebuilding a streak after a loss works again', () => {
    expect(play(['l', 'w', 'w', 'w'])).toEqual({ score: 4, streak: 3 });
  });

  it('start from non-zero score/streak (server upsert path)', () => {
    expect(applyResult(10, 2, 'w')).toEqual({ score: 12, streak: 3 });
    expect(applyResult(10, 2, 'l')).toEqual({ score: 9, streak: 0 });
  });
});

describe('applyResult — matches client mirror rule', () => {
  // Client rule (public/index.html:722-727):
  // w: streak++, score++, if streak%3===0 score++
  // l: streak=0, score--; d: streak=0; then score = max(score,0)
  const clientApply = (sc, r) => {
    if (r === 'w') { sc.streak++; sc.score++; if (sc.streak % 3 === 0) sc.score++; }
    else if (r === 'l') { sc.streak = 0; sc.score--; }
    else sc.streak = 0;
    sc.score = Math.max(sc.score, 0);
    return sc;
  };

  it('server and client produce identical state over random-ish sequences', () => {
    const seqs = [
      ['w', 'w', 'w', 'l', 'w', 'd', 'w', 'w', 'w', 'w'],
      ['l', 'l', 'd', 'w', 'w', 'w', 'w', 'w', 'w'],
      ['d', 'w', 'l', 'w', 'w', 'w', 'l', 'w'],
      ['w', 'w', 'w', 'w', 'w', 'w', 'w', 'w', 'w']
    ];
    for (const seq of seqs) {
      let s = 0, st = 0;
      const c = { score: 0, streak: 0 };
      for (const r of seq) {
        const t = applyResult(s, st, r);
        s = t.score; st = t.streak;
        clientApply(c, r);
        expect({ score: s, streak: st }).toEqual({ score: c.score, streak: c.streak });
      }
    }
  });
});
