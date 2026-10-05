# Tic Tac Toe · Minimax AI

Unbeatable Minimax AI tic-tac-toe with Google login, persistent scoring with **win-streak bonus**, game history replay, leaderboard, and server-side anti-cheat auditing.

Built on **Cloudflare Workers + D1 (SQLite)** backend with a **Firebase Authentication** (Google) frontend. No build step — vanilla JavaScript.

## Documentation

| Doc | Contents |
|---|---|
| [docs/SETUP.md](docs/SETUP.md) | Firebase Console setup, config, run locally step by step, troubleshooting |
| [docs/USERMANUAL.md](docs/USERMANUAL.md) | How to play, UI tabs, scoring, replay, leaderboard, API reference |
| [docs/WINSTREAK.md](docs/WINSTREAK.md) | Win-streak rules, where the logic lives, how to test it (manual + automated) |
| [docs/MINIMAX.md](docs/MINIMAX.md) | How the Minimax + alpha-beta AI works and how to verify it |
| [docs/DEPLOY.md](docs/DEPLOY.md) | Deploy to Cloudflare Workers (D1 + Firebase production domain) |

## Quick start

```bash
npm install
cp public/firebase-config.example.js public/firebase-config.js   # then fill in your Firebase keys
npm run db:setup      # create local D1 tables (once)
npm run dev           # http://localhost:8787
```

Open **http://localhost:8787** (opening `public/index.html` directly will not work — the Worker API and Firebase authorized origin require this URL).

> Full step-by-step with Firebase Console setup: [docs/SETUP.md](docs/SETUP.md)

## Requirements

- Node.js 20+ (tested with Node 24) and npm
- A Firebase project (free Spark plan is enough)
- For deployment: a Cloudflare account (free plan is enough)

## Project structure

```
├── public/
│   ├── index.html                  # entire frontend: UI + game logic + Minimax + auth
│   ├── firebase-config.js          # YOUR Firebase keys (gitignored)
│   └── firebase-config.example.js  # placeholder template
├── src/
│   └── index.js                    # Cloudflare Worker: auth verify + JSON API + scoring
├── migrations/
│   └── 0001_init.sql               # users / scores / games tables
├── tests/
│   ├── applyResult.test.js         # win-streak & scoring rules
│   └── validateGame.test.js        # anti-cheat game validation
├── wrangler.jsonc                  # Workers + D1 + env config
└── docs/                           # this documentation
```

## npm scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Start local dev server on http://localhost:8787 |
| `npm run db:setup` | Create tables in the **local** D1 database |
| `npm run db:setup:remote` | Create tables in the **production** D1 database |
| `npm run db:reset` | Drop and recreate local tables |
| `npm run db:show` | Print local scores + last 20 games |
| `npm test` | Run automated tests (vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run deploy` | Deploy Worker + assets to Cloudflare |

## Scoring rules

- Win **+1**, Loss **−1**, Draw **0**
- **+1 bonus every 3 consecutive wins** (3rd, 6th, 9th, … win in a row)
- Score never drops below **0**
- A loss or draw resets the win streak to **0**

Details and tests: [docs/WINSTREAK.md](docs/WINSTREAK.md)

## Security model

- Every `/api/*` call requires `Authorization: Bearer <Firebase ID token>`; the Worker verifies the token against Firebase identitytoolkit.
- The client reports a game result, but the **server replays the move log** (`validateGame`) and recomputes the real result — faked wins are rejected, so the score/streak can't be cheated.
- `computeAudit()` replays **all** stored games and compares against the `scores` table; the UI shows ✓/✗ consistency after every sync.
