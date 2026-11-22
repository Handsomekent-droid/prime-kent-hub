// Shared helpers for the Vercel serverless functions.
// Env (Vercel → Project → Settings → Environment Variables):
//   SUPABASE_URL, SUPABASE_ANON_KEY   — to verify the signed-in user
//   SUPABASE_SERVICE_ROLE_KEY         — only for "delete my account"
//   BOT_API_URL                       — e.g. http://123.45.67.89:25565   (your Pterodactyl allocation, or an https URL)
//   BOT_API_SECRET                    — the same long random text as WEB_API_SECRET in the bot's .env

const env = (k) => String(process.env[k] || '').trim();

function send(res, code, obj) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}

// Verifies the Supabase access token and returns the user, or null.
async function getUser(req) {
  const auth = String(req.headers.authorization || '');
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token || !env('SUPABASE_URL') || !env('SUPABASE_ANON_KEY')) return null;
  try {
    const r = await fetch(`${env('SUPABASE_URL')}/auth/v1/user`, { headers: { apikey: env('SUPABASE_ANON_KEY'), Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const u = await r.json();
    return u && /^[0-9a-f-]{36}$/i.test(u.id || '') ? u : null;
  } catch { return null; }
}

const clientIp = (req) => String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim().slice(0, 64);

// Calls the bot's /hub/* API on the Pterodactyl server.
async function bot(path, { method = 'GET', body, user, ip } = {}) {
  const base = env('BOT_API_URL').replace(/\/+$/, '');
  if (!base || env('BOT_API_SECRET').length < 16) return { status: 500, data: { ok: false, msg: 'The website is not connected to the bot yet (BOT_API_URL / BOT_API_SECRET missing).' } };
  try {
    const r = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json', 'x-hub-secret': env('BOT_API_SECRET'), 'x-hub-user': user.id, 'x-hub-ip': ip || '' },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000)
    });
    let data; try { data = await r.json(); } catch { data = { ok: false, msg: 'Bad answer from the bot server.' }; }
    return { status: r.status, data };
  } catch {
    return { status: 502, data: { ok: false, msg: 'The bot server is offline or unreachable. Please try again in a moment.' } };
  }
}

// small wrapper: method check + auth + JSON errors
const handler = (methods, fn) => async (req, res) => {
  try {
    if (!methods.includes(req.method)) return send(res, 405, { ok: false, msg: 'Method not allowed.' });
    const user = await getUser(req);
    if (!user) return send(res, 401, { ok: false, msg: 'Please sign in.' });
    await fn(req, res, user);
  } catch (e) {
    send(res, 500, { ok: false, msg: 'Server error.' });
  }
};

module.exports = { env, send, getUser, clientIp, bot, handler };
