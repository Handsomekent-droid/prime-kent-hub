// Unlinks every number, removes the profile row and deletes the Supabase user (needs SUPABASE_SERVICE_ROLE_KEY).
const { handler, bot, send, env } = require('./_lib');
module.exports = handler(['POST'], async (req, res, user) => {
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!key) return send(res, 500, { ok: false, msg: 'Account deletion is not enabled on this site (SUPABASE_SERVICE_ROLE_KEY missing).' });
  const r = await bot('/hub/delete', { method: 'POST', body: { id: 'all' }, user });
  if (r.status !== 200 && r.status !== 404) return send(res, r.status, r.data); // do not delete the account if the numbers could not be unlinked
  const h = { apikey: key, Authorization: `Bearer ${key}` };
  try { await fetch(`${env('SUPABASE_URL')}/rest/v1/profiles?id=eq.${user.id}`, { method: 'DELETE', headers: h, signal: AbortSignal.timeout(8000) }); } catch {}
  const d = await fetch(`${env('SUPABASE_URL')}/auth/v1/admin/users/${user.id}`, { method: 'DELETE', headers: h, signal: AbortSignal.timeout(8000) }).catch(() => null);
  if (!d || !d.ok) return send(res, 502, { ok: false, msg: 'Could not delete the account. Try again.' });
  send(res, 200, { ok: true });
});
