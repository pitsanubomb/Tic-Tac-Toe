# Deploy to Cloudflare Workers

The app deploys as a single Cloudflare Worker: static assets from `public/` + `/api/*` handled by `src/index.js`, with **D1** as the production database.

Config file: `wrangler.jsonc`

```jsonc
{
  "name": "tic-tac-toe",
  "main": "src/index.js",
  "assets": { "directory": "./public", "run_worker_first": ["/api/*"] },
  "d1_databases": [{ "binding": "DB", "database_name": "DB", "database_id": "00000000-..." }],
  "vars": { "FIREBASE_PROJECT_ID": "poc-tic", "FIREBASE_API_KEY": "AIza..." }
}
```

## 0. Before you start

- A **Cloudflare account** (free plan is fine)
- Local project set up and working: [SETUP.md](SETUP.md)
- Run the test suite first: `npm test`

## 1. Log in to Wrangler

```bash
npx wrangler login
```

Opens a browser → Allow. Verify with `npx wrangler whoami`.

## 2. Create the production D1 database

```bash
npx wrangler d1 create DB
```

Output includes a real UUID, e.g.:

```
database_id = "f7b0c9e2-1234-4abc-9def-0123456789ab"
```

Copy it into `wrangler.jsonc` → `d1_databases[0].database_id`, replacing the `00000000-0000-0000-0000-000000000000` placeholder.

> Skipping this step → deploy fails or the Worker can't find the database.

## 3. Create production tables

```bash
npm run db:setup:remote
# = wrangler d1 execute DB --remote --file migrations/0001_init.sql
```

Verify:

```bash
npx wrangler d1 execute DB --remote --command "SELECT name FROM sqlite_master WHERE type='table';"
```

Expected: `users`, `scores`, `games`.

## 4. Deploy

```bash
npm run deploy
# = npx wrangler deploy
```

Output:

```
Deployed tic-tac-toe triggers
├── https://tic-tac-toe.<subdomain>.workers.dev
```

Open that URL — the app loads, login works, play a game, score saves.

## 5. Firebase production setup

1. **Add the Worker domain to Authorized domains:**
   - Firebase Console → Authentication → **Authorized domains** → **Add domain**
   - Add: `tic-tac-toe.<subdomain>.workers.dev`
   - (Custom domain too, if you attach one.)
2. Confirm `vars.FIREBASE_API_KEY` in `wrangler.jsonc` matches your Firebase project's Web API key (Project settings → General → Your apps).
3. Test login from the deployed URL.

## 6. Post-deploy checklist

- [ ] `npm test` passes before deploy
- [ ] `database_id` is the real UUID (not the `0000...` placeholder)
- [ ] Remote tables created (`db:setup:remote`)
- [ ] Worker URL opens and renders
- [ ] Google login works from the `workers.dev` domain
- [ ] Play one game → score updates and survives a page reload
- [ ] **ตรวจสอบ** tab shows `✓ ปกติ` for the new game
- [ ] Leaderboard shows your entry

## 7. Updating the app

```bash
npm test
npm run deploy
```

Static assets and Worker ship together. **Database schema changes** need a new migration file + manual apply:

```bash
npx wrangler d1 execute DB --remote --file migrations/0002_your_change.sql
```

> No CI/CD is configured — deploys are manual. Add a GitHub Action with `wrangler deploy` + `CLOUDFLARE_API_TOKEN` if you want auto-deploys.

## 8. Useful production commands

```bash
npx wrangler d1 execute DB --remote --command "SELECT * FROM scores ORDER BY score DESC LIMIT 10;"
npx wrangler d1 execute DB --remote --command "SELECT id, result, moves FROM games ORDER BY id DESC LIMIT 20;"
npx wrangler tail                                        # live Worker logs
npx wrangler d1 execute DB --remote --file - < reset.sql # destructive: reset (write your own SQL)
```

> Local scripts (`db:show`, `db:reset`) always target the **local** D1 only. For production data use `--remote` explicitly.

## 9. Troubleshooting

| Symptom | Fix |
|---|---|
| Deploy error about `database_id` | Run step 2 and paste the real UUID |
| `no such table` in production | Run step 3 (`db:setup:remote`) |
| `401 unauthorized` from API in prod | Wrong/missing `FIREBASE_API_KEY` in `wrangler.jsonc` → redeploy |
| Login error `auth/unauthorized-domain` | Step 5 — add the `workers.dev` domain in Firebase |
| Assets 404 after deploy | Confirm `assets.directory: "./public"` and re-run `npm run deploy` |
| Changes not visible | Hard-refresh (assets are cached) and confirm you deployed the right branch |

## 10. Tear down (optional)

```bash
npx wrangler d1 delete DB      # delete production database (irreversible)
npx wrangler delete            # remove the Worker
```
