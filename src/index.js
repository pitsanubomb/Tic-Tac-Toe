const PROJECT_ID = 'poc-tic';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}

function jwtPayload(jwt) {
  const p = jwt.split('.');
  if (p.length !== 3) return null;
  const b64 = p[1].replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0))))
}

async function verifyAuth(req, apiKey) {
  const m = (req.headers.get('Authorization') || '').match(/^Bearer (.+)$/);
  if (!m) return null;
  const jwt = m[1];
  try {
    const r = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + encodeURIComponent(apiKey), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: jwt })
    });
    if (!r.ok) {
      console.warn('token verify failed:', r.status, await r.text());
      return null;
    }
    const data = await r.json();
    const u = data && data.users && data.users[0];
    if (!u || !u.localId) {
      console.warn('token verify failed: no user in response');
      return null;
    }
    try {
      const claims = jwtPayload(jwt);
      if (!claims || claims.iss !== 'https://securetoken.google.com/' + PROJECT_ID) {
        console.warn('token verify failed: iss mismatch', claims && claims.iss);
        return null;
      }
    } catch (e) {
      console.warn('token verify failed: jwt decode', e && e.message);
      return null;
    }
    return { uid: u.localId, email: u.email || '', name: u.displayName || '', photo: u.photoUrl || '' };
  } catch (e) {
    console.warn('token verify error:', e && e.message);
    return null;
  }
}

async function getScore(DB, uid) {
  const row = await DB.prepare('SELECT wins, draws, losses, score, streak FROM scores WHERE uid = ?').bind(uid).first();
  return { w: row?.wins || 0, d: row?.draws || 0, l: row?.losses || 0, score: row?.score || 0, streak: row?.streak || 0 };
}

// +1 win, -1 loss, draw 0; +1 bonus every 3 consecutive wins; score floors at 0.
export function applyResult(score, streak, result) {
  if (result === 'w') {
    streak += 1;
    score += 1;
    if (streak % 3 === 0) score += 1;
  } else if (result === 'l') {
    streak = 0;
    score -= 1;
  } else {
    streak = 0;
  }
  return { score: Math.max(score, 0), streak };
}

async function computeAudit(DB, uid) {
  const g = await DB.prepare(
    "SELECT COALESCE(SUM(result = 'w'),0) AS w, COALESCE(SUM(result = 'd'),0) AS d, COALESCE(SUM(result = 'l'),0) AS l FROM games WHERE uid = ?"
  ).bind(uid).first();
  const s = await DB.prepare('SELECT wins, draws, losses, score FROM scores WHERE uid = ?').bind(uid).first();
  const rs = await DB.prepare('SELECT result FROM games WHERE uid = ? ORDER BY id').bind(uid).all();
  const games = { w: g?.w || 0, d: g?.d || 0, l: g?.l || 0, score: 0 };
  let replayStreak = 0;
  for (const r of rs.results || []) {
    const t = applyResult(games.score, replayStreak, r.result);
    games.score = t.score;
    replayStreak = t.streak;
  }
  const scores = { w: s?.wins || 0, d: s?.draws || 0, l: s?.losses || 0, score: s?.score || 0 };
  const consistent = games.w === scores.w && games.d === scores.d && games.l === scores.l && games.score === scores.score;
  const diff = {};
  if (!consistent) {
    for (const k of ['w', 'd', 'l', 'score']) if (games[k] !== scores[k]) diff[k] = { games: games[k], scores: scores[k] };
  }
  return { games, scores, consistent, diff };
}

const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

function findWinner(s) {
  for (const [a, b, c] of LINES) if (s[a] && s[a] === s[b] && s[a] === s[c]) return { p: s[a], line: [a, b, c] };
  return null;
}

// Server-side truth check of a stored game — can't be faked from the client.
export function validateGame(moves, hf, stored) {
  const hv = hf ? 'X' : 'O', av = hf ? 'O' : 'X';
  const first = hf ? hv : av;
  const board = Array(9).fill(null);
  let winIdx = -1, line = [];
  for (let i = 0; i < moves.length; i++) {
    const c = moves[i];
    if (!Number.isInteger(c) || c < 0 || c > 8) return 'illegal_moves';
    if (board[c]) return 'illegal_moves';
    board[c] = i % 2 === 0 ? first : (first === hv ? av : hv);
    const w = findWinner(board);
    if (w && winIdx < 0) {
      winIdx = i;
      line = w.line;
      if (i < moves.length - 1) return 'illegal_moves';
    }
  }
  let computed;
  if (winIdx >= 0) computed = board[line[0]] === hv ? 'w' : 'l';
  else if (board.every(Boolean)) computed = 'd';
  else return 'illegal_moves';
  return computed === stored ? 'ok' : 'result_mismatch';
}

