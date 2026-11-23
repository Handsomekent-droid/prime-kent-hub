// /s/<code>  ->  redirect to the saved link (public). Uses only the anon key; counts the click.
const { env } = require('./_lib');
module.exports = async (req, res) => {
  const code = String((req.query && req.query.code) || '').trim();
  const back = (c, msg) => { res.statusCode = c; res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.setHeader('Cache-Control', 'no-store'); res.end(`<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><body style="font-family:system-ui;background:#07030f;color:#f4eeff;display:grid;place-items:center;min-height:100vh;text-align:center"><div><h1>${msg}</h1><p><a style="color:#c9a0ff" href="/">Prime Kent Dev Hub</a></p></div>`); };
  if (!/^[a-zA-Z0-9_-]{3,24}$/.test(code)) return back(404, 'Link not found');
  const base = env('SUPABASE_URL'), key = env('SUPABASE_ANON_KEY');
  if (!base || !key) return back(500, 'Not set up yet');
  try {
    const r = await fetch(`${base}/rest/v1/short_links?select=url&code=eq.${encodeURIComponent(code)}&limit=1`, { headers: { apikey: key, Authorization: 'Bearer ' + key }, signal: AbortSignal.timeout(8000) });
    const rows = r.ok ? await r.json() : [];
    const url = rows[0] && rows[0].url;
    if (!url || !/^https?:\/\//i.test(url)) return back(404, 'Link not found');
    await fetch(`${base}/rest/v1/rpc/link_click`, { method: 'POST', headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, body: JSON.stringify({ c: code }), signal: AbortSignal.timeout(2500) }).catch(() => {});
    res.statusCode = 302; res.setHeader('Location', url); res.setHeader('Cache-Control', 'no-store'); res.end();
  } catch { back(502, 'Try again in a moment'); }
};
