# User Manual

Tic-tac-toe against an **unbeatable Minimax AI**, with Google login, persistent scoring, win-streak bonuses, history replay, and a leaderboard.

UI language is **Thai**. This manual explains every screen.

## 1. Login

1. Open the app (locally: `http://localhost:8787`).
2. Click **เข้าสู่ระบบด้วย Google** ("Sign in with Google").
3. Choose a Google account in the popup and allow access.

Notes:

- There is no separate sign-up — the **first login automatically creates your account** on the server (`users` table upsert).
- Your session persists; closing the tab keeps you logged in.
- **ออกจากระบบ** button (top right) signs you out.
- Login errors appear in Thai under the button, e.g. popup blocked, unauthorized domain — see [SETUP.md troubleshooting](SETUP.md#7-troubleshooting).

## 2. Main screen — เล่น (Play)

```
Tic Tac Toe · Minimax AI
[avatar] Your Name            [ออกจากระบบ]
 เล่น | ประวัติ | อันดับ | ตรวจสอบ       ← tabs

 [ฉันเริ่มก่อน (X)] [AI เริ่มก่อน (AI = X)]   ← who moves first
 ┌───┬───┬───┐
 │   │   │   │   ← 3×3 board (click empty cells)
 ├───┼───┼───┤
 │   │   │   │
 ├───┼───┼───┤
 │   │   │   │
 └───┴───┴───┘
 ตาของคุณ (X)                                ← status line
 คะแนน 0 · ชนะ 0 · เสมอ 0 · แพ้ 0  ✓ คะแนนถูกต้อง
                              [▶ ดูซ้ำ] [เริ่มใหม่]
```

| Control | Action |
|---|---|
| **ฉันเริ่มก่อน (X)** | You play X and move first |
| **AI เริ่มก่อน (AI = X)** | AI plays X and moves first |
| Board cells | Click to place your mark (X or O) |
| **เริ่มใหม่** | Restart the current board (abandons the game — it is **not** saved) |
| **▶ ดูซ้ำ** | Reopen the replay of the game you just finished (appears after game over) |

Status line messages: `ตาของคุณ (X)` (your turn), `AI กำลังคิด...` (AI thinking, ~250 ms), `คุณชนะ!` / `AI ชนะ` / `เสมอ`.

Score line: `คะแนน {score} · ชนะ {w} · เสมอ {d} · แพ้ {l}` — see [WINSTREAK.md](WINSTREAK.md) for scoring rules.

Audit badge (next to the score):

- **✓ คะแนนถูกต้อง** — stored scores match a full replay of all your games
- **✗ คะแนนไม่ตรง** — inconsistency detected (should not happen; hover for details)

When a game ends it is **saved automatically** to the server (move log + result). The score is then replaced by the **server-computed** value — the client only shows it.

## 3. History — ประวัติ

- Lists your last 10 games (most recent first): result (คุณชนะ / AI ชนะ / เสมอ), who started, timestamp.
- **Click a row** to open the replay dialog.

## 4. Replay dialog

Controls:

| Button | Action |
|---|---|
| ⟲ | Back to first move |
| ◀ | Previous move |
| เล่น / หยุด | Autoplay / pause (700 ms per move) |
| ▶ | Next move |
| ✕ or Esc or click outside | Close |

The dialog shows the move counter, an **audit badge** recomputing the result from the move log (`✓` valid, `✗` invalid), and highlights the winning line.

## 5. Leaderboard — อันดับ

Top 10 players ordered by **score desc, wins desc**. Shows avatar/name and ชนะ/เสมอ/แพ้/score. Refreshes after every game and on tab open.

## 6. Admin audit — ตรวจสอบ

- Lists the **latest 50 games of all players** (move logs included).
- Each row is re-validated server-side: `✓ ปกติ` (ok), `✗ ผลไม่ตรง` (result mismatch), `✗ เดินผิดปกติ` (illegal moves).
- **Click a row** to replay any game.

This is the anti-cheat view — a client that lies about a result shows up here as `✗`.

## 7. API reference

All endpoints require `Authorization: Bearer <Firebase ID token>` and return JSON.

| Method | Path | Body / Query | Returns |
|---|---|---|---|
| POST | `/api/session` | — | `{profile, score, audit}` (upserts your user) |
| POST | `/api/game` | `{result:'w'\|'d'\|'l', human_first:0\|1, moves:[0..8]}` | `{score, audit}` (400 if moves invalid or result faked) |
| GET | `/api/history` | `?limit=1..50` (default 10) | `{games:[{id,result,human_first,moves,created_at}]}` |
| GET | `/api/score/audit` | — | `{games, scores, consistent, diff}` |
| GET | `/api/admin/games` | `?limit=1..200` (default 50) | all users' games with per-game `status` |
| GET | `/api/leaderboard` | — | `{top:[{name,photo,wins,draws,losses,score}]}` (top 10) |

Errors: `401 {error:'unauthorized'}` (missing/invalid token), `400 {error:...}` (`bad json`, `bad result`, `duplicate cell`, `illegal_moves`, `result_mismatch`, …), `404 {error:'not found'}`.

Cells are indexed `0..8` left-to-right, top-to-bottom:

```
0 1 2
3 4 5
6 7 8
```

## 8. Data & privacy

- Stored: Google uid, email, display name, photo URL, per-game move log + result, aggregated score/streak.
- Deleting local data: `npm run db:reset` (dev only). Production data lives in Cloudflare D1.
