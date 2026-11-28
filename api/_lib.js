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

// How many extra pairing slots this user has earned by inviting friends.
// Every 5 confirmed referrals = +2 slots, capped at +20 bonus (10 default + 20 = 30 max, matching the bot's own ceiling).
async function referralBonus(req) {
  const auth = String(req.headers.authorization || '');
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token || !env('SUPABASE_URL') || !env('SUPABASE_ANON_KEY')) return 0;
  try {
    const r = await fetch(`${env('SUPABASE_URL')}/rest/v1/rpc/referral_count`, {
      method: 'POST',
      headers: { apikey: env('SUPABASE_ANON_KEY'), Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: '{}',
      signal: AbortSignal.timeout(8000)
    });
    if (!r.ok) return 0;
    const n = Number(await r.json()) || 0;
    return Math.min(20, Math.floor(n / 5) * 2);
  } catch { return 0; }
}

// Calls the bot's /hub/* API on the Pterodactyl server.
// `maxHeader`, when set, asks the bot to raise this user's pairing-slot cap (e.g. a referral reward).
// The bot clamps it itself (never below its own default, never above 30), so a bad value here is harmless.
async function bot(path, { method = 'GET', body, user, ip, admin, maxHeader } = {}) {
  const base = env('BOT_API_URL').replace(/\/+$/, '');
  if (!base || env('BOT_API_SECRET').length < 16) return { status: 500, data: { ok: false, msg: 'The website is not connected to the bot yet (BOT_API_URL / BOT_API_SECRET missing).' } };
  try {
    const r = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json', 'x-hub-secret': env('BOT_API_SECRET'), 'x-hub-user': user.id, 'x-hub-ip': ip || '', ...(admin ? { 'x-hub-admin': '1' } : {}), ...(maxHeader ? { 'x-hub-max': String(maxHeader) } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000)
    });
    let data; try { data = await r.json(); } catch { data = { ok: false, msg: 'Bad answer from the bot server.' }; }
    if (r.status === 401 || r.status === 403) return { status: 502, data: { ok: false, msg: 'The bot rejected the secret. BOT_API_SECRET on Vercel must be exactly the same as WEB_API_SECRET in the bot .env.' } };
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

// Admins are the e-mail addresses listed in the ADMIN_EMAILS variable on Vercel (comma separated).
const isAdmin = (user) => {
  const list = env('ADMIN_EMAILS').toLowerCase().split(',').map((x) => x.trim()).filter(Boolean);
  return !!(user && user.email && list.includes(String(user.email).toLowerCase()) && (user.email_confirmed_at || user.confirmed_at || (user.app_metadata && user.app_metadata.provider === 'google')));
};

// Supabase with the service-role key (admin page only — never reachable without isAdmin)
async function supa(path, { method = 'GET', body, prefer } = {}) {
  const base = env('SUPABASE_URL'), key = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!base || !key) return { ok: false, status: 500, data: { msg: 'SUPABASE_SERVICE_ROLE_KEY is missing on Vercel.' } };
  try {
    const r = await fetch(base + path, { method, headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', ...(prefer ? { Prefer: prefer } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(12000) });
    let data = null; try { data = await r.json(); } catch {}
    return { ok: r.ok, status: r.status, data };
  } catch { return { ok: false, status: 502, data: { msg: 'Supabase did not answer.' } }; }
}

module.exports = { env, send, getUser, clientIp, bot, handler, isAdmin, supa, referralBonus };
