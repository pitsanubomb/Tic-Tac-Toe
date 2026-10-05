# Minimax AI — How It Works & How to Test It

## 1. Overview

The AI plays **perfect tic-tac-toe** using **Minimax with alpha-beta pruning**. It never loses: best case for the human is a draw. There are **no difficulty levels** — the only player choice is who moves first.

All AI code is inline in `public/index.html` (first `<script>` block). No separate module, no server involvement — the server only stores and validates finished games.

## 2. The algorithm

### Win detection — `winner(s)` (`public/index.html:682`)

Checks the 8 winning triplets:

```
0 1 2   3 4 5   6 7 8   0 3 6   1 4 7   2 5 8   0 4 8   2 4 6
```

### Scoring — `minimax(s, turn, depth, alpha, beta)` (`public/index.html:684-696`)

| Terminal state | Score | Why |
|---|---|---|
| AI wins | `10 − depth` | **Lower depth (earlier win) scores higher** → AI prefers fast wins |
| Human wins | `depth − 10` | Closer losses score higher → AI delays losses as long as possible |
| Draw | `0` | Neutral |

- `turn === ai` → maximize, else minimize.
- **Alpha-beta pruning**: branches are cut when `beta <= alpha`, massively reducing the search (up to ~½ⁿ nodes).

Board is a 9-slot array of `null | 'X' | 'O'`; the search tries every empty cell, placing/removing marks recursively.

### Move selection — `bestMove()` (`public/index.html:697-706`)

1. For each empty cell: place AI mark, run `minimax` with a **full window** `-Infinity..Infinity`.
   > Why full window: alpha-beta makes scores of *sibling* root calls incomparable (pruned values are bounds, not exact) — using a full window at the root keeps every cell's score exact so ties are detected correctly. (Thai comment at `index.html:701`.)
2. Keep the maximum score; collect **all tied best moves**.
3. Pick **randomly among ties** (`mv[Math.floor(Math.random()*mv.length)]`) so games don't feel scripted.

### Game flow

| Function | Lines | Role |
|---|---|---|
| `aiTurn()` | 739-745 | Apply `bestMove()`, end game if terminal, else hand turn back |
| `play(i)` | 746-753 | Human click: guard state, apply mark, trigger AI after 250 ms (`sched`, generation-guarded by `gen`) |
| `start()` / `setOrder(f)` | 754-765 | Reset board; X/O assignment from who starts |
| `end()` | 728-737 | Determine result, update score, highlight winning line, POST game to server |

## 3. How to test the Minimax AI

### 3.1 Automated tests

There is no automated AI test (the AI lives inline in HTML). What *is* tested:

```bash
npm test
```

- `tests/validateGame.test.js` — every stored game's move log is replay-validated, so AI moves are confirmed legal (alternating turns, no duplicate cells, no moves after a win).
- Runtime validation also runs on the server for every saved game (`src/index.js:105-127`) and in the replay view (`computeGameResult`, `index.html:767`).

### 3.2 Manual verification checklist

Run `npm run dev`, open `http://localhost:8787`, log in, and verify:

1. **AI never loses.** Play 10+ games trying different openings. Expected: only **เสมอ (draw)** or **AI ชนะ (AI win)** — never คุณชนะ with a normally-playing AI.
2. **AI blocks immediate threats.** Create two-in-a-row with an open third cell → AI must block it on its next move.
3. **AI takes the win.** When AI has two-in-a-row, it must complete the line instead of blocking elsewhere.
4. **AI prefers fast wins / delays losses.** With a forced win it closes the game in the fewest moves (the `10 − depth` heuristic).
5. **AI reacts to both orders.** Test **ฉันเริ่มก่อน (X)** and **AI เริ่มก่อน (AI = X)** — with perfect play both should end in a draw if the human also plays perfectly.
6. **Variety among equal moves.** Opening repeatedly from the same position → AI's reply may differ (random tie-breaking at `index.html:705`).
7. **Timing.** AI responds after ~250 ms with `AI กำลังคิด...`; no double moves, no moves after game over.
8. **Replay integrity.** After games, open **ประวัติ** → click a row → the replay must reproduce exactly what happened; audit badge `✓`.

### 3.3 Adversarial / edge checks

- **Board full without winner** → `เสมอ` (draw) recorded, streak resets (see [WINSTREAK.md](WINSTREAK.md)).
- **Win on the last (9th) cell** → detected correctly.
- **Reset mid-game (`เริ่มใหม่`)** → no AI move leaks into the new board; old game is not saved.
- **Rapid clicking** → `aiThinking`/`over` guards (`index.html:746-747`) prevent moves while AI thinks or after game end.

## 4. Optional: make the AI beatable (for manual win-streak tests)

To test win-dependent UI/scoring by hand, temporarily weaken `bestMove()` in `public/index.html:697`:

```js
function bestMove() {
  const empty = [];
  for (let i = 0; i < 9; i++) if (!b[i]) empty.push(i);
  return empty[Math.floor(Math.random() * empty.length)]; // random AI — DEBUG ONLY
}
```

Play 3 wins in a row → confirm the +1 streak bonus (score +2 on the 3rd win) → **revert before committing**. The permanent win-path tests live in `tests/applyResult.test.js`.
