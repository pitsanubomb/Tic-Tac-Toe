# Win-Streak & Scoring — Guideline & Testing Guide

## 1. The rule

> **Win +1 · Loss −1 · Draw 0 · Bonus +1 every 3 consecutive wins · Score floors at 0.**

| Event | Streak | Score change |
|---|---|---|
| Win | `streak + 1` | `+1`, plus **+1 bonus** when the new streak is a multiple of 3 (3, 6, 9, …) |
| Loss | `streak = 0` | `−1` (not below 0) |
| Draw | `streak = 0` | `0` |

Worked example (`w`=win, `l`=loss, `d`=draw):

| Games | Streak | Score |
|---|---|---|
| start | 0 | 0 |
| `w` | 1 | 1 |
| `w` | 2 | 2 |
| `w` | 3 → **bonus** | **4** (1+1+1+1) |
| `w` | 4 | 5 |
| `l` | 0 | 4 |
| `w` `w` `w` | 3 → **bonus** | 8 (4+1+1+**2**) |

## 2. Where the logic lives

| Piece | Location |
|---|---|
| **Server rule (source of truth)** — `applyResult(score, streak, result)` | `src/index.js:61-73` |
| Applied on every saved game, then upserted to `scores` | `src/index.js:176-186` |
| Full replay of all games to re-check score — `computeAudit()` | `src/index.js:75-95` |
| **Client mirror** (optimistic UI update) | `public/index.html:722-727` |
| Client replaced by server value after each sync | `public/index.html:916, 928` |
| DB column `streak` in table `scores` | `migrations/0001_init.sql:16` |
| Streak shown in UI? | No — it only affects score; the score line shows `คะแนน · ชนะ · เสมอ · แพ้` |

Anti-cheat chain: client posts `{result, human_first, moves}` → server **replays the move log** (`validateGame`, `src/index.js:105-127`) → only a genuine result updates `scores.streak`. A faked win is rejected with `400 result_mismatch`, so **the streak cannot be cheated from the browser**.

## 3. How to test the win-streak

The AI is perfect — you normally **cannot win**, so win-path behavior is covered by automated tests (section 3.2) rather than by hand.

### 3.1 Manual testing (local)

You can still verify the whole pipeline with losses and draws:

```bash
npm run dev          # terminal 1
npm test             # terminal 2 — automated rule tests
```

Steps:

1. Log in, play a full game (you'll usually lose → score −1, or force draws), let it save.
2. Check raw data:

   ```bash
   npm run db:show
   ```

   Verify: `scores` row updates `losses/draws`, `score`, `streak` (streak should be `0` after any loss/draw); `games` got a new row with the move JSON.

3. Check server-side consistency:

   ```bash
   curl -s http://localhost:8787/api/score/audit -H "Authorization: Bearer <YOUR_ID_TOKEN>"
   ```

   (Get a token in DevTools → Network → any `/api/*` request → `Authorization` header.) Expect `"consistent": true`.

   Easier: in the app, look at the **✓ คะแนนถูกต้อง** badge next to the score — it runs the same audit after every game.

4. Check anti-cheat: open the **ตรวจสอบ** tab — every game must show `✓ ปกติ`.
5. Restart the server → log in again → score must be identical (persisted in D1, not in the browser).
6. Optional UI QA hooks (DevTools console):

   ```js
   window.dispatchEvent(new CustomEvent('qa:show'))            // fake login UI without auth
   window.dispatchEvent(new CustomEvent('replay:open', {detail: {result:'w', human_first:1, moves:[0,3,1,4,2]}}))
   ```

**Win-path manual test (optional):** temporarily weaken the AI (e.g. make `bestMove()` return a random cell in `public/index.html:697`), play 3+ wins in a row, confirm the score jumps by 2 on the 3rd win, then revert the change.

### 3.2 Automated testing (recommended)

```bash
npm test              # run once
npm run test:watch    # watch mode
```

Covers 25 tests in `tests/`:

**`tests/applyResult.test.js`** — the scoring rule itself:

- win/loss/draw single-result effects
- score floor at 0
- **3-win bonus** (3rd, 6th win) and absence of bonus on 4th/5th win
- streak reset by loss/draw, rebuild after loss
- mixed sequences checked against manual math
- **server `applyResult` vs. client mirror produce identical state** for many sequences

**`tests/validateGame.test.js`** — the anti-cheat that protects the streak:

- accepts real wins (human first/second), AI wins, draws
- rejects out-of-range / duplicate / moves-after-win / incomplete games
- **rejects a claimed win when the replay says loss or draw** (`result_mismatch`)

Why this matters: a faked result never reaches `applyResult`, so streak tests + validation tests together prove the score can't be gamed.

## 4. Known caveats

- The client updates its own score optimistically, then overwrites it with the server value — a brief flicker is normal.
- **เริ่มใหม่** (reset mid-game) discards the game entirely — no score change, no record.
- `GET /api/score/audit` exists but the UI receives the audit inside `/api/session` and `/api/game` responses instead.
- The streak value itself is not rendered anywhere in the UI — only its effect on score.
