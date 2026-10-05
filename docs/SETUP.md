# Setup & Run Locally — Step by Step

## 1. Prerequisites

| Tool | Version | Check |
|---|---|---|
| Node.js | 20+ (tested with 24) | `node -v` |
| npm | 10+ | `npm -v` |
| Firebase project | free Spark plan | https://console.firebase.google.com |
| Cloudflare account | only needed for deploy | https://dash.cloudflare.com |

## 2. Install the project

```bash
git clone git@github.com:pitsanubomb/Tic-Tac-Toe.git
cd tic-tac-toe
npm install
```

This installs `wrangler` (local server + D1 + deploy) and `vitest` (tests). There is no build step.

## 3. Create the Firebase project (one-time)

1. Go to [Firebase Console](https://console.firebase.google.com) → **Add project** → name it (e.g. `poc-tic`) → continue (Analytics optional/off).
2. **Enable Google sign-in:**
   - Build → **Authentication** → Get started → **Sign-in method** tab → **Google** → Enable → Save.
3. **Register a web app:**
   - Project overview → `</>` (Web) → app nickname → **Register app** → copy the `firebaseConfig` object (do **not** tick "Firebase Hosting" — this app runs on Cloudflare).
4. **Add `localhost` as an authorized domain** (required for local login):
   - Authentication → **Authorized domains** → **Add domain** → `localhost`
   - Also add `127.0.0.1` if you open the app via `http://127.0.0.1:8787`.

> Missing any of these shows Thai errors on the login screen — see [Troubleshooting](#7-troubleshooting).

## 4. Create `public/firebase-config.js`

```bash
cp public/firebase-config.example.js public/firebase-config.js
```

Open `public/firebase-config.js` and paste your real values:

```js
export const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef"
};
```

- This file is **gitignored** — never commit real keys.
- `public/firebase-config.js` missing or still containing `YOUR_...` placeholders → the login screen shows an error and blocks sign-in (`public/index.html:1188-1195`).

## 5. Create the local database

```bash
npm run db:setup
```

Creates three tables in the **local** D1 (SQLite) database under `.wrangler/state/`:

- `users` — profile from Firebase (uid, email, name, photo)
- `scores` — wins, draws, losses, **score**, **streak**
- `games` — every game's result + move log

Verify:

```bash
npm run db:show
```

## 6. Run the dev server

```bash
npm run dev
```

Output:

```
Ready on http://localhost:8787
```

Open **http://localhost:8787** in your browser:

1. Click **เข้าสู่ระบบด้วย Google** → choose a Google account → allow popup.
2. You land on the **เล่น** tab — pick who starts and play.

Notes:

- Must be opened via `http://localhost:8787` — the API (`/api/*`) and Firebase authorized origin don't exist for `file://`.
- Editing `public/index.html` or `src/index.js` hot-reloads automatically (Wrangler watches files).
- Stop the server with `Ctrl+C`. Local data persists between runs (in `.wrangler/state/`).

Reset local data any time:

```bash
npm run db:reset
```

## 7. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| "ไม่พบ firebase-config.js" (config file not found) | File missing | Run step 4: `cp public/firebase-config.example.js public/firebase-config.js` |
| "firebase-config.js ยังเป็นค่าตัวอย่าง" (still example values) | Placeholders not replaced | Fill real Firebase values (step 4) |
| `auth/unauthorized-domain` | Domain not allowed in Firebase | Add `localhost` to Authentication → Authorized domains (step 3.4) |
| `auth/operation-not-allowed` or `auth/configuration-not-found` | Google provider off | Enable Google in Authentication → Sign-in method (step 3.2) |
| `auth/invalid-api-key` | Wrong `apiKey` in config | Re-copy from Firebase project settings (step 3.3/4) |
| `auth/popup-blocked` | Browser blocked the login popup | Allow popups for `localhost` and retry |
| `auth/network-request-failed` | Network/proxy issue | Check internet connection or VPN/proxy |
| Login works but score sync fails (`ซิงก์คะแนนไม่สำเร็จ`) / API returns 401 | `FIREBASE_API_KEY` var missing or wrong in `wrangler.jsonc` | Confirm `vars.FIREBASE_API_KEY` exists (see `wrangler.jsonc:19`); restart `npm run dev` |
| `token verify failed: HTTP 400` in terminal | Same as above — API key mismatch | Same fix; restart dev server |
| `no such table: users` when playing | Local DB not initialized | `npm run db:setup` |
| Page loads but API 404 | Not served through Wrangler | Open via `npm run dev` at `http://localhost:8787`, not the file directly |

## Next steps

- Play + UI guide: [USERMANUAL.md](USERMANUAL.md)
- Scoring / win-streak testing: [WINSTREAK.md](WINSTREAK.md)
- AI behavior: [MINIMAX.md](MINIMAX.md)
- Production deploy: [DEPLOY.md](DEPLOY.md)