function validateGameBody(b) {
  if (!b || typeof b !== 'object') return 'bad body';
  if (!['w', 'd', 'l'].includes(b.result)) return 'bad result';
  if (b.human_first !== 0 && b.human_first !== 1) return 'bad human_first';
  if (!Array.isArray(b.moves) || b.moves.length < 1 || b.moves.length > 9) return 'bad moves length';
  const seen = new Set();
  for (const c of b.moves) {
    if (!Number.isInteger(c) || c < 0 || c > 8) return 'bad cell';
    if (seen.has(c)) return 'duplicate cell';
    seen.add(c);
  }
  return null;
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);

    const user = await verifyAuth(req, env.FIREBASE_API_KEY);
    if (!user) return json({ error: 'unauthorized' }, 401);

    const { DB } = env;

    if (url.pathname === '/api/session' && req.method === 'POST') {
      await DB.prepare(
        `INSERT INTO users (uid, email, name, photo) VALUES (?, ?, ?, ?)
         ON CONFLICT(uid) DO UPDATE SET email = excluded.email, name = excluded.name, photo = excluded.photo, updated_at = datetime('now')`
      ).bind(user.uid, user.email, user.name, user.photo).run();
      const score = await getScore(DB, user.uid);
      const audit = await computeAudit(DB, user.uid);
      return json({ profile: { uid: user.uid, name: user.name, photo: user.photo, email: user.email }, score, audit });
    }

    if (url.pathname === '/api/game' && req.method === 'POST') {
      let b;
      try { b = await req.json(); } catch { return json({ error: 'bad json' }, 400); }
      const err = validateGameBody(b);
      if (err) return json({ error: err }, 400);
      const v = validateGame(b.moves, b.human_first, b.result);
      if (v !== 'ok') return json({ error: v }, 400);

      await DB.prepare(
        `INSERT INTO users (uid, email, name, photo) VALUES (?, ?, ?, ?)
         ON CONFLICT(uid) DO UPDATE SET updated_at = datetime('now')`
      ).bind(user.uid, user.email, user.name, user.photo).run();

      const prev = await DB.prepare('SELECT score, streak FROM scores WHERE uid = ?').bind(user.uid).first();
      const t = applyResult(prev?.score || 0, prev?.streak || 0, b.result);
      const inc = { w: [1, 0, 0], d: [0, 1, 0], l: [0, 0, 1] }[b.result];
      await DB.batch([
        DB.prepare('INSERT INTO games (uid, result, human_first, moves) VALUES (?, ?, ?, ?)')
          .bind(user.uid, b.result, b.human_first, JSON.stringify(b.moves)),
        DB.prepare(
          `INSERT INTO scores (uid, wins, draws, losses, score, streak) VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(uid) DO UPDATE SET wins = wins + excluded.wins, draws = draws + excluded.draws, losses = losses + excluded.losses, score = excluded.score, streak = excluded.streak`
        ).bind(user.uid, inc[0], inc[1], inc[2], t.score, t.streak)
      ]);
      const score = await getScore(DB, user.uid);
      const audit = await computeAudit(DB, user.uid);
      return json({ score, audit });
    }

    if (url.pathname === '/api/history' && req.method === 'GET') {
      const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '10', 10) || 10, 1), 50);
      const rs = await DB.prepare(
        'SELECT id, result, human_first, moves, created_at FROM games WHERE uid = ? ORDER BY id DESC LIMIT ?'
      ).bind(user.uid, limit).all();
      const games = (rs.results || []).map(r => ({
        id: r.id,
        result: r.result,
        human_first: r.human_first,
        moves: JSON.parse(r.moves),
        created_at: r.created_at
      }));
      return json({ games });
    }

    if (url.pathname === '/api/score/audit' && req.method === 'GET') {
      return json(await computeAudit(DB, user.uid));
    }

    if (url.pathname === '/api/admin/games' && req.method === 'GET') {
      const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '50', 10) || 50, 1), 200);
      const rs = await DB.prepare(
        `SELECT g.id, g.uid, g.result, g.human_first, g.moves, g.created_at, u.name, u.photo
         FROM games g JOIN users u ON u.uid = g.uid
         ORDER BY g.id DESC LIMIT ?`
      ).bind(limit).all();
      const games = (rs.results || []).map(r => {
        let moves;
        try { moves = JSON.parse(r.moves) } catch { moves = [] }
        return {
          id: r.id,
          uid: r.uid,
          name: r.name || '',
          photo: r.photo || '',
          result: r.result,
          human_first: r.human_first,
          moves,
          created_at: r.created_at,
          status: validateGame(moves, r.human_first, r.result)
        };
      });
      return json({ games });
    }

    if (url.pathname === '/api/leaderboard' && req.method === 'GET') {
      const rs = await DB.prepare(
        `SELECT u.name, u.photo, s.wins, s.draws, s.losses, s.score
         FROM scores s JOIN users u ON u.uid = s.uid
         ORDER BY s.score DESC, s.wins DESC, s.uid ASC LIMIT 10`
      ).all();
      return json({ top: rs.results || [] });
    }

    return json({ error: 'not found' }, 404);
  }
};
